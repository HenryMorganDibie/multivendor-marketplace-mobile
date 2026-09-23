import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { mockOrders, type Order, type OrderStatus, type OrderEvent, type OrderSnapshot, type PaymentProof } from '@/mocks/ordersData';
import { useAuth } from '@/contexts/AuthContext';
import { auth, db, callable } from '@/lib/firebase';
import { mapOrderDoc } from '@/lib/orders/mapOrderDoc';
import { uploadPaymentProofImage } from '@/lib/orders/uploadPaymentProofImage';

/**
 * Uploads each local proof image to Storage, then submits the resulting
 * storagePaths in one submitPaymentProof call — one call per submission,
 * whatever the image count, matching the backend's one-doc-per-submission
 * model (MAX_SUBMISSIONS = 2). Never call submitPaymentProof once per image;
 * that would burn a submission per photo and lock the customer out after
 * one multi-photo "I've Paid" tap.
 */
async function uploadAndSubmitPaymentProof(
  orderId: string,
  vendorId: string,
  proofs: PaymentProof[],
  notes?: string,
): Promise<void> {
  const images = await Promise.all(
    proofs.map(async (p) => {
      const { storagePath } = await uploadPaymentProofImage(p.uri, vendorId, orderId);
      return { storagePath };
    })
  );
  const submit = callable<Record<string, unknown>, { success: true; proofId: string }>('submitPaymentProof');
  await submit({ orderId, images, notes });
}

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
  // 'in_progress' added: the real backend's vendor transition table allows
  // accepted -> in_progress directly (no vendor-reachable path ever sets a
  // real order to 'confirmed' -- markOrderPaid, the only caller that would,
  // is never invoked from the live UI), so this table used to reject the
  // one transition Mark In Progress actually needs before it ever reached
  // the network call.
  accepted: ['confirmed', 'in_progress', 'cancelled'],
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


/**
 * What the server says a basket costs.
 *
 * Every figure here is decided by the backend against the live catalogue: item
 * prices as they stand now, stock, and whichever promotion actually qualifies.
 * A discount named by a device is a request; this is the answer.
 */
export interface PricedCart {
  success: true;
  cartId: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  quantity: number;
  items: {
    itemId: string;
    name: string;
    quantity: number;
    price_at_order: number;
  }[];
  appliedPromotion: {
    promotionId: string;
    title: string;
    discountAmount: number;
  } | null;
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
   * The local-only half of a status change: validates the transition against
   * this device's cached order, then shapes the local Order object exactly
   * the way it always has (event history entry, per-status special-casing).
   * No network call lives here -- this is shared by two callers with
   * different network behavior (see below), so the local shaping logic
   * exists in exactly one place instead of being duplicated between them.
   */
  const applyStatusLocally = useCallback((
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

    return true;
  }, [orders, isValidTransition]);

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
   *
   * Not used by the five vendor order-detail actions (accept/reject/mark
   * in-progress/complete/cancel) as of Order-R1 -- those now await the real
   * callable themselves (data/api.ts) and apply the confirmed result via
   * applyConfirmedStatus below, so the optimistic-then-fire-and-forget
   * pattern here no longer runs for them. This function's own contract is
   * unchanged for its other callers (customer order cancellation, the vendor
   * chat screen's mark-in-progress action).
   */
  const updateOrderStatus = useCallback((
    orderId: string,
    newStatus: OrderStatus,
    reason?: string,
    reasonCode?: string,
    reasonText?: string
  ): boolean => {
    if (!applyStatusLocally(orderId, newStatus, reason, reasonCode, reasonText)) {
      return false;
    }

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
  }, [applyStatusLocally, accountId]);

  /**
   * Applies a status change the backend has *already* confirmed (Order-R1):
   * the same local shaping as updateOrderStatus, with no network call of its
   * own, since the caller has already awaited the real callable itself
   * (data/api.ts) before invoking this.
   *
   * The Firestore listener above is racing this call, because both are
   * driven by the same backend write: the listener can deliver the
   * authoritative snapshot (already at newStatus) before this mutation's own
   * onSuccess runs. When that happens the order is already sitting at the
   * confirmed target status, and ALLOWED_TRANSITIONS has no entry for a
   * status transitioning to itself -- isValidTransition would reject it as
   * illegal, mislabeling a confirmed backend success as an invalid
   * transition. That is reconciliation, not a new transition, so it is
   * checked and short-circuited here rather than in isValidTransition or
   * applyStatusLocally: updateOrderStatus's own callers still need every
   * real duplicate/illegal transition rejected exactly as before, and this
   * function is the only one reconciling an already-confirmed result rather
   * than initiating a change.
   */
  const applyConfirmedStatus = useCallback((
    orderId: string,
    newStatus: OrderStatus,
    reason?: string,
    reasonCode?: string,
    reasonText?: string
  ): boolean => {
    const order = orders.find((o) => o.id === orderId);
    if (order?.status === newStatus) return true;
    return applyStatusLocally(orderId, newStatus, reason, reasonCode, reasonText);
  }, [orders, applyStatusLocally]);

  /** Whether accountId is one of the built-in demo/local-test logins. */
  const isDemoOrderAccount = useCallback((id?: string): boolean => {
    return !!DEMO_ORDER_ACCOUNTS[id ?? ''];
  }, []);

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
   *
   * Returns a promise for the real outcome. review-order.tsx used to fire this
   * and immediately clear the cart and navigate to the success screen without
   * waiting — a real rejection (item went out of stock, vendor closed, price
   * changed) still showed the customer a success screen and an emptied cart
   * for an order that was never actually created, with only a console.error
   * anywhere. Callers that want the old fire-and-forget behaviour can still
   * ignore the returned promise.
   */
  const addOrder = useCallback((order: Order): Promise<{ success: boolean; error?: string; orderId?: string; publicOrderId?: string }> => {
    setOrders((prev) => [order, ...prev]);

    if (DEMO_ORDER_ACCOUNTS[accountId ?? '']) return Promise.resolve({ success: true });

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

    return reprice({
      vendorId: order.vendorId,
      // selectedAddOns was never sent at all — repriceCart.ts's per-item
      // add-on loop had nothing to iterate, so a selected add-on always
      // priced at 0 server-side regardless of the CartAddOn.groupId fix.
      items: order.items.map((i) => ({
        itemId: i.id,
        quantity: i.quantity,
        selectedAddOns: i.addOns?.map((a) => ({ groupId: a.groupId, optionId: a.id })) ?? [],
      })),
      fulfillmentType: order.fulfillmentType === 'Pickup' ? 'pickup' : 'delivery',
      orderNote: order.orderNote,
    })
      .then((priced) => create({ cartId: priced.data.cartId }))
      .then((created) => {
        // The listener now holds the authoritative row under the server's id.
        // Dropping the placeholder avoids the same order appearing twice.
        setOrders((prev) => prev.filter((o) => o.id !== order.id));
        // The real orderId used to be discarded here entirely (only
        // {success:true} was returned) — callers had no way to reference the
        // order the backend actually created, e.g. to attach a delivery
        // contact snapshot to it (submitDeliveryContact requires this exact
        // id, not the client-side placeholder passed into this function).
        return { success: true as const, orderId: created.data.orderId, publicOrderId: created.data.publicOrderId };
      })
      .catch((err) => {
        console.error('[Orders] createOrder rejected:', err);
        setOrders((prev) => prev.filter((o) => o.id !== order.id));
        const message = err instanceof Error ? err.message : 'Could not place your order.';
        return { success: false, error: message };
      });
  }, [accountId]);

  /**
   * submitDeliveryContact — attaches an order-scoped delivery contact
   * snapshot (fullName, phoneNumber, address) to a real order. Backend
   * (functions/src/orders/submitDeliveryContact.ts) validates ownership,
   * refuses a second call for the same order (already-exists), and never
   * logs the values in full. Safe to retry after a failed attempt: it only
   * rejects once a snapshot has already been *successfully* stored.
   */
  const submitDeliveryContact = useCallback(
    async (
      orderId: string,
      contact: { fullName: string; phoneNumber: string; address?: string },
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const submit = callable<
          { orderId: string; fullName: string; phoneNumber: string; address?: string },
          { success: true }
        >('submitDeliveryContact');
        await submit({ orderId, ...contact });
        return { success: true };
      } catch (err) {
        // A retry after a network drop can legitimately hit "already-exists"
        // if the first call actually succeeded server-side and only the
        // response was lost - that's not a failure, the data is safely
        // stored under this order. Only a genuine already-exists counts;
        // anything else is a real failure.
        const code = (err as { code?: string })?.code;
        if (code === 'already-exists' || code === 'functions/already-exists') {
          return { success: true };
        }
        console.error('[Orders] submitDeliveryContact failed:', err);
        const message = err instanceof Error ? err.message : 'Could not save delivery details.';
        return { success: false, error: message };
      }
    },
    [],
  );

  /**
   * getOrderDeliveryContact — the ONLY sanctioned way to read the actual
   * fullName/phoneNumber/address of an order's delivery contact. Calls the
   * real getOrderDetails callable, which strips deliveryContact from the
   * response once the order is terminal (vendor side only — a customer
   * reading their own order always gets it back). Deliberately not derived
   * from the live orders listener/mapOrderDoc: that pipeline is shared by
   * both customer and vendor screens and has no concept of terminal-status
   * expiry, so exposing the raw field there would let a vendor's order
   * screen bypass the expiry this callable enforces.
   */
  const getOrderDeliveryContact = useCallback(
    async (
      orderId: string,
    ): Promise<{ deliveryContact: { fullName: string; phoneNumber: string; address?: string | null; submittedAt?: unknown } | null; expired: boolean }> => {
      try {
        const getDetails = callable<
          { orderId: string },
          { success: true; order: Record<string, unknown> }
        >('getOrderDetails');
        const res = await getDetails({ orderId });
        const order = res.data.order;
        return {
          deliveryContact: (order.deliveryContact as { fullName: string; phoneNumber: string; address?: string | null } | undefined) ?? null,
          expired: Boolean(order.deliveryContactExpired),
        };
      } catch (err) {
        console.error('[Orders] getOrderDetails (delivery contact) failed:', err);
        return { deliveryContact: null, expired: false };
      }
    },
    [],
  );


  /**
   * priceCart — what the customer will actually be charged, decided by the
   * server, before they commit to anything.
   *
   * repriceCart was already called, but only on submit and with its result
   * discarded: the customer approved a total the device had worked out, and the
   * server priced it afterwards. If the two disagreed — a price changed, an
   * item went out of stock, a promotion expired — the customer had already
   * tapped submit on a figure that was never real.
   *
   * Calling it before checkout means the amount on screen is the amount the
   * server will stand behind. It returns the promotion it actually applied
   * rather than accepting one named by the client, which is the whole point:
   * a discount a device claims is a request, not a price.
   *
   * The cartId comes back so the order is created from the priced cart rather
   * than repriced a second time, which would let the two calls disagree.
   */
  const priceCart = useCallback(async (input: {
    vendorId: string;
    items: { itemId: string; quantity: number; selectedAddOns?: { groupId: string; optionId: string }[] }[];
    fulfillmentType: 'pickup' | 'delivery' | 'shipping';
    orderNote?: string;
  }): Promise<PricedCart> => {
    const reprice = callable<Record<string, unknown>, PricedCart>('repriceCart');
    const res = await reprice({
      vendorId: input.vendorId,
      items: input.items,
      fulfillmentType: input.fulfillmentType,
      orderNote: input.orderNote ?? null,
    });
    return res.data;
  }, []);

  const markCustomerPaid = useCallback(async (orderId: string, proofs?: PaymentProof[]): Promise<boolean> => {
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

    // The vendor has to see the proof to review it, so it cannot stay on the
    // customer's device. Uploads each image to Storage first, then submits
    // the real storagePaths — submitPaymentProof rejects any payload without
    // one. Demo orders have no backend order to attach this to.
    //
    // This used to be fired with `void ... .catch(console.error)` and return
    // true regardless — the customer saw "marked paid" succeed even when the
    // real upload/submission failed silently in the background (a rejected
    // image, a network drop, hitting the 2-attempt lockout), with no way to
    // know their payment was never actually recorded. Now awaited: a real
    // failure rolls the optimistic update back to its pre-call state and
    // reports failure to the caller, instead of lying about success.
    if (!DEMO_ORDER_ACCOUNTS[accountId ?? ''] && proofs && proofs.length > 0) {
      try {
        await uploadAndSubmitPaymentProof(orderId, order.vendorId, proofs);
      } catch (err) {
        console.error('[Orders] submitPaymentProof rejected:', err);
        setOrders((prev) => prev.map((o) => (o.id === orderId ? order : o)));
        throw err;
      }
    }
    return true;
  }, [orders, accountId]);

  const addPaymentProof = useCallback(async (orderId: string, proof: PaymentProof): Promise<boolean> => {
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

    // Same upload-then-submit path as markCustomerPaid, for the "upload
    // proof later" flow — one image, one submission. Same silent-failure fix
    // as above: awaited, rolled back and reported on real rejection.
    if (!DEMO_ORDER_ACCOUNTS[accountId ?? '']) {
      try {
        await uploadAndSubmitPaymentProof(orderId, order.vendorId, [proof]);
      } catch (err) {
        console.error('[Orders] submitPaymentProof rejected:', err);
        setOrders((prev) => prev.map((o) => (o.id === orderId ? order : o)));
        throw err;
      }
    }
    return true;
  }, [orders, accountId]);

  const vendorConfirmPayment = useCallback(async (orderId: string, proofId?: string): Promise<boolean> => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      console.error(`[OrdersContext] Order not found for vendorConfirmPayment: ${orderId}`);
      return false;
    }
    if (order.paymentState !== 'CUSTOMER_MARKED_PAID') {
      console.error(`[OrdersContext] Cannot confirm: payment state is ${order.paymentState}`);
      return false;
    }

    // A real order can only be confirmed through reviewPaymentProof, which
    // requires an actual paymentProofs document — there is nothing for the
    // vendor to be "confirming" without one. This used to fall through to a
    // fake local success with no backend call at all whenever proofId was
    // missing (listener hadn't resolved yet, or the customer's "marked
    // paid" state was itself never backed by a real submission), which is
    // exactly what let the UI flash confirmed and then revert with nothing
    // ever persisted.
    const isDemo = DEMO_ORDER_ACCOUNTS[accountId ?? ''];
    if (!proofId && !isDemo) {
      console.error(`[OrdersContext] Cannot confirm payment: no payment proof document for order ${orderId}`);
      return false;
    }

    const now = new Date().toISOString();
    const newEvent: OrderEvent = {
      eventType: 'payment_confirmed',
      actor: { type: 'vendor', name: order.vendorName },
      timestamp: now,
      message: `${order.vendorName} confirmed payment.`,
    };

    // Only paymentState is set optimistically, and only because it is
    // exactly what mapOrderDoc's toPaymentState() derives from the real
    // paymentStatus ('PROOF_ACCEPTED') once Firestore's own update lands —
    // so there is nothing here for that later snapshot to contradict.
    // status and paymentStatus are NOT touched: reviewPaymentProof never
    // sets order.status to 'confirmed' (that value is not reachable through
    // the real order-status state machine) and never writes a
    // 'payment_received' paymentStatus (the real enum is PROOF_ACCEPTED) —
    // writing either here was exactly the mismatch that made the backend's
    // own snapshot immediately overwrite this optimistic update.
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const snapshot = buildOrderSnapshot(o);
        return {
          ...o,
          paymentState: 'VENDOR_PAYMENT_CONFIRMED' as const,
          orderSnapshot: snapshot,
          eventHistory: [...(o.eventHistory ?? []), { ...newEvent, receiptSnapshot: snapshot }],
        };
      })
    );
    console.log(`[OrdersContext] Vendor confirmed payment: ${orderId}`);

    // Same silent-failure fix as markCustomerPaid/addPaymentProof: this used
    // to fire reviewPaymentProof with `void ... .catch(console.error)` and
    // return true unconditionally — the vendor saw "confirmed" even if the
    // real call was rejected (a stale proofId, a permission mismatch, a race
    // with the customer's own submission). Now awaited, with the optimistic
    // update rolled back and the failure reported if it actually fails.
    if (proofId && !isDemo) {
      const review = callable<Record<string, unknown>, { success: true }>('reviewPaymentProof');
      try {
        await review({ orderId, proofId, decision: 'accept' });
      } catch (err) {
        console.error('[Orders] reviewPaymentProof (accept) rejected:', err);
        setOrders((prev) => prev.map((o) => (o.id === orderId ? order : o)));
        throw err;
      }
    }
    return true;
  }, [orders, accountId]);

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

  const vendorMarkNotPaid = useCallback(async (orderId: string, proofId?: string): Promise<boolean> => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      console.error(`[OrdersContext] Order not found for vendorMarkNotPaid: ${orderId}`);
      return false;
    }
    if (order.paymentState !== 'CUSTOMER_MARKED_PAID') {
      console.error(`[OrdersContext] Cannot mark not paid: payment state is ${order.paymentState}`);
      return false;
    }

    const isDemo = DEMO_ORDER_ACCOUNTS[accountId ?? ''];
    if (!proofId && !isDemo) {
      console.error(`[OrdersContext] Cannot mark not paid: no payment proof document for order ${orderId}`);
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

    // Same silent-failure fix as vendorConfirmPayment's accept path.
    if (proofId && !DEMO_ORDER_ACCOUNTS[accountId ?? '']) {
      const review = callable<Record<string, unknown>, { success: true }>('reviewPaymentProof');
      try {
        await review({
          orderId,
          proofId,
          decision: 'reject',
          reviewReason: 'Vendor marked payment as not received.',
        });
      } catch (err) {
        console.error('[Orders] reviewPaymentProof (reject) rejected:', err);
        setOrders((prev) => prev.map((o) => (o.id === orderId ? order : o)));
        throw err;
      }
    }
    return true;
  }, [orders, accountId]);

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
    applyConfirmedStatus,
    isDemoOrderAccount,
    addVendorEvent,
    addOrder,
    priceCart,
    markCustomerPaid,
    addPaymentProof,
    vendorConfirmPayment,
    vendorRequestPaymentProof,
    vendorMarkNotPaid,
    TERMINAL_STATUSES,
    setOrderPendingChanges,
    hasOrderPendingChanges,
    markOrderRated,
    submitDeliveryContact,
    getOrderDeliveryContact,
  }), [orders, getOrder, isValidTransition, updateOrderStatus, applyConfirmedStatus, isDemoOrderAccount, addVendorEvent, addOrder, priceCart, markCustomerPaid, addPaymentProof, vendorConfirmPayment, vendorRequestPaymentProof, vendorMarkNotPaid, setOrderPendingChanges, hasOrderPendingChanges, markOrderRated, submitDeliveryContact, getOrderDeliveryContact]);
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
