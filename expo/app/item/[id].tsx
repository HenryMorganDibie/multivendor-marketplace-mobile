import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Modal,
  Animated,
} from 'react-native';
import { Alert } from '@/utils/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Share2,
  Heart,
  Star,
  ShoppingCart,
  Forward,
  AlertTriangle,
  Check,
  Minus,
  Plus,
  Zap,
  Store,
  ChevronRight,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeBack } from '@/utils/useSafeBack';
import { useCart } from '@/contexts/CartContext';
import { mockMenuItems, MenuItem, type Vendor } from '@/mocks/vendorData';
import { vendorRepository } from '@/services/repositories/vendorRepository';
import { fromBackendItem, CatalogItem } from '@/contexts/CatalogContext';
import { doc, onSnapshot as onDocSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import VendorStatusGate, { normalizeVendorStatus, useVendorStatusPermissions } from '@/components/VendorStatusGate';
import VendorPreviewModal from '@/components/VendorPreviewModal';
import { safeShare } from '@/utils/share';
import { formatPriceWithCommas } from '@/utils/formatPrice';
import { useOrders } from '@/contexts/OrdersContext';
import { getActivePromotions } from '@/mocks/promotionsData';
import { getMenuItemDisplayPrice, hasItemSalePrice } from '@/utils/itemPricing';
import { catalogService } from '@/services/catalogService';

const { width } = Dimensions.get('window');
const IMAGE_HEIGHT = Math.round(width * 0.82);

const C = {
  charcoal: '#2B2B2B',
  orange: '#FF8C42',
  orangeDisabled: 'rgba(255,140,66,0.35)',
  bg: '#F2F2F2',
  surface: '#FFFFFF',
  surfaceAlt: '#F8F9FA',
  border: '#E8E8E8',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  selectedBorder: '#FF8C42',
  selectedFill: 'rgba(255,140,66,0.08)',
  disabledBg: '#EFEFEF',
  disabledText: '#BDBDBD',
  saleRed: '#E53E3E',
  white: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.42)',
  pillBg: '#EDEDED',
  divider: '#EFEFEF',
};

type ItemSource = 'storefront' | 'chat_shared_item';

function getGroupSubtext(group: { isRequired: boolean; selectionType: 'radio' | 'checkbox'; options: any[] }): string {
  if (group.selectionType === 'radio') {
    return group.isRequired ? 'Required · Select 1' : 'Optional · Select 1';
  }
  const max = group.options.length;
  return group.isRequired
    ? 'Required · Select at least 1'
    : `Optional · Select up to ${max}`;
}

function ItemViewContent({
  id,
  vendorId,
  source,
  chatThreadId,
}: {
  id: string;
  vendorId?: string;
  source: ItemSource;
  chatThreadId?: string;
}) {
  const router = useRouter();
  const safeBack = useSafeBack();
  const insets = useSafeAreaInsets();
  const { addItem, globalItemCount, items: activeCartItems, updateItemQuantity, removeItemByIndex, activeVendorId, getVendorCart } = useCart();
  const { canAddToCart } = useVendorStatusPermissions();

  // getItemById reads CatalogContext's `items`, which only ever loads the
  // SIGNED-IN vendor's own catalog (keyed off the auth token's vendorId
  // claim) — built for the vendor's own management screens. A customer
  // browsing has no vendorId claim at all, so this never matched anything
  // real here; it just happened to fail silently the same way the mock
  // lookup below did. Fetching directly by the item's own vendorId (the
  // route param — which vendor's storefront this item was opened from) is
  // the correct customer-facing lookup, same collection the now-fixed
  // storefront listing already reads (catalogRepository.getVendorMenu).
  const [catalogItem, setCatalogItem] = useState<CatalogItem | undefined>(undefined);
  useEffect(() => {
    if (!vendorId || !id) {
      setCatalogItem(undefined);
      return;
    }
    const unsubscribe = onDocSnapshot(
      doc(db, 'vendors', vendorId, 'catalogItems', id),
      (snap) => {
        if (!snap.exists()) {
          setCatalogItem(undefined);
          return;
        }
        const data = snap.data();
        if (data.moderationStatus !== 'approved' || data.isHidden === true) {
          setCatalogItem(undefined);
          return;
        }
        setCatalogItem(fromBackendItem(snap.id, data));
      },
      (err) => {
        console.error('[ItemView] catalogItem subscription failed:', err);
        setCatalogItem(undefined);
      }
    );
    return unsubscribe;
  }, [vendorId, id]);
  // This screen gated its entire render on `item`, sourced only from the
  // mockMenuItems fixture array — a real catalog item id (from
  // vendors/{vendorId}/catalogItems, already correctly fetched above as
  // catalogItem and already used correctly for add-on selection below) never
  // matched, so every real item showed "Item not found" and nobody ever
  // reached the working add-on UI underneath. Mapping catalogItem onto the
  // same MenuItem shape lets every existing item.* reference below keep
  // working unchanged, now fed by real data when it exists.
  const item: MenuItem | undefined = catalogItem
    ? {
        id: catalogItem.id,
        name: catalogItem.name,
        description: catalogItem.description,
        price: catalogItem.basePrice,
        salePrice: catalogItem.salePrice,
        image: catalogItem.photos?.[0],
        inStock: catalogItem.isAvailable && !catalogItem.isOutOfStock,
        categoryId: catalogItem.categoryId,
        stockCount: catalogItem.trackInventory ? catalogItem.inventoryQuantity : undefined,
        createdAt: catalogItem.createdAt,
        orderCount: catalogItem.orderCount,
        recentOrderCount: catalogItem.recentOrderCount,
        isFeatured: catalogItem.isFeatured,
        // Not mapped: MenuItem's HighlightLabel (mocks/vendorData.ts) is a
        // narrower legacy union than CatalogItem's (utils/itemTagging.ts),
        // and this screen never actually reads item.highlightLabel anywhere.
      }
    : mockMenuItems.find((i) => i.id === id);

  const effectiveVendorId = vendorId ?? activeVendorId ?? undefined;
  const vendorCart = effectiveVendorId ? getVendorCart(effectiveVendorId) : null;
  const cartItems = vendorCart?.items ?? activeCartItems;

  const [selectedAddOns, setSelectedAddOns] = useState<Map<string, string[]>>(new Map());
  const [isInitialized, setIsInitialized] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);

  const heartScale = useRef(new Animated.Value(1)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(ctaOpacity, {
      toValue: 1,
      duration: 280,
      delay: 120,
      useNativeDriver: true,
    }).start();
  }, [ctaOpacity]);

  const selectedAddOnObjects = useMemo(() => {
    if (!catalogItem?.addOnGroups) return [];
    const all: { id: string; groupId: string; name: string; price: number }[] = [];
    catalogItem.addOnGroups.forEach((group) => {
      const sel = selectedAddOns.get(group.id) || [];
      group.options.forEach((opt) => {
        if (sel.includes(opt.id)) {
          // groupId is required by repriceCart.ts's (groupId, optionId) lookup
          // against the catalog item's addOnGroups — without it, a selected
          // add-on silently repriced to 0 server-side regardless of what was
          // shown on-device.
          all.push({ id: opt.id, groupId: group.id, name: opt.name, price: opt.price || 0 });
        }
      });
    });
    return all;
  }, [catalogItem?.addOnGroups, selectedAddOns]);

  const addOnsTotal = useMemo(
    () => selectedAddOnObjects.reduce((s, a) => s + a.price, 0),
    [selectedAddOnObjects]
  );

  const cartItemInfo = useMemo(() => {
    const addOnIds = selectedAddOnObjects.map((a) => a.id).sort().join(',');
    const index = cartItems.findIndex((ci) => {
      const cartAddOnIds = ci.addOns?.map((a) => a.id).sort().join(',') || '';
      return ci.id === id && cartAddOnIds === addOnIds;
    });
    return index !== -1 ? { item: cartItems[index], index } : null;
  }, [cartItems, id, selectedAddOnObjects]);

  const quantity = cartItemInfo ? cartItemInfo.item.quantity : 0;

  const requiredGroupsFilled = useMemo(() => {
    if (!catalogItem?.addOnGroups) return true;
    return catalogItem.addOnGroups.every((g) => {
      if (!g.isRequired) return true;
      return (selectedAddOns.get(g.id) || []).length > 0;
    });
  }, [catalogItem?.addOnGroups, selectedAddOns]);

  useEffect(() => {
    if (!isInitialized && cartItemInfo && catalogItem?.addOnGroups) {
      const map = new Map<string, string[]>();
      catalogItem.addOnGroups.forEach((g) => {
        const sel = g.options.filter((o) => cartItemInfo.item.addOns?.some((a) => a.id === o.id)).map((o) => o.id);
        if (sel.length > 0) map.set(g.id, sel);
      });
      setSelectedAddOns(map);
      setIsInitialized(true);
    } else if (!isInitialized) {
      setIsInitialized(true);
    }
  }, [cartItemInfo, isInitialized, catalogItem?.addOnGroups]);

  const itemPromoBadges = useMemo(() => {
    if (!vendorId) return [];
    const activePromos = getActivePromotions(vendorId);
    const badges: string[] = [];
    for (const promo of activePromos) {
      if (promo.applicableItemIds?.includes(id)) {
        switch (promo.type) {
          case 'bogo': badges.push('BUY 1 GET 1'); break;
          case 'free_item': badges.push('FREE ITEM'); break;
          default: badges.push('OFFER'); break;
        }
      }
    }
    return badges;
  }, [vendorId, id]);

  const { orders } = useOrders();
  const orderedBefore = useMemo(() => {
    if (!item) return false;
    return orders.some((o) => o.status === 'completed' && o.items.some((i) => i.id === id));
  }, [id, item, orders]);

  // isPopular below is NOT fixed by this pass: it needs a per-item order
  // count across ALL customers, not the signed-in customer's own orders
  // (useOrders() is customer-scoped), and `item` itself still comes from
  // mockMenuItems rather than a real single-catalog-item fetch — this whole
  // page's catalog data source is a separate, larger gap than the mockOrders
  // reference this pass was scoped to fix. The real equivalent exists
  // server-side as catalogItems/{itemId}.orderCount (incremented in
  // adjustInventoryAfterOrder), just not wired to this screen.

  // mockVendors.find only ever matches the ten built-in demo ids (v1-v10);
  // for any real vendor this returned null, silently hiding "About this
  // vendor" and blanking the storefront row for every real vendor viewed
  // from a chat-shared item. vendorRepository.getById already resolves both
  // the demo ids and live Firestore vendors (see app/chat/[vendorId].tsx for
  // the same pattern), so it replaces the mock lookup here too.
  const [vendor, setVendor] = useState<Vendor | null>(null);
  useEffect(() => {
    if (!vendorId) {
      setVendor(null);
      return;
    }
    let cancelled = false;
    void vendorRepository.getById(vendorId).then((v) => {
      if (!cancelled) setVendor(v ?? null);
    });
    return () => { cancelled = true; };
  }, [vendorId]);

  // "More from this vendor" was always the same six fixture items regardless
  // of which vendor's item was actually open — a customer forwarded an item
  // from Bella Cakes' chat saw Spicy Restaurant's mock menu underneath it.
  // catalogService.getVendorMenu reads the same
  // vendors/{vendorId}/catalogItems collection the storefront listing and the
  // catalogItem subscription above already use.
  const [vendorMenuItems, setVendorMenuItems] = useState<MenuItem[]>([]);
  useEffect(() => {
    if (!vendorId) {
      setVendorMenuItems([]);
      return;
    }
    let cancelled = false;
    void catalogService.getVendorMenu(vendorId).then((menu) => {
      if (!cancelled) setVendorMenuItems(menu.items);
    }).catch((err) => {
      console.error('[ITEM] Could not load vendor menu for related items:', err);
      if (!cancelled) setVendorMenuItems([]);
    });
    return () => { cancelled = true; };
  }, [vendorId]);

  const relatedItems = useMemo(() => {
    // Only fall back to the fixture list when there is no real vendor to ask
    // at all; once a vendorId is known, an empty live result means the
    // vendor genuinely has no other items, not "show the mock menu instead."
    const source = vendorId ? vendorMenuItems : mockMenuItems;
    return source
      .filter((i) => i.id !== id && i.inStock)
      .slice(0, 6);
  }, [id, vendorId, vendorMenuItems]);

  const handleSeeAll = () => {
    if (!vendorId) return;
    console.log('[ITEM] See all pressed, navigating to vendor storefront:', vendorId, 'chatThreadId:', chatThreadId);
    router.push({
      pathname: '/customer/store/[vendorId]' as any,
      params: {
        vendorId,
        ...(chatThreadId ? { returnToChatThreadId: chatThreadId } : {}),
      },
    });
  };

  const handleViewRelatedItem = (relatedItemId: string) => {
    console.log('[ITEM] Related item tapped:', relatedItemId);
    router.push({
      pathname: '/item/[id]' as any,
      params: {
        id: relatedItemId,
        vendorId,
        source: 'chat_shared_item',
        ...(chatThreadId ? { chatThreadId } : {}),
      },
    });
  };

  // Was tallying quantities out of the seeded mockOrders array regardless of
  // which vendor/item was actually open, so every item on every real vendor's
  // storefront showed the same "Popular" verdict computed from demo data.
  // catalogItem.orderCount (mapped onto item.orderCount above) is the live
  // per-item counter the backend already maintains
  // (catalogItems/{itemId}.orderCount, incremented in
  // adjustInventoryAfterOrder) — falling back to mockMenuItems' orderCount
  // only for the case where catalogItem itself never resolved.
  const isPopular = useMemo(() => {
    if (!item) return false;
    return (item.orderCount ?? 0) >= 3;
  }, [item]);

  if (!item) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.floatingBack} onPress={() => safeBack()}>
          <ChevronLeft size={20} color={C.charcoal} />
        </TouchableOpacity>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Item not found</Text>
        </View>
      </View>
    );
  }

  const basePrice = catalogItem?.basePrice ?? item.price;
  const salePrice = catalogItem?.salePrice ?? item.salePrice;
  const isOnSale = salePrice !== undefined && salePrice > 0 && salePrice < basePrice;
  const displayPrice = isOnSale ? salePrice : basePrice;

  const effectiveQuantity = quantity > 0 ? quantity : 1;
  const itemTotal = displayPrice * effectiveQuantity;
  const addOnsTotalWithQty = addOnsTotal * effectiveQuantity;
  const grandTotal = itemTotal + addOnsTotalWithQty;

  const canOrder = canAddToCart && item.inStock;
  const ctaEnabled = canOrder && requiredGroupsFilled;

  const toggleAddOn = (groupId: string, optionId: string, selType: 'radio' | 'checkbox', maxSel: number) => {
    setSelectedAddOns((prev) => {
      const next = new Map(prev);
      const cur = next.get(groupId) || [];
      if (selType === 'radio') {
        next.set(groupId, [optionId]);
      } else {
        if (cur.includes(optionId)) {
          const updated = cur.filter((x) => x !== optionId);
          if (updated.length === 0) { next.delete(groupId); } else { next.set(groupId, updated); }
        } else {
          if (cur.length >= maxSel) { return prev; }
          next.set(groupId, [...cur, optionId]);
        }
      }
      return next;
    });
  };

  const incrementQty = () => {
    if (item.stockCount && quantity >= item.stockCount) return;
    if (cartItemInfo) {
      updateItemQuantity(cartItemInfo.index, 1, effectiveVendorId);
    } else {
      addItem(
        {
          id: item.id,
          name: item.name,
          price: displayPrice,
          originalPrice: basePrice,
          image: item.image,
          addOns: selectedAddOnObjects.length > 0 ? selectedAddOnObjects : undefined,
        },
        effectiveVendorId,
      );
    }
  };

  const decrementQty = () => {
    if (quantity <= 1) {
      if (cartItemInfo) {
        removeItemByIndex(cartItemInfo.index, effectiveVendorId);
      }
      return;
    }
    if (cartItemInfo) {
      updateItemQuantity(cartItemInfo.index, -1, effectiveVendorId);
    }
  };

  const handleAddToCart = () => {
    if (!ctaEnabled) {
      if (!requiredGroupsFilled) {
        Alert.alert('Required selections', 'Please complete all required selections.');
      }
      return;
    }
    if (cartItemInfo) {
      Alert.alert('Cart updated', `${item.name} updated.`);
      safeBack();
    } else {
      addItem(
        {
          id: item.id,
          name: item.name,
          price: displayPrice,
          originalPrice: basePrice,
          image: item.image,
          addOns: selectedAddOnObjects.length > 0 ? selectedAddOnObjects : undefined,
        },
        effectiveVendorId,
      );
      safeBack();
    }
  };

  const handleFavorite = () => {
    setIsFavorite((v) => !v);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.35, useNativeDriver: true, speed: 30 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
  };

  const handleShare = async () => {
    setShowActionsModal(false);
    await safeShare({ message: `Check out ${item.name} on the platform!`, title: item.name });
  };

  const handleForward = () => {
    setShowActionsModal(false);
    if (!vendorId) {
      Alert.alert('Error', 'Vendor information not available');
      return;
    }
    router.push({ pathname: '/chat/[vendorId]' as any, params: { vendorId, forwardItemId: id } });
  };

  const handleReport = () => {
    setShowActionsModal(false);
    Alert.alert('Report Item', 'Thank you for reporting. Our team will review this item.');
  };

  const hasAddOnGroups = (catalogItem?.addOnGroups?.length ?? 0) > 0;
  const showSocialBlock = orderedBefore || isPopular || (item.stockCount !== undefined);
  const isChatSource = source === 'chat_shared_item';

  const ctaLabel = (() => {
    if (!item.inStock) return 'Currently unavailable';
    if (!canAddToCart) return 'Ordering unavailable';
    if (!requiredGroupsFilled) return 'Select required options';
    if (cartItemInfo) return `Update cart · ${formatPriceWithCommas(grandTotal)}`;
    return `Add to cart · ${formatPriceWithCommas(displayPrice + addOnsTotal)}`;
  })();

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
      >
        {/* ── HERO ── */}
        <View style={styles.heroContainer}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]}>
              <Text style={styles.heroPlaceholderText}>No Image</Text>
            </View>
          )}
          <View style={[styles.heroOverlay, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity style={styles.heroBtn} onPress={() => safeBack()} activeOpacity={0.85}>
              <ChevronLeft size={20} color={C.charcoal} />
            </TouchableOpacity>
            <View style={styles.heroBtnRow}>
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <TouchableOpacity style={styles.heroBtn} onPress={handleFavorite} activeOpacity={0.85}>
                  <Heart
                    size={20}
                    color={isFavorite ? '#E53E3E' : C.charcoal}
                    fill={isFavorite ? '#E53E3E' : 'none'}
                  />
                </TouchableOpacity>
              </Animated.View>
              <TouchableOpacity style={styles.heroBtn} onPress={() => setShowActionsModal(true)} activeOpacity={0.85}>
                <Share2 size={20} color={C.charcoal} />
              </TouchableOpacity>
            </View>
          </View>

          {!item.inStock && (
            <View style={styles.unavailableOverlay}>
              <Text style={styles.unavailableOverlayText}>Unavailable</Text>
            </View>
          )}
        </View>

        {/* ── ITEM INFO CARD ── */}
        <View style={styles.infoCard}>
          <View style={styles.infoCardInner}>
            <View style={styles.nameRow}>
              <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
              <View style={styles.priceBlock}>
                {isOnSale ? (
                  <>
                    <Text style={styles.priceStrike}>{formatPriceWithCommas(basePrice)}</Text>
                    <Text style={styles.priceSale}>{formatPriceWithCommas(displayPrice)}</Text>
                  </>
                ) : (
                  <Text style={styles.priceMain}>{formatPriceWithCommas(displayPrice)}</Text>
                )}
              </View>
            </View>

            {isOnSale && (
              <View style={styles.savingsBanner}>
                <Text style={styles.savingsBannerText}>
                  You save {formatPriceWithCommas(basePrice - displayPrice)} per item
                </Text>
              </View>
            )}

            {item.description ? (
              <Text style={styles.description} numberOfLines={3}>{item.description}</Text>
            ) : null}

            {itemPromoBadges.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.promoBadgesScroll}
                contentContainerStyle={styles.promoBadgesContent}
              >
                {itemPromoBadges.map((label, idx) => (
                  <View key={idx} style={styles.greenPromoBadge}>
                    <Zap size={11} color="#FFFFFF" fill="#FFFFFF" />
                    <Text style={styles.greenPromoBadgeText}>{label}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {showSocialBlock && (
              <View style={styles.socialRow}>
                {item.stockCount !== undefined && item.stockCount <= 5 && item.inStock && (
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>Only {item.stockCount} left</Text>
                  </View>
                )}
                {orderedBefore && (
                  <View style={styles.pill}>
                    <Check size={11} color={C.textSecondary} style={{ marginRight: 3 }} />
                    <Text style={styles.pillText}>Ordered before</Text>
                  </View>
                )}
                {isPopular && (
                  <View style={styles.pill}>
                    <Star size={11} color={C.orange} fill={C.orange} style={{ marginRight: 3 }} />
                    <Text style={styles.pillText}>Popular</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* ── MODIFIER ENGINE ── */}
        {hasAddOnGroups && catalogItem?.addOnGroups.map((group) => {
          const groupSelections = selectedAddOns.get(group.id) || [];
          const maxSel = group.selectionType === 'radio' ? 1 : group.options.length;
          const subtext = group.subheading ?? getGroupSubtext({ ...group, selectionType: group.selectionType });
          const isGroupSatisfied = !group.isRequired || groupSelections.length > 0;

          return (
            <View key={group.id} style={styles.modifierGroup}>
              <View style={styles.modifierGroupHeader}>
                <View style={styles.modifierGroupTitleRow}>
                  <Text style={styles.modifierGroupTitle}>{group.heading}</Text>
                  {group.isRequired && !isGroupSatisfied && (
                    <View style={styles.requiredBadge}>
                      <Text style={styles.requiredBadgeText}>Required</Text>
                    </View>
                  )}
                  {group.isRequired && isGroupSatisfied && (
                    <View style={styles.satisfiedBadge}>
                      <Check size={11} color={C.white} />
                    </View>
                  )}
                </View>
                <Text style={styles.modifierGroupSubtext}>{subtext}</Text>
              </View>
              <View style={styles.modifierDivider} />

              {group.options.map((option, idx) => {
                const isSelected = groupSelections.includes(option.id);
                const isDisabled = !option.isAvailable || !item.inStock;
                const isMaxReached =
                  group.selectionType === 'checkbox' &&
                  groupSelections.length >= maxSel &&
                  !isSelected;
                const effectiveDisabled = isDisabled || isMaxReached;
                const isLast = idx === group.options.length - 1;
                const hasCost = option.price !== undefined && option.price > 0;

                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.modifierOption,
                      isSelected && styles.modifierOptionSelected,
                      isLast && styles.modifierOptionLast,
                      effectiveDisabled && styles.modifierOptionDisabled,
                    ]}
                    onPress={() =>
                      !effectiveDisabled && toggleAddOn(group.id, option.id, group.selectionType, maxSel)
                    }
                    activeOpacity={effectiveDisabled ? 1 : 0.7}
                  >
                    <View style={styles.modifierOptionLeft}>
                      {group.selectionType === 'radio' ? (
                        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected, effectiveDisabled && styles.controlDisabled]}>
                          {isSelected && <View style={styles.radioDot} />}
                        </View>
                      ) : (
                        <View style={[styles.checkboxOuter, isSelected && styles.checkboxOuterSelected, effectiveDisabled && styles.controlDisabled]}>
                          {isSelected && <Check size={13} color={C.white} strokeWidth={3} />}
                        </View>
                      )}
                      <Text
                        style={[
                          styles.modifierOptionName,
                          isSelected && styles.modifierOptionNameSelected,
                          effectiveDisabled && styles.modifierOptionNameDisabled,
                        ]}
                      >
                        {option.name}
                      </Text>
                    </View>
                    {hasCost && (
                      <Text style={[styles.modifierOptionPrice, effectiveDisabled && styles.modifierOptionPriceDisabled]}>
                        +{formatPriceWithCommas(option.price!)}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}

        {/* ── QUANTITY SELECTOR ── */}
        <View style={styles.quantityCard}>
          <Text style={styles.quantityLabel}>Quantity</Text>
          <View style={styles.qtyControls}>
            <TouchableOpacity
              style={[styles.qtyBtn, (quantity <= 0 || !canOrder) && styles.qtyBtnDisabled]}
              onPress={decrementQty}
              disabled={quantity <= 0 || !canOrder}
              activeOpacity={0.7}
            >
              <Minus size={18} color={quantity <= 0 || !canOrder ? C.disabledText : C.charcoal} />
            </TouchableOpacity>
            <Text style={styles.qtyValue}>{quantity}</Text>
            <TouchableOpacity
              style={[
                styles.qtyBtn,
                (!canOrder || (item.stockCount !== undefined && quantity >= item.stockCount)) && styles.qtyBtnDisabled,
              ]}
              onPress={incrementQty}
              disabled={!canOrder || (item.stockCount !== undefined && quantity >= item.stockCount)}
              activeOpacity={0.7}
            >
              <Plus size={18} color={!canOrder ? C.disabledText : C.charcoal} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── CHAT SOURCE CONTEXTUAL SECTIONS ── */}
        {isChatSource && vendor && (
          <>
            {/* About this vendor */}
            <TouchableOpacity
              style={styles.vendorAboutCard}
              onPress={() => setShowVendorModal(true)}
              activeOpacity={0.82}
              testID="about-vendor-card"
            >
              <View style={styles.vendorAboutLeft}>
                {vendor.logoImage ? (
                  <Image
                    source={{ uri: vendor.logoImage }}
                    style={styles.vendorAboutLogo}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.vendorAboutLogoFallback}>
                    <Store size={18} color={C.orange} />
                  </View>
                )}
                <View style={styles.vendorAboutTextBlock}>
                  <Text style={styles.vendorAboutSectionLabel}>About this vendor</Text>
                  <Text style={styles.vendorAboutName} numberOfLines={1}>{vendor.name}</Text>
                  <Text style={styles.vendorAboutMeta} numberOfLines={1}>
                    {vendor.category} · {vendor.area}
                  </Text>
                  {vendor.description ? (
                    <Text style={styles.vendorAboutDesc} numberOfLines={2}>{vendor.description}</Text>
                  ) : null}
                </View>
              </View>
              <ChevronRight size={16} color={C.textMuted} />
            </TouchableOpacity>

            {/* More from this vendor */}
            {relatedItems.length > 0 && (
              <View style={styles.moreFromSection}>
                <View style={styles.moreFromHeader}>
                  <Text style={styles.moreFromTitle}>More from {vendor.name}</Text>
                  <TouchableOpacity
                    style={styles.seeMoreBtn}
                    onPress={handleSeeAll}
                    activeOpacity={0.7}
                    testID="see-more-button"
                  >
                    <Text style={styles.seeMoreBtnText}>See all</Text>
                    <ChevronRight size={14} color={C.orange} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.moreFromScroll}
                >
                  {relatedItems.map((relItem) => {
                    const relBase = relItem.price;
                    const relSale = relItem.salePrice;
                    const relIsOnSale = relSale !== undefined && relSale > 0 && relSale < relBase;
                    const relDisplay = relIsOnSale ? relSale : relBase;

                    return (
                      <TouchableOpacity
                        key={relItem.id}
                        style={styles.relatedItemCard}
                        onPress={() => handleViewRelatedItem(relItem.id)}
                        activeOpacity={0.82}
                      >
                        {relItem.image ? (
                          <Image
                            source={{ uri: relItem.image }}
                            style={styles.relatedItemImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[styles.relatedItemImage, styles.relatedItemImageFallback]}>
                            <Store size={20} color={C.textMuted} />
                          </View>
                        )}
                        {relIsOnSale && (
                          <View style={styles.relatedSaleBadge}>
                            <Text style={styles.relatedSaleBadgeText}>SALE</Text>
                          </View>
                        )}
                        {!relItem.inStock && (
                          <View style={styles.relatedUnavailableBadge}>
                            <Text style={styles.relatedUnavailableText}>Unavailable</Text>
                          </View>
                        )}
                        <View style={styles.relatedItemInfo}>
                          <Text style={styles.relatedItemName} numberOfLines={2}>{relItem.name}</Text>
                          <View style={styles.relatedPriceRow}>
                            <Text style={styles.relatedItemPrice}>{formatPriceWithCommas(relDisplay)}</Text>
                            {relIsOnSale && (
                              <Text style={styles.relatedItemOriginal}>{formatPriceWithCommas(relBase)}</Text>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </>
        )}

        {/* ── STOREFRONT VENDOR ROW (minimal) ── */}
        {!isChatSource && vendor && (
          <View style={styles.vendorSection}>
            <View style={styles.vendorSectionHeader}>
              <View style={styles.vendorSectionLeft}>
                <View style={styles.vendorIconCircle}>
                  <Store size={16} color={C.orange} />
                </View>
                <View style={styles.vendorSectionTextBlock}>
                  <Text style={styles.vendorSectionName} numberOfLines={1}>{vendor.name}</Text>
                  <Text style={styles.vendorSectionMeta}>{vendor.category} · {vendor.area}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.seeAllButton}
                onPress={handleSeeAll}
                activeOpacity={0.7}
                testID="see-all-button"
              >
                <Text style={styles.seeAllButtonText}>See all</Text>
                <ChevronRight size={16} color={C.orange} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── STICKY CTA BAR ── */}
      <Animated.View
        style={[
          styles.stickyBar,
          { paddingBottom: insets.bottom + 12, opacity: ctaOpacity },
        ]}
      >
        {globalItemCount > 0 && canAddToCart && (
          <TouchableOpacity
            style={styles.cartPill}
            onPress={() => router.push('/cart' as any)}
            activeOpacity={0.85}
          >
            <ShoppingCart size={18} color={C.charcoal} />
            <View style={styles.cartPillBadge}>
              <Text style={styles.cartPillBadgeText}>{globalItemCount > 99 ? '99+' : globalItemCount}</Text>
            </View>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.ctaButton, !ctaEnabled && styles.ctaButtonDisabled]}
          onPress={handleAddToCart}
          activeOpacity={ctaEnabled ? 0.88 : 1}
        >
          <Text style={[styles.ctaButtonText, !ctaEnabled && styles.ctaButtonTextDisabled]}>
            {ctaLabel}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── ACTIONS MODAL ── */}
      <Modal
        visible={showActionsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowActionsModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowActionsModal(false)}
        >
          <View style={[styles.actionsSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.actionsHandle} />
            <Text style={styles.actionsTitle}>{item.name}</Text>

            <TouchableOpacity style={styles.actionRow} onPress={handleForward} activeOpacity={0.7}>
              <View style={styles.actionIcon}>
                <Forward size={20} color={C.charcoal} />
              </View>
              <Text style={styles.actionText}>Forward to chat</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={handleShare} activeOpacity={0.7}>
              <View style={styles.actionIcon}>
                <Share2 size={20} color={C.charcoal} />
              </View>
              <Text style={styles.actionText}>Share item</Text>
            </TouchableOpacity>

            <View style={styles.actionsDivider} />

            <TouchableOpacity style={styles.actionRow} onPress={handleReport} activeOpacity={0.7}>
              <View style={[styles.actionIcon, styles.actionIconDestructive]}>
                <AlertTriangle size={20} color="#E53E3E" />
              </View>
              <Text style={[styles.actionText, styles.actionTextDestructive]}>Report item</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── VENDOR PREVIEW MODAL ── */}
      <VendorPreviewModal
        visible={showVendorModal}
        vendor={vendor}
        onClose={() => setShowVendorModal(false)}
        onViewStore={(vid) => {
          setShowVendorModal(false);
          setTimeout(() => {
            router.push({
              pathname: '/customer/store/[vendorId]' as any,
              params: {
                vendorId: vid,
                ...(chatThreadId ? { returnToChatThreadId: chatThreadId } : {}),
              },
            });
          }, 150);
        }}
      />
    </View>
  );
}

export default function ItemViewScreen() {
  const { id, vendorId, source, fromChat, chatThreadId } = useLocalSearchParams<{
    id: string;
    vendorId?: string;
    source?: string;
    fromChat?: string;
    chatThreadId?: string;
  }>();

  const resolvedSource: ItemSource =
    source === 'chat_shared_item'
      ? 'chat_shared_item'
      : source === 'storefront'
      ? 'storefront'
      : fromChat === 'true'
      ? 'chat_shared_item'
      : 'storefront';

  // Same gap as the in-content vendor lookup: mockVendors.find only matches
  // the ten demo ids, so a real vendor that had been suspended or
  // deactivated always fell back to normalizeVendorStatus(undefined) here —
  // this gate is what's supposed to block ordering from a suspended vendor,
  // and it silently passed every real vendor as if unresolved.
  const [gateVendorStatus, setGateVendorStatus] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!vendorId) {
      setGateVendorStatus(undefined);
      return;
    }
    let cancelled = false;
    void vendorRepository.getById(vendorId).then((v) => {
      if (!cancelled) setGateVendorStatus(v?.vendorStatus);
    });
    return () => { cancelled = true; };
  }, [vendorId]);

  const normalizedStatus = useMemo(
    () => normalizeVendorStatus(gateVendorStatus),
    [gateVendorStatus],
  );

  console.log('[ITEM] id:', id, 'vendorId:', vendorId, 'source:', resolvedSource, 'chatThreadId:', chatThreadId);

  return (
    <VendorStatusGate vendorStatus={normalizedStatus}>
      <ItemViewContent
        id={id as string}
        vendorId={vendorId}
        source={resolvedSource}
        chatThreadId={chatThreadId}
      />
    </VendorStatusGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    flex: 1,
  },

  heroContainer: {
    width,
    height: IMAGE_HEIGHT,
    backgroundColor: C.border,
    position: 'relative',
  },
  heroImage: {
    width,
    height: IMAGE_HEIGHT,
  },
  heroPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0E0E0',
  },
  heroPlaceholderText: {
    fontSize: 15,
    color: C.textMuted,
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  heroBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  unavailableOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(26,26,26,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  unavailableOverlayText: {
    color: C.white,
    fontSize: 13,
    fontWeight: '600',
  },

  infoCard: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  infoCardInner: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 16,
  },
  itemName: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: C.textPrimary,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  priceBlock: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  priceMain: {
    fontSize: 20,
    fontWeight: '700',
    color: C.textPrimary,
  },
  priceSale: {
    fontSize: 20,
    fontWeight: '700',
    color: C.orange,
  },
  priceStrike: {
    fontSize: 13,
    fontWeight: '400',
    color: C.textMuted,
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  description: {
    fontSize: 14,
    color: C.textSecondary,
    lineHeight: 20,
    marginBottom: 14,
  },
  socialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.pillBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '500',
    color: C.textSecondary,
  },
  savingsBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: -4,
    marginBottom: 12,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start' as const,
  },
  savingsBannerText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#16A34A',
  },
  promoBadgesScroll: {
    marginBottom: 10,
  },
  promoBadgesContent: {
    gap: 8,
    paddingRight: 4,
  },
  greenPromoBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#166534',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  greenPromoBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  modifierGroup: {
    backgroundColor: C.surface,
    marginTop: 10,
  },
  modifierGroupHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modifierGroupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  modifierGroupTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textPrimary,
    letterSpacing: -0.2,
  },
  requiredBadge: {
    backgroundColor: '#FFF0E8',
    borderWidth: 1,
    borderColor: 'rgba(255,140,66,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  requiredBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.orange,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  satisfiedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#38A169',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modifierGroupSubtext: {
    fontSize: 12,
    color: C.textMuted,
    fontWeight: '400',
  },
  modifierDivider: {
    height: 1,
    backgroundColor: C.divider,
    marginHorizontal: 20,
  },
  modifierOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
    backgroundColor: C.surface,
  },
  modifierOptionSelected: {
    backgroundColor: C.selectedFill,
  },
  modifierOptionLast: {
    borderBottomWidth: 0,
    marginBottom: 6,
  },
  modifierOptionDisabled: {
    opacity: 0.45,
  },
  modifierOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  radioOuterSelected: {
    borderColor: C.orange,
    backgroundColor: C.surface,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.orange,
  },
  checkboxOuter: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  checkboxOuterSelected: {
    borderColor: C.orange,
    backgroundColor: C.orange,
  },
  controlDisabled: {
    borderColor: C.disabledText,
    backgroundColor: C.disabledBg,
  },
  modifierOptionName: {
    fontSize: 15,
    color: C.textPrimary,
    fontWeight: '400',
    flex: 1,
  },
  modifierOptionNameSelected: {
    color: C.textPrimary,
    fontWeight: '500',
  },
  modifierOptionNameDisabled: {
    color: C.disabledText,
  },
  modifierOptionPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textPrimary,
    marginLeft: 12,
  },
  modifierOptionPriceDisabled: {
    color: C.disabledText,
  },

  vendorSection: {
    backgroundColor: C.surface,
    marginTop: 10,
  },
  vendorSectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  vendorSectionLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flex: 1,
    gap: 12,
    marginRight: 12,
  },
  vendorIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,140,66,0.1)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  vendorSectionTextBlock: {
    flex: 1,
  },
  vendorSectionName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: C.textPrimary,
    marginBottom: 2,
  },
  vendorSectionMeta: {
    fontSize: 13,
    color: C.textSecondary,
  },
  seeAllButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
    paddingVertical: 6,
    paddingLeft: 8,
  },
  seeAllButtonText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: C.orange,
  },

  quantityCard: {
    backgroundColor: C.surface,
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: C.textPrimary,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  qtyBtnDisabled: {
    borderColor: C.divider,
    backgroundColor: C.surfaceAlt,
  },
  qtyValue: {
    fontSize: 18,
    fontWeight: '700',
    color: C.textPrimary,
    minWidth: 28,
    textAlign: 'center',
  },

  vendorAboutCard: {
    backgroundColor: C.surface,
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vendorAboutLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 14,
    marginRight: 8,
  },
  vendorAboutLogo: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: C.surfaceAlt,
    flexShrink: 0,
  },
  vendorAboutLogoFallback: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,140,66,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,140,66,0.15)',
  },
  vendorAboutTextBlock: {
    flex: 1,
  },
  vendorAboutSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.orange,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  vendorAboutName: {
    fontSize: 15,
    fontWeight: '700',
    color: C.textPrimary,
    marginBottom: 2,
  },
  vendorAboutMeta: {
    fontSize: 12,
    color: C.textSecondary,
    marginBottom: 5,
  },
  vendorAboutDesc: {
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 18,
  },

  moreFromSection: {
    backgroundColor: C.surface,
    marginTop: 10,
    paddingTop: 18,
    paddingBottom: 4,
  },
  moreFromHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  moreFromTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textPrimary,
    letterSpacing: -0.2,
  },
  seeMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeMoreBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: C.orange,
  },
  moreFromScroll: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 18,
  },
  relatedItemCard: {
    width: 148,
    backgroundColor: C.surfaceAlt,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  relatedItemImage: {
    width: '100%',
    height: 100,
    backgroundColor: C.border,
  },
  relatedItemImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0E0E0',
  },
  relatedSaleBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: C.orange,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  relatedSaleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.white,
    letterSpacing: 0.3,
  },
  relatedUnavailableBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(26,26,26,0.65)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  relatedUnavailableText: {
    fontSize: 10,
    fontWeight: '600',
    color: C.white,
  },
  relatedItemInfo: {
    padding: 10,
  },
  relatedItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textPrimary,
    lineHeight: 17,
    marginBottom: 5,
  },
  relatedPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  relatedItemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: C.orange,
  },
  relatedItemOriginal: {
    fontSize: 11,
    color: C.textMuted,
    textDecorationLine: 'line-through',
  },

  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    paddingHorizontal: 20,
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 10,
  },
  cartPill: {
    width: 48,
    height: 52,
    borderRadius: 14,
    backgroundColor: C.surfaceAlt,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  cartPillBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.surface,
  },
  cartPillBadgeText: {
    color: C.white,
    fontSize: 10,
    fontWeight: '700',
  },
  ctaButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonDisabled: {
    backgroundColor: C.disabledBg,
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.white,
    letterSpacing: -0.2,
  },
  ctaButtonTextDisabled: {
    color: C.disabledText,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: C.overlay,
    justifyContent: 'flex-end',
  },
  actionsSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  actionsHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  actionsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: C.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconDestructive: {
    backgroundColor: '#FFF5F5',
  },
  actionText: {
    fontSize: 16,
    color: C.textPrimary,
    fontWeight: '400',
  },
  actionTextDestructive: {
    color: '#E53E3E',
  },
  actionsDivider: {
    height: 1,
    backgroundColor: C.divider,
    marginVertical: 4,
  },

  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    fontSize: 16,
    color: C.textMuted,
  },
  floatingBack: {
    position: 'absolute',
    top: 56,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
