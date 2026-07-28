import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Dimensions,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Eye, Zap } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useVendorMenu } from '@/data/hooks';
import { useResponsive } from '@/constants/layout';
import { formatPrice } from '@/utils/formatPrice';
import { getActivePromotions, getPromotionItemIds, getPromotionBadgeForItem } from '@/mocks/promotionsData';
import PromotionCarousel from '@/features/storefront/components/PromotionCarousel';
import type { Vendor, Category, MenuItem } from '@/mocks/vendorData';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DESCRIPTION_THRESHOLD = 100;

interface StorefrontPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  vendor: Vendor;
  logoImage: string | null;
  bannerImage: string | null;
  description: string;
}

export default function StorefrontPreviewModal({
  visible,
  onClose,
  vendor,
  logoImage,
  bannerImage,
  description,
}: StorefrontPreviewModalProps) {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [descriptionExpanded, setDescriptionExpanded] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const layout = useResponsive();

  const { data: menuData } = useVendorMenu(vendor.id);
  const menuItems = useMemo(() => menuData?.items ?? [], [menuData]);
  const categories = useMemo(() => menuData?.categories ?? [], [menuData]);

  const promoItemIds = useMemo(() => getPromotionItemIds(vendor.id), [vendor.id]);
  const activePromotions = useMemo(() => getActivePromotions(vendor.id), [vendor.id]);

  const isStoreOpen = !vendor.storeStatus || vendor.storeStatus === 'open';

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

  useEffect(() => {
    if (visible) {
      setDescriptionExpanded(false);
      setSelectedCategory('all');
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleClose = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  }, [slideAnim, onClose]);

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
                  <Text style={styles.hasAddOnsText}>• Customizable</Text>
                )}
              </View>
            </View>
            <View style={styles.listItemActions}>
              {!item.inStock ? (
                <View style={styles.unavailableBadge}>
                  <Text style={styles.unavailableText}>Out of stock</Text>
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
            {getCustomerCategoryName(category.name).toUpperCase()} ({items.length})
          </Text>
        </View>
        <View style={[styles.categoryListContainer, { paddingHorizontal: layout.horizontalPadding }]}>
          {items.map((item) => renderListItem(item))}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.modalRoot, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.container}>
          <SafeAreaView edges={['top']} style={styles.topBarSafe}>
            <View style={styles.topBar}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleClose}
                activeOpacity={0.7}
                testID="preview-back-btn"
              >
                <ChevronLeft size={20} color={Colors.text} />
                <Text style={styles.backText}>Back to editing</Text>
              </TouchableOpacity>

              <View style={styles.topBarCenter}>
                <Eye size={13} color={Colors.textSecondary} />
                <Text style={styles.topBarTitle}>Preview Mode</Text>
              </View>

              <View style={styles.topBarRight} />
            </View>
          </SafeAreaView>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
          >
            {bannerImage ? (
              <Image source={{ uri: bannerImage }} style={styles.bannerImage} />
            ) : (
              <View style={styles.bannerPlaceholder}>
                <Text style={styles.bannerPlaceholderText}>No banner uploaded</Text>
              </View>
            )}

            <View style={[styles.vendorInfo, { paddingHorizontal: layout.horizontalPadding }]}>
              {logoImage && (
                <View style={styles.logoContainer}>
                  <Image source={{ uri: logoImage }} style={styles.logoImage} />
                </View>
              )}

              <Text style={styles.vendorName}>{vendor.name}</Text>

              <View style={styles.metadataRow}>
                <Text style={styles.metadataText}>
                  {vendor.category} · ⭐ {vendor.rating} ({vendor.reviewCount})
                </Text>
              </View>
              <Text style={styles.metadataText}>{vendor.area}</Text>

              {description && description.trim().length > 0 && (
                <View style={styles.descriptionBlock}>
                  <Text
                    style={styles.descriptionText}
                    numberOfLines={descriptionExpanded ? undefined : 3}
                  >
                    {description.trim()}
                  </Text>
                  {description.trim().length > DESCRIPTION_THRESHOLD && (
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

              {!isStoreOpen && (
                <View style={styles.closedBadge}>
                  <Text style={styles.closedBadgeText}>
                    {vendor.storeStatus === 'away'
                      ? 'AWAY'
                      : vendor.storeStatus === 'sleep_mode'
                      ? 'SLEEP MODE'
                      : 'OUTSIDE BUSINESS HOURS'}
                  </Text>
                </View>
              )}

              {vendor.policy && vendor.policy.trim().length > 0 && (
                <View style={styles.policyRow}>
                  <Text style={styles.policyText}>{vendor.name}'s Business Policy</Text>
                </View>
              )}

              <View style={styles.ctaPlaceholders}>
                <View style={styles.ctaButtonDisabled}>
                  <Text style={styles.ctaButtonDisabledText}>Ask the platform AI</Text>
                </View>
                <View style={styles.ctaButtonOutlineDisabled}>
                  <Text style={styles.ctaButtonOutlineDisabledText}>Message vendor</Text>
                </View>
              </View>
            </View>

            <PromotionCarousel promotions={activePromotions} />

            {!isStoreOpen && (
              <View style={styles.storeClosedBanner}>
                <Text style={styles.storeClosedBannerText}>Store closed · Orders unavailable</Text>
              </View>
            )}

            <View style={styles.footerDisclaimer}>
              <Text style={styles.footerDisclaimerText}>
                Orders and payments are handled directly by {vendor.name}.
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryPills}
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

          <SafeAreaView edges={['bottom']} style={styles.previewBannerSafe}>
            <View style={styles.previewBanner}>
              <Eye size={13} color="#FFFFFF" />
              <Text style={styles.previewBannerText}>Preview mode: customers see your live storefront</Text>
            </View>
          </SafeAreaView>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBarSafe: {
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
    flex: 1,
  },
  backText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  topBarCenter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    flex: 1,
    justifyContent: 'center' as const,
  },
  topBarTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  topBarRight: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  bannerImage: {
    width: '100%' as const,
    height: 200,
    backgroundColor: Colors.border,
  },
  bannerPlaceholder: {
    width: '100%' as const,
    height: 160,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  bannerPlaceholderText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  vendorInfo: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  logoContainer: {
    marginBottom: 10,
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: Colors.border,
    borderWidth: 2,
    borderColor: Colors.border,
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
  fulfillmentSection: {
    marginTop: 8,
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
  closedBadge: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(43,43,43,0.85)',
    borderRadius: 6,
    alignSelf: 'flex-start' as const,
  },
  closedBadgeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700' as const,
    letterSpacing: 0.8,
  },
  policyRow: {
    paddingVertical: 6,
  },
  policyText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  ctaPlaceholders: {
    marginTop: 12,
    gap: 10,
  },
  ctaButtonDisabled: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(0,0,0,0.08)',
    paddingVertical: 12,
    borderRadius: 10,
  },
  ctaButtonDisabledText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: 'rgba(0,0,0,0.28)',
  },
  ctaButtonOutlineDisabled: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'transparent',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ctaButtonOutlineDisabledText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.textMuted,
  },
  storeClosedBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,140,66,0.08)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,140,66,0.18)',
  },
  storeClosedBannerText: {
    fontSize: 13,
    color: '#FF8C42',
    fontWeight: '600' as const,
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
  categoryPills: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  categoryPillsContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  categoryPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  categoryPillActive: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryPillText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  categoryPillTextActive: {
    color: Colors.text,
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
  categoryListContainer: {
    paddingBottom: 4,
  },
  listItem: {
    flexDirection: 'row' as const,
    paddingVertical: 8,
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
  itemImageDimmed: {
    opacity: 0.5,
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
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  listAddButtonDisabled: {
    opacity: 0.35,
  },
  addButtonText: {
    fontSize: 18,
    color: Colors.text,
    lineHeight: 22,
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
    color: Colors.white,
  },
  previewBannerSafe: {
    backgroundColor: '#1A1A1A',
  },
  previewBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 7,
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: '#1A1A1A',
  },
  previewBannerText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500' as const,
  },
  bottomSpacer: {
    height: 24,
  },
});
