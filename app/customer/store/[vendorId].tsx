import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ActionSheetIOS,
  Platform,
  Share as RNShare,
  Pressable,
} from 'react-native';
import LaektivaModal from '@/components/LaektivaModal';
import VendorProfileModal from '@/components/VendorProfileModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Heart, MoreVertical, Search, Plus, ShoppingCart, X, Minus, Sparkles, MessageCircle, ShoppingBag, Bell } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCart } from '@/contexts/CartContext';
import { useChats } from '@/contexts/ChatContext';
import { mockVendor, mockCategories, mockMenuItems, MenuItem, Category } from '@/mocks/vendorData';
import { useVendorChatMode } from '@/contexts/VendorChatModeContext';
import { mockOrders } from '@/mocks/ordersData';
import { formatPrice } from '@/utils/formatPrice';
import { getMenuItemDisplayPrice, hasItemSalePrice } from '@/utils/itemPricing';

const { width } = Dimensions.get('window');
const ITEM_CARD_WIDTH = 160;

export default function VendorStorefrontScreen() {
  const router = useRouter();
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const { getOrCreatePreOrderChat } = useChats();

  console.log('[STORE] Vendor storefront opened:', vendorId || 'default');
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showVendorDetails, setShowVendorDetails] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const { items: cartItems, addItem, removeItem, totalItems, setActiveVendor, vendorCartCount } = useCart();

  const vendor = mockVendor;
  const { isChatDisabled } = useVendorChatMode();

  React.useEffect(() => {
    setActiveVendor(vendor.id, vendor.name);
  }, [setActiveVendor, vendor.id, vendor.name]);

  const handleBackPress = () => {
    try {
      router.back();
    } catch {
      router.push('/customer/(tabs)/chats');
    }
  };

  const handleFavoriteToggle = () => {
    setIsFavorite(!isFavorite);
    console.log('Favorite toggled:', !isFavorite);
  };

  const handleMenuPress = () => {
    if (Platform.OS === 'web') {
      handleShare();
    } else if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Share', 'Report'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleShare();
          } else if (buttonIndex === 2) {
            handleReport();
          }
        }
      );
    } else {
      handleShare();
    }
  };

  const handleShare = async () => {
    try {
      const shareUrl = `https://the platform.com/@${vendor.username}`;
      await RNShare.share({
        message: `Check out ${vendor.name} (@${vendor.username}) on the platform! ${shareUrl}`,
        url: shareUrl,
        title: vendor.name,
      });
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error sharing:', error);
      }
    }
  };

  const handleReport = () => {
    console.log('Report vendor');
    router.push('/report-vendor' as any);
  };

  const handleAddToCart = (item: MenuItem) => {
    if (item.addOns && item.addOns.length > 0) {
      handleItemPress(item.id);
      return;
    }
    addItem({
      id: item.id,
      name: item.name,
      price: getMenuItemDisplayPrice(item),
      originalPrice: item.price,
      image: item.image,
    });
    console.log('Added to cart:', item.name);
  };

  const getItemQuantityInCart = (itemId: string) => {
    return cartItems
      .filter((cartItem) => cartItem.id === itemId)
      .reduce((sum, cartItem) => sum + cartItem.quantity, 0);
  };

  const handleIncrementItem = (item: MenuItem, e: any) => {
    e.stopPropagation();
    if (item.addOns && item.addOns.length > 0) {
      handleItemPress(item.id);
      return;
    }
    addItem({
      id: item.id,
      name: item.name,
      price: getMenuItemDisplayPrice(item),
      originalPrice: item.price,
      image: item.image,
    });
  };

  const handleDecrementItem = (itemId: string, e: any) => {
    e.stopPropagation();
    removeItem(itemId);
  };

  const handleCartPress = () => {
    console.log('Cart pressed - navigate to cart screen');
    router.push({
      pathname: '/cart' as any,
      params: { vendorId: vendor.id },
    });
  };

  const handleGlobalCartPress = () => {
    console.log('Global cart pressed');
    router.push('/global-cart' as any);
  };

  const handleViewPolicy = () => {
    console.log('View Vendor Business Policy');
    setShowPolicyModal(true);
  };

  const handleVendorNamePress = () => {
    setShowVendorDetails(true);
    console.log('Vendor details opened');
  };

  const handleOpenLink = async (url: string) => {
    console.log('Opening link:', url);
  };

  const handleAskAI = () => {
    console.log('Ask the platform AI pressed');
    router.push(`/chat/the platform-ai?vendorName=${encodeURIComponent(vendor.name)}` as any);
  };

  const handleMessageVendor = () => {
    console.log('Message vendor pressed');
    const initialMessage = 'Hi, I have a question about your menu.';
    const chat = getOrCreatePreOrderChat(vendor.id, vendor.name, initialMessage);
    console.log('Pre-order chat created with message:', chat.id);
    router.push(`/chat/pre-order/${vendor.id}` as any);
  };

  const getItemOrderCount = (itemId: string) => {
    return mockOrders
      .filter(order => order.vendorId === vendor.id)
      .reduce((count, order) => {
        const itemInOrder = order.items.find(i => i.id === itemId);
        return count + (itemInOrder ? itemInOrder.quantity : 0);
      }, 0);
  };

  const hasOrderedItem = (itemId: string) => {
    return getItemOrderCount(itemId) > 0;
  };

  const completedOrders = useMemo(() => {
    return mockOrders.filter(
      order => order.vendorId === vendor.id && order.status === 'completed'
    );
  }, [vendor.id]);

  const hasCompletedOrderWithVendor = completedOrders.length > 0;

  const orderAgainItems = useMemo(() => {
    if (!hasCompletedOrderWithVendor) return [];
    
    const itemMap = new Map<string, { item: MenuItem; orderCount: number; lastOrdered: string }>();
    
    completedOrders.forEach(order => {
      order.items.forEach(orderItem => {
        const menuItem = mockMenuItems.find(m => m.id === orderItem.id);
        if (menuItem && menuItem.inStock) {
          const existing = itemMap.get(orderItem.id);
          if (existing) {
            existing.orderCount += orderItem.quantity;
            if (order.orderDate > existing.lastOrdered) {
              existing.lastOrdered = order.orderDate;
            }
          } else {
            itemMap.set(orderItem.id, {
              item: menuItem,
              orderCount: orderItem.quantity,
              lastOrdered: order.orderDate,
            });
          }
        }
      });
    });
    
    return Array.from(itemMap.values()).sort((a, b) => 
      new Date(b.lastOrdered).getTime() - new Date(a.lastOrdered).getTime()
    );
  }, [completedOrders, hasCompletedOrderWithVendor]);

  const filteredItems = useMemo(() => {
    let items = mockMenuItems.filter(item => {
      const catalogItem = mockMenuItems.find(i => i.id === item.id) as any;
      return !catalogItem?.moderationStatus || catalogItem.moderationStatus === 'approved';
    });

    if (searchQuery.trim()) {
      items = items.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      items = items.filter((item) => item.categoryId === selectedCategory);
    }

    return items;
  }, [searchQuery, selectedCategory]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, MenuItem[]> = {};
    filteredItems.forEach((item) => {
      if (!groups[item.categoryId]) {
        groups[item.categoryId] = [];
      }
      groups[item.categoryId].push(item);
    });
    return groups;
  }, [filteredItems]);

  const handleItemPress = (itemId: string) => {
    router.push({
      pathname: '/item/[id]' as any,
      params: { id: itemId, vendorId: vendor.id },
    });
  };

  const renderItemCard = (item: MenuItem) => {
    const quantityInCart = getItemQuantityInCart(item.id);
    const hasOrdered = hasOrderedItem(item.id);
    const orderCount = getItemOrderCount(item.id);
    const hasModifiers = item.addOns && item.addOns.length > 0;
    
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.itemCard, !item.inStock && styles.itemCardDisabled]}
        onPress={() => handleItemPress(item.id)}
        activeOpacity={item.inStock ? 0.8 : 1}
        disabled={!item.inStock}
      >
        <View style={styles.itemImageContainer}>
          <Image source={{ uri: item.image }} style={[styles.itemImage, !item.inStock && styles.itemImageDimmed]} />
          {!item.inStock && (
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockText}>Unavailable</Text>
            </View>
          )}
        </View>
        <View style={styles.itemInfo}>
          <View style={styles.itemNameRow}>
            <Text style={[styles.itemName, !item.inStock && styles.itemNameDisabled]} numberOfLines={1}>
              {item.name}
            </Text>
            {item.inStock && !hasOrdered && quantityInCart === 0 && (
              <View style={{ width: 18 }} />
            )}
            {item.inStock && hasOrdered && !hasModifiers && quantityInCart === 0 && (
              <TouchableOpacity
                style={styles.addAgainButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleAddToCart(item);
                }}
                activeOpacity={0.7}
              >
                <Plus size={14} color="#007AFF" />
              </TouchableOpacity>
            )}
          </View>
          {hasItemSalePrice(item, undefined) ? (
            <View style={styles.salePriceRow}>
              <Text style={[styles.salePriceCurrent, !item.inStock && styles.itemMetadataDisabled]}>
                {formatPrice(getMenuItemDisplayPrice(item))}
              </Text>
              <Text style={[styles.originalPriceStrike, !item.inStock && styles.itemMetadataDisabled]}>
                {formatPrice(item.price)}
              </Text>
            </View>
          ) : (
            <Text style={[styles.itemMetadata, !item.inStock && styles.itemMetadataDisabled]}>
              {formatPrice(item.price)}
            </Text>
          )}
          {item.description && (
            <Text style={[styles.itemDescription, !item.inStock && styles.itemDescriptionDisabled]} numberOfLines={1}>
              {item.description}
            </Text>
          )}
          {item.inStock && hasOrdered && !hasModifiers && (
            <Text style={styles.orderedBeforeText}>Ordered {orderCount} time{orderCount !== 1 ? 's' : ''}</Text>
          )}
          {item.inStock && hasOrdered && hasModifiers && (
            <Text style={styles.orderedBeforeText}>Ordered before</Text>
          )}
          {item.inStock && quantityInCart > 0 && (
            <View style={styles.itemActionArea}>
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={(e) => handleDecrementItem(item.id, e)}
                  activeOpacity={0.7}
                >
                  <Minus size={16} color="#000" />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{quantityInCart}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={(e) => handleIncrementItem(item, e)}
                  activeOpacity={0.7}
                >
                  <Plus size={16} color="#000" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderCategorySection = (category: Category) => {
    const items = groupedItems[category.id] || [];
    if (items.length === 0) return null;

    return (
      <View key={category.id} style={styles.categorySection}>
        <View style={styles.categorySectionHeader}>
          <Text style={styles.categorySectionTitle}>
            {category.name.toUpperCase()} ({items.length})
          </Text>
          <TouchableOpacity onPress={() => router.push(`/category/${category.id}` as any)}>
            <Text style={styles.seeAllButton}>See all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryCarousel}
        >
          {items.map((item) => renderItemCard(item))}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <ArrowLeft size={24} color="#000" />
          </TouchableOpacity>

          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => router.push('/customer/notifications' as any)} style={styles.headerButton}>
              <Bell size={24} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleGlobalCartPress} style={styles.headerButton}>
              <ShoppingBag size={24} color="#000" />
              {vendorCartCount > 0 && (
                <View style={styles.globalCartBadge}>
                  <Text style={styles.globalCartBadgeText}>{vendorCartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowSearch(!showSearch)}
              style={styles.headerButton}
            >
              <Search size={24} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleFavoriteToggle} style={styles.headerButton}>
              <Heart
                size={24}
                color={isFavorite ? '#FF3B30' : '#000'}
                fill={isFavorite ? '#FF3B30' : 'none'}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleMenuPress} style={styles.headerButton}>
              <MoreVertical size={24} color="#000" />
            </TouchableOpacity>
          </View>
        </View>

        {showSearch && (
          <View style={styles.searchBar}>
            <Search size={20} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search menu items..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Image source={{ uri: vendor.bannerImage }} style={styles.bannerImage} />

        <View style={styles.vendorInfo}>
          <View style={styles.vendorIdentityRow}>
            <TouchableOpacity onPress={handleVendorNamePress} activeOpacity={0.8} style={styles.vendorLogoButton}>
              {vendor.logoImage ? (
                <Image source={{ uri: vendor.logoImage }} style={styles.vendorLogo} />
              ) : (
                <View style={styles.vendorLogoFallback}>
                  <Text style={styles.vendorLogoFallbackText}>{vendor.name.charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.vendorIdentityText}>
              <TouchableOpacity onPress={handleVendorNamePress} activeOpacity={0.7}>
                <Text style={styles.vendorName}>{vendor.name}</Text>
              </TouchableOpacity>
              {vendor.storeStatus === 'closed' && (
                <View style={styles.availabilityRow}>
                  <View style={styles.availabilityDot} />
                  <Text style={styles.availabilityText}>
                    {vendor.businessHours
                      ? (() => {
                          const match = vendor.businessHours!.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
                          return match ? `Opens at ${match[1]}` : 'Currently closed';
                        })()
                      : 'Currently closed'}
                  </Text>
                </View>
              )}
              <View style={styles.metadataRow}>
                <Text style={styles.metadataText}>{vendor.category} · </Text>
                <TouchableOpacity 
                  onPress={() => router.push(`/vendor-ratings/${vendor.id}` as any)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.ratingLink}>⭐ {vendor.rating} ({vendor.reviewCount})</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.metadataText}>{vendor.area}</Text>
            </View>
          </View>
          <View style={styles.fulfillmentSection}>
            <Text style={styles.fulfillmentLabel}>Fulfillment</Text>
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

          <TouchableOpacity onPress={handleViewPolicy} style={styles.policyButton}>
            <Text style={styles.policyText}>Vendor Business Policy</Text>
          </TouchableOpacity>

          <View style={styles.ctaSection}>
            <TouchableOpacity onPress={handleAskAI} style={styles.primaryCTA} activeOpacity={0.85}>
              <Sparkles size={20} color="#fff" />
              <Text style={styles.primaryCTAText}>Ask the platform AI</Text>
            </TouchableOpacity>
            {!isChatDisabled && (
            <TouchableOpacity onPress={handleMessageVendor} style={styles.secondaryCTA} activeOpacity={0.75}>
              <MessageCircle size={20} color="#333" />
              <Text style={styles.secondaryCTAText}>Message vendor</Text>
            </TouchableOpacity>
          )}
          </View>
        </View>

        <View style={styles.footerDisclaimer}>
          <Text style={styles.footerDisclaimerText}>
            Orders and payments are handled directly by the vendor.
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
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.orderAgainCard}
                    onPress={() => handleItemPress(item.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.orderAgainImageContainer}>
                      <Image source={{ uri: item.image }} style={styles.orderAgainImage} />
                      <TouchableOpacity
                        style={styles.orderAgainAddButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          if (hasModifiers) {
                            handleItemPress(item.id);
                          } else {
                            handleAddToCart(item);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Plus size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.orderAgainInfo}>
                      <Text style={styles.orderAgainItemName} numberOfLines={2}>{item.name}</Text>
                      {hasItemSalePrice(item, undefined) ? (
                      <View style={styles.salePriceRow}>
                        <Text style={styles.orderAgainSalePrice}>{formatPrice(getMenuItemDisplayPrice(item))}</Text>
                        <Text style={styles.orderAgainOriginalPrice}>{formatPrice(item.price)}</Text>
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryPills}
          contentContainerStyle={styles.categoryPillsContent}
        >
          <Pressable
            onPress={() => setSelectedCategory('all')}
            style={[
              styles.categoryPill,
              selectedCategory === 'all' && styles.categoryPillActive,
            ]}
          >
            <Text
              style={[
                styles.categoryPillText,
                selectedCategory === 'all' && styles.categoryPillTextActive,
              ]}
            >
              All
            </Text>
          </Pressable>
          {mockCategories.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => setSelectedCategory(category.id)}
              style={[
                styles.categoryPill,
                selectedCategory === category.id && styles.categoryPillActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  selectedCategory === category.id && styles.categoryPillTextActive,
                ]}
              >
                {category.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.menuSections}>
          {searchQuery.trim() ? (
            <View style={styles.searchResults}>
              <Text style={styles.searchResultsTitle}>
                Search Results ({filteredItems.length})
              </Text>
              <View style={styles.searchResultsGrid}>
                {filteredItems.map((item) => renderItemCard(item))}
              </View>
            </View>
          ) : (
            mockCategories.map((category) => renderCategorySection(category))
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {totalItems > 0 && (
        <TouchableOpacity
          style={styles.floatingCartButton}
          onPress={handleCartPress}
          activeOpacity={0.9}
        >
          <ShoppingCart size={24} color="#fff" />
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{totalItems}</Text>
          </View>
        </TouchableOpacity>
      )}

      <VendorProfileModal
        visible={showVendorDetails}
        vendor={vendor}
        onClose={() => setShowVendorDetails(false)}
        onViewPolicy={handleViewPolicy}
        onReport={handleReport}
      />

      <LaektivaModal
        visible={showPolicyModal}
        title="Vendor Business Policy"
        message={vendor.policy || 'Vendor policies and terms will be displayed here.'}
        primaryButton={{
          label: 'Close',
          onPress: () => setShowPolicyModal(false),
        }}
        onRequestClose={() => setShowPolicyModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  safeArea: {
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerButton: {
    padding: 8,
    position: 'relative' as const,
  },
  headerRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  content: {
    flex: 1,
  },
  bannerImage: {
    width: width,
    height: 200,
    backgroundColor: '#f0f0f0',
  },
  vendorInfo: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  vendorIdentityRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    marginBottom: 4,
  },
  vendorLogoButton: {
    marginRight: 12,
    marginTop: -30,
  },
  vendorLogo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0f0f0',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  vendorLogoFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0f0f0',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  vendorLogoFallbackText: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#666',
  },
  availabilityRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 2,
  },
  availabilityDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF8C42',
  },
  availabilityText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '400' as const,
  },
  vendorIdentityText: {
    flex: 1,
  },
  vendorName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 4,
  },
  metadataRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 4,
  },
  metadataText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  ratingLink: {
    fontSize: 15,
    color: '#007AFF',
    lineHeight: 22,
    fontWeight: '500' as const,
  },
  policyButton: {
    paddingVertical: 8,
  },
  policyText: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '500' as const,
  },
  ctaSection: {
    marginTop: 16,
    gap: 12,
  },
  primaryCTA: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#000',
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryCTAText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  secondaryCTA: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#ccc',
  },
  secondaryCTAText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#333',
  },
  footerDisclaimer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  footerDisclaimerText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center' as const,
  },
  categoryPills: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
    backgroundColor: '#f8f8f8',
  },
  categoryPillActive: {
    backgroundColor: '#000',
  },
  categoryPillText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#666',
  },
  categoryPillTextActive: {
    color: '#fff',
  },
  menuSections: {
    paddingTop: 8,
  },
  categorySection: {
    marginBottom: 24,
  },
  categorySectionHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  categorySectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
  },
  seeAllButton: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '500' as const,
  },
  categoryCarousel: {
    paddingLeft: 20,
    paddingRight: 20,
    gap: 12,
  },
  itemCard: {
    width: ITEM_CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  itemCardDisabled: {
    opacity: 0.6,
  },
  itemImageContainer: {
    position: 'relative' as const,
  },
  itemImage: {
    width: ITEM_CARD_WIDTH,
    height: 120,
    backgroundColor: '#f0f0f0',
  },
  itemImageDimmed: {
    opacity: 0.5,
  },
  outOfStockBadge: {
    position: 'absolute' as const,
    top: 8,
    left: 8,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  outOfStockText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#fff',
  },
  itemInfo: {
    padding: 12,
  },
  itemNameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 6,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#000',
    flex: 1,
  },
  itemNameDisabled: {
    color: '#999',
  },
  addAgainButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#007AFF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginLeft: 8,
  },
  itemMetadata: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  itemMetadataDisabled: {
    color: '#999',
  },
  itemDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    lineHeight: 18,
  },
  itemDescriptionDisabled: {
    color: '#999',
  },
  orderedBeforeText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500' as const,
    marginBottom: 6,
  },
  itemActionArea: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginTop: 8,
  },
  quantityControls: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: '#f8f8f8',
    borderRadius: 16,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  quantityText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#000',
    minWidth: 20,
    textAlign: 'center' as const,
  },
  searchResults: {
    padding: 20,
  },
  searchResultsTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 16,
  },
  searchResultsGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 12,
  },
  floatingCartButton: {
    position: 'absolute' as const,
    bottom: 100,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#000',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cartBadge: {
    position: 'absolute' as const,
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: '#fff',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  bottomSpacer: {
    height: 120,
  },
  fulfillmentSection: {
    marginTop: 12,
    gap: 8,
  },
  fulfillmentLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#999',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  fulfillmentBadges: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  fulfillmentBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  fulfillmentBadgeText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#000',
  },
  fulfillmentBadgeShipping: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  fulfillmentBadgeTextShipping: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#C2410C',
  },

  orderAgainSection: {
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderAgainHeader: {
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  orderAgainTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 4,
  },
  orderAgainSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  orderAgainCarousel: {
    paddingHorizontal: 20,
    gap: 12,
  },
  orderAgainCard: {
    width: 140,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  orderAgainImageContainer: {
    position: 'relative' as const,
  },
  orderAgainImage: {
    width: 140,
    height: 100,
    backgroundColor: '#f0f0f0',
  },
  orderAgainAddButton: {
    position: 'absolute' as const,
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#000',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  orderAgainInfo: {
    padding: 10,
  },
  orderAgainItemName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 4,
    lineHeight: 18,
  },
  orderAgainItemPrice: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  orderAgainCount: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500' as const,
  },
  globalCartBadge: {
    position: 'absolute' as const,
    top: 4,
    right: 4,
    backgroundColor: '#FF3B30',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: '#fff',
  },
  globalCartBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  salePriceRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginBottom: 6,
  },
  salePriceHighlight: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#2B2B2B',
  },
  salePriceCurrent: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#2B2B2B',
  },
  originalPriceStrike: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through' as const,
    fontWeight: '400' as const,
  },
  orderAgainSalePrice: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#2B2B2B',
  },
  orderAgainOriginalPrice: {
    fontSize: 11,
    color: '#999',
    textDecorationLine: 'line-through' as const,
    fontWeight: '400' as const,
  },
});
