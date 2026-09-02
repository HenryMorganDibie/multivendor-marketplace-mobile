import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Pressable,
  TextInput,
  NativeScrollEvent,
  NativeSyntheticEvent,
  LayoutChangeEvent,
  Platform,
} from 'react-native';
import { Colors } from '@/constants/colors';
import {
  Plus,
  Minus,
  Sparkles,
  MessageCircle,
  AlertCircle,
  Zap,
  Flame,
  Star,
  Clock,
  Search,
  X,
} from 'lucide-react-native';
import { MenuItem, Category, Vendor } from '@/mocks/vendorData';
import { getNextOpenTime } from '@/utils/businessHours';
import { formatPrice } from '@/utils/formatPrice';
import type { VendorPromotion } from '@/mocks/promotionsData';
import { getVendorActivePromotions } from '@/contexts/PromoContext';
import PromotionCarousel from '@/features/storefront/components/PromotionCarousel';

interface StorefrontCatalogProps {
  vendor: Vendor;
  categories: Category[];
  filteredItems: MenuItem[];
  groupedItems: Record<string, MenuItem[]>;
  orderAgainItems: Array<{ item: MenuItem; orderCount: number; lastOrdered: string }>;
  hasCompletedOrderWithVendor: boolean;
  selectedCategory: string;
  searchQuery: string;
  isStoreOpen: boolean;
  isVendorBlocked: boolean;
  canChat: boolean;
  /** Plan + vendor-status gated. False for Basic vendors. */
  canUsePlatformAi: boolean;
  canAddToCart: boolean;
  chatMode: string;
  layout: {
    horizontalPadding: number;
    isTablet: boolean;
    cardGap: number;
    cardContainerWidth: (cols: number, gap: number, padding: number) => number;
  };
  getItemQuantityInCart: (itemId: string) => number;
  onCategorySelect: (categoryId: string) => void;
  onSearchChange: (text: string) => void;
  onClearSearch: () => void;
  onItemPress: (itemId: string) => void;
  onAddToCart: (item: MenuItem) => void;
  onIncrementItem: (item: MenuItem, e: any) => void;
  onDecrementItem: (itemId: string, e: any) => void;
  onVendorNamePress: () => void;
  onViewPolicy: () => void;
  onAskAI: () => void;
  onMessageVendor: () => void;
}

const DESCRIPTION_THRESHOLD = 100;

/**
 * Tracks layout positions of each category section so the sticky pills can:
 *  - jump to a section when a pill is tapped (DoorDash-style)
 *  - auto-update the selected pill as the user scrolls through sections
 */
interface SectionLayout {
  y: number;
  height: number;
  categoryId: string;
}

export default function StorefrontCatalog({
  vendor,
  categories,
  filteredItems,
  groupedItems,
  orderAgainItems,
  hasCompletedOrderWithVendor,
  selectedCategory,
  searchQuery,
  isStoreOpen,
  isVendorBlocked,
  canChat,
  canUsePlatformAi,
  canAddToCart,
  chatMode,
  layout,
  getItemQuantityInCart,
  onCategorySelect,
  onSearchChange,
  onClearSearch,
  onItemPress,
  onAddToCart,
  onIncrementItem,
  onDecrementItem,
  onVendorNamePress,
  onViewPolicy,
  onAskAI,
  onMessageVendor,
}: StorefrontCatalogProps) {
  const [descriptionExpanded, setDescriptionExpanded] = useState<boolean>(false);
  const [showStickySearch, setShowStickySearch] = useState<boolean>(false);

  // Real promotions this vendor actually created (create-promo.tsx, backed
  // by vendors/{vendorId}/promotions) — previously read from
  // mocks/promotionsData.ts's getActivePromotions, which only ever matches
  // the ten demo vendor ids, so a real vendor's own real promotions never
  // appeared on their own real storefront. A one-time fetch, not the live
  // PromoContext subscription, since that context is hardcoded to the
  // signed-in vendor's own id -- a customer viewing this storefront isn't
  // signed in as this vendor.
  const [livePromotions, setLivePromotions] = useState<VendorPromotion[]>([]);
  useEffect(() => {
    let cancelled = false;
    void getVendorActivePromotions(vendor.id).then((promos) => {
      if (!cancelled) setLivePromotions(promos);
    });
    return () => { cancelled = true; };
  }, [vendor.id]);

  const scrollRef = useRef<ScrollView | null>(null);
  const sectionLayoutsRef = useRef<Map<string, SectionLayout>>(new Map());
  // The y of the sticky bar in scroll-content coordinates (set on layout).
  // Used to offset jump calculations so a section header lands just below the sticky bar.
  const stickyBarHeightRef = useRef<number>(0);
  // Suppresses scroll-driven selection updates while we're programmatically scrolling
  // to a tapped pill, so we don't fight the user's tap.
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const programmaticScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only categories that actually have items in the current (search-filtered) view.
  // When searching, the catalog switches to a flat search-results list and pills are hidden.
  const visibleCategories = useMemo<Category[]>(() => {
    return categories.filter((c) => (groupedItems[c.id]?.length ?? 0) > 0);
  }, [categories, groupedItems]);

  const getCustomerCategoryName = (name: string): string => {
    if (name.toLowerCase() === 'uncategorized') return 'Other';
    return name;
  };

  const isPromoItem = (item: MenuItem): boolean => {
    return item.salePrice !== undefined && item.salePrice !== null && item.salePrice < item.price;
  };

  const renderSystemTags = (item: MenuItem) => {
    const tags: React.ReactElement[] = [];
    if (item.isFeatured) {
      tags.push(
        <View key="featured" style={styles.tagChipFeatured}>
          <Star size={8} color="#92400E" fill="#92400E" />
          <Text style={styles.tagChipTextFeatured}>Featured</Text>
        </View>
      );
    }
    if (item.popular) {
      tags.push(
        <View key="popular" style={styles.tagChipPopular}>
          <Flame size={8} color="#C2410C" fill="#C2410C" />
          <Text style={styles.tagChipTextPopular}>Popular</Text>
        </View>
      );
    }
    if (item.isNew) {
      tags.push(
        <View key="new" style={styles.tagChipNew}>
          <Text style={styles.tagChipTextNew}>New</Text>
        </View>
      );
    }
    if (tags.length === 0) return null;
    return <View style={styles.tagChipRow}>{tags}</View>;
  };

  const promoItemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const promo of livePromotions) {
      promo.applicableItemIds?.forEach((id) => ids.add(id));
    }
    return Array.from(ids);
  }, [livePromotions]);
  const isPromotionTarget = (itemId: string): boolean => promoItemIds.includes(itemId);
  const getItemBadgeLabel = (itemId: string): string => {
    for (const promo of livePromotions) {
      if (promo.applicableItemIds?.includes(itemId)) {
        if (promo.type === 'bogo') return 'BUY 1 GET 1';
        if (promo.type === 'free_item') return 'FREE ITEM';
        return 'OFFER';
      }
    }
    return 'OFFER';
  };

  const renderListItem = (item: MenuItem) => {
    const quantityInCart = getItemQuantityInCart(item.id);
    const hasModifiers = item.addOns && item.addOns.length > 0;
    const isPromo = isPromoItem(item);

    return (
      <TouchableOpacity
        key={item.id}
        // Deliberately still tappable when unavailable. A customer may want to
        // read the description, check pricing, favourite it or message the
        // vendor about it. Only ordering is blocked, not viewing.
        style={[styles.listItem, !item.inStock && styles.listItemDimmed]}
        onPress={() => onItemPress(item.id)}
        activeOpacity={0.8}
        testID={`menu-item-${item.id}`}
      >
        <View style={styles.listItemImageContainer}>
          <Image source={{ uri: item.image }} style={[styles.listItemImage, !item.inStock && styles.itemImageDimmed]} />
          {isPromo && (
            <View style={styles.promoBadge}>
              <Zap size={9} color="#FFFFFF" fill="#FFFFFF" />
              <Text style={styles.promoBadgeText}>PROMO</Text>
            </View>
          )}
          {!isPromo && isPromotionTarget(item.id) && (
            <View style={styles.offerBadge}>
              <Zap size={9} color="#FFFFFF" fill="#FFFFFF" />
              <Text style={styles.offerBadgeText}>{getItemBadgeLabel(item.id)}</Text>
            </View>
          )}
        </View>
        <View style={styles.listItemContent}>
          <View style={styles.listItemHeader}>
            <View style={styles.listItemTextContainer}>
              <Text style={[styles.listItemName, !item.inStock && styles.itemNameDisabled]} numberOfLines={1}>
                {item.name}
              </Text>
              {item.description && (
                <Text style={[styles.listItemDescription, !item.inStock && styles.itemDescriptionDisabled]} numberOfLines={1}>
                  {item.description}
                </Text>
              )}
              {renderSystemTags(item)}
              <View style={styles.listItemPriceRow}>
                {isPromo ? (
                  <>
                    <Text style={[styles.listItemPriceStrikethrough, !item.inStock && styles.itemMetadataDisabled]}>
                      {formatPrice(item.price)}
                    </Text>
                    <Text style={[styles.listItemPricePromo, !item.inStock && styles.itemMetadataDisabled]}>
                      {formatPrice(item.salePrice!)}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.listItemPrice, !item.inStock && styles.itemMetadataDisabled]}>
                    {formatPrice(item.price)}
                  </Text>
                )}
                {hasModifiers && <Text style={styles.hasAddOnsText}>• Customizable</Text>}
              </View>
            </View>
            <View style={styles.listItemActions}>
              {!item.inStock && (
                <View style={styles.unavailableBadge}>
                  <Text style={styles.unavailableText}>Unavailable</Text>
                </View>
              )}
              {item.inStock && !canAddToCart && (
                <View style={[styles.listAddButton, styles.listAddButtonDisabled]}>
                  <Plus size={18} color={Colors.textMuted} />
                </View>
              )}
              {item.inStock && canAddToCart && quantityInCart === 0 && (
                <TouchableOpacity
                  style={styles.listAddButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    onAddToCart(item);
                  }}
                  activeOpacity={0.7}
                >
                  <Plus size={18} color={Colors.text} />
                </TouchableOpacity>
              )}
              {item.inStock && canAddToCart && quantityInCart > 0 && (
                <View style={styles.listQuantityControls}>
                  <TouchableOpacity
                    style={styles.listQuantityButton}
                    onPress={(e) => onDecrementItem(item.id, e)}
                    activeOpacity={0.7}
                  >
                    <Minus size={16} color={Colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.listQuantityText}>{quantityInCart}</Text>
                  <TouchableOpacity
                    style={styles.listQuantityButton}
                    onPress={(e) => onIncrementItem(item, e)}
                    activeOpacity={0.7}
                  >
                    <Plus size={16} color={Colors.text} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const handleSectionLayout = useCallback(
    (category: Category, e: LayoutChangeEvent) => {
      sectionLayoutsRef.current.set(category.id, {
        y: e.nativeEvent.layout.y,
        height: e.nativeEvent.layout.height,
        categoryId: category.id,
      });
    },
    []
  );

  const handleStickyBarLayout = useCallback((e: LayoutChangeEvent) => {
    stickyBarHeightRef.current = e.nativeEvent.layout.height;
  }, []);

  const jumpToCategory = useCallback(
    (categoryId: string) => {
      onCategorySelect(categoryId);
      if (categoryId === 'all') {
        isProgrammaticScrollRef.current = true;
        if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);
        scrollRef.current?.scrollTo({ x: 0, y: 0, animated: true });
        programmaticScrollTimerRef.current = setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 350);
        return;
      }
      const layout = sectionLayoutsRef.current.get(categoryId);
      if (!layout || !scrollRef.current) return;
      // Land the section header a few pixels below the sticky bar so the title
      // is visible rather than tucked under the pills.
      const offset = Math.max(0, layout.y - stickyBarHeightRef.current + 6);
      isProgrammaticScrollRef.current = true;
      if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);
      scrollRef.current.scrollTo({ x: 0, y: offset, animated: true });
      programmaticScrollTimerRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 450);
    },
    [onCategorySelect]
  );

  // As the user scrolls, update the selected pill to match the section in view.
  // Skipped during programmatic jumps (so taps don't get overridden) and while searching.
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isProgrammaticScrollRef.current) return;
      if (searchQuery.trim().length > 0) return;
      const y = event.nativeEvent.contentOffset.y;
      const stickyH = stickyBarHeightRef.current || 0;
      // The "current" section is the last one whose top has passed the sticky bar's bottom.
      let currentId: string | null = null;
      for (const cat of visibleCategories) {
        const layout = sectionLayoutsRef.current.get(cat.id);
        if (!layout) continue;
        if (layout.y - stickyH <= y + 4) {
          currentId = cat.id;
        } else {
          break;
        }
      }
      if (currentId && currentId !== selectedCategory) {
        onCategorySelect(currentId);
      } else if (!currentId && selectedCategory !== 'all' && y < (sectionLayoutsRef.current.get(visibleCategories[0]?.id ?? '')?.y ?? Infinity)) {
        // Above the first section → "All"
        onCategorySelect('all');
      }
    },
    [visibleCategories, selectedCategory, searchQuery, onCategorySelect]
  );

  // When the user clears the search, reset the selection back to "All".
  useEffect(() => {
    if (searchQuery.trim().length === 0 && selectedCategory !== 'all') {
      // Only reset if we were previously in search mode to avoid clobbering a
      // legitimate scroll-driven selection on mount. We detect that by checking
      // whether any section has been measured yet.
      if (sectionLayoutsRef.current.size > 0) {
        onCategorySelect('all');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  useEffect(() => {
    return () => {
      if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);
    };
  }, []);

  const renderCategorySection = (category: Category) => {
    const items = groupedItems[category.id] || [];
    if (items.length === 0) return null;
    const hPad = layout.horizontalPadding;
    const catCols = layout.isTablet ? 2 : 1;
    const colGap = layout.cardGap;

    return (
      <View
        key={category.id}
        style={styles.categorySection}
        onLayout={(e) => handleSectionLayout(category, e)}
      >
        <View style={[styles.categorySectionHeader, { paddingHorizontal: hPad }]}>
          <Text style={styles.categorySectionTitle}>
            {getCustomerCategoryName(category.name).toUpperCase()} ({items.length})
          </Text>
        </View>
        {layout.isTablet ? (
          <View style={[styles.menuGrid, { paddingHorizontal: hPad, gap: colGap }]}>
            {items.map((item) => (
              <View
                key={item.id}
                style={{ width: layout.cardContainerWidth(catCols, colGap, hPad) }}
              >
                {renderListItem(item)}
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.categoryListContainer, { paddingHorizontal: hPad }]}>
            {items.map((item) => renderListItem(item))}
          </View>
        )}
      </View>
    );
  };

  const isSearching = searchQuery.trim().length > 0;

  // The sticky block: store search + horizontal category pills.
  // Rendered as a child of the ScrollView with `stickyHeaderIndices` so RN pins
  // it to the top once the user scrolls past the vendor hero. When searching,
  // we render only the search row (no category pills) because results are flat.
  const renderStickyNav = () => (
    <View
      style={styles.stickyNav}
      onLayout={handleStickyBarLayout}
      pointerEvents="box-none"
    >
      {/* Search this store */}
      <View style={styles.storeSearchRow}>
        <View style={styles.storeSearchBar}>
          <Search size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.storeSearchInput}
            placeholder="Search this store"
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={onSearchChange}
            onFocus={() => setShowStickySearch(true)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                onClearSearch();
                setShowStickySearch(false);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <X size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category pills — hidden while searching (flat results list instead) */}
      {!isSearching && visibleCategories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryPills}
          contentContainerStyle={styles.categoryPillsContent}
        >
          <Pressable
            onPress={() => jumpToCategory('all')}
            style={[styles.categoryPill, selectedCategory === 'all' && styles.categoryPillActive]}
          >
            <Text style={[styles.categoryPillText, selectedCategory === 'all' && styles.categoryPillTextActive]}>
              All
            </Text>
          </Pressable>
          {visibleCategories.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => jumpToCategory(category.id)}
              style={[styles.categoryPill, selectedCategory === category.id && styles.categoryPillActive]}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  selectedCategory === category.id && styles.categoryPillTextActive,
                ]}
              >
                {getCustomerCategoryName(category.name)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );

  // Build the ScrollView children and compute the sticky header index.
  // Order: [hero] [stickyNav] [promotions/banners/search-results/menu] ...
  // The sticky nav is always at index 1, so it pins as soon as the hero scrolls off.
  const children: React.ReactNode[] = [];

  // 0 — Hero / vendor info
  children.push(
    <View key="hero">
      <Image source={{ uri: vendor.bannerImage }} style={styles.bannerImage} />

      <View style={[styles.vendorInfo, { paddingHorizontal: layout.horizontalPadding }]}>
        <TouchableOpacity onPress={onVendorNamePress} activeOpacity={0.7}>
          <Text style={styles.vendorName}>{vendor.name}</Text>
        </TouchableOpacity>
        <View style={styles.metadataRow}>
          <Text style={styles.metadataText}>{vendor.category} · ⭐ {vendor.rating} ({vendor.reviewCount})</Text>
        </View>
        <Text style={styles.metadataText}>{vendor.area}</Text>

        {vendor.description && vendor.description.trim().length > 0 && (
          <View style={styles.descriptionBlock}>
            <Text style={styles.descriptionText} numberOfLines={descriptionExpanded ? undefined : 3}>
              {vendor.description.trim()}
            </Text>
            {vendor.description.trim().length > DESCRIPTION_THRESHOLD && (
              <TouchableOpacity
                onPress={() => setDescriptionExpanded(!descriptionExpanded)}
                activeOpacity={0.7}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Text style={styles.descriptionSeeMore}>
                  {descriptionExpanded ? 'See less' : 'See more'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.fulfillmentSection}>
          <View style={styles.fulfillmentBadges}>
            {vendor.pickup && (
              <View style={styles.fulfillmentBadge}>
                <Text style={styles.fulfillmentBadgeText}>Pickup</Text>
              </View>
            )}
            {vendor.delivery && (
              <View style={styles.fulfillmentBadge}>
                <Text style={styles.fulfillmentBadgeText}>Delivery</Text>
              </View>
            )}
            {vendor.shipping && vendor.shippingScope === 'domestic' && (
              <View style={styles.fulfillmentBadgeShipping}>
                <Text style={styles.fulfillmentBadgeTextShipping}>Ships Nationwide</Text>
              </View>
            )}
            {vendor.shipping && vendor.shippingScope === 'international' && (
              <View style={styles.fulfillmentBadgeShipping}>
                <Text style={styles.fulfillmentBadgeTextShipping}>Ships Worldwide</Text>
              </View>
            )}
          </View>
        </View>

        {!isStoreOpen && (() => {
          const nextOpen = getNextOpenTime(vendor.weeklyHours);
          return (
            <View style={styles.closedIndicator}>
              <Clock size={12} color={Colors.textSecondary} />
              <Text style={styles.closedIndicatorText}>
                {vendor.storeStatus === 'away' ? 'Away' : nextOpen ? `Opens at ${nextOpen}` : 'Currently closed'}
              </Text>
            </View>
          );
        })()}

        {vendor.policy && vendor.policy.trim().length > 0 && (
          <TouchableOpacity onPress={onViewPolicy} style={styles.policyButton}>
            <Text style={styles.policyText}>{vendor.name}'s Business Policy</Text>
          </TouchableOpacity>
        )}

        <View style={styles.ctaSection}>
          {vendor.vendorStatus === 'ACTIVE' && (
            <>
              {canUsePlatformAi && (
                <TouchableOpacity onPress={onAskAI} style={styles.primaryCTA}>
                  <Sparkles size={20} color="#FFFFFF" />
                  <Text style={styles.primaryCTAText}>Ask the platform AI</Text>
                </TouchableOpacity>
              )}
              {canChat && chatMode === 'enabled' && (
                <TouchableOpacity onPress={onMessageVendor} style={styles.secondaryCTA}>
                  <MessageCircle size={20} color={Colors.textSecondary} />
                  <Text style={styles.secondaryCTAText}>Message vendor</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>

      <PromotionCarousel promotions={livePromotions} />

      {isVendorBlocked && (
        <View style={styles.blockedBanner}>
          <AlertCircle size={14} color={Colors.textSecondary} />
          <Text style={styles.blockedBannerText}>You cannot initiate communication with this vendor.</Text>
        </View>
      )}

      {!isStoreOpen && (() => {
        const nextOpen = getNextOpenTime(vendor.weeklyHours);
        return (
          <View style={styles.storeClosedBanner}>
            <Clock size={14} color="#6B7280" />
            <Text style={styles.storeClosedBannerText}>
              {nextOpen ? `Opens at ${nextOpen} · You can still order` : 'Currently closed · You can still order'}
            </Text>
          </View>
        );
      })()}

      <View style={styles.footerDisclaimer}>
        <Text style={styles.footerDisclaimerText}>
          Orders and payments are handled directly by {vendor.name}.
        </Text>
      </View>

      {hasCompletedOrderWithVendor && orderAgainItems.length > 0 && (
        <View style={styles.orderAgainSection}>
          <View style={styles.orderAgainHeader}>
            <Text style={styles.orderAgainTitle}>Order it again</Text>
            <Text style={styles.orderAgainSubtitle}>Quickly add items from your past orders</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.orderAgainCarousel}
          >
            {orderAgainItems.map(({ item, orderCount }) => {
              const hasModifiers = item.addOns && item.addOns.length > 0;
              const quantityInCart = getItemQuantityInCart(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.orderAgainCard}
                  onPress={() => onItemPress(item.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.orderAgainImageContainer}>
                    <Image source={{ uri: item.image }} style={styles.orderAgainImage} />
                    {!canAddToCart ? (
                      <View style={[styles.orderAgainAddButton, styles.orderAgainAddButtonDisabled]}>
                        <Plus size={18} color={Colors.textMuted} />
                      </View>
                    ) : quantityInCart === 0 ? (
                      <TouchableOpacity
                        style={styles.orderAgainAddButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          if (hasModifiers) {
                            onItemPress(item.id);
                          } else {
                            onAddToCart(item);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Plus size={18} color={Colors.text} />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.orderAgainQuantityBadge}>
                        <Text style={styles.orderAgainQuantityText}>{quantityInCart}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.orderAgainInfo}>
                    <Text style={styles.orderAgainItemName} numberOfLines={2}>{item.name}</Text>
                    {isPromoItem(item) ? (
                      <View style={styles.orderAgainPriceRow}>
                        <Text style={styles.orderAgainItemPricePromo}>{formatPrice(item.salePrice!)}</Text>
                        <Text style={styles.orderAgainItemPriceStrike}>{formatPrice(item.price)}</Text>
                      </View>
                    ) : (
                      <Text style={styles.orderAgainItemPrice}>{formatPrice(item.price)}</Text>
                    )}
                    <Text style={styles.orderAgainCount}>Ordered {orderCount} time{orderCount !== 1 ? 's' : ''}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );

  // 1 — Sticky nav (pinned once hero scrolls away). Do NOT include a top margin
  // here — the sticky bar carries its own background and bottom border.
  children.push(<View key="stickyNav" style={styles.stickyNavWrap}>{renderStickyNav()}</View>);

  // 2 — Menu sections OR flat search results
  children.push(
    <View key="menu" style={styles.menuSections}>
      {isSearching ? (
        <View style={[styles.searchResults, { paddingHorizontal: layout.horizontalPadding }]}>
          <Text style={styles.searchResultsTitle}>
            Search Results ({filteredItems.length})
          </Text>
          {filteredItems.length === 0 ? (
            <View style={styles.searchEmpty}>
              <Search size={26} color={Colors.textMuted} />
              <Text style={styles.searchEmptyTitle}>No items found</Text>
              <Text style={styles.searchEmptySubtitle}>Try a different search term.</Text>
            </View>
          ) : layout.isTablet ? (
            <View style={[styles.menuGrid, { gap: layout.cardGap }]}>
              {filteredItems.map((item) => (
                <View key={item.id} style={{ width: layout.cardContainerWidth(2, layout.cardGap, 0) }}>
                  {renderListItem(item)}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.categoryListContainer}>
              {filteredItems.map((item) => renderListItem(item))}
            </View>
          )}
        </View>
      ) : (
        visibleCategories.map((category) => renderCategorySection(category))
      )}
    </View>
  );

  children.push(<View key="bottomSpacer" style={styles.bottomSpacer} />);

  const STICKY_INDEX = 1;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.content}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[STICKY_INDEX]}
      onScroll={handleScroll}
      scrollEventThrottle={32}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 120 }}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  bannerImage: {
    width: '100%' as const,
    height: 200,
    backgroundColor: '#F0F0F0',
  },
  vendorInfo: {
    paddingTop: 12,
    paddingBottom: 16,
  },
  vendorName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  metadataRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 2,
  },
  metadataText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  fulfillmentSection: {
    marginTop: 8,
    gap: 6,
  },
  fulfillmentBadges: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  fulfillmentBadge: {
    backgroundColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fulfillmentBadgeText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  fulfillmentBadgeShipping: {
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fulfillmentBadgeTextShipping: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  closedIndicator: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginTop: 8,
  },
  closedIndicatorText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '400' as const,
  },
  policyButton: {
    paddingVertical: 6,
  },
  policyText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  descriptionBlock: {
    marginTop: 10,
    marginBottom: 2,
  },
  descriptionText: {
    fontSize: 13,
    color: '#555555',
    lineHeight: 20,
  },
  descriptionSeeMore: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500' as const,
    marginTop: 3,
  },
  ctaSection: {
    marginTop: 12,
    gap: 10,
  },
  primaryCTA: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#000000',
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryCTAText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  secondaryCTA: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: 'transparent',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryCTAText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  blockedBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F1F1',
  },
  blockedBannerText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  storeClosedBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  storeClosedBannerText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500' as const,
  },
  footerDisclaimer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
  },
  footerDisclaimerText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  orderAgainSection: {
    paddingTop: 20,
    paddingBottom: 16,
  },
  orderAgainHeader: {
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  orderAgainTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  orderAgainSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  orderAgainCarousel: {
    paddingHorizontal: 20,
    gap: 14,
    paddingBottom: 4,
  },
  orderAgainCard: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden' as const,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  orderAgainImageContainer: {
    position: 'relative' as const,
  },
  orderAgainImage: {
    width: 140,
    height: 100,
    backgroundColor: '#F0F0F0',
  },
  orderAgainAddButton: {
    position: 'absolute' as const,
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  orderAgainAddButtonDisabled: {
    backgroundColor: Colors.surface,
    opacity: 0.45,
  },
  orderAgainQuantityBadge: {
    position: 'absolute' as const,
    bottom: 8,
    right: 8,
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 10,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  orderAgainQuantityText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  orderAgainInfo: {
    padding: 10,
  },
  orderAgainItemName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
    lineHeight: 18,
  },
  orderAgainPriceRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 2,
  },
  orderAgainItemPricePromo: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  orderAgainItemPriceStrike: {
    fontSize: 11,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  orderAgainItemPrice: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  orderAgainCount: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500' as const,
  },

  /* Sticky nav */
  stickyNavWrap: {
    // Wrapper around the sticky block. RN pins this whole child under the top.
    backgroundColor: Colors.background,
  },
  stickyNav: {
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    // iOS hairline shadow under the sticky bar
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'ios' ? 0.04 : 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  storeSearchRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  storeSearchBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  storeSearchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    padding: 0,
  },
  categoryPills: {
    borderBottomWidth: 0,
  },
  categoryPillsContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryPillActive: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  categoryPillText: {
    fontSize: 13.5,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  categoryPillTextActive: {
    color: Colors.background,
  },

  /* Menu */
  menuSections: {
    paddingTop: 8,
    backgroundColor: Colors.background,
  },
  categorySection: {
    marginBottom: 8,
  },
  categorySectionHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
    paddingTop: 14,
  },
  categorySectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  menuGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
  },
  categoryListContainer: {
    paddingBottom: 4,
  },
  searchResults: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  searchResultsTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  searchEmpty: {
    alignItems: 'center' as const,
    paddingVertical: 40,
    gap: 8,
  },
  searchEmptyTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  searchEmptySubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  listItem: {
    flexDirection: 'row' as const,
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginBottom: 2,
  },
  listItemDimmed: {
    opacity: 0.75,
  },
  listItemImageContainer: {
    position: 'relative' as const,
  },
  listItemImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
  },
  promoBadge: {
    position: 'absolute' as const,
    bottom: 4,
    left: 4,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.primary,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 2,
  },
  promoBadgeText: {
    fontSize: 7,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  offerBadge: {
    position: 'absolute' as const,
    bottom: 4,
    left: 4,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#166534',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 2,
  },
  offerBadgeText: {
    fontSize: 7,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  itemImageDimmed: {
    opacity: 0.5,
  },
  listItemContent: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center' as const,
  },
  listItemHeader: {
    flex: 1,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
  },
  listItemTextContainer: {
    flex: 1,
  },
  listItemName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  itemNameDisabled: {
    color: Colors.textMuted,
  },
  listItemDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginBottom: 4,
  },
  itemDescriptionDisabled: {
    color: Colors.textMuted,
  },
  listItemPriceRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  listItemPrice: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2B2B2B',
  },
  listItemPriceStrikethrough: {
    fontSize: 13,
    color: Colors.textMuted,
    textDecorationLine: 'line-through' as const,
  },
  listItemPricePromo: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  itemMetadataDisabled: {
    color: Colors.textMuted,
  },
  hasAddOnsText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  listItemActions: {
    flexShrink: 0,
    justifyContent: 'flex-end' as const,
    alignItems: 'center' as const,
    alignSelf: 'center' as const,
  },
  listAddButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  listAddButtonDisabled: {
    backgroundColor: Colors.surface,
    opacity: 0.45,
  },
  listQuantityControls: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  listQuantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  listQuantityText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    minWidth: 18,
    textAlign: 'center' as const,
  },
  unavailableBadge: {
    backgroundColor: Colors.error,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  unavailableText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  bottomSpacer: {
    height: 120,
  },
  tagChipRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 4,
    marginBottom: 4,
    marginTop: 2,
  },
  tagChipFeatured: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagChipTextFeatured: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#92400E',
  },
  tagChipPopular: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagChipTextPopular: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#C2410C',
  },
  tagChipNew: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagChipTextNew: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#1D4ED8',
  },
});
