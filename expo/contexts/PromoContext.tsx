import { useState, useEffect, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { collection, getDocs, onSnapshot, orderBy, query } from 'firebase/firestore';
import { auth, callable, db } from '@/lib/firebase';
import type { VendorPromotion, PromotionType } from '@/mocks/promotionsData';
import { setExternalPromotions } from '@/mocks/promotionsData';

export type { PromotionType };

export interface VendorPromotionDraft {
  id?: string;
  type: PromotionType;
  discountValue: number;
  minimumOrder: number;
  maxDiscount?: number;
  freeItemId?: string;
  freeItemName?: string;
  bogoItemId?: string;
  bogoItemName?: string;
  buyQty?: number;
  getQty?: number;
  startDate: string;
  endDate: string;
}

const MAX_ACTIVE_PROMOTIONS = 3;

function generatePromoTitle(draft: VendorPromotionDraft): string {
  switch (draft.type) {
    case 'percentage':
      return `${draft.discountValue}% OFF orders ${draft.minimumOrder > 0 ? `$${draft.minimumOrder}+` : ''}`.trim();
    case 'flat':
      return `$${draft.discountValue} OFF orders ${draft.minimumOrder > 0 ? `$${draft.minimumOrder}+` : ''}`.trim();
    case 'bogo':
      return `Buy ${draft.buyQty || 1} Get ${draft.getQty || 1} ${draft.bogoItemName || 'Free'}`;
    case 'free_item':
      return `Free ${draft.freeItemName || 'Item'} ${draft.minimumOrder > 0 ? `$${draft.minimumOrder}+` : ''}`.trim();
    case 'free_delivery':
      return `Free delivery ${draft.minimumOrder > 0 ? `on orders $${draft.minimumOrder}+` : ''}`.trim();
    default:
      return 'Promotion';
  }
}

function generateShortDescription(draft: VendorPromotionDraft): string {
  switch (draft.type) {
    case 'percentage': {
      let desc = `Get ${draft.discountValue}% off`;
      if (draft.minimumOrder > 0) desc += ` when you spend $${draft.minimumOrder} or more`;
      if (draft.maxDiscount) desc += `. Max discount $${draft.maxDiscount}`;
      return desc;
    }
    case 'flat':
      return `Get $${draft.discountValue} off${draft.minimumOrder > 0 ? ` orders over $${draft.minimumOrder}` : ''}`;
    case 'bogo':
      return `Buy ${draft.buyQty || 1} ${draft.bogoItemName || 'item'}, get ${draft.getQty || 1} free`;
    case 'free_item':
      return `Free ${draft.freeItemName || 'item'}${draft.minimumOrder > 0 ? ` on orders over $${draft.minimumOrder}` : ''}`;
    case 'free_delivery':
      return `Free delivery${draft.minimumOrder > 0 ? ` on orders over $${draft.minimumOrder}` : ''}`;
    default:
      return '';
  }
}

function generateFullDescription(draft: VendorPromotionDraft): string {
  switch (draft.type) {
    case 'percentage': {
      let desc = `Enjoy ${draft.discountValue}% off your entire order`;
      if (draft.minimumOrder > 0) desc += ` when your subtotal reaches $${draft.minimumOrder} or more`;
      if (draft.maxDiscount) desc += `. Maximum discount capped at $${draft.maxDiscount}`;
      desc += '. This promotion is automatically applied at checkout — no code needed.';
      return desc;
    }
    case 'flat':
      return `Get $${draft.discountValue} off your order${draft.minimumOrder > 0 ? ` when you spend $${draft.minimumOrder} or more` : ''}. Automatically applied at checkout.`;
    case 'bogo':
      return `Purchase ${draft.buyQty || 1} ${draft.bogoItemName || 'item(s)'} and receive ${draft.getQty || 1} free. The discount is automatically applied when qualifying items are in your cart.`;
    case 'free_item':
      return `Order${draft.minimumOrder > 0 ? ` $${draft.minimumOrder} or more and` : ''} receive a free ${draft.freeItemName || 'item'}! Automatically added to qualifying orders.`;
    case 'free_delivery':
      return `Spend${draft.minimumOrder > 0 ? ` $${draft.minimumOrder} or more and` : ''} enjoy free delivery. Automatically applied at checkout.`;
    default:
      return '';
  }
}

function getIconForType(type: PromotionType): VendorPromotion['icon'] {
  switch (type) {
    case 'percentage': return 'percent';
    case 'flat': return 'tag';
    case 'bogo': return 'tag';
    case 'free_item': return 'gift';
    case 'free_delivery': return 'truck';
    default: return 'zap';
  }
}

function draftToBackendPayload(draft: VendorPromotionDraft) {
  return {
    title: generatePromoTitle(draft),
    shortDescription: generateShortDescription(draft),
    fullDescription: generateFullDescription(draft),
    type: draft.type,
    discountValue: draft.discountValue,
    minimumOrder: draft.minimumOrder,
    maxDiscount: draft.maxDiscount ?? null,
    freeItemName: draft.freeItemName ?? null,
    bogoItemName: draft.bogoItemName ?? null,
    applicableItemIds: draft.freeItemId ? [draft.freeItemId] : draft.bogoItemId ? [draft.bogoItemId] : null,
    startDate: draft.startDate,
    endDate: draft.endDate,
    icon: getIconForType(draft.type),
  };
}

interface PromotionDoc {
  promotionId: string;
  vendorId: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  type: PromotionType;
  discountValue: number;
  minimumOrder: number;
  maxDiscount?: number | null;
  applicableCategoryIds?: string[] | null;
  freeItemName?: string | null;
  bogoItemName?: string | null;
  applicableItemIds?: string[] | null;
  active: boolean;
  startDate: string;
  endDate: string;
  icon: VendorPromotion['icon'];
}

function toVendorPromotion(doc: PromotionDoc): VendorPromotion {
  return {
    id: doc.promotionId,
    vendorId: doc.vendorId,
    title: doc.title,
    shortDescription: doc.shortDescription,
    fullDescription: doc.fullDescription,
    type: doc.type,
    discountValue: doc.discountValue,
    minimumOrder: doc.minimumOrder,
    maxDiscount: doc.maxDiscount ?? undefined,
    freeItemName: doc.freeItemName ?? undefined,
    bogoItemName: doc.bogoItemName ?? undefined,
    applicableItemIds: doc.applicableItemIds ?? undefined,
    active: doc.active,
    startDate: doc.startDate,
    endDate: doc.endDate,
    icon: doc.icon,
  };
}

/**
 * One-time read of another vendor's ACTIVE promotions, for a customer
 * viewing that vendor's storefront. Deliberately not the live PromoContext
 * subscription above, which is hardcoded to the signed-in vendor's own
 * vendorId (from auth claims) for their own settings screens — a customer
 * browsing a storefront isn't signed in as that vendor.
 *
 * The storefront previously read from mocks/promotionsData.ts's
 * getActivePromotions, which only ever matches the ten demo vendor ids —
 * for any real vendor, promotions a vendor actually created via
 * create-promo.tsx (writing to this exact vendors/{vendorId}/promotions
 * collection) never appeared on their own real storefront.
 */
export async function getVendorActivePromotions(vendorId: string): Promise<VendorPromotion[]> {
  if (!vendorId) return [];
  // No `where('active', ...)` filter here deliberately -- the live
  // PromoContext subscription above reads the whole subcollection ordered by
  // createdAt and filters `active` client-side (see `activePromotions`
  // below), rather than a composite (active + createdAt) index. Matching
  // that same approach here avoids depending on an index that doesn't exist.
  const q = query(collection(db, 'vendors', vendorId, 'promotions'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => toVendorPromotion(d.data() as PromotionDoc))
    .filter((p) => p.active);
}

/**
 * Loads a viewed vendor's real promotions into promotionsData.ts's
 * getActivePromotions()/getPromotionItemIds()/getPromotionBadgeForItem() so
 * every screen still calling those directly (cart, item modals, storefront
 * previews) picks up real data instead of only ever matching the ten demo
 * vendor ids. Returns a version number that flips from 0 once loaded, to
 * add to a useMemo's deps so it recomputes after the async fetch resolves.
 */
export function usePrimeVendorPromotions(vendorId: string | undefined): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!vendorId) return;
    let cancelled = false;
    void getVendorActivePromotions(vendorId).then((list) => {
      if (cancelled) return;
      setExternalPromotions(vendorId, list);
      setVersion((v) => v + 1);
    });
    return () => { cancelled = true; };
  }, [vendorId]);
  return version;
}

export const [PromoContext, usePromo] = createContextHook(() => {
  const [promotions, setPromotions] = useState<VendorPromotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setVendorId(null);
        setIsLoading(false);
        return;
      }
      const tokenResult = await user.getIdTokenResult();
      setVendorId((tokenResult.claims.vendorId as string | undefined) ?? null);
    });
    return unsubscribeAuth;
  }, []);

  // Real-time promotions list, straight from
  // vendors/{vendorId}/promotions — the same collection
  // createPromotion/updatePromotion/deletePromotion write to.
  useEffect(() => {
    if (!vendorId) return;
    const q = query(collection(db, 'vendors', vendorId, 'promotions'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => toVendorPromotion(d.data() as PromotionDoc));
      setPromotions(list);
      setExternalPromotions(vendorId, list);
      setIsLoading(false);
    });
    return unsubscribe;
  }, [vendorId]);

  const activePromotions = useMemo(() => promotions.filter((p) => p.active), [promotions]);
  const canAddPromotion = activePromotions.length < MAX_ACTIVE_PROMOTIONS;

  const createPromotion = useCallback(async (draft: VendorPromotionDraft, _vendorId: string) => {
    const create = callable<Record<string, unknown>, { success: true; promotionId: string }>('createPromotion');
    const res = await create(draftToBackendPayload(draft));
    return res.data;
  }, []);

  const updatePromotion = useCallback(async (promoId: string, draft: VendorPromotionDraft) => {
    const update = callable<Record<string, unknown>, { success: true }>('updatePromotion');
    await update({ promotionId: promoId, ...draftToBackendPayload(draft) });
  }, []);

  const deletePromotion = useCallback(async (promoId: string) => {
    const del = callable<{ promotionId: string }, { success: true }>('deletePromotion');
    await del({ promotionId: promoId });
  }, []);

  const togglePromotion = useCallback(async (promoId: string) => {
    const toggle = callable<{ promotionId: string }, { success: true }>('togglePromotionActive');
    await toggle({ promotionId: promoId });
  }, []);

  const getPromotion = useCallback((promoId: string) => {
    return promotions.find((p) => p.id === promoId) ?? null;
  }, [promotions]);

  return useMemo(() => ({
    promotions,
    activePromotions,
    isLoading,
    canAddPromotion,
    maxPromotions: MAX_ACTIVE_PROMOTIONS,
    createPromotion,
    updatePromotion,
    deletePromotion,
    togglePromotion,
    getPromotion,
  }), [promotions, activePromotions, isLoading, canAddPromotion, createPromotion, updatePromotion, deletePromotion, togglePromotion, getPromotion]);
});
