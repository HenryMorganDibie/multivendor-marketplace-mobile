import type { Order, PaymentStatus } from '@/mocks/ordersData';
import type { OrderStatus } from '@/constants/orderStatus';
import {
  getStatusColor,
  getCustomerStatusLabel,
  getVendorStatusLabel,
  getDisplayStatusLabel,
} from '@/constants/orderStatus';

export interface StatusBadgeStyle {
  backgroundColor: string;
  textColor: string;
}

export interface PaymentBadgeStyle {
  backgroundColor: string;
  text: string;
}

export function getStatusBadgeStyle(status: OrderStatus): StatusBadgeStyle {
  const colors = getStatusColor(status);
  return { backgroundColor: colors.background, textColor: colors.text };
}

export function getStatusLabel(status: OrderStatus): string {
  return getDisplayStatusLabel(status);
}

export { getCustomerStatusLabel, getVendorStatusLabel };

export function getPaymentBadgeStyle(
  status: 'payment_received' | 'partially_received' | 'payment_pending'
): PaymentBadgeStyle {
  switch (status) {
    case 'payment_received':
      return { backgroundColor: '#34C759', text: 'PAYMENT RECEIVED' };
    case 'partially_received':
      return { backgroundColor: '#FF9500', text: 'PARTIAL PAYMENT' };
    case 'payment_pending':
      return { backgroundColor: '#FF3B30', text: 'PAYMENT PENDING' };
  }
}

export function getValidPaymentStatus(
  orderStatus: OrderStatus,
  storedPaymentStatus?: PaymentStatus
): PaymentStatus {
  switch (orderStatus) {
    case 'requested':
    case 'accepted':
    case 'rejected':
    case 'cancelled':
    case 'expired':
      return 'payment_pending';
    case 'confirmed':
    case 'in_progress':
      if (storedPaymentStatus === 'payment_received') return 'payment_received';
      if (storedPaymentStatus === 'partially_received') return 'partially_received';
      return 'partially_received';
    case 'completed':
      return 'payment_received';
    default:
      return storedPaymentStatus ?? 'payment_pending';
  }
}

export function getPaymentStatus(
  order: Order
): 'payment_received' | 'partially_received' | 'payment_pending' {
  return getValidPaymentStatus(order.status, order.paymentStatus);
}

export function formatScheduledDateTime(
  scheduledDate?: string,
  scheduledTime?: string
): string {
  if (!scheduledDate && !scheduledTime) return 'Not scheduled';

  if (scheduledDate && scheduledTime) {
    const date = new Date(scheduledDate);
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return `${formattedDate} • ${scheduledTime}`;
  }

  if (scheduledDate) {
    const date = new Date(scheduledDate);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  return scheduledTime || 'Not scheduled';
}

export function formatFulfillmentInfo(
  fulfillmentMethod: string,
  scheduledDate?: string,
  scheduledTime?: string
): string {
  const method = fulfillmentMethod === 'pickup' ? 'Pickup' : 'Delivery';
  const dateTime = formatScheduledDateTime(scheduledDate, scheduledTime);
  return `${method} • ${dateTime}`;
}

export function formatOrderPlacedDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatOrderAcceptedDate(dateString: string): string {
  return formatOrderPlacedDate(dateString);
}

export function formatPaymentConfirmedDate(dateString: string): string {
  return formatOrderPlacedDate(dateString);
}

export function getOrderDateDisplay(
  orderDate: string,
  status: OrderStatus,
  _isAccepted: boolean,
  _isInProgress: boolean,
  isCompleted: boolean,
  isCancelled: boolean
): string {
  if (isCompleted) return 'Completed';
  if (isCancelled) return 'Cancelled';
  if (status === 'rejected') return 'Declined';
  if (status === 'expired') return 'Expired';
  return formatOrderPlacedDate(orderDate);
}

export function shouldShowPaymentIndicator(
  paymentStatus: 'payment_received' | 'partially_received' | 'payment_pending'
): boolean {
  return paymentStatus !== 'payment_received';
}

import { formatPriceCents as _formatPriceCents, formatPriceWithCommas as _formatPriceWithCommas, type Currency } from '@/utils/formatPrice';

export function formatOrderPrice(amountInCents: number, currency: Currency = 'NGN'): string {
  return _formatPriceCents(amountInCents, currency);
}

export function formatOrderPriceDecimal(amount: number, currency: Currency = 'NGN'): string {
  return _formatPriceWithCommas(amount, currency);
}
