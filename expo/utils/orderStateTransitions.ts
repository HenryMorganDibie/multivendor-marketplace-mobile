import type { OrderStatus } from '@/constants/orderStatus';

export type FulfillmentMethod = 'pickup' | 'delivery' | 'shipping';

/**
 * Mirrors the backend's transitions exactly.
 *
 * This had `accepted -> confirmed -> in_progress`, and the backend has
 * `accepted -> in_progress`. `confirmed` appears in the backend's status union
 * and in ACTIVE_ORDER_STATUSES, but no transition in updateOrderStatus ever
 * produces it — it is unreachable there. So a vendor could be shown a Confirmed
 * step, tap it, and have the server refuse a transition it does not define.
 *
 * "Payment confirmed" is a real thing, and it is a payment state, not an
 * operational one. It belongs alongside the order status, not instead of it:
 * an order can read Accepted with payment Confirmed. Mixing them meant a screen
 * showing Confirmed while the server thought the order was merely accepted.
 *
 * Backend source: VENDOR_TRANSITIONS in functions/src/orders/updateOrderStatus.ts.
 * If a status is added there, it is added here, not the other way round.
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  requested: ['accepted', 'rejected', 'cancelled', 'expired'],
  accepted: ['in_progress', 'rejected', 'cancelled'],
  // Kept only so an order written before this correction still renders and can
  // be moved on. Nothing transitions *into* it any more.
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['awaiting_customer_update', 'completed', 'cancelled'],
  awaiting_customer_update: ['in_progress', 'completed', 'cancelled'],
  completed: [],
  rejected: [],
  cancelled: [],
  expired: [],
};

const TERMINAL_STATUSES: OrderStatus[] = ['completed', 'rejected', 'cancelled', 'expired'];

const CANCELLABLE_STATUSES: OrderStatus[] = ['requested', 'accepted', 'confirmed', 'in_progress'];

// Backend Enforced Rule — UI Display Only
export function isValidTransition(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
  _fulfillmentMethod?: FulfillmentMethod
): boolean {
  if (TERMINAL_STATUSES.includes(fromStatus)) return false;
  const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];
  return allowed.includes(toStatus);
}

// Backend Enforced Rule — UI Display Only
export function getNextAllowedStatuses(
  currentStatus: OrderStatus,
  _fulfillmentMethod?: FulfillmentMethod
): OrderStatus[] {
  if (TERMINAL_STATUSES.includes(currentStatus)) return [];
  return ALLOWED_TRANSITIONS[currentStatus] ?? [];
}

export function isTerminalStatus(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function isCancellable(status: OrderStatus): boolean {
  return CANCELLABLE_STATUSES.includes(status);
}

export function getInvalidTransitionMessage(
  fromStatus: OrderStatus,
  toStatus: OrderStatus
): string {
  if (TERMINAL_STATUSES.includes(fromStatus)) {
    return `Order is in terminal state "${fromStatus}" and cannot be changed.`;
  }
  const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];
  if (!allowed.includes(toStatus)) {
    return `Cannot transition from "${fromStatus}" to "${toStatus}". Allowed: ${allowed.join(', ') || 'none'}.`;
  }
  return '';
}

export function getStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    requested: 'Requested',
    accepted: 'Accepted',
    // A legacy order may still hold this. It reads as Accepted, which is what
    // the backend would call it, rather than showing an operational step that
    // no longer exists.
    confirmed: 'Accepted',
    in_progress: 'In Progress',
    awaiting_customer_update: 'Awaiting Customer Update',
    completed: 'Completed',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    expired: 'Expired',
  };
  return labels[status] ?? status;
}

/**
 * What has been paid, which is not what stage the order is at.
 *
 * These were mixed: a screen showed "Confirmed" as the order's status when what
 * had actually happened was that payment was confirmed, while the server still
 * considered the order merely accepted. An order screen can show both — Order
 * status: Accepted, Payment: Confirmed — but one must never stand in for the
 * other.
 *
 * The vocabulary matches the invoice ledger, because it is the same question
 * being asked about the same money.
 */
export type OrderPaymentStatus =
  | 'unpaid'
  | 'partial'
  | 'paid'
  | 'overpaid'
  | 'reversed';

export function getPaymentStatusLabel(status: OrderPaymentStatus): string {
  const labels: Record<OrderPaymentStatus, string> = {
    unpaid: 'Unpaid',
    partial: 'Partly paid',
    paid: 'Payment confirmed',
    overpaid: 'Overpaid',
    reversed: 'Payment reversed',
  };
  return labels[status] ?? status;
}

export function getOrderStatusFlow(): OrderStatus[] {
  return ['requested', 'accepted', 'confirmed', 'in_progress', 'completed'];
}

export function getFulfillmentMethodLabel(method: FulfillmentMethod): string {
  const labels: Record<FulfillmentMethod, string> = {
    pickup: 'Pickup',
    delivery: 'Delivery',
    shipping: 'Shipping',
  };
  return labels[method] ?? method;
}
