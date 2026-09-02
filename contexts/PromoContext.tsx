import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
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

const PROMOTIONS_STORAGE_KEY = '@platform_vendor_promotions';
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

export const [PromoContext, usePromo] = createContextHook(() => {
  const [promotions, setPromotions] = useState<VendorPromotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadPromotions();
  }, []);

  const loadPromotions = async () => {
    try {
      const stored = await AsyncStorage.getItem(PROMOTIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as VendorPromotion[];
        setPromotions(parsed);
        console.log('[PromoContext] Loaded', parsed.length, 'promotions');
      }
    } catch (error) {
      console.error('[PromoContext] Failed to load promotions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const persist = useCallback(async (updated: VendorPromotion[]) => {
    try {
      await AsyncStorage.setItem(PROMOTIONS_STORAGE_KEY, JSON.stringify(updated));
      setPromotions(updated);
    } catch (error) {
      console.error('[PromoContext] Failed to persist promotions:', error);
      throw error;
    }
  }, []);

  const activePromotions = useMemo(
    () => promotions.filter((p) => p.active),
    [promotions]
  );

  useEffect(() => {
    setExternalPromotions(promotions);
  }, [promotions]);

  const canAddPromotion = activePromotions.length < MAX_ACTIVE_PROMOTIONS;

  const createPromotion = useCallback(async (draft: VendorPromotionDraft, vendorId: string) => {
    const newPromo: VendorPromotion = {
      id: `promo-${Date.now()}`,
      vendorId,
      title: generatePromoTitle(draft),
      shortDescription: generateShortDescription(draft),
      fullDescription: generateFullDescription(draft),
      type: draft.type,
      discountValue: draft.discountValue,
      minimumOrder: draft.minimumOrder,
      freeItemName: draft.freeItemName,
      bogoItemName: draft.bogoItemName,
      applicableItemIds: draft.freeItemId ? [draft.freeItemId] : draft.bogoItemId ? [draft.bogoItemId] : undefined,
      active: true,
      startDate: draft.startDate,
      endDate: draft.endDate,
      icon: getIconForType(draft.type),
    };

    const updated = [...promotions, newPromo];
    await persist(updated);
    console.log('[PromoContext] Created promotion:', newPromo.id, newPromo.title);
    return newPromo;
  }, [promotions, persist]);

  const updatePromotion = useCallback(async (promoId: string, draft: VendorPromotionDraft) => {
    const updated = promotions.map((p) => {
      if (p.id !== promoId) return p;
      return {
        ...p,
        title: generatePromoTitle(draft),
        shortDescription: generateShortDescription(draft),
        fullDescription: generateFullDescription(draft),
        type: draft.type,
        discountValue: draft.discountValue,
        minimumOrder: draft.minimumOrder,
        freeItemName: draft.freeItemName,
        bogoItemName: draft.bogoItemName,
        applicableItemIds: draft.freeItemId ? [draft.freeItemId] : draft.bogoItemId ? [draft.bogoItemId] : undefined,
        startDate: draft.startDate,
        endDate: draft.endDate,
        icon: getIconForType(draft.type),
      };
    });
    await persist(updated);
    console.log('[PromoContext] Updated promotion:', promoId);
  }, [promotions, persist]);

  const deletePromotion = useCallback(async (promoId: string) => {
    const updated = promotions.filter((p) => p.id !== promoId);
    await persist(updated);
    console.log('[PromoContext] Deleted promotion:', promoId);
  }, [promotions, persist]);

  const togglePromotion = useCallback(async (promoId: string) => {
    const promo = promotions.find((p) => p.id === promoId);
    if (!promo) return;

    if (!promo.active && activePromotions.length >= MAX_ACTIVE_PROMOTIONS) {
      console.log('[PromoContext] Cannot activate — max active promotions reached');
      return;
    }

    const updated = promotions.map((p) =>
      p.id === promoId ? { ...p, active: !p.active } : p
    );
    await persist(updated);
    console.log('[PromoContext] Toggled promotion:', promoId, '→', !promo.active);
  }, [promotions, activePromotions.length, persist]);

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
