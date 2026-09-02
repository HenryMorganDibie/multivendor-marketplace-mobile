import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Image,
  TouchableOpacity,
  ActionSheetIOS,
  Platform,
  Share as RNShare,
  Modal,
  TextInput,
} from 'react-native';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Heart, MoreVertical, Search, Plus, ShoppingCart, X, Minus, MapPin, Clock, ExternalLink, Sparkles, MessageCircle, ShoppingBag } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCart } from '@/contexts/CartContext';
import { useChats } from '@/contexts/ChatContext';
import { mockVendor, mockCategories, mockMenuItems, MenuItem, Category } from '@/mocks/vendorData';
import { useVendorChatMode } from '@/contexts/VendorChatModeContext';
import { mockOrders } from '@/mocks/ordersData';
import { formatPrice } from '@/utils/formatPrice';
import { getMenuItemDisplayPrice, hasItemSalePrice } from '@/utils/itemPricing';

const ITEM_CARD_WIDTH = 160;
const ITEM_CARD_HEIGHT = 140 + 60; // image height + details

export default function VendorStorefrontScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getOrCreatePreOrderChat } = useChats();

  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [, setShowSearch] = useState(false);
  const [showVendorDetails, setShowVendorDetails] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const { items: cartItems, addItem, removeItem, totalItems, setActiveVendor, globalItemCount } = useCart();

  const vendor = mockVendor;
  const { isChatDisabled } = useVendorChatMode();

  React.useEffect(() => {
    setActiveVendor(vendor.id, vendor.name);
  }, [setActiveVendor, vendor.id, vendor.name]);

  const filteredCategories = useMemo(() => {
    if (searchQuery.trim() === '') return mockCategories;
    return mockCategories.filter(cat =>
      cat.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const filteredItems = useMemo(() => {
    let items = mockMenuItems;
    if (selectedCategory !== 'all') {
      items = items.filter(item => item.categoryId === selectedCategory);
    }
    if (searchQuery.trim() !== '') {
      items = items.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return items;
  }, [selectedCategory, searchQuery]);

  /**
   * O(1) cart quantity lookup — replaces O(n) .find() per item per render.
   * Rebuilds only when cartItems changes.
   */
  const cartQuantityMap = useMemo(
    () => new Map(cartItems.map(i => [i.id, i.quantity])),
    [cartItems],
  );

  const handleMoreOptions = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Share Store', 'Report Vendor'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
        },
        buttonIndex => {
          if (buttonIndex === 1) {
            const shareUrl = `https://theplatform.com/@${vendor.username}`;
            RNShare.share({
              message: `Check out ${vendor.name} (@${vendor.username}) on the platform! ${shareUrl}`,
              url: shareUrl,
            });
          } else if (buttonIndex === 2) {
            router.push('/report-vendor');
          }
        }
      );
    }
  }, [vendor, router]);

  const handleBackPress = useCallback(() => {
    router.back();
  }, [router]);

  const handleContactVendor = useCallback(() => {
    if (isChatDisabled) return;

    const existingOrder = mockOrders.find(
      order =>
        order.vendorId === vendor.id &&
        (order.status === 'pending' || order.status === 'accepted')
    );

    if (existingOrder) {
      router.push(`/chat/order/${existingOrder.id}` as any);
    } else {
      getOrCreatePreOrderChat(vendor.id, vendor.name, '');
      router.push(`/chat/pre-order/${vendor.id}` as any);
    }
  }, [isChatDisabled, vendor, router, getOrCreatePreOrderChat]);

  const handleAddItem = useCallback((item: MenuItem) => {
    const displayPrice = getMenuItemDisplayPrice(item);
    const isOnSale = hasItemSalePrice(item, undefined);
    addItem({
      id: item.id,
      name: item.name,
      price: displayPrice,
      originalPrice: isOnSale ? item.price : undefined,
      image: item.image,
    }, vendor.id, vendor.name);
  }, [addItem, vendor.id, vendor.name]);

  const handleRemoveItem = useCallback((itemId: string) => {
    removeItem(itemId);
  }, [removeItem]);

  const renderCategoryChip = useCallback((cat: Category) => {
    const isActive = selectedCategory === cat.id;
    return (
      <TouchableOpacity
        key={cat.id}
        style={[styles.categoryChip, isActive && styles.categoryChipActive]}
        onPress={() => {
          setSelectedCategory(cat.id);
          setShowSearch(false);
          setSearchQuery('');
        }}
        activeOpacity={0.7}
      >
        <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
          {cat.name}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedCategory]);

  const renderItemCard = useCallback(({ item }: { item: MenuItem }) => {
    const quantity = cartQuantityMap.get(item.id) ?? 0;
    const isInCart = quantity > 0;

    return (
      <View style={styles.itemCard}>
        <TouchableOpacity
          style={styles.itemImageContainer}
          onPress={() => router.push(`/item/${item.id}` as any)}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' }}
            style={styles.itemImage}
            resizeMode="cover"
          />
        </TouchableOpacity>

        <View style={styles.itemDetails}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          {hasItemSalePrice(item, undefined) ? (
            <View style={styles.itemPriceRow}>
              <Text style={styles.itemPriceSale}>{formatPrice(getMenuItemDisplayPrice(item))}</Text>
              <Text style={styles.itemPriceOriginal}>{formatPrice(item.price)}</Text>
            </View>
          ) : (
            <Text style={styles.itemPriceSale}>{formatPrice(item.price)}</Text>
          )}
        </View>

        {!isInCart ? (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleAddItem(item)}
            activeOpacity={0.7}
          >
            <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        ) : (
          <View style={styles.quantityControl}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleRemoveItem(item.id)}
              activeOpacity={0.7}
            >
              <Minus size={14} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleAddItem(item)}
              activeOpacity={0.7}
            >
              <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }, [cartQuantityMap, handleAddItem, handleRemoveItem, router]);

  const keyExtractor = useCallback((item: MenuItem) => item.id, []);

  const ListHeaderComponent = useMemo(() => (
    <>
      <View style={styles.vendorInfoSection}>
        <View style={styles.vendorHeader}>
          <View style={styles.vendorTitleRow}>
            <Text style={styles.vendorName}>{vendor.name}</Text>
            <View style={styles.verifiedBadge}>
              <Sparkles size={14} color="#FFFFFF" strokeWidth={2} />
            </View>
          </View>
          <Text style={styles.vendorCategory}>{vendor.category}</Text>
        </View>

        <View style={styles.vendorStats}>
          <Text style={styles.vendorStatsText}>
            ⭐ {vendor.rating.toFixed(1)} ({vendor.reviewCount}+ reviews)
          </Text>
          <Text style={styles.vendorStatsDivider}>•</Text>
          <Text style={styles.vendorStatsText}>{vendor.area}</Text>
        </View>

        <TouchableOpacity
          style={styles.viewDetailsButton}
          onPress={() => setShowVendorDetails(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.viewDetailsText}>View Store Details</Text>
          <ExternalLink size={14} color="#007AFF" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <View style={styles.actionsBar}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleContactVendor}
          activeOpacity={0.7}
        >
          <MessageCircle size={20} color="#FFFFFF" strokeWidth={2} />
          <Text style={styles.actionButtonText}>Contact</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={() => { if (totalItems > 0) router.push('/cart'); }}
          activeOpacity={0.7}
        >
          <ShoppingBag size={20} color="#FFFFFF" strokeWidth={2} />
          <Text style={styles.actionButtonText}>Cart ({totalItems})</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBarContainer}>
        <View style={styles.searchBarWrapper}>
          <Search size={18} color="#8E8E93" strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items"
            placeholderTextColor="#8E8E93"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setShowSearch(true)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => { setSearchQuery(''); setShowSearch(false); }}
              activeOpacity={0.7}
            >
              <X size={18} color="#8E8E93" strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesScroll}
        style={styles.categoriesContainer}
      >
        {filteredCategories.map(renderCategoryChip)}
      </ScrollView>
    </>
  ), [vendor, totalItems, searchQuery, filteredCategories, handleContactVendor, renderCategoryChip, router]);

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: vendor.bannerImage }}
        style={styles.bannerImage}
        resizeMode="cover"
      />

      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.headerButton} onPress={handleBackPress} activeOpacity={0.7}>
            <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2} />
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setIsFavorite(!isFavorite)}
              activeOpacity={0.7}
            >
              <Heart
                size={22}
                color={isFavorite ? '#FF3B30' : '#FFFFFF'}
                fill={isFavorite ? '#FF3B30' : 'transparent'}
                strokeWidth={2}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={handleMoreOptions} activeOpacity={0.7}>
              <MoreVertical size={22} color="#FFFFFF" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* FlatList with numColumns replaces ScrollView+map for virtualized rendering */}
      <FlatList
        data={filteredItems}
        renderItem={renderItemCard}
        keyExtractor={keyExtractor}
        numColumns={2}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={<View style={styles.bottomPadding} />}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.itemsGridContent}
        columnWrapperStyle={styles.itemsRow}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={6}
      />

      {totalItems > 0 && (
        <TouchableOpacity
          style={styles.floatingCartButton}
          onPress={() => router.push('/cart')}
          activeOpacity={0.9}
        >
          <ShoppingCart size={24} color="#FFFFFF" strokeWidth={2} />
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{totalItems}</Text>
          </View>
          <Text style={styles.floatingCartText}>View Cart</Text>
        </TouchableOpacity>
      )}

      <Modal visible={showVendorDetails} animationType="slide" onRequestClose={() => setShowVendorDetails(false)}>
        <View style={styles.modalContainer}>
          <SafeAreaView edges={['top']} style={styles.modalSafeArea}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Store Details</Text>
              <TouchableOpacity onPress={() => setShowVendorDetails(false)} activeOpacity={0.7}>
                <X size={24} color="#FFFFFF" strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.detailSection}>
              <View style={styles.detailRow}>
                <MapPin size={20} color="#8E8E93" strokeWidth={2} />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Location</Text>
                  <Text style={styles.detailValue}>{vendor.area}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Clock size={20} color="#8E8E93" strokeWidth={2} />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Operating Hours</Text>
                  <Text style={styles.detailValue}>Mon-Sat: 9AM - 6PM</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <ShoppingBag size={20} color="#8E8E93" strokeWidth={2} />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Fulfillment</Text>
                  <View style={styles.fulfillmentBadges}>
                    {vendor.pickup && <View style={styles.fulfillmentBadge}><Text style={styles.fulfillmentBadgeText}>Pickup</Text></View>}
                    {vendor.delivery && <View style={styles.fulfillmentBadge}><Text style={styles.fulfillmentBadgeText}>Delivery</Text></View>}
                    {vendor.shipping && <View style={styles.fulfillmentBadge}><Text style={styles.fulfillmentBadgeText}>Shipping</Text></View>}
                  </View>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.viewPoliciesButton}
              onPress={() => {
                setShowVendorDetails(false);
                setShowPolicyModal(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.viewPoliciesButtonText}>View Store Policies</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showPolicyModal}
        animationType="slide"
        onRequestClose={() => setShowPolicyModal(false)}
      >
        <View style={styles.modalContainer}>
          <SafeAreaView edges={['top']} style={styles.modalSafeArea}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Store Policies</Text>
              <TouchableOpacity onPress={() => setShowPolicyModal(false)} activeOpacity={0.7}>
                <X size={24} color="#FFFFFF" strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.policyText}>{vendor.policy || 'No policies available.'}</Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  bannerImage: {
    width: '100%',
    height: 250,
    position: 'absolute' as const,
    top: 0,
  },
  header: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerActions: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  scrollView: {
    flex: 1,
    marginTop: 220,
  },
  itemsGridContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  itemsRow: {
    gap: 12,
    marginBottom: 12,
  },
  vendorInfoSection: {
    backgroundColor: '#000000',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
  },
  vendorHeader: {
    marginBottom: 8,
  },
  vendorTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 4,
  },
  vendorName: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  verifiedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  vendorCategory: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500' as const,
  },
  vendorStats: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  vendorStatsText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  vendorStatsDivider: {
    fontSize: 14,
    color: '#8E8E93',
    marginHorizontal: 8,
  },
  viewDetailsButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 8,
  },
  viewDetailsText: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '600' as const,
  },
  actionsBar: {
    flexDirection: 'row' as const,
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#000000',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#1C1C1E',
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionButtonPrimary: {
    backgroundColor: '#007AFF',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  searchBarContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#000000',
  },
  searchBarWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  categoriesContainer: {
    backgroundColor: '#000000',
  },
  categoriesScroll: {
    paddingHorizontal: 20,
    gap: 8,
    paddingVertical: 12,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  categoryChipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#8E8E93',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  itemCard: {
    width: ITEM_CARD_WIDTH,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    overflow: 'hidden' as const,
  },
  itemImageContainer: {
    width: '100%',
    height: 140,
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemDetails: {
    padding: 12,
    paddingBottom: 8,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  itemPriceRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  itemPriceSale: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  itemPriceOriginal: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: '#8E8E93',
    textDecorationLine: 'line-through' as const,
  },
  addButton: {
    position: 'absolute' as const,
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  quantityControl: {
    position: 'absolute' as const,
    bottom: 8,
    right: 8,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#007AFF',
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 8,
  },
  quantityButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    minWidth: 20,
    textAlign: 'center' as const,
  },
  floatingCartButton: {
    position: 'absolute' as const,
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: '#007AFF',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 12,
  },
  cartBadge: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 6,
  },
  cartBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  floatingCartText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  bottomPadding: {
    height: 100,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalSafeArea: {
    backgroundColor: '#000000',
  },
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1E',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  modalContent: {
    flex: 1,
  },
  detailSection: {
    padding: 20,
    gap: 24,
  },
  detailRow: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500' as const,
  },
  fulfillmentBadges: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 4,
  },
  fulfillmentBadge: {
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fulfillmentBadgeText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500' as const,
  },
  viewPoliciesButton: {
    marginHorizontal: 20,
    marginVertical: 20,
    backgroundColor: '#1C1C1E',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center' as const,
  },
  viewPoliciesButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#007AFF',
  },
  policyText: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 22,
    padding: 20,
  },
});
