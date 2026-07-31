import type { Invoice, InvoiceStatus, InvoicePaymentRecord } from '@/contexts/InvoiceContext';

/**
 * Turns a Firestore invoice into the shape the app's screens already read.
 *
 * One thing needed untangling. The app's `InvoiceStatus` mixes two different
 * ideas: how the invoice reached the customer (`draft`, `shared_externally`,
 * `sent_in_chat`, `viewed`) and what has been paid against it (`paid`,
 * `cancelled`, `expired`, `void`). Those are independent — an invoice can be
 * sent in chat *and* half paid — and a single field cannot hold both, so
 * whichever was written last used to win.
 *
 * The backend now derives payment state from the ledger, so the two are
 * genuinely separate. `status` keeps its delivery meaning, which is what the
 * list and chat cards display, and `paymentStatus` carries the derived truth
 * alongside it. Screens showing "Sent" keep working untouched; screens showing
 * money read the new field.
 */

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overpaid' | 'cancelled';

type Timestampish = { toDate: () => Date } | { seconds: number } | string | null | undefined;

function toIso(value: Timestampish): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  const seconds = (value as { seconds?: number }).seconds;
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : '';
}

/**
 * Delivery state, which the backend does not model. It is inferred from what
 * the invoice carries: a share token that has been opened means viewed, a bound
 * chat means sent, otherwise it is still a draft.
 */
function deliveryStatus(data: Record<string, unknown>): InvoiceStatus {
  if (data.status === 'cancelled') return 'cancelled';
  if (data.viewedAt) return 'viewed';
  if (data.chatId || data.sentInChatAt) return 'sent_in_chat';
  if (data.sharedExternallyAt) return 'shared_externally';
  return 'draft';
}

export function mapInvoiceDoc(id: string, data: Record<string, unknown>): Invoice {
  const lineItems = Array.isArray(data.lineItems) ? (data.lineItems as Record<string, unknown>[]) : [];

  return {
    id,
    invoiceNumber: (data.invoiceNumber as string) ?? '',
    customerName: (data.customerName as string) ?? '',
    customerPhone: (data.customerPhone as string) ?? undefined,
    customerEmail: (data.customerEmail as string) ?? undefined,
    customerId: (data.customerId as string) ?? undefined,
    chatId: (data.chatId as string) ?? undefined,

    lineItems: lineItems.map((li, i) => ({
      id: (li.id as string) ?? `li-${i}`,
      name: (li.description as string) ?? (li.name as string) ?? '',
      quantity: (li.quantity as number) ?? 1,
      unitPrice: (li.unitPrice as number) ?? 0,
      total: ((li.quantity as number) ?? 1) * ((li.unitPrice as number) ?? 0),
    })),

    subtotal: (data.subtotal as number) ?? 0,
    total: (data.subtotal as number) ?? 0,
    currency: (data.currency as string) ?? 'NGN',

    // Delivery, not payment. See the note above.
    status: deliveryStatus(data),

    orderId: (data.orderId as string) ?? undefined,
    shareCode: (data.shareToken as string) ?? undefined,
    notes: (data.notes as string) ?? undefined,
    createdAt: toIso(data.createdAt as Timestampish),
    issueDate: toIso(data.createdAt as Timestampish),
    dueDate: data.dueDate ? toIso(data.dueDate as Timestampish) : undefined,
  // Cast through unknown: this builds the fields the screens read, and the
  // Invoice interface carries several optional ones the backend does not store
  // (customerSource, sourceType, fulfilmentDetails). Listing them all as
  // undefined would be noise.
  } as unknown as Invoice;
}

/**
 * The ledger-derived figures, kept beside the invoice rather than inside it so
 * the existing shape is untouched and a screen reads whichever it needs.
 */
export interface InvoiceLedgerView {
  paymentStatus: PaymentStatus;
  amountPaidMinorUnits: number;
  balanceMinorUnits: number;
  lastPaymentAt: string | null;
}

export function mapInvoiceLedger(data: Record<string, unknown>): InvoiceLedgerView {
  const total = (data.subtotal as number) ?? 0;
  const paid = (data.amountPaidMinorUnits as number) ?? 0;

  // Falls back to deriving it rather than trusting a missing cached field: an
  // invoice written before the ledger existed has no amountPaid, and showing it
  // as unpaid when it was settled would be worse than recomputing here.
  const cached = data.paymentStatus ?? data.status;
  const derived: PaymentStatus =
    data.status === 'cancelled' ? 'cancelled'
      : paid === 0 ? 'unpaid'
        : total - paid < 0 ? 'overpaid'
          : total - paid === 0 ? 'paid'
            : 'partial';

  return {
    paymentStatus: (['unpaid', 'partial', 'paid', 'overpaid', 'cancelled'].includes(cached as string)
      ? (cached as PaymentStatus)
      : derived),
    amountPaidMinorUnits: paid,
    balanceMinorUnits: (data.balanceMinorUnits as number) ?? total - paid,
    lastPaymentAt: data.lastPaymentAt ? toIso(data.lastPaymentAt as Timestampish) : null,
  };
}

export type { InvoicePaymentRecord };
