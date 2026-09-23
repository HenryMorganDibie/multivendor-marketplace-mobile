export function calculateTax(subtotal: number, taxEnabled: boolean, taxRate: number): number {
  return taxEnabled ? subtotal * taxRate : 0;
}

export function calculateTotal(subtotal: number, tax: number, discount: number): number {
  return subtotal + tax - discount;
}

export interface PromoValidationResult {
  valid: boolean;
  discount: number;
  message: string;
}

const VALID_PROMO_CODES: Record<string, { discount: number; type: 'percentage' | 'flat'; expiryDate?: string }> = {
  WELCOME10: { discount: 10, type: 'percentage' },
  SAVE500: { discount: 500, type: 'flat' },
  PLATFORM20: { discount: 20, type: 'percentage' },
  EXPIRED: { discount: 15, type: 'percentage', expiryDate: '2024-01-01' },
};

export function validatePromoCode(code: string, subtotal: number): PromoValidationResult {
  const upperCode = code.toUpperCase().trim();

  if (!VALID_PROMO_CODES[upperCode]) {
    return { valid: false, discount: 0, message: 'Invalid promo code' };
  }

  const promo = VALID_PROMO_CODES[upperCode];

  if (promo.expiryDate && new Date(promo.expiryDate) < new Date()) {
    return { valid: false, discount: 0, message: 'Promo code expired' };
  }

  const discountAmount =
    promo.type === 'percentage'
      ? Math.round(subtotal * (promo.discount / 100))
      : promo.discount;

  return { valid: true, discount: discountAmount, message: 'Promo code applied' };
}

export interface CanSubmitOrderParams {
  selectedFulfillment: string | null;
  itemsCount: number;
  isBelowMinimum: boolean;
  isVendorUnavailable: boolean;
  hasItemsRequiringSelection: boolean;
  requiresOrderTiming?: boolean;
  timingPreference?: 'flexible' | 'schedule';
  hasScheduledDateTime?: boolean;
}

export function checkCanSubmitOrder(params: CanSubmitOrderParams): boolean {
  const {
    selectedFulfillment,
    itemsCount,
    isBelowMinimum,
    isVendorUnavailable,
    hasItemsRequiringSelection,
    requiresOrderTiming,
    timingPreference,
    hasScheduledDateTime,
  } = params;

  const timingValid = !requiresOrderTiming ||
    timingPreference === 'flexible' ||
    (timingPreference === 'schedule' && hasScheduledDateTime);

  return (
    selectedFulfillment !== null &&
    itemsCount > 0 &&
    !isBelowMinimum &&
    !hasItemsRequiringSelection &&
    !!timingValid
  );
}
