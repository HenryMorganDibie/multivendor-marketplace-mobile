import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { Plus, Minus, Sparkles, MessageCircle, AlertCircle, Zap, ChevronRight } from 'lucide-react-native';
import { MenuItem, Category, Vendor } from '@/mocks/vendorData';
import { formatPrice } from '@/utils/formatPrice';
import { getActivePromotions, getPromotionItemIds, getPromotionBadgeForItem } from '@/mocks/promotionsData';
import PromotionCarousel from '@/features/storefront/components/PromotionCarousel';
import {
  computeSystemTags,
  getSystemTagDisplay,
  getHighlightLabelDisplay,
  FEATURED_TAG_DISPLAY,
  type SystemTag,
} from '@/utils/itemTagging';

interface StorefrontSections {
  promotions: MenuItem[];
  popular: MenuItem[];
  newItems: MenuItem[];
  featured: MenuItem[];
}

interface StorefrontCatalogProps {
  vendor: Vendor;
  categories: Category[];
  filteredItems: MenuItem[];
  groupedItems: Record<string, MenuItem[]>;
  storefrontSections: StorefrontSections;
  orderAgainItems: Array<{ item: MenuItem; orderCount: number; lastOrdered: string }>;
  hasCompletedOrderWithVendor: boolean;
  selectedCategory: string;
  searchQuery: string;
  isStoreOpen: boolean;
  isVendorBlocked: boolean;
  canChat: boolean;
  canAccessAI: boolean;
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
const SECTION_PREVIEW_LIMIT = 6;

export default function StorefrontCatalog({
  vendor,
  categories,
  filteredItems,
  groupedItems,
  storefrontSections,
  orderAgainItems,
  hasCompletedOrderWithVendor,
  selectedCategory,
  searchQuery,
  isStoreOpen,
  isVendorBlocked,
  canChat,
  canAccessAI,
  canAddToCart,
  chatMode,
  layout,
  getItemQuantityInCart,
  onCategorySelect,
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

  const allMenuItems = React.useMemo(() => filteredItems, [filteredItems]);

  const getCustomerCategoryName = (name: string): string => {
    if (name.toLowerCase() === 'uncategorized') return 'Other';
    return name;
  };

  const isPromoMenuItem = (item: MenuItem): boolean => {
    return typeof item.salePrice === 'number' && item.salePrice > 0 && item.salePrice < item.price;
  };

  const promoItemIds = getPromotionItemIds(vendor.id);
  const isPromotionTarget = (itemId: string): boolean => promoItemIds.includes(itemId);
  const getItemBadgeLabel = (itemId: string): string => getPromotionBadgeForItem(vendor.id, itemId) ?? 'OFFER';

  const getTagsForItem = (item: MenuItem): SystemTag[] => {
    return computeSystemTags(item, allMenuItems);
  };

  const renderItemBadges = (item: MenuItem) => {
    const sysTags = getTagsForItem(item);
    const isFeaturedItem = item.isFeatured === true;
    const highlightLabel = item.highlightLabel;

    const shown: React.ReactElement[] = [];

    if (isFeaturedItem) {
      shown.push(
        <View key="featured" style={[styles.tagBadge, { backgroundColor: FEATURED_TAG_DISPLAY.bg }]}>
          <Text style={[styles.tagBadgeText, { color: FEATURED_TAG_DISPLAY.color }]}>
            {FEATURED_TAG_DISPLAY.emoji} {FEATURED_TAG_DISPLAY.label}
          </Text>
        </View>
      );
    }

    sysTags.forEach((tag) => {
      const display = getSystemTagDisplay(tag);
      shown.push(
        <View key={tag} style={[styles.tagBadge, { backgroundColor: display.bg }]}>
          <Text style={[styles.tagBadgeText, { color: display.color }]}>
            {display.emoji} {display.label}
          </Text>
        </View>
      );
    });

    if (highlightLabel) {
      const hl = getHighlightLabelDisplay(highlightLabel);
      shown.push(
        <View key="highlight" style={[styles.tagBadge, { backgroundColor: '#F0FDF4' }]}>
          <Text style={[styles.tagBadgeText, { color: '#15803D' }]}>
            {hl.emoji} {hl.label}
          </Text>
        </View>
      );
    }

    if (shown.length === 0) return null;
    return (
      <View style={styles.itemBadgeRow}>
        {shown.slice(0, 2)}
      </View>
    );
  };

  const renderListItem = (item: MenuItem) => {
    const quantityInCart = getItemQuantityInCart(item.id);
    const hasModifiers = item.addOns && item.addOns.length > 0;
    const isPromo = isPromoMenuItem(item);

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.listItem, !item.inStock && styles.listItemDisabled]}
        onPress={() => onItemPress(item.id)}
        activeOpacity={item.inStock ? 0.8 : 1}
        disabled={!item.inStock}
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
              {renderItemBadges(item)}
              {item.description && (
                <Text style={[styles.listItemDescription, !item.inStock && styles.itemDescriptionDisabled]} numberOfLines={1}>
                  {item.description}
                </Text>
              )}
              <View style={styles.listItemPriceRow}>
                {isPromo ? (
                  <>
                    <Text style={[styles.listItemPrice, !item.inStock && styles.itemMetadataDisabled]}>
                      {formatPrice(item.salePrice!)}
                    </Text>
                    <Text style={[styles.listItemPriceStrikethrough, !item.inStock && styles.itemMetadataDisabled]}>
                      {formatPrice(item.price)}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.listItemPrice, !item.inStock && styles.itemMetadataDisabled]}>
                    {formatPrice(item.price)}
                  </Text>
                )}
                {hasModifiers && (
                  <Text style={styles.hasAddOnsText}>• Customizable</Text>
                )}
              </View>
            </View>
            <View style={styles.listItemActions}>
              {!item.inStock && (
                <View style={styles.unavailableBadge}>
                  <Text style={styles.unavailableText}>Out of stock</Text>
                </View>
              )}
              {item.inStock && (!isStoreOpen || !canAddToCart) && (
                <View style={[styles.listAddButton, styles.listAddButtonDisabled]}>
                  <Plus size={18} color={Colors.textMuted} />
                </View>
              )}
              {item.inStock && isStoreOpen && canAddToCart && quantityInCart === 0 && (
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
              {item.inStock && isStoreOpen && canAddToCart && quantityInCart > 0 && (
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

  const renderHorizontalSection = (
    title: string,
    emoji: string,
    items: MenuItem[],
    accentColor: string,
    bgColor: string,
  ) => {
    if (items.length === 0) return null;
    const preview = items.slice(0, SECTION_PREVIEW_LIMIT);

    return (
      <View style={[styles.horizontalSection, { borderLeftColor: accentColor }]}>
        <View style={styles.horizontalSectionHeader}>
          <View style={styles.horizontalSectionTitleRow}>
            <Text style={styles.horizontalSectionEmoji}>{emoji}</Text>
            <Text style={styles.horizontalSectionTitle}>{title}</Text>
            <View style={[styles.horizontalSectionCount, { backgroundColor: bgColor }]}>
              <Text style={[styles.horizontalSectionCountText, { color: accentColor }]}>{items.length}</Text>
            </View>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalSectionScroll}
        >
          {preview.map((item) => {
            const quantityInCart = getItemQuantityInCart(item.id);
            const isPromo = isPromoMenuItem(item);
            const hasModifiers = item.addOns && item.addOns.length > 0;
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.sectionCard}
                onPress={() => onItemPress(item.id)}
                activeOpacity={0.8}
              >
                <View style={styles.sectionCardImageWrap}>
                  <Image source={{ uri: item.image }} style={styles.sectionCardImage} />
                  {isPromo && (
                    <View style={styles.sectionCardPromoBadge}>
                      <Text style={styles.sectionCardPromoBadgeText}>PROMO</Text>
                    </View>
                  )}
                  {item.inStock && isStoreOpen && canAddToCart && (
                    quantityInCart === 0 ? (
                      <TouchableOpacity
                        style={styles.sectionCardAdd}
                        onPress={(e) => {
                          e.stopPropagation();
                          if (hasModifiers) { onItemPress(item.id); return; }
                          onAddToCart(item);
                        }}
                        activeOpacity={0.7}
                      >
                        <Plus size={16} color={Colors.text} />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.sectionCardQtyBadge}>
                        <Text style={styles.sectionCardQtyText}>{quantityInCart}</Text>
                      </View>
                    )
                  )}
                </View>
                <View style={styles.sectionCardInfo}>
                  <Text style={styles.sectionCardName} numberOfLines={2}>{item.name}</Text>
                  {isPromo ? (
                    <View style={styles.sectionCardPriceRow}>
                      <Text style={styles.sectionCardPriceSale}>{formatPrice(item.salePrice!)}</Text>
                      <Text style={styles.sectionCardPriceStrike}>{formatPrice(item.price)}</Text>
                    </View>
                  ) : (
                    <Text style={styles.sectionCardPrice}>{formatPrice(item.price)}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderCategorySection = (category: Category) => {
    const items = groupedItems[category.id] || [];
    if (items.length === 0) return null;
    const hPad = layout.horizontalPadding;
    const catCols = layout.isTablet ? 2 : 1;
    const colGap = layout.cardGap;

    return (
      <View key={category.id} style={styles.categorySection}>
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

  const hasSmartSections =
    storefrontSections.promotions.length > 0 ||
    storefrontSections.popular.length > 0 ||
    storefrontSections.newItems.length > 0 ||
    storefrontSections.featured.length > 0;

  return (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.bannerContainer}>
        <Image source={{ uri: vendor.bannerImage }} style={styles.bannerImage} />
      </View>

      <View style={[styles.vendorInfo, { paddingHorizontal: layout.horizontalPadding }]}>
        <View style={styles.vendorIdentityRow}>
          <TouchableOpacity onPress={onVendorNamePress} activeOpacity={0.8} style={styles.vendorLogoContainer}>
            {vendor.logoImage ? (
              <Image source={{ uri: vendor.logoImage }} style={styles.vendorLogo} />
            ) : (
              <View style={styles.vendorLogoFallback}>
                <Text style={styles.vendorLogoFallbackText}>{vendor.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.vendorIdentityText}>
            <TouchableOpacity onPress={onVendorNamePress} activeOpacity={0.7}>
              <Text style={styles.vendorName}>{vendor.name}</Text>
            </TouchableOpacity>
            {!isStoreOpen && (
              <View style={styles.availabilityRow}>
                <View style={styles.availabilityDot} />
                <Text style={styles.availabilityText}>
                  {vendor.businessHours
                    ? (() => {
                        const now = new Date();
                        const currentHour = now.getHours();
                        const match = vendor.businessHours!.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
                        if (match) {
                          const openTime = match[1];
                          const openHourMatch = openTime.match(/(\d{1,2})/);
                          const isPM = /PM/i.test(openTime);
                          const openHour = openHourMatch ? parseInt(openHourMatch[1]) + (isPM && parseInt(openHourMatch[1]) !== 12 ? 12 : 0) : 0;
                          if (currentHour >= openHour) {
                            return `Opens tomorrow at ${openTime}`;
                          }
                          return `Opens at ${openTime}`;
                        }
                        return 'Currently closed';
                      })()
                    : 'Currently closed'}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.metadataRow}>
          <Text style={styles.metadataText}>{vendor.category} · ⭐ {vendor.rating} ({vendor.reviewCount})</Text>
        </View>
        <Text style={styles.metadataText}>{vendor.area}</Text>

        {vendor.description && vendor.description.trim().length > 0 && (
          <View style={styles.descriptionBlock}>
            <Text
              style={styles.descriptionText}
              numberOfLines={descriptionExpanded ? undefined : 3}
            >
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



        {vendor.policy && vendor.policy.trim().length > 0 && (
          <TouchableOpacity onPress={onViewPolicy} style={styles.policyButton}>
            <Text style={styles.policyText}>Vendor Business Policy</Text>
          </TouchableOpacity>
        )}

        <View style={styles.ctaSection}>
          {vendor.vendorStatus === 'ACTIVE' && (
            <>
              {canAccessAI && (
                <TouchableOpacity onPress={onAskAI} style={styles.primaryCTA} activeOpacity={0.85}>
                  <Sparkles size={20} color='#FFFFFF' />
                  <Text style={styles.primaryCTAText}>Ask the platform AI</Text>
                </TouchableOpacity>
              )}
              {canChat && chatMode === 'enabled' && (
                <TouchableOpacity onPress={onMessageVendor} style={styles.secondaryCTA} activeOpacity={0.75}>
                  <MessageCircle size={20} color={Colors.text} />
                  <Text style={styles.secondaryCTAText}>Message vendor</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>

      <PromotionCarousel promotions={getActivePromotions(vendor.id)} />

      {isVendorBlocked && (
        <View style={styles.blockedBanner}>
          <AlertCircle size={14} color={Colors.textSecondary} />
          <Text style={styles.blockedBannerText}>You cannot initiate communication with this vendor.</Text>
        </View>
      )}



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
                    {(!isStoreOpen || !canAddToCart) ? (
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
                    <Text style={styles.orderAgainItemPrice}>{formatPrice(item.price)}</Text>
                    <Text style={styles.orderAgainCount}>Ordered {orderCount} time{orderCount !== 1 ? 's' : ''}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {hasSmartSections && !searchQuery.trim() && selectedCategory === 'all' && (
        <View style={styles.smartSections}>
          {renderHorizontalSection('Promotions', '🎁', storefrontSections.promotions, '#7C3AED', '#F5F3FF')}
          {renderHorizontalSection('Popular Items', '🔥', storefrontSections.popular, '#B45309', '#FEF3C7')}
          {renderHorizontalSection('New Items', '🆕', storefrontSections.newItems, '#1D4ED8', '#EFF6FF')}
          {renderHorizontalSection('Featured Items', '⭐', storefrontSections.featured, '#92400E', '#FFFBEB')}
        </View>
      )}

      <View style={styles.fullMenuHeader}>
        <Text style={styles.fullMenuTitle}>Full Menu</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryPills}
        contentContainerStyle={styles.categoryPillsContent}
      >
        <Pressable
          onPress={() => onCategorySelect('all')}
          style={[styles.categoryPill, selectedCategory === 'all' && styles.categoryPillActive]}
        >
          <Text style={[styles.categoryPillText, selectedCategory === 'all' && styles.categoryPillTextActive]}>
            All
          </Text>
        </Pressable>
        {categories.map((category) => (
          <Pressable
            key={category.id}
            onPress={() => onCategorySelect(category.id)}
            style={[styles.categoryPill, selectedCategory === category.id && styles.categoryPillActive]}
          >
            <Text style={[styles.categoryPillText, selectedCategory === category.id && styles.categoryPillTextActive]}>
              {getCustomerCategoryName(category.name)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.menuSections}>
        {searchQuery.trim() ? (
          <View style={[styles.searchResults, { paddingHorizontal: layout.horizontalPadding }]}>
            <Text style={styles.searchResultsTitle}>
              Search Results ({filteredItems.length})
            </Text>
            {layout.isTablet ? (
              <View style={[styles.menuGrid, { gap: layout.cardGap }]}>
                {filteredItems.map((item) => (
                  <View
                    key={item.id}
                    style={{ width: layout.cardContainerWidth(2, layout.cardGap, 0) }}
                  >
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
          categories.map((category) => renderCategorySection(category))
        )}
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  bannerContainer: {
    position: 'relative' as const,
  },
  bannerImage: {
    width: '100%' as const,
    height: 200,
    backgroundColor: Colors.border,
  },
  vendorInfo: {
    paddingTop: 14,
    paddingBottom: 16,
  },
  vendorIdentityRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    marginBottom: 8,
    marginTop: -36,
  },
  vendorLogoContainer: {
    marginRight: 12,
  },
  vendorLogo: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: Colors.surface,
    borderWidth: 3,
    borderColor: Colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  vendorLogoFallback: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: Colors.surface,
    borderWidth: 3,
    borderColor: Colors.background,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  vendorLogoFallbackText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
  },
  vendorIdentityText: {
    flex: 1,
    paddingTop: 38,
  },
  vendorName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  availabilityRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 2,
  },
  availabilityDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.primary,
  },
  availabilityText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '400' as const,
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
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fulfillmentBadgeTextShipping: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.text,
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
    borderWidth: 1.5,
    borderColor: Colors.borderDark,
  },
  secondaryCTAText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
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
    borderColor: Colors.border,
  },
  blockedBannerText: {
    fontSize: 13,
    color: Colors.textSecondary,
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
    gap: 12,
  },
  orderAgainCard: {
    width: 140,
    backgroundColor: Colors.background,
    borderRadius: 12,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  orderAgainImageContainer: {
    position: 'relative' as const,
  },
  orderAgainImage: {
    width: 140,
    height: 100,
    backgroundColor: Colors.border,
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
  smartSections: {
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 8,
  },
  horizontalSection: {
    marginBottom: 4,
    paddingTop: 16,
    paddingBottom: 4,
    borderLeftWidth: 3,
    marginLeft: 16,
    paddingLeft: 12,
    marginRight: 0,
  },
  horizontalSectionHeader: {
    paddingRight: 16,
    marginBottom: 10,
  },
  horizontalSectionTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  horizontalSectionEmoji: {
    fontSize: 18,
  },
  horizontalSectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  horizontalSectionCount: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 2,
  },
  horizontalSectionCountText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  horizontalSectionScroll: {
    paddingRight: 16,
    gap: 10,
  },
  sectionCard: {
    width: 130,
    backgroundColor: Colors.background,
    borderRadius: 10,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionCardImageWrap: {
    position: 'relative' as const,
  },
  sectionCardImage: {
    width: 130,
    height: 90,
    backgroundColor: Colors.border,
  },
  sectionCardPromoBadge: {
    position: 'absolute' as const,
    top: 6,
    left: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sectionCardPromoBadgeText: {
    fontSize: 8,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.3,
  },
  sectionCardAdd: {
    position: 'absolute' as const,
    bottom: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionCardQtyBadge: {
    position: 'absolute' as const,
    bottom: 6,
    right: 6,
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionCardQtyText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  sectionCardInfo: {
    padding: 8,
  },
  sectionCardName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 3,
    lineHeight: 17,
  },
  sectionCardPrice: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  sectionCardPriceRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  sectionCardPriceStrike: {
    fontSize: 11,
    color: Colors.textMuted,
    textDecorationLine: 'line-through' as const,
  },
  sectionCardPriceSale: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#2B2B2B',
  },
  fullMenuHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  fullMenuTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  categoryPills: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  categoryPillsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  categoryPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  categoryPillActive: {
    backgroundColor: Colors.text,
  },
  categoryPillText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
  },
  menuSections: {
    paddingTop: 8,
  },
  categorySection: {
    marginBottom: 8,
  },
  categorySectionHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
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
  listItem: {
    flexDirection: 'row' as const,
    paddingVertical: 10,
    paddingHorizontal: 0,
    marginBottom: 2,
  },
  listItemDisabled: {
    opacity: 0.6,
  },
  listItemImageContainer: {
    position: 'relative' as const,
  },
  listItemImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: Colors.border,
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
  itemBadgeRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 4,
    marginBottom: 4,
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
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
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  listAddButtonDisabled: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    opacity: 0.45,
  },
  listQuantityControls: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  unavailableText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.error,
  },
  bottomSpacer: {
    height: 120,
  },
});
