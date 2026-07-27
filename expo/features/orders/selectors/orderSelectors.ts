import type { Order } from '@/mocks/ordersData';
import {
  isExternalOrder,
  isOrderCancelled,
  isOrderRejected,
  calculateTotalWithAdjustments,
  calculateOrderBalance,
  getTotalItemCount,
  canAcceptOrder,
  canCancelOrder,
  canMarkInProgress,
  shouldShowAdjustTotalButton,
} from '@/utils/orderHelpers';

export interface OrderDisplayFlags {
  isExternal: boolean;
  isInProgress: boolean;
  isCancelled: boolean;
  isRejected: boolean;
  orderChatAvailable: boolean;
  showAcceptDecline: boolean;
  showMarkInProgress: boolean;
  showCancel: boolean;
}

export interface OrderPaymentState {
  calculatedTotal: number;
  balanceDue: number;
  shouldShowAdjustButton: boolean;
  showRecordPayment: boolean;
  isPaymentConfirmed: boolean;
}

export function selectOrderDisplayFlags(
  order: Order,
  autoAcceptEnabled: boolean
): OrderDisplayFlags {
  const orderStatus = order.status;
  const isExternal = isExternalOrder(order);

  return {
    isExternal,
    isInProgress: orderStatus === 'in_progress',
    isCancelled: isOrderCancelled(orderStatus),
    isRejected: isOrderRejected(orderStatus),
    orderChatAvailable: !['requested', 'rejected', 'cancelled', 'expired'].includes(orderStatus),
    showAcceptDecline: canAcceptOrder(orderStatus) && !autoAcceptEnabled,
    showMarkInProgress: canMarkInProgress(orderStatus, isExternal),
    showCancel: canCancelOrder(orderStatus) && !isExternal,
  };
}

export function selectOrderFinancials(
  order: Order,
  adjustments: { label: string; amount: number }[]
): { calculatedTotal: number; balanceDue: number; totalItemCount: number } {
  const calculatedTotal = calculateTotalWithAdjustments(order.total, adjustments);
  const balanceDue = calculateOrderBalance(calculatedTotal, order.amountPaid || 0);
  const totalItemCount = getTotalItemCount(order.items);
  return { calculatedTotal, balanceDue, totalItemCount };
}

export function selectPaymentDisplayState(
  order: Order,
  calculatedTotal: number,
  balanceDue: number
): OrderPaymentState {
  const isExternal = isExternalOrder(order);
  const orderStatus = order.status;
  const paymentStatus = order.paymentStatus;

  return {
    calculatedTotal,
    balanceDue,
    shouldShowAdjustButton: shouldShowAdjustTotalButton(orderStatus, isExternal, balanceDue),
    showRecordPayment:
      (orderStatus === 'accepted' || paymentStatus === 'partially_received') &&
      paymentStatus !== 'payment_received' &&
      balanceDue > 0,
    isPaymentConfirmed: paymentStatus === 'payment_received' && balanceDue <= 0,
  };
}

export function selectIsPaymentSufficient(
  paymentStatus?: 'payment_received' | 'partially_received' | 'payment_pending'
): boolean {
  return paymentStatus === 'payment_received' || paymentStatus === 'partially_received';
}
