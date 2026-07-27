import type { VendorPromotion } from '@/mocks/promotionsData';

export interface ItemPricingResult {
  finalPrice: number;
  originalPrice: number;
  savingsPerUnit: number;
  hasDiscount: boolean;
}

export function getItemFinalPrice(
  item: { price: number; salePrice?: number },
  _activePromotions: VendorPromotion[] = []
): number {
  if (
    item.salePrice !== undefined &&
    item.salePrice > 0 &&
    item.salePrice < item.price
  ) {
    return item.salePrice;
  }
  return item.price;
}

export function getItemPricingResult(
  item: { price: number; salePrice?: number },
  activePromotions: VendorPromotion[] = []
): ItemPricingResult {
  const originalPrice = item.price;
  const finalPrice = getItemFinalPrice(item, activePromotions);
  const savingsPerUnit = originalPrice - finalPrice;
  return {
    finalPrice,
    originalPrice,
    savingsPerUnit,
    hasDiscount: savingsPerUnit > 0,
  };
}
