import type { CartItem } from '@/contexts/CartContext';
import type { ContactCard } from '@/contexts/ContactCardsContext';

export interface ReviewOrderNavigationParams {
  vendorId: string;
  fulfillmentType: string;
  orderNote: string;
  subtotal: string;
  tax: string;
  discount: string;
  total: string;
  items: string;
  promoCode: string;
  preferredDate: string;
  preferredTime: string;
  contactCard: string;
}

export interface BuildReviewOrderParamsInput {
  /** Which vendor this basket belongs to. */
  vendorId?: string;
  fulfillmentType: string | null;
  orderNote: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  items: CartItem[];
  promoCode: string;
  promoApplied: boolean;
  preferredDate: Date | null;
  preferredTime: string;
  selectedContactCard: ContactCard | null;
}

export function buildReviewOrderNavigationParams(
  input: BuildReviewOrderParamsInput
): ReviewOrderNavigationParams {
  const {
    fulfillmentType,
    orderNote,
    subtotal,
    tax,
    discount,
    total,
    items,
    promoCode,
    promoApplied,
    preferredDate,
    preferredTime,
    selectedContactCard,
    vendorId,
  } = input;

  return {
    // Carried through so the review screen knows which vendor this basket is
    // for. Without it that screen fell back to the demo vendor, so every order
    // was attributed to the same fixture business whichever storefront the
    // customer actually ordered from — and since that id does not exist in
    // Firestore, the real order could never resolve a vendor either.
    vendorId: vendorId ?? '',
    fulfillmentType: fulfillmentType ?? '',
    orderNote: orderNote.trim(),
    subtotal: subtotal.toString(),
    tax: tax.toString(),
    discount: discount.toString(),
    total: total.toString(),
    items: JSON.stringify(items),
    promoCode: promoApplied ? promoCode : '',
    preferredDate: preferredDate
      ? preferredDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '',
    preferredTime,
    contactCard: selectedContactCard ? JSON.stringify(selectedContactCard) : '',
  };
}
