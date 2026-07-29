export type SystemTag = 'popular' | 'new' | 'promo';
export type HighlightLabel =
  | 'vendors_pick'
  | 'featured_label'
  | 'signature'
  | 'limited_availability'
  | 'recommended'
  // Retired. Kept in the union so items still carrying one keep rendering.
  | 'chefs_pick'
  | 'spicy'
  | 'limited'
  | 'best_seller';

const NEW_ITEM_DAYS = 14;
const POPULAR_TOP_PERCENTILE = 0.8;
const TRENDING_DAYS = 14;

/**
 * What a vendor may put on their own item.
 *
 * Every one of these is the vendor speaking about their own product, which is
 * theirs to say. None of them asserts anything about sales, ratings or other
 * vendors, because nothing here is verified and a customer cannot tell a
 * measured claim from a typed one.
 *
 * "Best Seller" and "Chef's Pick" were previously selectable and have been
 * retired: the first claimed sales data nobody checked, the second assumed
 * every vendor is a restaurant. Sales are described by the Popular system tag,
 * computed from real order counts in computeSystemTags below.
 */
export const HIGHLIGHT_LABEL_OPTIONS: { value: HighlightLabel; label: string; emoji: string }[] = [
  { value: 'vendors_pick', label: "Vendor's Pick", emoji: '👍' },
  { value: 'featured_label', label: 'Featured', emoji: '⭐' },
  { value: 'signature', label: 'Signature', emoji: '✨' },
  { value: 'limited_availability', label: 'Limited Availability', emoji: '⏳' },
  { value: 'recommended', label: 'Recommended', emoji: '💡' },
];

// No longer selectable, still rendered for items that already carry one.
const RETIRED_HIGHLIGHT_LABELS: Record<string, { label: string; emoji: string }> = {
  best_seller: { label: 'Best Seller', emoji: '🏆' },
  chefs_pick: { label: "Chef's Pick", emoji: '👨‍🍳' },
  spicy: { label: 'Spicy', emoji: '🌶️' },
  limited: { label: 'Limited Availability', emoji: '⏳' },
};

export function getHighlightLabelDisplay(label: HighlightLabel): { label: string; emoji: string } {
  const found = HIGHLIGHT_LABEL_OPTIONS.find((o) => o.value === label);
  return found ?? RETIRED_HIGHLIGHT_LABELS[label] ?? { label: 'Label', emoji: '•' };
}

export function isNewItem(createdAt?: string): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= NEW_ITEM_DAYS;
}

export function isPromoItem(item: { salePrice?: number; basePrice?: number; price?: number }): boolean {
  const basePrice = item.basePrice ?? item.price ?? 0;
  return typeof item.salePrice === 'number' && item.salePrice > 0 && item.salePrice < basePrice;
}

export function isPopularItem<T extends { id: string; orderCount?: number; recentOrderCount?: number }>(
  item: T,
  allItems: T[]
): boolean {
  const counts = allItems
    .map((i) => i.orderCount ?? 0)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);

  if (counts.length === 0) return false;

  const thresholdIndex = Math.floor(counts.length * POPULAR_TOP_PERCENTILE);
  const threshold = counts[thresholdIndex] ?? counts[counts.length - 1];
  const itemCount = item.orderCount ?? 0;
  if (itemCount === 0) return false;

  const recentCount = item.recentOrderCount ?? 0;
  const isTrending = recentCount >= 3;

  return itemCount >= threshold || isTrending;
}

export function computeSystemTags<
  T extends {
    id: string;
    createdAt?: string;
    salePrice?: number;
    basePrice?: number;
    price?: number;
    orderCount?: number;
    recentOrderCount?: number;
    isFeatured?: boolean;
  }
>(item: T, allItems: T[]): SystemTag[] {
  const tags: SystemTag[] = [];
  if (isPromoItem(item)) tags.push('promo');
  if (isNewItem(item.createdAt)) tags.push('new');
  if (isPopularItem(item, allItems)) tags.push('popular');
  return tags;
}

export function getSystemTagDisplay(tag: SystemTag): { emoji: string; label: string; color: string; bg: string } {
  switch (tag) {
    case 'popular':
      return { emoji: '🔥', label: 'Popular', color: '#B45309', bg: '#FEF3C7' };
    case 'new':
      return { emoji: '🆕', label: 'New', color: '#1D4ED8', bg: '#EFF6FF' };
    case 'promo':
      return { emoji: '🎁', label: 'Promo', color: '#7C3AED', bg: '#F5F3FF' };
  }
}

export const FEATURED_TAG_DISPLAY = {
  emoji: '⭐',
  label: 'Featured',
  color: '#92400E',
  bg: '#FFFBEB',
};

export function getStorefrontSections<
  T extends {
    id: string;
    createdAt?: string;
    salePrice?: number;
    basePrice?: number;
    price?: number;
    orderCount?: number;
    recentOrderCount?: number;
    isFeatured?: boolean;
    inStock?: boolean;
    isAvailable?: boolean;
    isHidden?: boolean;
  }
>(
  items: T[],
  allItems?: T[]
): {
  promotions: T[];
  popular: T[];
  newItems: T[];
  featured: T[];
} {
  const pool = allItems ?? items;
  const visible = items.filter(
    (i) => (i.inStock !== false) && (i.isAvailable !== false) && (i.isHidden !== true)
  );

  return {
    promotions: visible.filter((i) => isPromoItem(i)),
    popular: visible.filter((i) => isPopularItem(i, pool)),
    newItems: visible.filter((i) => isNewItem(i.createdAt)),
    featured: visible.filter((i) => i.isFeatured === true),
  };
}
