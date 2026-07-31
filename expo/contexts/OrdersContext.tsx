import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { mockOrders, type Order, type OrderStatus, type OrderEvent, type OrderSnapshot, type PaymentProof } from '@/mocks/ordersData';
import { useAuth } from '@/contexts/AuthContext';
import { auth, db, callable } from '@/lib/firebase';
import { mapOrderDoc } from '@/lib/orders/mapOrderDoc';

/**
 * The transitions this app will attempt.
 *
 * These are wider than the backend's, and deliberately left that way rather
 * than narrowed to match, because the two tables answer different questions.
 * This one decides which buttons a screen offers; the server decides what is
 * actually allowed, per role, and refuses anything else.
 *
 * The gaps are worth knowing, because a button that leads to a server refusal
 * is a bug the user experiences:
 *
 *   'confirmed' and 'awaiting_customer_update' have no vendor transition on the
 *   backend at all. Its vendor path is requested → accepted → in_progress →
 *   completed. Offering a vendor a "confirm" action would call updateOrderStatus
 *   and be refused with "Vendors cannot transition from accepted to confirmed".
 *
 *   'cancelled' is a customer action from requested or accepted, never a vendor
 *   one. A vendor cancelling is a rejection.
 *
 * Narrowing this table is not a one-line change: several screens branch on these
 * states, and cutting them here would silently remove actions from those screens
 * rather than fix them. Recorded here so the next person to touch order status
 * knows the app is the permissive side, not the authority.
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  requested: ['accepted', 'rejected', 'cancelled', 'expired'],
  accepted: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['awaiting_customer_update', 'completed', 'cancelled'],
  awaiting_customer_update: ['in_progress', 'completed', 'cancelled'],
  completed: [],
  rejected: [],
  cancelled: [],
  expired: [],
};

const TERMINAL_STATUSES: OrderStatus[] = ['completed', 'rejected', 'cancelled', 'expired'];

/**
 * Orders are still seeded demo data rather than Firestore, and those orders all
 * belong to the built-in demo vendors. Handing them to whoever is signed in
 * meant a vendor who registered a minute ago opened their dashboard to other
 * people's orders, other people's customers and revenue they had never earned.
 *
 * The seed is therefore scoped to the accounts it was written for. Nothing ever
 * signs in *as* 'v1' (that id exists only inside the mock data), so the local
 * test logins are mapped onto it, otherwise the demo orders would be
 * unreachable for everyone. A real Firebase uid matches nothing and starts
 * empty, which is both accurate for a new vendor and what the Firestore
 * listener will produce once orders are wired.
 */
const DEMO_ORDER_ACCOUNTS: Record<string, string> = {
  '2': 'v1', // vendor@test.com
  v1: 'v1',
};

function seedOrdersFor(accountId: string | undefined): Order[] {
  if (!accountId) return [];
  const demoVendorId = DEMO_ORDER_ACCOUNTS[accountId];
  return demoVendorId ? mockOrders.filter((o) => o.vendorId === demoVendorId) : [];
}

export const [OrdersProvider, useOrders] = createContextHook(() => {
  const { user } = useAuth();
  const accountId = user?.id;

  const [orders, setOrders] = useState<Order[]>(() => seedOrdersFor(accountId));

  // Auth resolves after the first render, and the signed-in account changes
  // without this provider unmounting, so the seed is re-evaluated on identity
  // change rather than only at init. This only ever produces anything for the
  // built-in demo logins; a real Firebase account gets an empty list here and
  // is then filled by the listener below.
  useEffect(() => {
    setOrders(seedOrdersFor(accountId));
  }, [accountId]);

  /**
   * Live orders for whoever is signed in.
   *
   * Two different queries, because the rules allow two different reads: a
   * customer may read orders where customerId is their uid, a vendor may read
   * orders where vendorId matches their claim. Querying the wrong field returns
   * a permission error rather than an empty list, so the role has to be decided
   * before the query is built.
   *
   * On failure the list is emptied rather than left showing the seed. A vendor
   * acting on an order that does not exist is worse than a vendor seeing none.
   */
  useEffect(() => {
    let unsubscribeOrders: (() => void) | null = null;

    const unsubscribeAuth = auth.onIdTokenChanged(async (fbUser) => {
      unsubscribeOrders?.();
      unsubscribeOrders = null;

      if (!fbUser) return;
      const token = await fbUser.getIdTokenResult();
      const role = token.claims.role as string | undefined;
      const vendorId = token.claims.vendorId as string | undefined;

      const ordersQuery =
        role === 'vendor' && vendorId
          ? query(collection(db, 'orders'), where('vendorId', '==', vendorId))
          : query(collection(db, 'orders'), where('customerId', '==', fbUser.uid));

      unsubscribeOrders = onSnapshot(
        ordersQuery,
        (snap) => {
          setOrders(snap.docs.map((d) => mapOrderDoc(d.id, d.data())));
        },
        (err) => {
          console.error('[Orders] Live subscription failed:', err);
          setOrders([]);
        },
      );
    });

    return () => {
      unsubscribeOrders?.();
      unsubscribeAuth();
    };
  }, []);
  const [orderPendingChanges, setOrderPendingChangesState] = useState<Record<string, boolean>>({});

  const getOrder = useCallback((id: string): Order | undefined => {
    return orders.find((o) => o.id === id);
  }, [orders]);

  const isValidTransition = useCallback((from: OrderStatus, to: OrderStatus): boolean => {
    if (TERMINAL_STATUSES.includes(from)) {
      console.log(`[OrdersContext] Blocked: ${from} is a terminal state`);
      return false;
    }
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    return allowed.includes(to);
  }, []);

  /**
   * Moves an order to a new status.
   *
   * The backend is the authority here. updateOrderStatus on the server checks
   * the transition against its own state machine, checks the caller actually
   * owns the order, writes the status inside a transaction, and applies the side
   * effects: releasing reserved stock on a cancellation, counting the sale and
   * generating a receipt on completion. None of that can be done from the app.
   *
   * The local update below stays as an optimistic one. The Firestore listener
   * will overwrite it with the real document a moment later, so this exists only
   * so the row does not sit still for a round trip. If the call fails, the
   * listener's next snapshot puts the old status back.
   *
   * The signature stays synchronous and boolean-returning because eighteen
   * screens call it that way. It reports whether the transition was *accepted*
   * for sending, not whether the server has finished applying it.
   */
  const updateOrderStatus = useCallback((
    orderId: string,
    newStatus: OrderStatus,
    reason?: string,
    reasonCode?: string,
    reasonText?: string
  ): boolean => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      console.error(`[OrdersContext] Order not found: ${orderId}`);
      return false;
    }

    if (!isValidTransition(order.status, newStatus)) {
      console.error(`[OrdersContext] Invalid transition: ${order.status} → ${newStatus} for order ${orderId}`);
      return false;
    }

    const newEvent: OrderEvent = buildStatusChangeEvent(newStatus, order.vendorName, reason);

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;

        const updated: Order = {
          ...o,
          status: newStatus,
          eventHistory: [...(o.eventHistory ?? []), newEvent],
        };

        if (newStatus === 'confirmed') {
          const snapshot = buildOrderSnapshot(o);
          updated.orderSnapshot = snapshot;
          const history = updated.eventHistory ?? [];
          const paymentEvent = history[history.length - 1];
          if (paymentEvent && paymentEvent.eventType === 'payment_confirmed') {
            updated.eventHistory = [
              ...history.slice(0, -1),
              { ...paymentEvent, receiptSnapshot: snapshot },
            ];
          }
        }
        if (newStatus === 'completed') {
          updated.completedBy = 'vendor';
          updated.completedAt = new Date().toISOString();
        }
        if (newStatus === 'rejected' && reason) {
          updated.rejectionReason = reason;
        }
        if (newStatus === 'cancelled') {
          if (reason) updated.cancellationReason = reason;
          if (reasonCode) updated.cancellationReasonCode = reasonCode;
          if (reasonText) updated.cancellationReasonText = reasonText;
        }

        return updated;
      })
    );

    // Demo logins exist only in local seed data and have no backend order to
    // update, so the optimistic write is the whole story for them.
    if (!DEMO_ORDER_ACCOUNTS[accountId ?? '']) {
      const send = callable<
        { orderId: string; newStatus: string; reason?: string },
        { success: true }
      >('updateOrderStatus');
      void send({ orderId, newStatus, reason: reason ?? reasonText })
        .catch((err) => {
          // Deliberately not reverting by hand. The listener is the source of
          // truth and its next snapshot restores whatever the server actually
          // holds, which is more reliable than guessing the prior state here.
          console.error('[Orders] Status update rejected by the backend:', err);
        });
    }

    console.log(`[OrdersContext] Status updated: ${orderId} → ${newStatus}`);
    return true;
  }, [orders, isValidTransition]);

  const addVendorEvent = useCallback((
    orderId: string,
    event: Omit<OrderEvent, 'timestamp'>
  ): boolean => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      console.error(`[OrdersContext] Order not found for event: ${orderId}`);
      return false;
    }

    if (!['confirmed', 'in_progress'].includes(order.status)) {
      console.error(`[OrdersContext] Vendor events only allowed in confirmed/in_progress. Current: ${order.status}`);
      return false;
    }

    const newEvent: OrderEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          eventHistory: [...(o.eventHistory ?? []), newEvent],
        };
      })
    );

    console.log(`[OrdersContext] Vendor event added: ${orderId} type=${event.eventType}`);
    return true;
  }, [orders]);

  /**
   * Places a real order.
   *
   * createOrder on the server does the work that cannot be trusted to a client:
   * it reprices every line against the live catalogue, refuses items that are
   * hidden or still under moderation, reserves stock inside a transaction, and
   * allocates the public order number. A client-side total is a suggestion; the
   * server's is the price.
   *
   * The optimistic row is inserted first so the screen moves immediately, then
   * replaced by the real document when the listener fires. It carries the
   * client-side id, which the server will not reuse, so the temporary row is
   * removed rather than left as a duplicate alongside the real one.
   */
  const addOrder = useCallback((order: Order) => {
    setOrders((prev) => [order, ...prev]);

    if (DEMO_ORDER_ACCOUNTS[accountId ?? '']) return;

    // Two steps, because the backend deliberately splits them. repriceCart
    // prices the basket against the live catalogue and persists it, returning a
    // cartId; createOrderFromCart then turns that priced cart into an order.
    // The order is never built from client-supplied prices, which is the point:
    // a total that arrived from a device is a suggestion, not a price.
    const reprice = callable<
      Record<string, unknown>,
      { success: true; cartId: string; total: number }
    >('repriceCart');
    const create = callable<
      { cartId: string },
      { success: true; orderId: string; publicOrderId: string }
    >('createOrderFromCart');

    void reprice({
      vendorId: order.vendorId,
      items: order.items.map((i) => ({ itemId: i.id, quantity: i.quantity })),
      fulfillmentType: order.fulfillmentType === 'Pickup' ? 'pickup' : 'delivery',
      orderNote: order.orderNote,
    })
      .then((priced) => create({ cartId: priced.data.cartId }))
      .then(() => {
        // The listener now holds the authoritative row under the server's id.
        // Dropping the placeholder avoids the same order appearing twice.
        setOrders((prev) => prev.filter((o) => o.id !== order.id));
      })
      .catch((err) => {
        console.error('[Orders] createOrder rejected:', err);
        setOrders((prev) => prev.filter((o) => o.id !== order.id));
      });
  }, [accountId]);

  const markCustomerPaid = useCallback((orderId: string, proofs?: PaymentProof[]): boolean => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      console.error(`[OrdersContext] Order not found for markCustomerPaid: ${orderId}`);
      return false;
    }
    if (order.status !== 'accepted') {
      console.error(`[OrdersContext] Cannot mark paid: order status is ${order.status}, expected accepted`);
      return false;
    }
    if (order.paymentState === 'CUSTOMER_MARKED_PAID' || order.paymentState === 'VENDOR_PAYMENT_CONFIRMED') {
      console.error(`[OrdersContext] Already marked as paid or confirmed`);
      return false;
    }

    const now = new Date().toISOString();
    const newEvent: OrderEvent = {
      eventType: 'payment_confirmed',
      actor: { type: 'customer', name: order.customerName || 'Customer' },
      timestamp: now,
      message: `${order.customerName || 'Customer'} marked payment as completed.`,
    };

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          paymentState: 'CUSTOMER_MARKED_PAID' as const,
          customerMarkedPaidAt: now,
          paymentProof: proofs && proofs.length > 0 ? proofs : o.paymentProof,
          eventHistory: [...(o.eventHistory ?? []), newEvent],
        };
      })
    );
    console.log(`[OrdersContext] Customer marked paid: ${orderId}`);
    return true;
  }, [orders]);

  const addPaymentProof = useCallback((orderId: string, proof: PaymentProof): boolean => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      console.error(`[OrdersContext] Order not found for addPaymentProof: ${orderId}`);
      return false;
    }
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          paymentProof: [...(o.paymentProof ?? []), proof],
        };
      })
    );

    // The vendor has to see the proof to review it, so it cannot stay on the
    // customer's device. submitPaymentProof records it against the order and
    // notifies the vendor.
    if (!DEMO_ORDER_ACCOUNTS[accountId ?? '']) {
      const submit = callable<Record<string, unknown>, { success: true }>('submitPaymentProof');
      void submit({
        orderId,
        proofType: proof.type,
        proofUrl: proof.uri,
      }).catch((err) => {
        console.error('[Orders] submitPaymentProof rejected:', err);
      });
    }
    return true;
  }, [orders]);

  const vendorConfirmPayment = useCallback((orderId: string): boolean => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      console.error(`[OrdersContext] Order not found for vendorConfirmPayment: ${orderId}`);
      return false;
    }
    if (order.paymentState !== 'CUSTOMER_MARKED_PAID') {
      console.error(`[OrdersContext] Cannot confirm: payment state is ${order.paymentState}`);
      return false;
    }

    const now = new Date().toISOString();
    const newEvent: OrderEvent = {
      eventType: 'payment_confirmed',
      actor: { type: 'vendor', name: order.vendorName },
      timestamp: now,
      message: `${order.vendorName} confirmed payment.`,
    };

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const snapshot = buildOrderSnapshot(o);
        return {
          ...o,
          status: 'confirmed' as OrderStatus,
          paymentState: 'VENDOR_PAYMENT_CONFIRMED' as const,
          paymentStatus: 'payment_received' as const,
          amountPaid: o.total,
          orderSnapshot: snapshot,
          eventHistory: [...(o.eventHistory ?? []), { ...newEvent, receiptSnapshot: snapshot }],
        };
      })
    );
    console.log(`[OrdersContext] Vendor confirmed payment: ${orderId}`);
    return true;
  }, [orders]);

  const vendorRequestPaymentProof = useCallback((orderId: string): boolean => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      console.error(`[OrdersContext] Order not found for vendorRequestPaymentProof: ${orderId}`);
      return false;
    }
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          vendorPaymentProofRequested: true,
          vendorPaymentProofRequestedAt: new Date().toISOString(),
        };
      })
    );
    console.log(`[OrdersContext] Vendor requested payment proof: ${orderId}`);
    return true;
  }, [orders]);

  const vendorMarkNotPaid = useCallback((orderId: string): boolean => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      console.error(`[OrdersContext] Order not found for vendorMarkNotPaid: ${orderId}`);
      return false;
    }
    if (order.paymentState !== 'CUSTOMER_MARKED_PAID') {
      console.error(`[OrdersContext] Cannot mark not paid: payment state is ${order.paymentState}`);
      return false;
    }

    const now = new Date().toISOString();
    const newEvent: OrderEvent = {
      eventType: 'payment_confirmed',
      actor: { type: 'vendor', name: order.vendorName },
      timestamp: now,
      message: `${order.vendorName} marked payment as not received.`,
    };

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          paymentState: 'PAYMENT_REJECTED' as const,
          eventHistory: [...(o.eventHistory ?? []), newEvent],
        };
      })
    );
    console.log(`[OrdersContext] Vendor marked not paid: ${orderId}`);
    return true;
  }, [orders]);

  const setOrderPendingChanges = useCallback((orderId: string, hasPending: boolean) => {
    setOrderPendingChangesState(prev => ({ ...prev, [orderId]: hasPending }));
  }, []);

  const hasOrderPendingChanges = useCallback((orderId: string): boolean => {
    return !!orderPendingChanges[orderId];
  }, [orderPendingChanges]);

  const markOrderRated = useCallback((orderId: string) => {
    console.log(`[OrdersContext] Marking order as rated: ${orderId}`);
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, hasRating: true } : o))
    );
  }, []);

  return useMemo(() => ({
    orders,
    getOrder,
    isValidTransition,
    updateOrderStatus,
    addVendorEvent,
    addOrder,
    markCustomerPaid,
    addPaymentProof,
    vendorConfirmPayment,
    vendorRequestPaymentProof,
    vendorMarkNotPaid,
    TERMINAL_STATUSES,
    setOrderPendingChanges,
    hasOrderPendingChanges,
    markOrderRated,
  }), [orders, getOrder, isValidTransition, updateOrderStatus, addVendorEvent, addOrder, markCustomerPaid, addPaymentProof, vendorConfirmPayment, vendorRequestPaymentProof, vendorMarkNotPaid, setOrderPendingChanges, hasOrderPendingChanges, markOrderRated]);
});

function buildOrderSnapshot(order: Order): OrderSnapshot {
  return {
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price_at_order: item.price,
      addOns: item.addOns?.map((a) => ({ id: a.id, name: a.name, price: a.price })),
    })),
    notes: order.orderNote,
    subtotal_at_order: order.subtotal,
    // The order's own currency, not a fixed one. The backend sets this from the
    // vendor's country when the cart is priced, so a vendor outside Nigeria had
    // their receipt snapshot stamped NGN over whatever they actually charged.
    // Falling back to NGN only when an order genuinely carries none, which is
    // the seeded demo data.
    currency: order.currency ?? 'NGN',
    fulfillmentType: order.fulfillmentType,
    scheduledDate: order.scheduledDate,
    scheduledTime: order.scheduledTime,
    createdAt: order.orderDate,
  };
}

function buildStatusChangeEvent(
  newStatus: OrderStatus,
  vendorName: string,
  reason?: string
): OrderEvent {
  const now = new Date().toISOString();

  switch (newStatus) {
    case 'accepted':
      return {
        eventType: 'order_accepted',
        actor: { type: 'vendor', name: vendorName },
        timestamp: now,
        message: `${vendorName} accepted your order request.`,
      };
    case 'rejected':
      return {
        eventType: 'order_rejected',
        actor: { type: 'vendor', name: vendorName },
        timestamp: now,
        message: `${vendorName} declined your order request.${reason ? ` Reason: ${reason}` : ''}`,
      };
    case 'confirmed':
      return {
        eventType: 'payment_confirmed',
        actor: { type: 'vendor', name: vendorName },
        timestamp: now,
        message: `${vendorName} confirmed payment.`,
      };
    case 'in_progress':
      return {
        eventType: 'order_in_progress',
        actor: { type: 'vendor', name: vendorName },
        timestamp: now,
        message: `${vendorName} is currently fulfilling your order.`,
      };
    case 'completed':
      return {
        eventType: 'order_completed',
        actor: { type: 'vendor', name: vendorName },
        timestamp: now,
        message: `${vendorName} marked this order as completed.`,
      };
    case 'cancelled':
      return {
        eventType: 'order_cancelled',
        actor: { type: 'system', name: vendorName },
        timestamp: now,
        message: reason ? `${vendorName} cancelled this order. Reason: ${reason}` : `This order has been cancelled.`,
      };
    case 'expired':
      return {
        eventType: 'order_expired',
        actor: { type: 'system', name: 'System' },
        timestamp: now,
        message: `This order request expired because ${vendorName} did not respond in time.`,
      };
    default:
      return {
        eventType: 'order_placed',
        actor: { type: 'system', name: 'System' },
        timestamp: now,
      };
  }
}
