import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  Pressable,
  Share,
  Dimensions,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import CatalogItemModerationCard, { type ItemModerationState } from '@/components/CatalogItemModerationCard';
import {
  ChevronLeft,
  MoreVertical,
  Package,
  EyeOff,
  Star,
  Share2,
  Pencil,
  MessageSquare,
  Tag,
  ChevronRight,
  Check,
  X,
  Clock,
} from 'lucide-react-native';
import { useCatalog } from '@/contexts/CatalogContext';
import { useVendor } from '@/contexts/VendorContext';
import { Colors } from '@/constants/colors';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';
import { HIGHLIGHT_LABEL_OPTIONS } from '@/utils/itemTagging';
import ForwardToModal, { type ForwardPayload } from '@/components/ForwardToModal';
import { shareItem, checkShareable } from '@/lib/storefront/shareStorefront';
import { Alert } from '@/utils/alert';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ItemDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getItemById, getCategoryById } = useCatalog();
  const { vendor } = useVendor();
  const insets = useSafeAreaInsets();
  const [showMenu, setShowMenu] = useState(false);
  const [showForward, setShowForward] = useState(false);
  // Sharing or forwarding an item customers can't see yet sends them to a dead
  // end, so those actions are disabled until it's actually visible. Starts null
  // (unknown) and only enables on a positive confirmation from the backend —
  // defaulting to enabled would briefly allow sharing an unapproved item.
  const [moderationState, setModerationState] = useState<ItemModerationState | null>(null);
  const canShareWithCustomers = moderationState?.isVisibleToCustomers === true;
  const [photoIndex, setPhotoIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const item = getItemById(id as string);
  const currency = (mockVendor.currency as Currency) || 'NGN';

  if (!item) return null;

  /**
   * A vendor who uploads a new photo on an already-approved item sees a
   * blank gallery until an admin reviews it — the live item.photos is still
   * whatever was approved before (nothing, in the common case of a first
   * photo being added), and the actual new photo only exists in the pending
   * revision. Per the client: this reads as broken, not as "under review" — the
   * vendor should see what they just submitted. Customers are unaffected,
   * since the storefront reads the live approved item directly, never this
   * screen's moderation state.
   */
  const pendingPhotos = moderationState?.pendingRevision?.proposedChanges?.photos;
  const displayPhotos = Array.isArray(pendingPhotos) ? (pendingPhotos as string[]) : item.photos;

  const category = getCategoryById(item.categoryId);
  const isPromo =
    item.salePrice !== undefined &&
    item.salePrice !== null &&
    item.salePrice < item.basePrice;
  const displayPrice = item.salePrice ?? item.basePrice;
  // The backend's ModerationStatus uses 'pending'; this app's older mock type
  // used 'pending_review'. Both are accepted so the dimmed-gallery treatment
  // works against real data as well as any screen still on mock data — checking
  // only the mock spelling meant it never triggered for a real item.
  const isPending =
    item.moderationStatus === 'pending_review' || item.moderationStatus === ('pending' as typeof item.moderationStatus);
  const isHidden = item.isHidden;

  const highlightOpt = item.highlightLabel
    ? HIGHLIGHT_LABEL_OPTIONS.find((o) => o.value === item.highlightLabel)
    : null;

  const handleShare = async () => {
    setShowMenu(false);
    // This used to share a plain sentence with no link at all — the same
    // dead-end bug the storefront share had, one level down at the item.
    // shareItem builds the real deep link to this specific item.
    const vendorCheck = checkShareable(vendor);
    if (!vendorCheck.canShare) {
      Alert.alert('Cannot share yet', vendorCheck.message ?? 'Your storefront is not ready to share.');
      return;
    }
    if (!canShareWithCustomers) {
      Alert.alert('Cannot share yet', 'This item is still awaiting approval and is not visible to customers yet.');
      return;
    }
    try {
      await shareItem(vendor, { id: item.id, name: item.name, price: displayPrice, currency });
    } catch (_) {}
  };

  const inventoryLabel = (() => {
    if (!item.trackInventory) {
      if (item.isOutOfStock) return { text: 'Unavailable', color: Colors.error };
      return null;
    }
    const qty = item.inventoryQuantity ?? 0;
    const threshold = item.lowStockThreshold ?? 5;
    if (qty === 0) return { text: 'Unavailable', color: Colors.error };
    if (qty <= threshold)
      return { text: `Only ${qty} left`, color: '#D97706' };
    return { text: `${qty} in stock`, color: Colors.success };
  })();

  const forwardPayload: ForwardPayload = {
    type: 'catalog_item',
    itemId: item.id,
    name: item.name,
    price: displayPrice,
    currency,
    image: item.photos[0],
    stockLabel: inventoryLabel?.text,
  };

  const handleForward = () => {
    setShowMenu(false);
    setTimeout(() => setShowForward(true), 150);
  };

  const handleEdit = () => {
    setShowMenu(false);
    router.push(`/vendor/catalog/item/${id}/edit` as any);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft size={22} color={Colors.text} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Item Details
          </Text>
          <TouchableOpacity
            onPress={() => setShowMenu(true)}
            style={styles.headerBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MoreVertical size={22} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Photo Gallery */}
        {displayPhotos.length > 0 ? (
          <View style={[
            styles.galleryContainer,
            (isPending || isHidden) && styles.galleryContainerMuted,
          ]}>
            <FlatList
              ref={flatListRef}
              data={displayPhotos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => i.toString()}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(
                  e.nativeEvent.contentOffset.x / SCREEN_WIDTH
                );
                setPhotoIndex(idx);
              }}
              renderItem={({ item: uri }) => (
                <View style={styles.gallerySlide}>
                  <Image
                    source={{ uri }}
                    style={[
                      styles.galleryImage,
                      isHidden && styles.galleryImageHidden,
                      isPending && !isHidden && styles.galleryImagePending,
                    ]}
                    resizeMode="cover"
                  />
                </View>
              )}
            />
            {displayPhotos.length > 1 && (
              <View style={styles.paginationDots}>
                {displayPhotos.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      i === photoIndex && styles.dotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          // Short placeholder rather than a full-height empty block. An item with
          // no photo shouldn't spend a whole screen of space saying so, and it
          // pushed the actual product details below the fold.
          <View style={[
            styles.photoPlaceholder,
            (isPending || isHidden) && styles.photoPlaceholderMuted,
          ]}>
            <Package size={26} color={Colors.textMuted} strokeWidth={1.5} />
            <Text style={styles.photoPlaceholderText}>No image added</Text>
          </View>
        )}

        {/* Vendor-only "hidden" notice. Moderation state is handled separately
            below by CatalogItemModerationCard, which reads the real backend
            status — the two were previously conflated in one banner driven by a
            mock status value that never matched what the backend returns. */}
        {isHidden && (
          <View style={[styles.stateBanner, styles.stateBannerHidden]}>
            <EyeOff size={13} color={Colors.textSecondary} strokeWidth={2} />
            <Text style={styles.stateBannerTextHidden}>Hidden from your storefront</Text>
          </View>
        )}

        <View style={styles.body}>
          <CatalogItemModerationCard
            itemId={String(id)}
            onEdit={() => router.push(`/vendor/catalog/item/${id}/edit` as never)}
            onStateLoaded={setModerationState}
          />
          {/* Name + Price */}
          <View style={styles.nameSection}>
            <View style={styles.nameRow}>
              <Text style={[
                styles.itemName,
                isHidden && styles.itemNameHidden,
                isPending && !isHidden && styles.itemNamePending,
              ]}>{item.name}</Text>
              {highlightOpt && (
                <View style={styles.highlightPill}>
                  <Text style={styles.highlightPillText}>
                    {highlightOpt.emoji} {highlightOpt.label}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.priceRow}>
              {isPromo ? (
                <>
                  <Text style={[
                    styles.priceSale,
                    (isHidden || isPending) && styles.priceMuted,
                  ]}>
                    {formatPriceWithCommas(displayPrice, currency)}
                  </Text>
                  <Text style={styles.priceOriginal}>
                    {formatPriceWithCommas(item.basePrice, currency)}
                  </Text>
                </>
              ) : (
                <Text style={[
                  styles.price,
                  isHidden && styles.priceMuted,
                  isPending && !isHidden && styles.pricePending,
                ]}>
                  {formatPriceWithCommas(displayPrice, currency)}
                </Text>
              )}
            </View>

            {/* Status chips */}
            <View style={styles.chipsRow}>
              {item.isHidden && (
                <View style={[styles.chip, styles.chipNeutral]}>
                  <EyeOff size={12} color={Colors.textSecondary} strokeWidth={2} />
                  <Text style={[styles.chipText, styles.chipTextNeutral]}>Hidden</Text>
                </View>
              )}
              {!item.isAvailable && (
                <View style={[styles.chip, styles.chipNeutral]}>
                  <Text style={[styles.chipText, styles.chipTextNeutral]}>Unavailable</Text>
                </View>
              )}
              {item.isFeatured && (
                <View style={[styles.chip, styles.chipFeatured]}>
                  <Star size={11} color={Colors.primary} fill={Colors.primary} />
                  <Text style={[styles.chipText, styles.chipTextFeatured]}>Featured</Text>
                </View>
              )}
              {inventoryLabel && (
                <View style={[styles.chip, { backgroundColor: `${inventoryLabel.color}14`, borderColor: `${inventoryLabel.color}30` }]}>
                  <Text style={[styles.chipText, { color: inventoryLabel.color }]}>
                    {inventoryLabel.text}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Info rows */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Category</Text>
              <Text style={styles.infoValue}>
                {category?.name || 'Uncategorized'}
              </Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Base price</Text>
              <Text style={styles.infoValue}>
                {formatPriceWithCommas(item.basePrice, currency)}
              </Text>
            </View>
            {isPromo && (
              <>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Sale price</Text>
                  <Text style={[styles.infoValue, { color: Colors.primary }]}>
                    {formatPriceWithCommas(item.salePrice!, currency)}
                  </Text>
                </View>
              </>
            )}
            {item.trackInventory && item.inventoryQuantity !== undefined && (
              <>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Inventory</Text>
                  <Text style={styles.infoValue}>
                    {item.inventoryQuantity} in stock
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Description */}
          {item.description && item.description.trim().length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>Description</Text>
              <Text style={styles.descriptionText}>{item.description}</Text>
            </View>
          )}

          {/* Add-ons summary */}
          {item.addOnGroups.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>Add-ons</Text>
              <View style={styles.infoCard}>
                {item.addOnGroups.map((group, gi) => (
                  <View key={group.id}>
                    {gi > 0 && <View style={styles.infoDivider} />}
                    <View style={styles.addOnGroupRow}>
                      <View style={styles.addOnGroupLeft}>
                        <Text style={styles.addOnGroupName}>{group.heading}</Text>
                        <Text style={styles.addOnGroupMeta}>
                          {group.options.length} option{group.options.length !== 1 ? 's' : ''}
                          {' · '}
                          {group.selectionType === 'radio' ? 'Single choice' : 'Multiple choice'}
                          {group.isRequired ? ' · Required' : ''}
                        </Text>
                      </View>
                      <ChevronRight size={16} color={Colors.textMuted} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}


        </View>
      </ScrollView>

      {/* Forward To Modal */}
      <ForwardToModal
        visible={showForward}
        payload={forwardPayload}
        onClose={() => setShowForward(false)}
      />

      {/* Action Menu */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={styles.menuSheet}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.menuHandle} />

              <TouchableOpacity
                style={[styles.menuItem, !canShareWithCustomers && styles.menuItemDisabled]}
                onPress={handleForward}
                disabled={!canShareWithCustomers}
                activeOpacity={0.7}
                testID="item-menu-forward"
              >
                <View style={[styles.menuIcon, { backgroundColor: '#EFF6FF' }]}>
                  <MessageSquare size={18} color="#3B82F6" strokeWidth={2} />
                </View>
                <Text style={styles.menuItemTitle}>Forward</Text>
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={[styles.menuItem, !canShareWithCustomers && styles.menuItemDisabled]}
                onPress={handleShare}
                disabled={!canShareWithCustomers}
                activeOpacity={0.7}
                testID="item-menu-share"
              >
                <View style={[styles.menuIcon, { backgroundColor: Colors.primarySoft }]}>
                  <Share2 size={18} color={Colors.primary} strokeWidth={2} />
                </View>
                <Text style={styles.menuItemTitle}>Share</Text>
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleEdit}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIcon, { backgroundColor: Colors.surface }]}>
                  <Pencil size={18} color={Colors.text} strokeWidth={2} />
                </View>
                <Text style={styles.menuItemTitle}>Edit</Text>
              </TouchableOpacity>

              <View style={{ height: insets.bottom > 0 ? insets.bottom + 4 : 16 }} />
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safeTop: {
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: -0.2,
    marginHorizontal: 8,
  },
  scroll: {
    flex: 1,
    backgroundColor: Colors.backgroundCanvas,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  galleryContainer: {
    backgroundColor: Colors.background,
  },
  gallerySlide: {
    width: SCREEN_WIDTH,
    height: 280,
    backgroundColor: Colors.surface,
  },
  galleryImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  galleryImageHidden: {
    opacity: 0.35,
  },
  galleryImagePending: {
    opacity: 0.65,
  },
  galleryContainerMuted: {
    backgroundColor: '#F5F5F5',
  },
  photoPlaceholderMuted: {
    backgroundColor: '#FFFCF5',
  },
  stateBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stateBannerPending: {
    backgroundColor: '#FFFBEB',
    borderBottomColor: '#FDE68A',
  },
  stateBannerHidden: {
    backgroundColor: Colors.surface,
    borderBottomColor: Colors.border,
  },
  stateBannerTextPending: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#92400E',
    flex: 1,
  },
  stateBannerTextHidden: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    flex: 1,
  },
  itemNameHidden: {
    color: Colors.textMuted,
  },
  itemNamePending: {
    color: Colors.textSecondary,
  },
  priceMuted: {
    color: Colors.textMuted,
  },
  pricePending: {
    color: Colors.textSecondary,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.borderDark,
  },
  dotActive: {
    width: 18,
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  photoPlaceholder: {
    // 240 was the same height as a real image, so a missing photo consumed a
    // full screen of space and pushed the product details out of view.
    height: 96,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  photoPlaceholderText: {
    fontSize: 13.5,
    color: Colors.textMuted,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  nameSection: {
    gap: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flexWrap: 'wrap',
  },
  itemName: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  highlightPill: {
    backgroundColor: Colors.primaryTint,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,122,40,0.2)',
    marginTop: 2,
  },
  highlightPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  priceSale: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: -0.3,
  },
  priceOriginal: {
    fontSize: 16,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  chipNeutral: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  chipTextNeutral: {
    color: Colors.textSecondary,
  },
  chipFeatured: {
    backgroundColor: Colors.primaryTint,
    borderColor: 'rgba(255,122,40,0.2)',
  },
  chipTextFeatured: {
    color: Colors.primary,
  },
  chipPending: {
    backgroundColor: Colors.warningLight,
    borderColor: Colors.warningBorder,
  },
  chipTextPending: {
    color: '#D97706',
  },
  infoCard: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    maxWidth: '55%',
    textAlign: 'right',
  },
  infoDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  descriptionText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  addOnGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  addOnGroupLeft: {
    flex: 1,
    gap: 2,
  },
  addOnGroupName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  addOnGroupMeta: {
    fontSize: 12,
    color: Colors.textMuted,
  },

  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 20,
  },
  menuHandle: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.borderDark,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    gap: 12,
  },
  // Dimmed rather than hidden: a vendor should still see that sharing exists
  // and will be available once the item is approved, instead of wondering
  // where the option went.
  menuItemDisabled: {
    opacity: 0.4,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginHorizontal: 18,
  },
});
