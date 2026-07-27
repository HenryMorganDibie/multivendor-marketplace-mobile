export type PromoType = 'bogo' | 'free_item' | 'free_delivery' | 'percentage' | 'flat';

export type PersonalizationReason =
  | 'ordered_similar'
  | 'popular_area'
  | 'recently_viewed'
  | 'searched'
  | 'trending';

export interface PromoDeal {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorUsername: string;
  vendorRating: number;
  vendorReviewCount: number;
  bannerImage: string;
  logoImage?: string;
  promoTitle: string;
  promoType: PromoType;
  promoBadge: string;
  deliveryTime: string;
  isOpen: boolean;
  reasonType: PersonalizationReason;
  reasonText: string;
  city: string;
  countryCode: string;
  region: string;
  isActive: boolean;
  category: string;
}

export const REASON_LABEL: Record<PersonalizationReason, string> = {
  ordered_similar: 'Because you ordered similar items',
  popular_area: 'Popular in your area',
  recently_viewed: 'Based on your recent views',
  searched: 'Because you searched for this',
  trending: 'Trending near you',
};

export const PROMO_BADGE_STYLE: Record<PromoType, { bg: string; text: string }> = {
  bogo: { bg: '#FF8C42', text: '#FFFFFF' },
  free_item: { bg: '#FF8C42', text: '#FFFFFF' },
  free_delivery: { bg: '#FF8C42', text: '#FFFFFF' },
  percentage: { bg: '#FF8C42', text: '#FFFFFF' },
  flat: { bg: '#FF8C42', text: '#FFFFFF' },
};

export const mockPromoDeals: PromoDeal[] = [
  {
    id: 'pd-1',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    vendorUsername: 'spicyrest',
    vendorRating: 4.7,
    vendorReviewCount: 24,
    bannerImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
    promoTitle: 'Buy 1 Get 1 Spring Roll',
    promoType: 'bogo',
    promoBadge: 'BUY 1 GET 1',
    deliveryTime: '20–35 min',
    isOpen: true,
    reasonType: 'ordered_similar',
    reasonText: REASON_LABEL.ordered_similar,
    city: 'Lekki',
    countryCode: 'NG',
    region: 'Lagos',
    isActive: true,
    category: 'Food & Catering',
  },
  {
    id: 'pd-2',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    vendorUsername: 'spicyrest',
    vendorRating: 4.7,
    vendorReviewCount: 24,
    bannerImage: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80',
    promoTitle: 'Free Puff Puff on ₦5,000+',
    promoType: 'free_item',
    promoBadge: 'FREE ITEM',
    deliveryTime: '20–35 min',
    isOpen: true,
    reasonType: 'recently_viewed',
    reasonText: REASON_LABEL.recently_viewed,
    city: 'Lekki',
    countryCode: 'NG',
    region: 'Lagos',
    isActive: true,
    category: 'Food & Catering',
  },
  {
    id: 'pd-3',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    vendorUsername: 'spicyrest',
    vendorRating: 4.7,
    vendorReviewCount: 24,
    bannerImage: 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&q=80',
    promoTitle: 'Free Delivery on ₦7,000+',
    promoType: 'free_delivery',
    promoBadge: 'FREE DELIVERY',
    deliveryTime: '20–35 min',
    isOpen: true,
    reasonType: 'popular_area',
    reasonText: REASON_LABEL.popular_area,
    city: 'Lekki',
    countryCode: 'NG',
    region: 'Lagos',
    isActive: true,
    category: 'Food & Catering',
  },
  {
    id: 'pd-4',
    vendorId: 'v4-ng',
    vendorName: 'The Wrap Bar',
    vendorUsername: 'thewrapbar',
    vendorRating: 4.6,
    vendorReviewCount: 91,
    bannerImage: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80',
    promoTitle: '15% OFF orders ₦6,000+',
    promoType: 'percentage',
    promoBadge: '15% OFF',
    deliveryTime: '15–30 min',
    isOpen: true,
    reasonType: 'trending',
    reasonText: REASON_LABEL.trending,
    city: 'Lekki',
    countryCode: 'NG',
    region: 'Lagos',
    isActive: true,
    category: 'Food & Catering',
  },
  {
    id: 'pd-5',
    vendorId: 'v5-ng',
    vendorName: 'Chop House',
    vendorUsername: 'chophouse',
    vendorRating: 4.4,
    vendorReviewCount: 52,
    bannerImage: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
    promoTitle: 'Buy 1 Get 1 Jollof Rice',
    promoType: 'bogo',
    promoBadge: 'BUY 1 GET 1',
    deliveryTime: '25–45 min',
    isOpen: true,
    reasonType: 'popular_area',
    reasonText: REASON_LABEL.popular_area,
    city: 'Victoria Island',
    countryCode: 'NG',
    region: 'Lagos',
    isActive: true,
    category: 'Food & Catering',
  },
  {
    id: 'pd-6',
    vendorId: 'v6-ng',
    vendorName: 'The Pastry Corner',
    vendorUsername: 'pastrycorner',
    vendorRating: 4.8,
    vendorReviewCount: 134,
    bannerImage: 'https://images.unsplash.com/photo-1495147466023-ac5c588e2e94?w=800&q=80',
    promoTitle: 'Free Éclair with ₦4,500+',
    promoType: 'free_item',
    promoBadge: 'FREE ITEM',
    deliveryTime: '30–50 min',
    isOpen: true,
    reasonType: 'searched',
    reasonText: REASON_LABEL.searched,
    city: 'Ikeja',
    countryCode: 'NG',
    region: 'Lagos',
    isActive: true,
    category: 'Food & Catering',
  },
  {
    id: 'pd-7',
    vendorId: 'v2',
    vendorName: 'Bella Cakes',
    vendorUsername: 'bellacakes',
    vendorRating: 4.9,
    vendorReviewCount: 156,
    bannerImage: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80',
    promoTitle: 'Buy 1 Get 1 Cupcake',
    promoType: 'bogo',
    promoBadge: 'BUY 1 GET 1',
    deliveryTime: '20–35 min',
    isOpen: true,
    reasonType: 'ordered_similar',
    reasonText: REASON_LABEL.ordered_similar,
    city: 'Wuse 2',
    countryCode: 'NG',
    region: 'Abuja',
    isActive: true,
    category: 'Food & Catering',
  },
  {
    id: 'pd-8',
    vendorId: 'v7-ng',
    vendorName: 'Abuja Grills',
    vendorUsername: 'abuja-grills',
    vendorRating: 4.5,
    vendorReviewCount: 78,
    bannerImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
    promoTitle: 'Free Delivery on ₦5,000+',
    promoType: 'free_delivery',
    promoBadge: 'FREE DELIVERY',
    deliveryTime: '25–40 min',
    isOpen: true,
    reasonType: 'popular_area',
    reasonText: REASON_LABEL.popular_area,
    city: 'Wuse 2',
    countryCode: 'NG',
    region: 'Abuja',
    isActive: true,
    category: 'Food & Catering',
  },
  {
    id: 'pd-9',
    vendorId: 'v8-ng',
    vendorName: 'PH Kitchen',
    vendorUsername: 'phkitchen',
    vendorRating: 4.3,
    vendorReviewCount: 44,
    bannerImage: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
    promoTitle: '20% OFF First Order',
    promoType: 'percentage',
    promoBadge: '20% OFF',
    deliveryTime: '30–50 min',
    isOpen: true,
    reasonType: 'trending',
    reasonText: REASON_LABEL.trending,
    city: 'Port Harcourt',
    countryCode: 'NG',
    region: 'Rivers',
    isActive: true,
    category: 'Food & Catering',
  },
  {
    id: 'pd-10',
    vendorId: 'v9-ng',
    vendorName: 'Fresh Bowl PH',
    vendorUsername: 'freshbowlph',
    vendorRating: 4.6,
    vendorReviewCount: 60,
    bannerImage: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
    promoTitle: 'Buy 1 Get 1 Smoothie Bowl',
    promoType: 'bogo',
    promoBadge: 'BUY 1 GET 1',
    deliveryTime: '20–40 min',
    isOpen: true,
    reasonType: 'popular_area',
    reasonText: REASON_LABEL.popular_area,
    city: 'Port Harcourt',
    countryCode: 'NG',
    region: 'Rivers',
    isActive: true,
    category: 'Food & Catering',
  },
];

export const TRENDING_DEALS: PromoDeal[] = mockPromoDeals.filter(
  (d) => d.reasonType === 'trending' || d.reasonType === 'popular_area'
);

export function getDealsForLocation(
  countryCode: string,
  region: string,
  city?: string | null
): PromoDeal[] {
  console.log('[PROMO_DEALS] Filtering for', countryCode, region, city);
  const active = mockPromoDeals.filter((d) => d.isActive);

  if (!countryCode || !region) {
    console.log('[PROMO_DEALS] No location set, returning trending deals');
    return TRENDING_DEALS;
  }

  const regionDeals = active.filter(
    (d) => d.countryCode === countryCode && d.region === region
  );

  if (regionDeals.length === 0) {
    console.log('[PROMO_DEALS] No deals in region, returning trending');
    return TRENDING_DEALS;
  }

  return regionDeals;
}

const REASON_PRIORITY: Record<PersonalizationReason, number> = {
  ordered_similar: 0,
  recently_viewed: 1,
  searched: 2,
  popular_area: 3,
  trending: 4,
};

export function personalizeDeals(
  deals: PromoDeal[],
  orderedVendorIds: Set<string>,
  recentVendorIds: Set<string>
): PromoDeal[] {
  const personalized = deals.map((deal) => {
    if (orderedVendorIds.has(deal.vendorId)) {
      return {
        ...deal,
        reasonType: 'ordered_similar' as const,
        reasonText: REASON_LABEL.ordered_similar,
      };
    }
    if (recentVendorIds.has(deal.vendorId)) {
      return {
        ...deal,
        reasonType: 'recently_viewed' as const,
        reasonText: REASON_LABEL.recently_viewed,
      };
    }
    return deal;
  });

  return personalized.sort(
    (a, b) => REASON_PRIORITY[a.reasonType] - REASON_PRIORITY[b.reasonType]
  );
}

const PROMO_TYPE_PRIORITY: Record<PromoType, number> = {
  bogo: 0,
  percentage: 1,
  flat: 2,
  free_item: 3,
  free_delivery: 4,
};

export interface CuratedDeal extends PromoDeal {
  moreDealsCount: number;
}

export function deduplicateDealsPerVendor(deals: PromoDeal[]): CuratedDeal[] {
  console.log('[DEALS_CURATE] Deduplicating', deals.length, 'deals');
  const vendorMap = new Map<string, PromoDeal[]>();

  for (const deal of deals) {
    const existing = vendorMap.get(deal.vendorId);
    if (existing) {
      existing.push(deal);
    } else {
      vendorMap.set(deal.vendorId, [deal]);
    }
  }

  const curated: CuratedDeal[] = [];

  for (const [vendorId, vendorDeals] of vendorMap) {
    const sorted = [...vendorDeals].sort((a, b) => {
      const priorityA = PROMO_TYPE_PRIORITY[a.promoType];
      const priorityB = PROMO_TYPE_PRIORITY[b.promoType];
      if (priorityA !== priorityB) return priorityA - priorityB;
      return 0;
    });

    const best = sorted[0];
    curated.push({
      ...best,
      moreDealsCount: vendorDeals.length - 1,
    });
    console.log('[DEALS_CURATE] Vendor', vendorId, '→ picked:', best.promoTitle, '| +' + (vendorDeals.length - 1), 'more');
  }

  return curated;
}
