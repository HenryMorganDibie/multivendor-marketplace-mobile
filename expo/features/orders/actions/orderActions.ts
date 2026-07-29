import type { Order } from '@/mocks/ordersData';
import type { Currency } from '@/utils/formatPrice';
import { validatePartialPaymentAmount, calculatePaymentUpdate } from '@/utils/paymentHelpers';

export const DECLINE_REASONS = [
  { code: 'out_of_stock', label: 'Item unavailable' },
  { code: 'capacity_full', label: 'At capacity, cannot fulfill' },
  { code: 'hours_conflict', label: 'Outside operating hours' },
  { code: 'order_too_large', label: 'Order too large to fulfill' },
  { code: 'incorrect_details', label: 'Incorrect order details' },
  { code: 'customer_unreachable', label: 'Unable to reach customer' },
  { code: 'other', label: 'Other' },
];

export const CANCELLATION_REASONS = [
  { code: 'item_unavailable', label: 'Item unavailable' },
  { code: 'ingredient_unavailable', label: 'Ingredient/material unavailable' },
  { code: 'service_unavailable', label: 'Service unavailable at requested time' },
  { code: 'overbooked', label: 'Overbooked / capacity reached' },
  { code: 'staff_unavailable', label: 'Staff unavailable' },
  { code: 'incorrect_details', label: 'Incorrect order details' },
  { code: 'customer_requested', label: 'Customer requested cancellation' },
  { code: 'customer_no_payment', label: 'Customer did not complete payment' },
  { code: 'duplicate_order', label: 'Duplicate order' },
  { code: 'other', label: 'Other' },
];

export function buildCancelPayload(
  orderId: string,
  reasonCode: string,
  reasonText: string
): { orderId: string; reason: string; reasonCode: string; reasonText?: string } | null {
  if (!reasonCode) return null;
  if (reasonCode === 'other' && !reasonText.trim()) return null;

  const reasonLabel = CANCELLATION_REASONS.find(r => r.code === reasonCode)?.label ?? reasonCode;
  const reason = reasonCode === 'other' ? reasonText.trim() : reasonLabel;
  const resolvedReasonText = reasonCode === 'other' ? reasonText.trim() : undefined;

  return { orderId, reason, reasonCode, reasonText: resolvedReasonText };
}

export function buildPaymentUpdate(
  paymentType: 'full' | 'partial',
  partialPaymentAmount: string,
  balanceDue: number,
  amountPaid: number,
  calculatedTotal: number
): {
  valid: boolean;
  error?: string;
  amountReceived: number;
  newTotalPaid: number;
  newBalanceDue: number;
} {
  if (paymentType === 'partial') {
    const validation = validatePartialPaymentAmount(partialPaymentAmount, balanceDue);
    if (!validation.valid) {
      return { valid: false, error: 'Amount cannot exceed the outstanding balance.', amountReceived: 0, newTotalPaid: 0, newBalanceDue: 0 };
    }
  }

  const update = calculatePaymentUpdate(paymentType, partialPaymentAmount, balanceDue, amountPaid, calculatedTotal);
  return { valid: true, ...update };
}

export function getCurrencyFromOrder(_order: Order): Currency {
  return 'NGN' as Currency;
}
