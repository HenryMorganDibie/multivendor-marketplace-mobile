export type PromotionType = 'percentage' | 'flat' | 'bogo' | 'free_item' | 'free_delivery';

export type PromotionCategory = 'discount' | 'value' | 'delivery';

export type StackingMode = 'single' | 'delivery_only' | 'advanced';

export function getPromotionCategory(type: PromotionType): PromotionCategory {
  switch (type) {
    case 'percentage':
    case 'flat':
      return 'discount';
    case 'bogo':
    case 'free_item':
      return 'value';
    case 'free_delivery':
      return 'delivery';
  }
}

export interface VendorPromotion {
  id: string;
  vendorId: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  type: PromotionType;
  discountValue: number;
  minimumOrder: number;
  maxDiscount?: number;
  freeItemName?: string;
  bogoItemName?: string;
  applicableItemIds?: string[];
  applicableCategoryIds?: string[];
  active: boolean;
  startDate: string;
  endDate: string;
  icon: 'percent' | 'gift' | 'truck' | 'tag' | 'zap';
  eligibility?: 'all' | 'pickup' | 'delivery';
  vendorTerms?: string;
}

export const mockVendorPromotions: VendorPromotion[] = [
  {
    id: 'promo-1',
    vendorId: 'v1',
    title: '15% OFF orders ₦8,000+',
    shortDescription: 'Get 15% off when you spend ₦8,000 or more',
    fullDescription: 'Enjoy 15% off your entire order when your subtotal reaches ₦8,000 or more. This promotion is automatically applied at checkout — no code needed. Cannot be combined with other promotions.',
    type: 'percentage',
    discountValue: 15,
    minimumOrder: 8000,
    maxDiscount: 2000,
    active: true,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    icon: 'percent',
    eligibility: 'all',
    vendorTerms: 'Cannot be combined with other promotions. Valid on all menu items.',
  },
  {
    id: 'promo-2',
    vendorId: 'v1',
    title: 'Free Puff Puff ₦5,000+',
    shortDescription: 'Get free Puff Puff on orders over ₦5,000',
    fullDescription: 'Order ₦5,000 or more and receive a free serving of our signature Puff Puff! Automatically added to qualifying orders. While stocks last.',
    type: 'free_item',
    discountValue: 0,
    minimumOrder: 5000,
    freeItemName: 'Puff Puff',
    applicableItemIds: ['6'],
    active: true,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    icon: 'gift',
    eligibility: 'all',
  },
  {
    id: 'promo-3',
    vendorId: 'v1',
    title: 'Buy 1 Get 1 Spring Roll',
    shortDescription: 'Buy any Spring Roll, get one free',
    fullDescription: 'Purchase any Spring Roll and receive a second one absolutely free. The discount is automatically applied when you add 2 or more Spring Rolls to your cart.',
    type: 'bogo',
    discountValue: 0,
    minimumOrder: 0,
    bogoItemName: 'Spring Rolls',
    applicableItemIds: ['5'],
    active: true,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    icon: 'tag',
    eligibility: 'all',
  },
  {
    id: 'promo-4',
    vendorId: 'v1',
    title: 'Free delivery ₦7,000+',
    shortDescription: 'Free delivery on orders over ₦7,000',
    fullDescription: 'Spend ₦7,000 or more and enjoy free delivery to your location. Applies to all delivery orders within the vendor\'s delivery zone. Automatically applied at checkout.',
    type: 'free_delivery',
    discountValue: 0,
    minimumOrder: 7000,
    active: true,
    startDate: '2026-01-01',
    endDate: '2026-06-30',
    icon: 'truck',
    eligibility: 'delivery',
    vendorTerms: 'Free delivery applies within 5km radius only.',
  },
];

let _externalPromotions: VendorPromotion[] = [];

export function setExternalPromotions(promotions: VendorPromotion[]) {
  _externalPromotions = promotions;
}

export function getActivePromotions(vendorId: string): VendorPromotion[] {
  const now = new Date();
  const all = [...mockVendorPromotions, ..._externalPromotions];
  const seen = new Set<string>();
  return all.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return (
      p.vendorId === vendorId &&
      p.active &&
      new Date(p.startDate) <= now &&
      new Date(p.endDate) >= now
    );
  });
}

export type PromoSelectionStatus = 'selected' | 'available' | 'unavailable';

export interface AppliedPromotion {
  promotion: VendorPromotion;
  discountAmount: number;
  description: string;
}

export interface EvaluatedPromotion {
  promotion: VendorPromotion;
  eligible: boolean;
  discountAmount: number;
  description: string;
  category: PromotionCategory;
  status: PromoSelectionStatus;
}

function evaluateSinglePromo(
  promo: VendorPromotion,
  subtotal: number,
  cartItemIds: string[],
  cartItemQuantities: Record<string, number>
): { eligible: boolean; discountAmount: number; description: string } {
  switch (promo.type) {
    case 'percentage': {
      if (subtotal >= promo.minimumOrder) {
        let discount = Math.round(subtotal * (promo.discountValue / 100));
        if (promo.maxDiscount && discount > promo.maxDiscount) {
          discount = promo.maxDiscount;
        }
        return { eligible: true, discountAmount: discount, description: promo.title };
      }
      return { eligible: false, discountAmount: 0, description: promo.title };
    }
    case 'flat': {
      if (subtotal >= promo.minimumOrder) {
        return { eligible: true, discountAmount: promo.discountValue, description: promo.title };
      }
      return { eligible: false, discountAmount: 0, description: promo.title };
    }
    case 'free_item': {
      const desc = `Free ${promo.freeItemName}`;
      if (subtotal >= promo.minimumOrder) {
        return { eligible: true, discountAmount: 0, description: desc };
      }
      return { eligible: false, discountAmount: 0, description: desc };
    }
    case 'bogo': {
      const bogoItemIds = promo.applicableItemIds || [];
      const hasBogoItem = bogoItemIds.some((id) => cartItemIds.includes(id));
      const desc = `Buy 1 Get 1 ${promo.bogoItemName}`;
      if (hasBogoItem) {
        const bogoQty = bogoItemIds.reduce((sum, id) => sum + (cartItemQuantities[id] || 0), 0);
        if (bogoQty >= 2) {
          return { eligible: true, discountAmount: 0, description: desc };
        }
      }
      return { eligible: false, discountAmount: 0, description: desc };
    }
    case 'free_delivery': {
      if (subtotal >= promo.minimumOrder) {
        return { eligible: true, discountAmount: 0, description: promo.title };
      }
      return { eligible: false, discountAmount: 0, description: promo.title };
    }
    default:
      return { eligible: false, discountAmount: 0, description: '' };
  }
}

function pickBestInCategory(
  evaluated: EvaluatedPromotion[],
  category: PromotionCategory
): EvaluatedPromotion | null {
  const eligible = evaluated.filter((e) => e.category === category && e.eligible);
  if (eligible.length === 0) return null;

  if (category === 'discount') {
    return eligible.reduce((best, cur) => (cur.discountAmount > best.discountAmount ? cur : best));
  }
  return eligible[0];
}

export function evaluatePromotionsWithStatus(
  vendorId: string,
  subtotal: number,
  cartItemIds: string[],
  cartItemQuantities: Record<string, number>,
  stackingMode: StackingMode = 'single'
): EvaluatedPromotion[] {
  const activePromos = getActivePromotions(vendorId);
  console.log('[Promotions] Evaluating', activePromos.length, 'promos, stacking:', stackingMode);

  const evaluated: EvaluatedPromotion[] = activePromos.map((promo) => {
    const result = evaluateSinglePromo(promo, subtotal, cartItemIds, cartItemQuantities);
    return {
      promotion: promo,
      eligible: result.eligible,
      discountAmount: result.discountAmount,
      description: result.description,
      category: getPromotionCategory(promo.type),
      status: 'available' as PromoSelectionStatus,
    };
  });

  if (stackingMode === 'single') {
    const allEligible = evaluated.filter((e) => e.eligible);
    let best: EvaluatedPromotion | null = null;

    if (allEligible.length > 0) {
      const discountPromos = allEligible.filter((e) => e.category === 'discount');
      const valuePromos = allEligible.filter((e) => e.category === 'value');
      const deliveryPromos = allEligible.filter((e) => e.category === 'delivery');

      const bestDiscount = discountPromos.reduce<EvaluatedPromotion | null>(
        (b, c) => (!b || c.discountAmount > b.discountAmount ? c : b), null
      );
      const bestValue = valuePromos[0] ?? null;
      const bestDelivery = deliveryPromos[0] ?? null;

      const candidates = [bestDiscount, bestValue, bestDelivery].filter(Boolean) as EvaluatedPromotion[];
      best = candidates.reduce<EvaluatedPromotion | null>(
        (b, c) => (!b || c.discountAmount > b.discountAmount ? c : b), null
      );
    }

    return evaluated.map((e) => {
      if (best && e.promotion.id === best.promotion.id) {
        return { ...e, status: 'selected' as const };
      }
      if (!e.eligible) {
        return { ...e, status: 'unavailable' as const };
      }
      return { ...e, status: 'available' as const };
    });
  }

  if (stackingMode === 'delivery_only') {
    const bestDiscount = pickBestInCategory(evaluated, 'discount');
    const bestValue = pickBestInCategory(evaluated, 'value');
    const bestDelivery = pickBestInCategory(evaluated, 'delivery');

    const nonDeliveryEligible = evaluated.filter((e) => e.eligible && e.category !== 'delivery');
    let bestNonDelivery: EvaluatedPromotion | null = null;
    if (nonDeliveryEligible.length > 0) {
      const bd = bestDiscount;
      const bv = bestValue;
      bestNonDelivery = bd && bv
        ? (bd.discountAmount >= bv.discountAmount ? bd : bv)
        : bd ?? bv;
    }

    const selectedIds = new Set<string>();
    if (bestNonDelivery) selectedIds.add(bestNonDelivery.promotion.id);
    if (bestDelivery) selectedIds.add(bestDelivery.promotion.id);

    return evaluated.map((e) => {
      if (selectedIds.has(e.promotion.id)) {
        return { ...e, status: 'selected' as const };
      }
      if (!e.eligible) {
        return { ...e, status: 'unavailable' as const };
      }
      return { ...e, status: 'available' as const };
    });
  }

  if (stackingMode === 'advanced') {
    const bestDiscount = pickBestInCategory(evaluated, 'discount');
    const bestValue = pickBestInCategory(evaluated, 'value');
    const bestDelivery = pickBestInCategory(evaluated, 'delivery');

    const selectedIds = new Set<string>();
    if (bestDiscount) selectedIds.add(bestDiscount.promotion.id);
    if (bestValue) selectedIds.add(bestValue.promotion.id);
    if (bestDelivery) selectedIds.add(bestDelivery.promotion.id);

    return evaluated.map((e) => {
      if (selectedIds.has(e.promotion.id)) {
        return { ...e, status: 'selected' as const };
      }
      if (!e.eligible) {
        return { ...e, status: 'unavailable' as const };
      }
      return { ...e, status: 'available' as const };
    });
  }

  return evaluated;
}

export function evaluatePromotions(
  vendorId: string,
  subtotal: number,
  cartItemIds: string[],
  cartItemQuantities: Record<string, number>,
  stackingMode: StackingMode = 'single'
): AppliedPromotion[] {
  const results = evaluatePromotionsWithStatus(vendorId, subtotal, cartItemIds, cartItemQuantities, stackingMode);
  return results
    .filter((e) => e.status === 'selected')
    .map((e) => ({
      promotion: e.promotion,
      discountAmount: e.discountAmount,
      description: e.description,
    }));
}

export function getPromotionItemIds(vendorId: string): string[] {
  const activePromos = getActivePromotions(vendorId);
  const ids = new Set<string>();
  for (const promo of activePromos) {
    if (promo.applicableItemIds) {
      promo.applicableItemIds.forEach((id) => ids.add(id));
    }
  }
  return Array.from(ids);
}

export function getPromotionBadgeForItem(vendorId: string, itemId: string): string | null {
  const activePromos = getActivePromotions(vendorId);
  for (const promo of activePromos) {
    if (promo.applicableItemIds?.includes(itemId)) {
      switch (promo.type) {
        case 'bogo':
          return 'BUY 1 GET 1';
        case 'free_item':
          return 'FREE ITEM';
        default:
          return 'OFFER';
      }
    }
  }
  return null;
}
