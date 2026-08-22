import type { Order, OrderStatus, OrderItem, PaymentStatus } from '@/mocks/ordersData';
import type { PaymentState } from '@/constants/paymentStates';

/**
 * Turns a Firestore order document into the Order shape the app already uses.
 *
 * Eighteen screens read orders through OrdersContext. Rather than change all of
 * them, the backend document is mapped onto the existing shape, so the wiring
 * is contained to one file and every screen keeps working untouched.
 *
 * The two shapes differ in ways worth knowing:
 *
 *   - the backend nests money under orderSnapshot; the app reads it flat
 *   - the backend stores fulfillmentType lowercase and allows "shipping";
 *     the app expects 'Pickup' | 'Delivery' capitalised
 *   - the backend keeps names in vendorSnapshot/customerSnapshot; the app
 *     reads vendorName and customerName directly
 *   - timestamps are Firestore Timestamps, not the ISO strings the app sorts on
 */

/** Firestore timestamps arrive as objects, not dates, and sometimes as nulls. */
type FirestoreTimestampish =
  | { toDate: () => Date }
  | { seconds: number; nanoseconds?: number }
  | string
  | null
  | undefined;

function toIso(value: FirestoreTimestampish): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  const seconds = (value as { seconds?: number }).seconds;
  if (typeof seconds === 'number') return new Date(seconds * 1000).toISOString();
  return '';
}

/**
 * The app's union has no 'shipping'. Treating it as Delivery is the honest
 * mapping: from the customer's side both mean "it comes to me", and the
 * distinction only matters to the vendor's own logistics, which this shape does
 * not model.
 */
function toFulfillmentType(value: string | undefined): 'Pickup' | 'Delivery' {
  return value === 'pickup' ? 'Pickup' : 'Delivery';
}

function toItems(raw: unknown): OrderItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((it, index) => {
    const item = it as Record<string, unknown>;
    return {
      // Snapshots may predate an itemId, so fall back to a stable index key
      // rather than risk duplicate React keys in a list.
      id: (item.itemId as string) ?? `item-${index}`,
      name: (item.name as string) ?? 'Item',
      quantity: (item.quantity as number) ?? 1,
      // Real order documents (createOrder.ts / createExternalOrder) snapshot
      // items as { basePrice, salePrice, lineTotal, quantity }, never
      // price_at_order or price — this was reading fields that don't exist
      // on any real order, silently showing ₦0.00 for every line item while
      // the aggregate subtotal/total (read separately from orderSnapshot)
      // stayed correct. salePrice/basePrice matches exactly how the backend
      // itself resolves unit price (repriceCart.ts); lineTotal/quantity is a
      // last-resort derivation; price_at_order/price are kept as a fallback
      // only in case an older document shape still uses them.
      price:
        (item.salePrice as number) ??
        (item.basePrice as number) ??
        (typeof item.lineTotal === 'number' && typeof item.quantity === 'number' && (item.quantity as number) > 0
          ? (item.lineTotal as number) / (item.quantity as number)
          : undefined) ??
        (item.price_at_order as number) ??
        (item.price as number) ??
        0,
      addOns: Array.isArray(item.addOns)
        ? (item.addOns as Record<string, unknown>[]).map((a) => ({
            id: (a.id as string) ?? '',
            name: (a.name as string) ?? '',
            price: (a.price as number) ?? 0,
          }))
        : undefined,
    } as OrderItem;
  });
}

/**
 * The app's payment banner logic (order/[id].tsx, vendor/chats/[orderId].tsx)
 * reads order.paymentState — a field only ever set by the mock data and the
 * local-only vendorConfirmPayment/vendorMarkNotPaid state updates. Real
 * orders only carry the backend's own paymentStatus enum (set by
 * submitPaymentProof/reviewPaymentProof), under different names and values.
 * Translated here so those screens' existing paymentState checks work
 * unmodified for real orders too, same "map onto the existing shape in one
 * place" approach as the rest of this file.
 */
function toPaymentState(paymentStatus: string | undefined): PaymentState | undefined {
  switch (paymentStatus) {
    case 'PROOF_SUBMITTED': return 'CUSTOMER_MARKED_PAID';
    case 'PROOF_ACCEPTED': return 'VENDOR_PAYMENT_CONFIRMED';
    case 'PROOF_REJECTED': return 'PAYMENT_REJECTED';
    case 'PROOF_LOCKED': return 'PAYMENT_REJECTED';
    default: return undefined;
  }
}

export function mapOrderDoc(id: string, data: Record<string, unknown>): Order {
  const snapshot = (data.orderSnapshot ?? {}) as Record<string, number | string>;
  const vendorSnapshot = (data.vendorSnapshot ?? {}) as Record<string, string>;
  const customerSnapshot = (data.customerSnapshot ?? {}) as Record<string, string>;

  return {
    id,
    publicOrderId: (data.publicOrderId as string) ?? id,
    vendorId: (data.vendorId as string) ?? '',
    vendorName: vendorSnapshot.name ?? '',
    // An external order has no the platform customer, so the name the vendor typed
    // in is the only one there is.
    customerName:
      customerSnapshot.displayName ??
      (data.externalCustomerName as string) ??
      undefined,
    customerId: (data.customerId as string) ?? undefined,
    status: (data.status as OrderStatus) ?? 'requested',
    orderDate: toIso(data.createdAt as FirestoreTimestampish),
    fulfillmentType: toFulfillmentType(data.fulfillmentType as string),
    fulfillmentMethod: (data.fulfillmentType as Order['fulfillmentMethod']) ?? 'pickup',
    items: toItems(data.items),
    subtotal: Number(snapshot.subtotal ?? 0),
    tax: Number(snapshot.tax ?? 0),
    discount: Number(snapshot.discount ?? 0),
    total: Number(snapshot.total ?? 0),
    currency: (snapshot.currency as string) ?? 'NGN',
    paymentStatus: (data.paymentStatus as PaymentStatus) ?? undefined,
    paymentState: toPaymentState(data.paymentStatus as string | undefined),
    orderSource: (data.orderSource as Order['orderSource']) ?? 'internal',
    orderNote: (data.orderNote as string) ?? undefined,
  } as Order;
}
