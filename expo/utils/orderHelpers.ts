import type { OrderStatus } from '@/constants/orderStatus';
import type { Order } from '@/mocks/ordersData';

// Backend Enforced Rule — UI Display Only
export function isOrderPending(status: OrderStatus): boolean {
  return status === 'requested';
}

// Backend Enforced Rule — UI Display Only
export function isOrderAccepted(status: OrderStatus): boolean {
  return status === 'accepted';
}

// Backend Enforced Rule — UI Display Only
export function isAwaitingCustomerUpdate(status: OrderStatus): boolean {
  return status === 'awaiting_customer_update';
}

// Backend Enforced Rule — UI Display Only
export function isOrderConfirmed(status: OrderStatus): boolean {
  return status === 'confirmed';
}

// Backend Enforced Rule — UI Display Only
export function isOrderInProgress(status: OrderStatus): boolean {
  return status === 'in_progress';
}

export function isOrderCompleted(status: OrderStatus): boolean {
  return status === 'completed';
}

export function isOrderCancelled(status: OrderStatus): boolean {
  return status === 'cancelled';
}

export function isOrderRejected(status: OrderStatus): boolean {
  return status === 'rejected';
}

export function isOrderExpired(status: OrderStatus): boolean {
  return status === 'expired';
}

export function isOrderActive(status: OrderStatus): boolean {
  return status === 'accepted' || status === 'confirmed' || status === 'in_progress';
}

export function isOrderTerminal(status: OrderStatus): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'rejected' || status === 'expired';
}

export function isOrderUpcoming(status: OrderStatus): boolean {
  return status === 'requested' || status === 'accepted' || status === 'confirmed' || status === 'in_progress';
}

export function isOrderPast(status: OrderStatus): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'rejected' || status === 'expired';
}

// Backend Enforced Rule — UI Display Only
export function canAcceptOrder(status: OrderStatus): boolean {
  return status === 'requested';
}

// Backend Enforced Rule — UI Display Only
export function canRejectOrder(status: OrderStatus): boolean {
  return status === 'requested';
}

// Backend Enforced Rule — UI Display Only
export function canCancelOrder(status: OrderStatus): boolean {
  return ['requested', 'accepted', 'confirmed', 'in_progress'].includes(status);
}

// Backend Enforced Rule — UI Display Only
export function canExpireOrder(status: OrderStatus): boolean {
  return status === 'requested';
}

// Backend Enforced Rule — UI Display Only
export function canConfirmPayment(status: OrderStatus, isExternal: boolean): boolean {
  return status === 'accepted' && !isExternal;
}

// Backend Enforced Rule — UI Display Only
export function canMarkInProgress(status: OrderStatus, isExternal: boolean): boolean {
  return status === 'confirmed' && !isExternal;
}

// Backend Enforced Rule — UI Display Only
export function canMarkCompleted(status: OrderStatus, isExternal: boolean): boolean {
  return status === 'in_progress' && !isExternal;
}

export function canSendVendorEvent(status: OrderStatus, isExternal: boolean): boolean {
  return (status === 'confirmed' || status === 'in_progress') && !isExternal;
}

export function shouldShowAdjustTotalButton(
  status: OrderStatus,
  isExternal: boolean,
  balanceDue: number
): boolean {
  return (
    (status === 'accepted' || status === 'confirmed' || status === 'in_progress') &&
    !isOrderCompleted(status) &&
    !isOrderCancelled(status) &&
    !isOrderRejected(status) &&
    !isExternal &&
    balanceDue > 0
  );
}

export function canSendPaymentRequest(
  status: OrderStatus,
  isExternal: boolean,
  balanceDue: number
): boolean {
  return status === 'accepted' && !isExternal && balanceDue > 0;
}

export function canMarkAsPaid(
  status: OrderStatus,
  isExternal: boolean,
  balanceDue: number,
  hasPaymentRequest: boolean
): boolean {
  return (
    (status === 'accepted' || status === 'confirmed' || status === 'in_progress') &&
    !isExternal &&
    balanceDue > 0 &&
    hasPaymentRequest
  );
}

export function calculateOrderBalance(total: number, amountPaid: number): number {
  return total - amountPaid;
}

export function calculateTotalWithAdjustments(
  baseTotal: number,
  adjustments: { amount: number }[]
): number {
  const adjustmentTotal = adjustments.reduce((sum, adj) => sum + adj.amount, 0);
  return baseTotal + adjustmentTotal;
}

export function getTotalItemCount(items: { quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function isExternalOrder(order: Order): boolean {
  return order.orderSource === 'external';
}

export function isPaymentPending(
  paymentStatus?: 'payment_received' | 'partially_received' | 'payment_pending'
): boolean {
  return !paymentStatus || paymentStatus === 'payment_pending';
}

export function isPaymentPartial(
  paymentStatus?: 'payment_received' | 'partially_received' | 'payment_pending'
): boolean {
  return paymentStatus === 'partially_received';
}

export function isPaymentComplete(
  paymentStatus?: 'payment_received' | 'partially_received' | 'payment_pending'
): boolean {
  return paymentStatus === 'payment_received';
}

export function hasOutstandingBalance(balanceDue: number): boolean {
  return balanceDue > 0;
}

export function isOrderPaid(status: OrderStatus): boolean {
  return status === 'confirmed' || status === 'in_progress' || status === 'completed';
}

export function shouldShowContactDetails(
  status: OrderStatus,
  isExternal: boolean
): boolean {
  return (
    isOrderPaid(status) &&
    !isOrderCancelled(status) &&
    !isOrderCompleted(status) &&
    !isExternal
  );
}

export function isOldUnpaidExternal(
  order: Order,
  hoursThreshold: number = 6
): boolean {
  const isExternal = isExternalOrder(order);
  const isPending = isPaymentPending(order.paymentStatus) || isPaymentPartial(order.paymentStatus);
  const orderTime = new Date(order.orderDate).getTime();
  const thresholdTime = Date.now() - (hoursThreshold * 60 * 60 * 1000);

  return isExternal && isPending && orderTime < thresholdTime;
}

export function getPaymentPriority(order: Order): number {
  const isExternal = isExternalOrder(order);
  const paymentStatus = order.paymentStatus || 'payment_pending';

  if (isExternal && paymentStatus === 'payment_pending') return 0;
  if (paymentStatus === 'partially_received') return 1;
  if (paymentStatus === 'payment_received') return 2;
  return 3;
}

// Backend Enforced Rule — UI Display Only
export function getStatusPriority(status: OrderStatus): number {
  switch (status) {
    case 'requested': return 0;
    case 'accepted': return 1;
    case 'confirmed': return 2;
    case 'in_progress': return 3;
    case 'completed': return 4;
    case 'rejected': return 5;
    case 'cancelled': return 6;
    case 'expired': return 7;
    default: return 999;
  }
}
