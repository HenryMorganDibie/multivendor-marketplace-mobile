import type { CartItem } from '@/contexts/CartContext';
import type { ContactCard } from '@/contexts/ContactCardsContext';

export interface ReviewOrderNavigationParams {
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
  } = input;

  return {
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
