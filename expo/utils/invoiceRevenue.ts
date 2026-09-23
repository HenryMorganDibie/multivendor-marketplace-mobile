import type { Invoice, InvoicePaymentRecord } from '@/contexts/InvoiceContext';
import { getAmountPaid } from '@/contexts/InvoiceContext';

/**
 * Mock revenue rules for Platform's dashboard / Business Insights.
 *
 * Revenue = money the vendor has CONFIRMED receiving. We never count unpaid
 * invoice totals as revenue. The rules below mirror the approved spec:
 *
 *   - Pending Payment / Unpaid     → ₦0
 *   - Partially Paid               → sum of recorded payments only
 *   - Paid                         → full amount received (capped at invoice total)
 *   - Overdue                      → ₦0 unless partial payments were recorded
 *   - Cancelled / Voided           → ₦0
 *
 * Recording a payment updates:
 *   - Today's Revenue on the vendor dashboard (keyed off the payment `date`)
 *   - Total Revenue in Business Insights
 *   - Revenue Trend for the selected period
 *
 * All numbers are mock-only. Henry's backend will be the single source of
 * truth for revenue and MUST enforce the double-counting rule described
 * below (see BACKEND_INTEGRATION_GUIDE.md "Invoice payment double-counting").
 *
 * DOUBLE-COUNTING RULE (backend integration note for Henry):
 *   Standalone invoice payments may contribute to revenue. If an invoice is
 *   linked to an order (invoice.orderId is set), the same payment MUST NOT be
 *   counted once through the invoice and again through the order. The backend
 *   should use a single payment/revenue record with linked source IDs
 *   (orderId + invoiceId) so revenue aggregation deduplicates by payment id.
 *   The mock helpers below accept an optional `linkedOrderIds` set so the UI
 *   can avoid double-counting locally; once Henry ships a unified payment
 *   record this guard becomes redundant.
 */

/**
 * Sum of confirmed payments on a single invoice that should count towards
 * revenue, given the invoice's effective status. Never returns more than the
 * invoice total.
 */
export function getInvoiceRevenue(invoice: Invoice): number {
  // Cancelled / voided / expired invoices contribute ₦0 even if a payment
  // was recorded before they were voided. (Henry: confirm whether voided-
  // after-payment should refund revenue; for now we treat terminal void as
  // revenue-zero to match the spec.)
  if (invoice.status === 'cancelled' || invoice.status === 'expired') {
    return 0;
  }
  const paid = getAmountPaid(invoice.payments);
  // Unpaid + overdue: ₦0 unless partial payments were recorded.
  if (paid <= 0) return 0;
  // Cap at invoice total so an over-payment never inflates revenue.
  return Math.min(paid, Math.max(0, invoice.total));
}

/**
 * Total revenue across a set of invoices, applying the double-counting guard
 * for invoices linked to orders whose ids are in `linkedOrderIds`. When an
 * invoice is linked to an order that already contributes to order revenue,
 * its payment is skipped here so the same money is not counted twice.
 *
 * Mock-only — the backend should deduplicate by payment id, not by this
 * client-side guard.
 */
export function sumInvoiceRevenue(
  invoices: Invoice[],
  linkedOrderIds?: Set<string>,
): number {
  return invoices.reduce((acc, inv) => {
    if (inv.orderId && linkedOrderIds?.has(inv.orderId)) return acc;
    return acc + getInvoiceRevenue(inv);
  }, 0);
}

/**
 * Revenue from a single payment record, for trend charts. Each payment
 * contributes its own amount (capped at the parent invoice total) on the
 * payment `date`, NOT the invoice issue date. This is what makes "Today's
 * Revenue" react to a payment recorded today even if the invoice was issued
 * last week.
 *
 * Cancelled / voided invoices are excluded at the caller level (pass only
 * live invoices).
 */
export function getPaymentRevenueAmount(
  invoice: Invoice,
  payment: InvoicePaymentRecord,
): number {
  if (invoice.status === 'cancelled' || invoice.status === 'expired') return 0;
  const totalPaid = getAmountPaid(invoice.payments);
  // If the cumulative payments exceed the invoice total, clamp this payment's
  // contribution so revenue never exceeds the invoice total.
  if (totalPaid > invoice.total) {
    const overflow = totalPaid - invoice.total;
    return Math.max(0, payment.amount - overflow);
  }
  return payment.amount;
}

/** True when the payment's date falls on the same calendar day as `dateStr`. */
export function isPaymentOnDay(payment: InvoicePaymentRecord, dateStr: string): boolean {
  try {
    return new Date(payment.date).toDateString() === new Date(dateStr).toDateString();
  } catch {
    return false;
  }
}

/** True when the payment's date falls within [start, end] inclusive. */
export function isPaymentInRange(
  payment: InvoicePaymentRecord,
  start: Date,
  end: Date,
): boolean {
  try {
    const d = new Date(payment.date).getTime();
    return d >= start.getTime() && d <= end.getTime();
  } catch {
    return false;
  }
}

/**
 * Revenue for a given day, summed from individual payment records (so a
 * payment recorded today on an invoice issued last week counts towards
 * today, not last week). Applies the double-counting guard for invoices
 * linked to orders in `linkedOrderIds`.
 */
export function getInvoiceRevenueForDay(
  invoices: Invoice[],
  dateStr: string,
  linkedOrderIds?: Set<string>,
): number {
  let total = 0;
  for (const inv of invoices) {
    if (inv.orderId && linkedOrderIds?.has(inv.orderId)) continue;
    if (inv.status === 'cancelled' || inv.status === 'expired') continue;
    for (const p of inv.payments ?? []) {
      if (isPaymentOnDay(p, dateStr)) {
        total += getPaymentRevenueAmount(inv, p);
      }
    }
  }
  return total;
}

/**
 * Revenue across a date range, summed from individual payment records.
 * Applies the double-counting guard for invoices linked to orders in
 * `linkedOrderIds`.
 */
export function getInvoiceRevenueForRange(
  invoices: Invoice[],
  start: Date,
  end: Date,
  linkedOrderIds?: Set<string>,
): number {
  let total = 0;
  for (const inv of invoices) {
    if (inv.orderId && linkedOrderIds?.has(inv.orderId)) continue;
    if (inv.status === 'cancelled' || inv.status === 'expired') continue;
    for (const p of inv.payments ?? []) {
      if (isPaymentInRange(p, start, end)) {
        total += getPaymentRevenueAmount(inv, p);
      }
    }
  }
  return total;
}
