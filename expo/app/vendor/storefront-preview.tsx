import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Pressable,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Eye, Zap, Store } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useVendor } from '@/contexts/VendorContext';
import { useVendorMenu } from '@/data/hooks';
import { useResponsive } from '@/constants/layout';
import { formatPrice } from '@/utils/formatPrice';
import { getActivePromotions, getPromotionItemIds, getPromotionBadgeForItem } from '@/mocks/promotionsData';
import PromotionCarousel from '@/features/storefront/components/PromotionCarousel';
import { Category, MenuItem } from '@/mocks/vendorData';

const DESCRIPTION_THRESHOLD = 100;

export default function StorefrontPreviewScreen() {
  const router = useRouter();
  const { vendor } = useVendor();
  const { data: menuData } = useVendorMenu(vendor.id);
  const layout = useResponsive();

  const menuItems = useMemo(() => menuData?.items ?? [], [menuData]);
  const categories = useMemo(() => menuData?.categories ?? [], [menuData]);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [descriptionExpanded, setDescriptionExpanded] = useState<boolean>(false);

  const isStoreOpen = !vendor.storeStatus || vendor.storeStatus === 'open';

  const promoItemIds = useMemo(() => getPromotionItemIds(vendor.id), [vendor.id]);
  const activePromotions = useMemo(() => getActivePromotions(vendor.id), [vendor.id]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'all') return menuItems;
    return menuItems.filter((item) => item.categoryId === selectedCategory);
  }, [menuItems, selectedCategory]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, MenuItem[]> = {};
    menuItems.forEach((item) => {
      if (!groups[item.categoryId]) {
        groups[item.categoryId] = [];
      }
      groups[item.categoryId].push(item);
    });
    return groups;
  }, [menuItems]);

  const getCustomerCategoryName = (name: string): string => {
    if (name.toLowerCase() === 'uncategorized') return 'Other';
    return name;
  };

  const isPromoItem = (item: MenuItem): boolean => {
    return item.salePrice !== undefined && item.salePrice !== null && item.salePrice < item.price;
  };

  const isPromotionTarget = (itemId: string): boolean => promoItemIds.includes(itemId);
  const getItemBadgeLabel = (itemId: string): string => getPromotionBadgeForItem(vendor.id, itemId) ?? 'OFFER';

  const renderListItem = (item: MenuItem) => {
    const hasModifiers = item.addOns && item.addOns.length > 0;
    const isPromo = isPromoItem(item);

    return (
      <View
        key={item.id}
        style={[styles.listItem, !item.inStock && styles.listItemDisabled]}
        testID={`preview-menu-item-${item.id}`}
      >
        <View style={styles.listItemImageContainer}>
          <Image
            source={{ uri: item.image }}
            style={[styles.listItemImage, !item.inStock && styles.itemImageDimmed]}
          />
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
              <Text
                style={[styles.listItemName, !item.inStock && styles.itemNameDisabled]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {item.description && (
                <Text
                  style={[styles.listItemDescription, !item.inStock && styles.itemDescriptionDisabled]}
                  numberOfLines={1}
                >
                  {item.description}
                </Text>
              )}
              <View style={styles.listItemPriceRow}>
                {isPromo ? (
                  <>
                    <Text style={styles.listItemPriceStrikethrough}>
                      {formatPrice(item.price)}
                    </Text>
                    <Text style={styles.listItemPricePromo}>
                      {formatPrice(item.salePrice!)}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.listItemPrice, !item.inStock && styles.itemMetadataDisabled]}>
                    {formatPrice(item.price)}
                  </Text>
                )}
                {hasModifiers && (
                  <Text style={styles.hasAddOnsText}>· Customizable</Text>
                )}
              </View>
            </View>
            <View style={styles.listItemActions}>
              {!item.inStock ? (
                <View style={styles.unavailableBadge}>
                  <Text style={styles.unavailableText}>Unavailable</Text>
                </View>
              ) : (
                <View style={[styles.listAddButton, styles.listAddButtonDisabled]}>
                  <Text style={styles.addButtonText}>+</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderCategorySection = (category: Category) => {
    const items = groupedItems[category.id] || [];
    if (items.length === 0) return null;

    return (
      <View key={category.id} style={styles.categorySection}>
        <View style={[styles.categorySectionHeader, { paddingHorizontal: layout.horizontalPadding }]}>
          <Text style={styles.categorySectionTitle}>
            {getCustomerCategoryName(category.name)} <Text style={styles.categorySectionCount}>({items.length})</Text>
          </Text>
        </View>
        <View style={[styles.categoryListContainer, { paddingHorizontal: layout.horizontalPadding }]}>
          {items.map((item) => renderListItem(item))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Preview Mode Indicator Bar */}
      <SafeAreaView edges={['top']} style={styles.previewBarSafe}>
        <View style={styles.previewIndicatorBar}>
          <View style={styles.previewIndicatorLeft}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
              testID="exit-preview-btn"
            >
              <ArrowLeft size={18} color={Colors.text} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <View style={styles.previewIndicatorCenter}>
            <View style={styles.previewBadge}>
              <Eye size={12} color={Colors.primary} strokeWidth={2} />
              <Text style={styles.previewBadgeText}>Preview</Text>
            </View>
          </View>

          <View style={styles.previewIndicatorRight} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        {vendor.bannerImage ? (
          <Image source={{ uri: vendor.bannerImage }} style={styles.bannerImage} />
        ) : (
          <View style={styles.bannerPlaceholder}>
            <Store size={24} color={Colors.textMuted} strokeWidth={1.5} />
            <Text style={styles.bannerPlaceholderText}>No banner · tap above to add one</Text>
          </View>
        )}

        {/* Vendor Info */}
        <View style={[styles.vendorInfo, { paddingHorizontal: layout.horizontalPadding }]}>
          {vendor.logoImage ? (
            <View style={styles.logoContainer}>
              <Image source={{ uri: vendor.logoImage }} style={styles.logoImage} />
            </View>
          ) : (
            <View style={[styles.logoContainer, styles.logoPlaceholder]}>
              <Text style={styles.logoPlaceholderText}>
                {vendor.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <Text style={styles.vendorName}>{vendor.name}</Text>

          <View style={styles.metadataRow}>
            <Text style={styles.metadataText}>
              {vendor.category}
            </Text>
            <Text style={styles.metadataDot}>·</Text>
            <Text style={styles.metadataStar}>⭐</Text>
            <Text style={styles.metadataText}>
              {vendor.rating} ({vendor.reviewCount})
            </Text>
          </View>
          {vendor.area ? (
            <Text style={[styles.metadataText, { marginTop: 2 }]}>{vendor.area}</Text>
          ) : null}

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
                  <Text style={styles.descriptionToggle}>
                    {descriptionExpanded ? 'See less' : 'See more'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Fulfillment badges */}
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
                <View style={styles.fulfillmentBadge}>
                  <Text style={styles.fulfillmentBadgeText}>Ships Nationwide</Text>
                </View>
              )}
              {vendor.shipping && vendor.shippingScope === 'international' && (
                <View style={styles.fulfillmentBadge}>
                  <Text style={styles.fulfillmentBadgeText}>Ships Worldwide</Text>
                </View>
              )}
            </View>
          </View>

          {/* Store status */}
          {!isStoreOpen && (
            <View style={styles.closedBadge}>
              <Text style={styles.closedBadgeText}>
                {vendor.storeStatus === 'away'
                  ? '· Away'
                  : vendor.storeStatus === 'sleep_mode'
                  ? '· Sleep Mode'
                  : '· Outside Business Hours'}
              </Text>
            </View>
          )}

          {vendor.policy && vendor.policy.trim().length > 0 && (
            <TouchableOpacity style={styles.policyRow} activeOpacity={0.7}>
              <Text style={styles.policyText}>{vendor.name}'s Business Policy</Text>
            </TouchableOpacity>
          )}

          {/* Disabled CTAs */}
          <View style={styles.ctaRow}>
            <View style={[styles.ctaButton, styles.ctaButtonPrimary]}>
              <Text style={styles.ctaButtonPrimaryText}>Ask the platform AI</Text>
            </View>
            <View style={[styles.ctaButton, styles.ctaButtonOutline]}>
              <Text style={styles.ctaButtonOutlineText}>Message</Text>
            </View>
          </View>
        </View>

        {/* Promotions */}
        <PromotionCarousel promotions={activePromotions} />

        {/* Store closed banner */}
        {!isStoreOpen && (
          <View style={styles.storeClosedBanner}>
            <Text style={styles.storeClosedBannerText}>Store closed · Orders unavailable</Text>
          </View>
        )}

        {/* Category filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryPillsScroll}
          contentContainerStyle={styles.categoryPillsContent}
        >
          <Pressable
            onPress={() => setSelectedCategory('all')}
            style={[styles.categoryPill, selectedCategory === 'all' && styles.categoryPillActive]}
          >
            <Text style={[styles.categoryPillText, selectedCategory === 'all' && styles.categoryPillTextActive]}>
              All
            </Text>
          </Pressable>
          {categories.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => setSelectedCategory(category.id)}
              style={[styles.categoryPill, selectedCategory === category.id && styles.categoryPillActive]}
            >
              <Text style={[styles.categoryPillText, selectedCategory === category.id && styles.categoryPillTextActive]}>
                {getCustomerCategoryName(category.name)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Menu */}
        <View style={styles.menuSections}>
          {selectedCategory !== 'all'
            ? filteredItems.map((item) => (
                <View key={item.id} style={{ paddingHorizontal: layout.horizontalPadding }}>
                  {renderListItem(item)}
                </View>
              ))
            : categories.map((category) => renderCategorySection(category))}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Preview disclaimer strip */}
      <SafeAreaView edges={['bottom']} style={styles.disclaimerSafe}>
        <View style={styles.disclaimerStrip}>
          <Text style={styles.disclaimerText}>
            Viewing as customer · Unsaved changes won't appear here
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Preview indicator bar
  previewBarSafe: {
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  previewIndicatorBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  previewIndicatorLeft: {
    flex: 1,
    alignItems: 'flex-start' as const,
  },
  previewIndicatorCenter: {
    flex: 1,
    alignItems: 'center' as const,
  },
  previewIndicatorRight: {
    flex: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  previewBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: Colors.primaryTint,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,122,40,0.15)',
  },
  previewBadgeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },

  content: {
    flex: 1,
  },

  // Banner
  bannerImage: {
    width: '100%' as const,
    height: 210,
    backgroundColor: Colors.surface,
  },
  bannerPlaceholder: {
    width: '100%' as const,
    height: 140,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  bannerPlaceholderText: {
    fontSize: 13,
    color: Colors.textMuted,
  },

  // Vendor info
  vendorInfo: {
    paddingTop: 20,
    paddingBottom: 16,
  },
  logoContainer: {
    marginBottom: 12,
  },
  logoImage: {
    width: 68,
    height: 68,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  logoPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  logoPlaceholderText: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
  },
  vendorName: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  metadataRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    flexWrap: 'wrap' as const,
  },
  metadataText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  metadataDot: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  metadataStar: {
    fontSize: 13,
  },
  descriptionBlock: {
    marginTop: 12,
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  descriptionToggle: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500' as const,
    marginTop: 4,
  },
  fulfillmentSection: {
    marginTop: 12,
  },
  fulfillmentBadges: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  fulfillmentBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fulfillmentBadgeText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  closedBadge: {
    marginTop: 10,
    alignSelf: 'flex-start' as const,
  },
  closedBadgeText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  policyRow: {
    marginTop: 10,
    paddingVertical: 2,
  },
  policyText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  ctaRow: {
    flexDirection: 'row' as const,
    gap: 10,
    marginTop: 16,
  },
  ctaButton: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 13,
    borderRadius: 12,
  },
  ctaButtonPrimary: {
    backgroundColor: 'rgba(0,0,0,0.07)',
  },
  ctaButtonPrimaryText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: 'rgba(0,0,0,0.3)',
  },
  ctaButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ctaButtonOutlineText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.textMuted,
  },

  // Store closed
  storeClosedBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFF7ED',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#FDE68A',
  },
  storeClosedBannerText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '600' as const,
  },

  // Category pills
  categoryPillsScroll: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    marginTop: 8,
  },
  categoryPillsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryPillActive: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  categoryPillText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  categoryPillTextActive: {
    color: Colors.white,
    fontWeight: '600' as const,
  },

  // Menu
  menuSections: {
    paddingTop: 8,
  },
  categorySection: {
    marginBottom: 4,
  },
  categorySectionHeader: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  categorySectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  categorySectionCount: {
    fontWeight: '400' as const,
    color: Colors.textMuted,
  },
  categoryListContainer: {
    paddingBottom: 4,
  },
  listItem: {
    flexDirection: 'row' as const,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  listItemDisabled: {
    opacity: 0.55,
  },
  listItemImageContainer: {
    position: 'relative' as const,
  },
  listItemImage: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  itemImageDimmed: {
    opacity: 0.45,
  },
  promoBadge: {
    position: 'absolute' as const,
    bottom: 4,
    left: 4,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.primary,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
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
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  offerBadgeText: {
    fontSize: 7,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  listItemContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center' as const,
  },
  listItemHeader: {
    flex: 1,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
  },
  listItemTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  listItemName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 3,
  },
  itemNameDisabled: {
    color: Colors.textMuted,
  },
  listItemDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 5,
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
    color: Colors.text,
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
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  listAddButtonDisabled: {
    opacity: 0.3,
  },
  addButtonText: {
    fontSize: 20,
    color: Colors.text,
    lineHeight: 24,
  },
  unavailableBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unavailableText: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textMuted,
  },

  // Disclaimer strip
  disclaimerSafe: {
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  disclaimerStrip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  disclaimerText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },

  bottomSpacer: {
    height: 32,
  },
});
