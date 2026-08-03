import { useState, useEffect } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db, callable } from '@/lib/firebase';
import { mapInvoiceDoc, mapInvoiceLedger, type InvoiceLedgerView } from '@/lib/invoices/mapInvoiceDoc';
import { DEV_LOCAL_AUTH_ENABLED } from '@/constants/devAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';

/**
 * DRAFT          — created, not yet delivered
 * SHARED_EXTERNALLY — sent via native share sheet (WhatsApp, email, etc.)
 * SENT_IN_CHAT   — attached to a real the platform customer chat thread
 * VIEWED         — customer has opened the invoice link
 * PAID           — vendor manually marked as paid
 * CANCELLED      — voided
 * EXPIRED        — public link no longer active
 */
export type InvoiceStatus =
  | 'draft'
  | 'shared_externally'
  | 'sent_in_chat'
  | 'viewed'
  | 'paid'
  | 'cancelled'
  | 'expired'
  | 'void';

/** How the customer was selected when creating the invoice */
export type InvoiceCustomerSource = 'the platform' | 'external';

/**
 * Which kind of the platform conversation an internal-customer invoice was
 * created from. Henry should persist this so the backend can link the
 * invoice to the right conversation and prevent revenue double-counting.
 */
export type InvoiceSourceType = 'order_chat' | 'inquiry_chat';

/**
 * Fulfilment method captured at invoice creation. Displayed on the
 * customer-facing invoice when relevant. Does NOT convert the invoice into an
 * order — invoices remain financial documents.
 */
export type InvoiceFulfilmentMethod = 'pickup' | 'delivery' | 'service' | 'none';

/** Mock payment method on a recorded payment. Optional. */
export type InvoicePaymentMethod =
  | 'bank_transfer'
  | 'cash'
  | 'card_direct'
  | 'mobile_money'
  | 'other';

/** Friendly label for a payment method. */
export const INVOICE_PAYMENT_METHOD_LABELS: Record<InvoicePaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  card_direct: 'Card paid directly to vendor',
  mobile_money: 'Mobile money',
  other: 'Other',
};

/**
 * Payment-due terms the vendor can pick on the Create Invoice screen.
 * `none` means no due date is set — the Due field is omitted on the invoice.
 * `custom_date` is paired with a concrete `dueDate` ISO string.
 * `due_on_receipt` / `net_7` / `net_14` / `net_30` are preset terms; Henry
 * should persist `paymentTerms` alongside `dueDate` so the public invoice
 * page can render the right label without recomputing offsets client-side.
 */
export type InvoicePaymentTerms =
  | 'due_on_receipt'
  | 'net_7'
  | 'net_14'
  | 'net_30'
  | 'custom_date'
  | 'none';

/** Human label for a payment-terms preset. */
export const INVOICE_PAYMENT_TERMS_LABELS: Record<InvoicePaymentTerms, string> = {
  due_on_receipt: 'Due on receipt',
  net_7: 'In 7 days',
  net_14: 'In 14 days',
  net_30: 'In 30 days',
  custom_date: 'Choose a date',
  none: 'No due date',
};

/** Resolve the due-date ISO string for a payment-terms preset, given the issue date. */
export function computeDueDateForTerms(
  terms: InvoicePaymentTerms,
  issueDate: string,
  customDate?: string,
): string | undefined {
  if (terms === 'none') return undefined;
  if (terms === 'custom_date') return customDate;
  if (terms === 'due_on_receipt') return issueDate;
  const days = terms === 'net_7' ? 7 : terms === 'net_14' ? 14 : 30;
  const d = new Date(issueDate);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * A single payment the vendor has confirmed receiving against an invoice.
 * Mock-only — Henry will persist these under the invoice document (or a
 * linked `payments` collection) and enforce the double-count rules described
 * in BACKEND_INTEGRATION_GUIDE.md.
 */
export interface InvoicePaymentRecord {
  id: string;
  /** Amount received in the invoice's currency. */
  amount: number;
  /** ISO date the payment was received (drives Today's Revenue). */
  date: string;
  /** Optional payment method. */
  method?: InvoicePaymentMethod;
  /** Optional vendor note. */
  note?: string;
  /** When the record was created. */
  recordedAt: string;
}

/** Customer-facing display label for an invoice status. */
export function getInvoiceStatusDisplayLabel(status: InvoiceStatus): string {
  switch (status) {
    case 'draft': return 'Draft';
    case 'sent_in_chat':
    case 'shared_externally': return 'Sent';
    case 'viewed': return 'Viewed';
    case 'paid': return 'Paid';
    case 'cancelled': return 'Cancelled';
    case 'expired': return 'Expired';
    case 'void': return 'Void';
    default: return 'Draft';
  }
}

/** Public, unguessable invoice share URL. Never exposes the readable invoice number. */
export function getInvoiceShareUrl(shareCode: string): string {
  return `https://the platform.app/i/${shareCode}`;
}

/** Financial edits allowed? Paid and void invoices are locked. */
export function canEditInvoice(status: InvoiceStatus): boolean {
  return (
    status === 'draft' ||
    status === 'sent_in_chat' ||
    status === 'shared_externally' ||
    status === 'viewed'
  );
}

export interface InvoiceLineItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  /** Optional short description shown below the item name on the invoice. */
  description?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  /** Bound the platform chat thread — required for SENT_IN_CHAT delivery */
  chatId?: string;
  /** Bound the platform customer id — required for SENT_IN_CHAT delivery */
  customerId?: string;
  /** How the customer was selected when creating the invoice */
  customerSource?: InvoiceCustomerSource;
  /**
   * For internal the platform customers: which kind of conversation the invoice
   * was created from. `order_chat` when selected from an order chat,
   * `inquiry_chat` when selected from a pre-order inquiry. Henry should
   * persist this on the invoice document to prevent revenue double-counting.
   */
  sourceType?: InvoiceSourceType;
  /** Linked conversation id for internal-customer invoices. */
  conversationId?: string;
  /** Optional address for external customers (delivery / invoice records). */
  customerAddress?: string;
  /** Unguessable code backing the public URL the platform.app/i/{shareCode} */
  shareCode?: string;
  items: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string;
  status: InvoiceStatus;
  currency: Currency;
  createdAt: string;
  /** Bumped on every edit so the public page reflects live updates */
  updatedAt?: string;
  /** Payment-due terms selected at create time. Henry should persist this so
   *  the public invoice page can render the right label without recomputing
   *  offsets. `none` means no Due field is shown. */
  paymentTerms?: InvoicePaymentTerms;
  /** Sharing metadata — when/where the invoice was first shared and re-shared.
   *  Henry should persist these as part of the invoice document. */
  firstSharedAt?: string;
  lastSharedAt?: string;
  /** How the invoice was shared: 'chat' (internal the platform customer) or
   *  'external_link' (secure public URL). Henry should persist this. */
  shareChannel?: 'chat' | 'external_link';
  sharedAt?: string;
  sentInChatAt?: string;
  paidAt?: string;
  voidedAt?: string;
  paymentStatus?: InvoicePaymentStatus;
  /**
   * Confirmed payments recorded against this invoice. Mock-only; the backend
   * will own this list. The invoice's effective `paymentStatus` should be
   * derived from these via `resolvePaymentStatus` when Henry exposes them.
   */
  payments?: InvoicePaymentRecord[];
  /**
   * Optional order this invoice was generated from. When present, the same
   * payment MUST NOT be counted once via the invoice and again via the order —
   * see BACKEND_INTEGRATION_GUIDE.md ("Invoice payment double-counting").
   * Henry should use a single payment/revenue record with linked source IDs.
   * NOTE: normal create-invoice flow never sets orderId. Only an explicit
   * "Create invoice from this order" flow (Phase 2) may populate this.
   */
  orderId?: string;
  /** Selected fulfilment method (and its mock delivery/pickup details). */
  fulfilmentMethod?: InvoiceFulfilmentMethod;
  fulfilmentDetails?: InvoiceFulfilmentDetails;
  /** Customer-facing issue date (display). Backend integration note: Henry
   *  should persist this on the invoice document. Mock-only for now. */
  issueDate?: string;
  /** Customer-facing due date (display). When in the past and the invoice is
   *  not paid, the customer card shows an "Overdue" status. Mock-only.
   *  Derived from `paymentTerms` at create time; Henry should persist both. */
  dueDate?: string;
}

/**
 * Mock fulfilment details, conditionally surfaced based on `fulfilmentMethod`.
 * `pickup` → location + dateTime + instructions.
 * `delivery` → address + deliveryFee + dateTime + instructions.
 * `service` → serviceLocation + dateTime + notes.
 * `none` → no fields used.
 *
 * All fields are optional — vendors can leave any of them blank to create an
 * invoice without forcing a scheduled time or location.
 *
 * Backend integration note (Henry): persist these under the invoice document.
 * In particular:
 *   - `fulfilmentMethod` ('pickup' | 'delivery' | 'service' | 'none')
 *   - `fulfilmentLocation` (pickup location / delivery address / service
 *     location — stored in the method-specific field above for backwards
 *     compatibility, but a single `fulfilmentLocation` field would be cleaner)
 *   - `scheduledAt` (ISO string when the vendor picked a concrete date/time)
 *   - `isFlexible` (true when the vendor chose "I'm flexible" instead of a
 *     concrete time — store this instead of inventing a date)
 *   - method-specific `instructions` / `notes`
 *   - `deliveryFee`
 */
export interface InvoiceFulfilmentDetails {
  location?: string;
  address?: string;
  serviceLocation?: string;
  deliveryFee?: number;
  dateTime?: string;
  instructions?: string;
  notes?: string;
  /** True when the vendor chose "I'm flexible" instead of a concrete date/time.
   *  Henry should persist this as a fulfilment preference flag. */
  isFlexible?: boolean;
}

export type InvoicePaymentStatus = 'unpaid' | 'partially_paid' | 'paid';

/**
 * Resolve the effective payment status for an invoice from its recorded
 * payments. Mock-only — Henry's backend should be the single source of truth
 * for this, returning `paid`/`partially_paid`/`unpaid` from the invoice
 * document so the client never re-derives it.
 */
export function resolvePaymentStatus(
  total: number,
  payments: InvoicePaymentRecord[] | undefined,
  fallback?: InvoicePaymentStatus,
): InvoicePaymentStatus {
  if (payments && payments.length > 0) {
    const paid = payments.reduce((sum, p) => sum + p.amount, 0);
    if (paid >= total && total > 0) return 'paid';
    if (paid > 0) return 'partially_paid';
  }
  return fallback ?? 'unpaid';
}

/** Sum of confirmed payment amounts against an invoice. */
export function getAmountPaid(payments?: InvoicePaymentRecord[]): number {
  return (payments ?? []).reduce((sum, p) => sum + p.amount, 0);
}

/** Remaining balance on an invoice (never negative). */
export function getBalanceDue(total: number, payments?: InvoicePaymentRecord[]): number {
  return Math.max(0, total - getAmountPaid(payments));
}

// Bumped v2 → v3 to clear stale mock invoices that used the old
// timestamp-based invoice number format (INV-1782258248594-690) and
// unrelated seed items. The new seed uses the approved
// VENDORSLUG-INV-12345 format and consistent demo items. Real user-created
// invoices are mock-only at this stage, so clearing is safe.
const STORAGE_KEY = 'vendor_invoices_v3';

/**
 * Mock seed invoices used to demonstrate the customer-facing invoice flow
 * (vendor sends invoice → customer sees invoice card in chat → customer taps
 * View Invoice → sees the full branded invoice). UI and mock data only — no
 * backend logic. Henry will replace this seed with real backend invoices.
 *
 * Invoice numbers use the approved customer-facing format VENDORSLUG-INV-12345.
 * The internal sequence number (INV-000123) is never shown to customers.
 */
const SEED_INVOICES: Invoice[] = [
  {
    id: 'seed_invoice_unpaid_001',
    invoiceNumber: 'SPICYREST-INV-12345',
    // Privacy: internal the platform customers are stored as "First L." so the
    // vendor never sees the full surname on any surface. Henry should persist
    // the canonical first/last split on the backend and format via
    // formatInternalCustomerName at the data boundary.
    customerName: 'Jane S.',
    customerId: 'customer-001',
    chatId: 'chat-v1-customer-001',
    customerSource: 'the platform',
    shareCode: 'kx7m2n9p4q8r3t6v',
    items: [
      { id: 'si-1', name: 'Jollof Rice (Special Platter)', quantity: 2, unitPrice: 3500, total: 7000 },
      { id: 'si-2', name: 'Grilled Chicken', quantity: 1, unitPrice: 4000, total: 4000 },
      { id: 'si-3', name: 'Puff Puff', quantity: 5, unitPrice: 200, total: 1000 },
    ],
    subtotal: 12000,
    tax: 500,
    discount: 0,
    total: 12500,
    notes: 'Pickup from 15 Admiralty Way, Lekki. Please reference your invoice number on payment.',
    status: 'sent_in_chat',
    currency: 'NGN',
    createdAt: '2026-07-15T10:42:00.000Z',
    updatedAt: '2026-07-15T10:42:00.000Z',
    sentInChatAt: '2026-07-15T10:42:00.000Z',
    paymentStatus: 'unpaid',
    issueDate: '2026-07-15T10:42:00.000Z',
    dueDate: '2026-07-30T23:59:00.000Z',
    fulfilmentMethod: 'pickup',
    fulfilmentDetails: {
      location: '15 Admiralty Way, Lekki Phase 1',
      dateTime: '2026-07-16T13:00:00.000Z',
      instructions: 'Bring this invoice number for reference.',
    },
  },
  {
    id: 'seed_invoice_overdue_001',
    invoiceNumber: 'SPICYREST-INV-12344',
    customerName: 'Jane S.',
    customerId: 'customer-001',
    chatId: 'chat-v1-customer-001',
    customerSource: 'the platform',
    shareCode: 'mn3v8k1q7w2x9j4p',
    items: [
      { id: 'si-4', name: 'Small Chops Platter (Catering)', quantity: 1, unitPrice: 8000, total: 8000 },
    ],
    subtotal: 8000,
    tax: 600,
    discount: 0,
    // Total = subtotal + tax + deliveryFee - discount = 8000 + 600 + 1500 - 0
    total: 10100,
    notes: 'Catering deposit for event on Jul 25. Balance due on delivery.',
    status: 'sent_in_chat',
    currency: 'NGN',
    createdAt: '2026-07-01T09:20:00.000Z',
    updatedAt: '2026-07-01T09:20:00.000Z',
    sentInChatAt: '2026-07-01T09:20:00.000Z',
    paymentStatus: 'partially_paid',
    payments: [
      {
        id: 'pay_seed_overdue_001',
        amount: 3000,
        date: '2026-07-03T10:00:00.000Z',
        method: 'bank_transfer',
        note: 'Deposit installment',
        recordedAt: '2026-07-03T10:05:00.000Z',
      },
    ],
    issueDate: '2026-07-01T09:20:00.000Z',
    dueDate: '2026-07-10T23:59:00.000Z',
    fulfilmentMethod: 'delivery',
    fulfilmentDetails: {
      address: '24 Bourdillon Road, Ikoyi, Lagos',
      deliveryFee: 1500,
      dateTime: '2026-07-25T18:00:00.000Z',
      instructions: 'Setup at the backyard tent.',
    },
  },
  {
    id: 'seed_invoice_paid_001',
    invoiceNumber: 'SPICYREST-INV-12343',
    customerName: 'Jane S.',
    customerId: 'customer-001',
    chatId: 'chat-v1-customer-001',
    customerSource: 'the platform',
    shareCode: 'pq2r6s8t0u4w5x7y',
    items: [
      { id: 'si-5', name: 'Veggie Burger', quantity: 2, unitPrice: 2500, total: 5000 },
      { id: 'si-6', name: 'Fresh Smoothie', quantity: 2, unitPrice: 1500, total: 3000 },
    ],
    subtotal: 8000,
    tax: 600,
    discount: 0,
    total: 8600,
    notes: 'Thanks for your order!',
    status: 'paid',
    currency: 'NGN',
    createdAt: '2026-07-05T14:10:00.000Z',
    updatedAt: '2026-07-06T11:00:00.000Z',
    sentInChatAt: '2026-07-05T14:10:00.000Z',
    paidAt: '2026-07-06T11:00:00.000Z',
    paymentStatus: 'paid',
    payments: [
      {
        id: 'pay_seed_paid_001',
        amount: 8600,
        date: '2026-07-06T11:00:00.000Z',
        method: 'card_direct',
        note: 'Full payment on pickup',
        recordedAt: '2026-07-06T11:02:00.000Z',
      },
    ],
    issueDate: '2026-07-05T14:10:00.000Z',
    dueDate: '2026-07-07T23:59:00.000Z',
    fulfilmentMethod: 'pickup',
    fulfilmentDetails: {
      location: '15 Admiralty Way, Lekki Phase 1',
      dateTime: '2026-07-06T12:30:00.000Z',
    },
  },
];

type InvoiceContextValue = {
  invoices: Invoice[];
  isLoading: boolean;
  createInvoice: (invoiceData: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt'>) => Promise<Invoice>;
  /** Copies an invoice into a fresh draft server-side. Returns the new id. */
  duplicateInvoiceById: (id: string) => Promise<string | null>;
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  getInvoiceById: (id: string) => Invoice | undefined;
  getInvoiceByShareCode: (shareCode: string) => Invoice | undefined;
  /** Resolves a shared link server-side for someone who does not own it. */
  fetchPublicInvoice: (shareCode: string) => Promise<Invoice | undefined>;
  /** Cancels an invoice server-side. The only status transition the backend takes. */
  cancelInvoice: (id: string) => Promise<void>;
  /** Server-rendered PDF, plan-gated by canDownloadInvoicePdf. */
  downloadInvoicePdf: (id: string) => Promise<{ pdfBase64: string; fileName: string } | null>;
  sendInvoiceInChat: (id: string, chatId: string, customerId?: string) => Promise<void>;
  markInvoiceSharedExternally: (id: string) => Promise<void>;
  recordPayment: (id: string, payment: Omit<InvoicePaymentRecord, 'id' | 'recordedAt'>) => Promise<InvoicePaymentRecord | null>;
  deletePayment: (invoiceId: string, paymentId: string) => Promise<void>;
  /** Ledger figures per invoice: what is paid, what is left, and the derived status. */
  ledgerFor: (invoiceId: string) => InvoiceLedgerView | undefined;
};

const DEFAULT_INVOICE_CONTEXT_VALUE: InvoiceContextValue = {
  invoices: [],
  isLoading: true,
  duplicateInvoiceById: async () => null,
  createInvoice: async () => {
    throw new Error('InvoiceProvider is not mounted yet.');
  },
  updateInvoice: async () => {},
  deleteInvoice: async () => {},
  getInvoiceById: () => undefined,
  getInvoiceByShareCode: () => undefined,
  fetchPublicInvoice: async () => undefined,
  cancelInvoice: async () => {},
  downloadInvoicePdf: async () => null,
  sendInvoiceInChat: async () => {},
  markInvoiceSharedExternally: async () => {},
  recordPayment: async () => null,
  deletePayment: async () => {},
  ledgerFor: () => undefined,
};

export const [InvoiceProvider, useInvoices] = createContextHook(() => {
  const queryClient = useQueryClient();

  /**
   * Live invoices for the signed-in vendor, and the ledger figures beside them.
   *
   * The seed below only ever applies to the built-in demo logins now. A real
   * account gets an empty list here and is filled by this listener, which is
   * accurate: a vendor who has raised no invoices has none.
   */
  const [backendInvoices, setBackendInvoices] = useState<Invoice[] | null>(null);
  const [ledgerByInvoice, setLedgerByInvoice] = useState<Record<string, InvoiceLedgerView>>({});

  useEffect(() => {
    let unsubscribeInvoices: (() => void) | null = null;

    const unsubscribeAuth = auth.onIdTokenChanged(async (fbUser) => {
      unsubscribeInvoices?.();
      unsubscribeInvoices = null;

      if (!fbUser) { setBackendInvoices(null); return; }
      const token = await fbUser.getIdTokenResult();
      const vendorId = token.claims.vendorId as string | undefined;
      if (!vendorId) { setBackendInvoices(null); return; }

      unsubscribeInvoices = onSnapshot(
        query(collection(db, 'invoices'), where('vendorId', '==', vendorId)),
        (snap) => {
          setBackendInvoices(snap.docs.map((d) => mapInvoiceDoc(d.id, d.data())));
          setLedgerByInvoice(
            Object.fromEntries(snap.docs.map((d) => [d.id, mapInvoiceLedger(d.data())])),
          );
        },
        (err) => {
          // An empty list beats stale invoices a vendor might chase payment on.
          console.error('[Invoices] Live subscription failed:', err);
          setBackendInvoices([]);
        },
      );
    });

    return () => { unsubscribeInvoices?.(); unsubscribeAuth(); };
  }, []);

  const invoicesQuery = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      let parsed: Invoice[] = stored ? (JSON.parse(stored) as Invoice[]) : [];
      // Demo logins only. A real account's invoices come from the listener
      // above; seeding them here would show a vendor invoices that do not
      // exist, against customers they have never had.
      if (!stored && DEV_LOCAL_AUTH_ENABLED) {
        parsed = SEED_INVOICES;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_INVOICES));
      }
      // Backfill share codes for invoices created before public links existed.
      let needsPersist = false;
      const withCodes = parsed.map((inv) => {
        if (!inv.shareCode) {
          needsPersist = true;
          return { ...inv, shareCode: generateShareCode() };
        }
        return inv;
      });
      if (needsPersist) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(withCodes));
      }
      return withCodes;
    },
  });

  const saveInvoicesMutation = useMutation({
    mutationFn: async (invoices: Invoice[]) => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
      return invoices;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  /**
   * Customer-facing invoice number in the approved VENDORSLUG-INV-12345
   * format (e.g. SPICYREST-INV-12345). The slug is uppercased and stripped
   * of non-alphanumerics; the sequence is the next monotonic 5-digit number.
   *
   * Never exposes timestamps, database IDs, or share codes. Mock uses the
   * current mock vendor's slug; Henry will supply the real vendor slug from
   * `vendorSubscriptions/{vendorId}` when wiring the backend.
   */
  const generateInvoiceNumber = (existing: Invoice[]): string => {
    const vendorSlug = (mockVendor.slug || mockVendor.name || 'VENDOR')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 12)
      .toUpperCase();
    const maxSeq = existing.reduce((acc, inv) => {
      const match = new RegExp(`^${vendorSlug}-INV-(\d+)$`).exec(inv.invoiceNumber);
      return match ? Math.max(acc, parseInt(match[1], 10)) : acc;
    }, 0);
    return `${vendorSlug}-INV-${String(maxSeq + 1).padStart(5, '0')}`;
  };

  const generateInvoiceId = () =>
    `invoice_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const createInvoice = async (
    invoiceData: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt'>
  ): Promise<Invoice> => {
    /**
     * Real vendors create invoices on the server.
     *
     * This used to write to AsyncStorage with a locally generated id and never
     * call the backend at all, while the read path and recordPayment were
     * already wired. So a vendor's invoice existed only on their device: it
     * never reached Firestore, never appeared on another device, and could not
     * be paid against, because recordPayment resolves the invoice server-side
     * and would not find it.
     *
     * Same guard recordPayment uses. In a release build DEV_LOCAL_AUTH_ENABLED
     * is false so this is always the server. In development it is the server
     * whenever a real vendor session has resolved, and the local path below
     * stays for the demo logins that have no backend account.
     *
     * The invoice number, share token and currency are all decided by the
     * server. Currency in particular: the app used to send a hardcoded 'NGN',
     * which gave a vendor in the United States naira invoices.
     */
    if (!DEV_LOCAL_AUTH_ENABLED || backendInvoices !== null) {
      const create = callable<
        Record<string, unknown>,
        { success: true; invoiceId: string; invoiceNumber: string }
      >('createInvoice');

      const res = await create({
        customerName: invoiceData.customerName,
        customerPhone: invoiceData.customerPhone ?? null,
        customerEmail: invoiceData.customerEmail ?? null,
        // The stored field is `description`; the app's interface calls it `name`.
        lineItems: (invoiceData.items ?? []).map((item) => ({
          description: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        notes: invoiceData.notes ?? null,
        // The Create Invoice screen's "the platform customer" mode already collects
        // these from the vendor's real chats. Sending them keeps the binding;
        // omitting them, as this first did, threw away the customer the vendor
        // had explicitly chosen and made the invoice indistinguishable from one
        // typed by hand.
        customerId: invoiceData.customerId ?? null,
        conversationId: invoiceData.conversationId ?? invoiceData.chatId ?? null,
      });

      // Returned for the caller that navigates straight to the new invoice. The
      // canonical copy arrives through the Firestore listener a moment later and
      // replaces this one, so nothing here is written to local storage — doing
      // that would leave a duplicate behind under a different id.
      return {
        ...invoiceData,
        id: res.data.invoiceId,
        invoiceNumber: res.data.invoiceNumber,
        createdAt: new Date().toISOString(),
      } as Invoice;
    }

    const invoices = invoicesQuery.data || [];
    const now = new Date().toISOString();
    const newInvoice: Invoice = {
      ...invoiceData,
      id: generateInvoiceId(),
      invoiceNumber: generateInvoiceNumber(invoices),
      shareCode: invoiceData.shareCode ?? generateShareCode(),
      createdAt: now,
      updatedAt: now,
      // Draft invoices have NO issue date — it is stamped only when the
      // invoice is first issued (sent in chat or shared externally). This
      // keeps the displayed issue date honest and prevents drafts from
      // showing a stale "issued" date that was really just their creation time.
      issueDate: invoiceData.status === 'draft' ? undefined : now,
    };
    await saveInvoicesMutation.mutateAsync([newInvoice, ...invoices]);
    return newInvoice;
  };

  /**
   * duplicateInvoice — copy an invoice into a fresh draft.
   *
   * The backend callable has been complete since Phase 3, gated by
   * canDuplicateInvoice and consuming its own quota. The mobile menu hid the
   * action behind a "post-MVP" comment, so a finished, plan-gated feature was
   * unreachable while sitting in the agreed scope.
   *
   * The plan check is left to the backend rather than re-derived here. A client
   * deciding its own gates is what made Basic vendors see Standard widgets on
   * the dashboard; the server already knows and refuses with a message worth
   * showing.
   */
  const duplicateInvoiceById = async (id: string): Promise<string | null> => {
    const duplicate = callable<
      { invoiceId: string },
      { success: true; invoiceId: string; invoiceNumber: string }
    >('duplicateInvoice');
    const res = await duplicate({ invoiceId: id });
    return res.data.invoiceId;
  };

  const updateInvoice = async (id: string, updates: Partial<Invoice>) => {
    /**
     * Edits went to AsyncStorage while the screen renders the backend list, so
     * for a real vendor "Edit draft" had no visible effect at all.
     *
     * Only the fields the backend accepts are sent. It decides what may change
     * based on what has happened to the invoice: money is editable only while
     * the customer has never been sent a figure, nothing is editable once a
     * payment exists, and currency is never editable because it follows the
     * vendor's country. Local-only fields on the app's richer Invoice shape are
     * intentionally not forwarded.
     */
    if (!DEV_LOCAL_AUTH_ENABLED || backendInvoices?.some((inv) => inv.id === id)) {
      const edit = callable<Record<string, unknown>, { success: true }>('updateInvoice');
      const payload: Record<string, unknown> = { invoiceId: id };

      if (updates.customerName !== undefined) payload.customerName = updates.customerName;
      if (updates.customerPhone !== undefined) payload.customerPhone = updates.customerPhone ?? null;
      if (updates.customerEmail !== undefined) payload.customerEmail = updates.customerEmail ?? null;
      if (updates.notes !== undefined) payload.notes = updates.notes ?? null;
      if (updates.dueDate !== undefined) payload.dueDate = updates.dueDate ?? null;
      if (updates.items !== undefined) {
        payload.lineItems = (updates.items ?? []).map((item) => ({
          description: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }));
      }

      // Nothing but the id: a caller changing only local display state has
      // nothing for the server, and a no-op write would still bump updatedAt.
      if (Object.keys(payload).length === 1) return;

      await edit(payload);
      return;
    }

    const invoices = invoicesQuery.data || [];
    const updated = invoices.map((inv) =>
      inv.id === id ? { ...inv, ...updates, updatedAt: new Date().toISOString() } : inv
    );
    await saveInvoicesMutation.mutateAsync(updated);
  };

  /**
   * cancelInvoice — the only status transition the backend still accepts.
   *
   * updateInvoiceStatus has been deployed since Phase 3 and nothing called it,
   * so cancelling was local-only and invisible to the server. It refuses `paid`
   * outright: settlement is decided by the ledger, not by writing a status.
   */
  const cancelInvoice = async (id: string) => {
    const setStatus = callable<{ invoiceId: string; status: string }, { success: true }>(
      'updateInvoiceStatus',
    );
    await setStatus({ invoiceId: id, status: 'cancelled' });
  };

  /**
   * downloadInvoicePdf — returns base64 for the caller to share or save.
   *
   * Plan-gated server-side by canDownloadInvoicePdf, and gated there rather
   * than here on purpose. A paid invoice renders with the branding frozen when
   * it settled, so a receipt keeps the look it had at the time.
   */
  const downloadInvoicePdf = async (
    id: string,
  ): Promise<{ pdfBase64: string; fileName: string } | null> => {
    const download = callable<
      { invoiceId: string },
      { success: true; pdfBase64: string; fileName: string }
    >('downloadInvoicePdf');
    const res = await download({ invoiceId: id });
    return { pdfBase64: res.data.pdfBase64, fileName: res.data.fileName };
  };

  const deleteInvoice = async (id: string) => {
    /**
     * This filtered the local list while the screen renders the backend list,
     * so for a real vendor Delete Draft did nothing at all — it neither removed
     * the invoice server-side nor took the row off the screen. It read as a
     * broken button because it was one.
     *
     * The backend refuses to delete anything with history: an invoice that has
     * been sent, viewed or had any payment recorded against it must be
     * cancelled instead, and says so. Only a draft nobody ever saw is
     * removable, which is what this action has always claimed to do.
     */
    if (!DEV_LOCAL_AUTH_ENABLED || backendInvoices?.some((inv) => inv.id === id)) {
      const remove = callable<{ invoiceId: string }, { success: true }>('deleteInvoice');
      await remove({ invoiceId: id });
      // No local write: the listener removes the row when Firestore confirms.
      return;
    }

    const invoices = invoicesQuery.data || [];
    await saveInvoicesMutation.mutateAsync(
      invoices.filter((inv) => inv.id !== id)
    );
  };

  const getInvoiceById = (id: string): Invoice | undefined =>
    (invoicesQuery.data || []).find((inv) => inv.id === id);

  /** Resolve an invoice from its public share code (the platform.app/i/{shareCode}). */
  const getInvoiceByShareCode = (shareCode: string): Invoice | undefined =>
    (backendInvoices ?? invoicesQuery.data ?? []).find((inv) => inv.shareCode === shareCode);

  /**
   * fetchPublicInvoice — resolve a shared link for someone who does not own it.
   *
   * The public page looked the share code up in the device's own list, which
   * can only ever succeed for the vendor who created the invoice on that
   * device. For the customer the link is actually for — a different person on a
   * different phone — there was nothing to find, so the page was empty. It also
   * searched the local AsyncStorage list rather than the backend one, so it
   * failed for the vendor too once their invoices came from Firestore.
   *
   * getPublicInvoice has been deployed since Phase 3 and nothing called it. It
   * resolves by share token server-side and strips the token from what it
   * returns, so possessing a link never leaks the means to guess another.
   *
   * The local lookup is still tried first: the vendor previewing their own
   * invoice should not need a round trip.
   */
  const fetchPublicInvoice = async (shareCode: string): Promise<Invoice | undefined> => {
    const local = getInvoiceByShareCode(shareCode);
    if (local) return local;

    try {
      const fetchPublic = callable<
        { shareCode: string },
        { success: true; invoice: Record<string, unknown> }
      >('getPublicInvoice');
      const res = await fetchPublic({ shareCode });
      const raw = res.data.invoice;
      return mapInvoiceDoc((raw.invoiceId as string) ?? shareCode, raw);
    } catch (error) {
      // A revoked or expired link is a normal outcome, not a fault. The page
      // shows its own not-found state rather than an error.
      console.warn('[Invoices] Public invoice not available:', error);
      return undefined;
    }
  };

  /**
   * Mark an invoice as sent inside a the platform chat thread.
   * Requires a valid chatId — will throw if missing. Stamps `issueDate` the
   * first time an invoice is issued so the customer-facing document shows the
   * real send date (not the draft's creation date). Draft → issued transitions
   * only; re-sends keep the original issue date.
   */
  const sendInvoiceInChat = async (id: string, chatId: string, customerId?: string) => {
    /**
     * This only ever rewrote local status fields. It never put anything in the
     * conversation, so "sent in chat" described a state on one device while the
     * customer's chat stayed empty — the invoice was marked delivered and never
     * delivered.
     *
     * sendInvoiceInChat posts the card server-side. It assembles the card from
     * the stored invoice rather than from anything sent here, since a client
     * able to name its own amount or invoice number could post a convincing
     * demand for money into someone's chat. It also binds chatId and
     * sentInChatAt onto the invoice, which is what makes the delivery status
     * derive as sent and what makes "Open chat" work at all.
     */
    if (!DEV_LOCAL_AUTH_ENABLED || backendInvoices?.some((inv) => inv.id === id)) {
      const send = callable<
        { invoiceId: string; chatId: string },
        { success: true; alreadySent: boolean }
      >('sendInvoiceInChat');
      await send({ invoiceId: id, chatId });
      // No local write: the listener brings back the bound invoice.
      return;
    }

    const invoices = invoicesQuery.data || [];
    const existing = invoices.find((inv) => inv.id === id);
    const wasDraft = existing?.status === 'draft';
    const now = new Date().toISOString();
    await updateInvoice(id, {
      status: 'sent_in_chat',
      chatId,
      customerId,
      sentInChatAt: now,
      // Stamp issueDate on the first issuance only.
      ...(wasDraft && !existing?.issueDate ? { issueDate: now } : {}),
    });
  };

  /**
   * Mark an invoice as externally shared (via native share sheet). Stamps
   * `issueDate` the first time an invoice is issued so the public invoice
   * page shows the real share date. Draft → issued transitions only.
   */
  const markInvoiceSharedExternally = async (id: string) => {
    const invoices = invoicesQuery.data || [];
    const existing = invoices.find((inv) => inv.id === id);
    const wasDraft = existing?.status === 'draft';
    const now = new Date().toISOString();
    await updateInvoice(id, {
      status: 'shared_externally',
      sharedAt: now,
      ...(wasDraft && !existing?.issueDate ? { issueDate: now } : {}),
    });
  };

  /**
   * Record a confirmed payment against an invoice. Mock-only — the backend
   * will own payment records. Recording a payment updates:
   *   - `payments` (append-only list)
   *   - `paymentStatus` (re-derived from `payments` via `resolvePaymentStatus`)
   *   - `status` → 'paid' when fully paid, and `paidAt` is stamped.
   *
   * Revenue aggregation (Today's Revenue, Total Revenue, Revenue Trend) is
   * driven off the payment `date` field, NOT the invoice total. See
   * BACKEND_INTEGRATION_GUIDE.md for the double-counting rules Henry must
   * enforce when invoices are linked to orders.
   */
  /**
   * Records money received.
   *
   * Goes to the backend, which owns the ledger and derives the invoice's status
   * from it. The local write below stays for the demo logins, which have no
   * backend invoice to record against.
   *
   * The idempotency key is derived from the invoice, amount and date rather
   * than being random, so a double tap sends the same key and the server
   * recognises it as one payment instead of two.
   */
  const recordPayment = async (
    id: string,
    payment: Omit<InvoicePaymentRecord, 'id' | 'recordedAt'>
  ): Promise<InvoicePaymentRecord | null> => {
    if (!DEV_LOCAL_AUTH_ENABLED || backendInvoices?.some((inv) => inv.id === id)) {
      const send = callable<Record<string, unknown>, { success: true; paymentId: string }>('recordPayment');
      try {
        const res = await send({
          invoiceId: id,
          amountMinorUnits: Math.round(Math.max(0, payment.amount)),
          method: payment.method ?? 'other',
          reference: payment.note ?? null,
          idempotencyKey: `${id}_${payment.amount}_${payment.date}`,
        });
        return {
          id: res.data.paymentId,
          amount: payment.amount,
          date: payment.date,
          method: payment.method,
          note: payment.note,
          recordedAt: new Date().toISOString(),
        };
      } catch (error) {
        console.error('[Invoices] recordPayment rejected:', error);
        return null;
      }
    }

    const invoices = invoicesQuery.data || [];
    const invoice = invoices.find((inv) => inv.id === id);
    if (!invoice) return null;
    const record: InvoicePaymentRecord = {
      id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      amount: Math.max(0, payment.amount),
      date: payment.date,
      method: payment.method,
      note: payment.note,
      recordedAt: new Date().toISOString(),
    };
    const nextPayments = [...(invoice.payments ?? []), record];
    const nextStatus = resolvePaymentStatus(invoice.total, nextPayments, invoice.paymentStatus);
    const updates: Partial<Invoice> = {
      payments: nextPayments,
      paymentStatus: nextStatus,
    };
    if (nextStatus === 'paid' && invoice.status !== 'paid') {
      updates.status = 'paid';
      updates.paidAt = new Date().toISOString();
    }
    await updateInvoice(id, updates);
    return record;
  };

  /**
   * Undoes a recorded payment.
   *
   * Named delete for the screens that already call it, but nothing is deleted:
   * the backend writes a reversal row pointing at the original, and both stay
   * readable. Deleting financial history would remove the evidence of what was
   * believed at the time, which is the thing an audit needs most.
   */
  const deletePayment = async (invoiceId: string, paymentId: string): Promise<void> => {
    if (!DEV_LOCAL_AUTH_ENABLED || backendInvoices?.some((inv) => inv.id === invoiceId)) {
      const reverse = callable<Record<string, unknown>, { success: true }>('reversePayment');
      try {
        await reverse({
          paymentId,
          reason: 'Removed by the vendor from payment history',
          idempotencyKey: `rev_${paymentId}`,
        });
      } catch (error) {
        console.error('[Invoices] reversePayment rejected:', error);
      }
      return;
    }

    const invoices = invoicesQuery.data || [];
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;
    const nextPayments = (invoice.payments ?? []).filter((p) => p.id !== paymentId);
    const nextStatus = resolvePaymentStatus(invoice.total, nextPayments, invoice.paymentStatus);
    const updates: Partial<Invoice> = {
      payments: nextPayments,
      paymentStatus: nextStatus,
    };
    if (nextStatus !== 'paid' && invoice.status === 'paid') {
      updates.status = 'sent_in_chat';
      updates.paidAt = undefined;
    }
    await updateInvoice(invoiceId, updates);
  };

  return {
    // Backend invoices win when they exist. The local list is the demo logins'
    // and a fallback while the listener is still resolving, so a real vendor
    // never sees fixture invoices against customers they have not had.
    invoices: backendInvoices ?? invoicesQuery.data ?? [],
    isLoading: backendInvoices === null && invoicesQuery.isLoading,
    /** Ledger figures per invoice: what is paid, what is left, and the derived status. */
    ledgerFor: (invoiceId: string): InvoiceLedgerView | undefined => ledgerByInvoice[invoiceId],
    createInvoice,
    updateInvoice,
    deleteInvoice,
    duplicateInvoiceById,
    getInvoiceById,
    getInvoiceByShareCode,
    fetchPublicInvoice,
    cancelInvoice,
    downloadInvoicePdf,
    sendInvoiceInChat,
    markInvoiceSharedExternally,
    recordPayment,
    deletePayment,
  };
}, DEFAULT_INVOICE_CONTEXT_VALUE);

/** Unguessable share code for public invoice links. */
function generateShareCode(): string {
  const part = () => Math.random().toString(36).slice(2, 10);
  return `${part()}${part()}${Date.now().toString(36)}`;
}
