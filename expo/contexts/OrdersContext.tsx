import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { mockOrders, type Order, type OrderStatus, type OrderEvent, type OrderSnapshot, type PaymentProof } from '@/mocks/ordersData';
import { useAuth } from '@/contexts/AuthContext';

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
  // change rather than only at init.
  useEffect(() => {
    setOrders(seedOrdersFor(accountId));
  }, [accountId]);
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

  const addOrder = useCallback((order: Order) => {
    console.log(`[OrdersContext] Adding new order: ${order.id}`);
    setOrders((prev) => [order, ...prev]);
  }, []);

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
    console.log(`[OrdersContext] Payment proof added: ${orderId}`);
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
    currency: 'NGN',
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
