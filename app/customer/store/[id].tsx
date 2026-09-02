import React, { useState, useMemo } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Pressable,
  Modal,
} from 'react-native';
import LaektivaModal from '@/components/LaektivaModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Heart, MoreVertical, Search, Plus, ShoppingCart, X, Minus, MapPin, Clock, ExternalLink, Sparkles, MessageCircle } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCart } from '@/contexts/CartContext';
import { useChats } from '@/contexts/ChatContext';
import { mockVendor, mockCategories, mockMenuItems, MenuItem, Category } from '@/mocks/vendorData';
import { useVendorChatMode } from '@/contexts/VendorChatModeContext';
import { mockOrders } from '@/mocks/ordersData';
import { formatPrice } from '@/utils/formatPrice';
import { getMenuItemDisplayPrice } from '@/utils/itemPricing';
import * as Clipboard from 'expo-clipboard';

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
  const [showCopiedModal, setShowCopiedModal] = useState(false);
  const { items: cartItems, addItem, removeItem, totalItems, setActiveVendor } = useCart();

  const vendor = mockVendor;
  const { chatMode } = useVendorChatMode();

  React.useEffect(() => {
    setActiveVendor(vendor.id, vendor.name);
  }, [setActiveVendor, vendor.id, vendor.name]);

  const handleBackPress = () => {
    router.back();
  };

  const handleFavoriteToggle = () => {
    setIsFavorite(!isFavorite);
    console.log('Favorite toggled:', !isFavorite);
  };

  const handleMenuPress = async () => {
    const shareUrl = `https://theplatform.com/@${vendor.username}`;
    try {
      await Clipboard.setStringAsync(shareUrl);
      console.log('[Share Store] URL copied to clipboard:', shareUrl);
      setShowCopiedModal(true);
    } catch (error) {
      console.error('[Share Store] Failed to copy to clipboard:', error);
    }
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
    router.push(`/chat/platform-ai?vendorName=${encodeURIComponent(vendor.name)}` as any);
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
      pathname: `/item/[id]` as any,
      params: { id: itemId, vendorId: vendor.id },
    });
  };



  const renderListItem = (item: MenuItem) => {
    const quantityInCart = getItemQuantityInCart(item.id);
    const hasOrdered = hasOrderedItem(item.id);
    const orderCount = getItemOrderCount(item.id);
    const hasModifiers = item.addOns && item.addOns.length > 0;
    
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.listItem, !item.inStock && styles.listItemDisabled]}
        onPress={() => handleItemPress(item.id)}
        activeOpacity={item.inStock ? 0.8 : 1}
        disabled={!item.inStock}
      >
        <Image source={{ uri: item.image }} style={[styles.listItemImage, !item.inStock && styles.itemImageDimmed]} />
        <View style={styles.listItemContent}>
          <View style={styles.listItemHeader}>
            <View style={styles.listItemTextContainer}>
              <Text style={[styles.listItemName, !item.inStock && styles.itemNameDisabled]} numberOfLines={1}>
                {item.name}
              </Text>
              {item.description && (
                <Text style={[styles.listItemDescription, !item.inStock && styles.itemDescriptionDisabled]} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
              <View style={styles.listItemPriceRow}>
                <Text style={[styles.listItemPrice, !item.inStock && styles.itemMetadataDisabled]}>
                  {formatPrice(item.price)}
                </Text>
                {hasModifiers && (
                  <Text style={styles.hasAddOnsText}>• Customizable</Text>
                )}
              </View>
              {item.inStock && hasOrdered && (
                <Text style={styles.orderedBeforeText}>
                  {hasModifiers ? 'Ordered before' : `Ordered ${orderCount} time${orderCount !== 1 ? 's' : ''}`}
                </Text>
              )}
            </View>
            <View style={styles.listItemActions}>
              {!item.inStock && (
                <View style={styles.unavailableBadge}>
                  <Text style={styles.unavailableText}>Unavailable</Text>
                </View>
              )}
              {item.inStock && quantityInCart === 0 && (
                <TouchableOpacity
                  style={styles.listAddButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleAddToCart(item);
                  }}
                  activeOpacity={0.7}
                >
                  <Plus size={20} color={Colors.text} />
                </TouchableOpacity>
              )}
              {item.inStock && quantityInCart > 0 && (
                <View style={styles.listQuantityControls}>
                  <TouchableOpacity
                    style={styles.listQuantityButton}
                    onPress={(e) => handleDecrementItem(item.id, e)}
                    activeOpacity={0.7}
                  >
                    <Minus size={18} color={Colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.listQuantityText}>{quantityInCart}</Text>
                  <TouchableOpacity
                    style={styles.listQuantityButton}
                    onPress={(e) => handleIncrementItem(item, e)}
                    activeOpacity={0.7}
                  >
                    <Plus size={18} color={Colors.text} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
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
        </View>
        <View style={styles.categoryListContainer}>
          {items.map((item) => renderListItem(item))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <ArrowLeft size={24} color={Colors.text} />
          </TouchableOpacity>

          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => setShowSearch(!showSearch)}
              style={styles.headerButton}
            >
              <Search size={24} color={Colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleFavoriteToggle} style={styles.headerButton}>
              <Heart
                size={24}
                color={isFavorite ? Colors.error : Colors.text}
                fill={isFavorite ? Colors.error : 'none'}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleMenuPress} style={styles.headerButton}>
              <MoreVertical size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {showSearch && (
          <View style={styles.searchBar}>
            <Search size={20} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search menu items..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Image source={{ uri: vendor.bannerImage }} style={styles.bannerImage} />

        <View style={styles.vendorInfo}>
          <TouchableOpacity onPress={handleVendorNamePress} activeOpacity={0.7}>
            <Text style={styles.vendorName}>{vendor.name}</Text>
          </TouchableOpacity>
          <View style={styles.metadataRow}>
            <Text style={styles.metadataText}>{vendor.category} · ⭐ {vendor.rating} ({vendor.reviewCount})</Text>
          </View>
          <Text style={styles.metadataText}>{vendor.area}</Text>
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

          {vendor.storeStatus === 'closed' && (
            <View style={styles.closedBadge}>
              <Text style={styles.closedBadgeText}>CLOSED</Text>
            </View>
          )}

          <TouchableOpacity onPress={handleViewPolicy} style={styles.policyButton}>
            <Text style={styles.policyText}>Vendor Business Policy</Text>
          </TouchableOpacity>

          <View style={styles.ctaSection}>
            <TouchableOpacity onPress={handleAskAI} style={styles.primaryCTA}>
              <Sparkles size={20} color={Colors.text} />
              <Text style={styles.primaryCTAText}>Ask the platform AI</Text>
            </TouchableOpacity>
            {chatMode === 'disabled' ? (
              <View style={styles.chatDisabledNotice}>
                <MessageCircle size={14} color={Colors.textMuted} />
                <Text style={styles.chatDisabledNoticeText}>Messaging available after an order request.</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity onPress={handleMessageVendor} style={styles.secondaryCTA}>
                  <MessageCircle size={20} color={Colors.textSecondary} />
                  <Text style={styles.secondaryCTAText}>Message vendor</Text>
                </TouchableOpacity>
                {chatMode === 'limited' && (
                  <View style={styles.chatLimitedBanner}>
                    <Text style={styles.chatLimitedBannerText}>Clarifications only — short order-related questions.</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

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
                    onPress={() => handleItemPress(item.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.orderAgainImageContainer}>
                      <Image source={{ uri: item.image }} style={styles.orderAgainImage} />
                      {quantityInCart === 0 ? (
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
              <View style={styles.categoryListContainer}>
                {filteredItems.map((item) => renderListItem(item))}
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
          <ShoppingCart size={24} color={Colors.text} />
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{totalItems}</Text>
          </View>
        </TouchableOpacity>
      )}

      <Modal
        visible={showVendorDetails}
        animationType="fade"
        transparent
        onRequestClose={() => setShowVendorDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView edges={['top', 'bottom']} style={styles.modalGlassContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderContent}>
              <Text style={styles.modalVendorName}>{vendor.name}</Text>
              <Text style={styles.modalMetadata}>
                {vendor.category} · ⭐ {vendor.rating} ({vendor.reviewCount})
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowVendorDetails(false)}
              style={styles.modalCloseButton}
            >
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.modalSection}>
              <View style={styles.modalSectionHeader}>
                <MapPin size={20} color={Colors.textMuted} />
              </View>
              <Text style={styles.modalSectionContent}>{vendor.area}</Text>
            </View>

            {vendor.businessHours && (
              <View style={styles.modalSection}>
                <View style={styles.modalSectionHeader}>
                  <Clock size={20} color={Colors.textMuted} />
                </View>
                <Text style={styles.modalSectionContent}>{vendor.businessHours}</Text>
              </View>
            )}

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionLabel}>Fulfillment Methods</Text>
              {vendor.pickup && (
                <Text style={styles.modalSectionContent}>• Pickup available</Text>
              )}
              {vendor.delivery && (
                <Text style={styles.modalSectionContent}>• Delivery available</Text>
              )}
              {vendor.shipping && vendor.shippingScope === 'domestic' && (
                <Text style={styles.modalSectionContent}>• Ships Nationwide</Text>
              )}
              {vendor.shipping && vendor.shippingScope === 'international' && (
                <Text style={styles.modalSectionContent}>• Ships Worldwide</Text>
              )}
            </View>

            {vendor.minimumOrderAmount && (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionContent}>
                  Minimum order: {formatPrice(vendor.minimumOrderAmount)}
                </Text>
              </View>
            )}

            {vendor.contactLinks && (vendor.contactLinks.website || vendor.contactLinks.instagram || vendor.contactLinks.tiktok) && (
              <View style={styles.modalSection}>
                {vendor.contactLinks.website && (
                  <TouchableOpacity
                    style={styles.modalLink}
                    onPress={() => handleOpenLink(vendor.contactLinks!.website!)}
                  >
                    <Text style={styles.modalLinkText}>Website</Text>
                    <ExternalLink size={16} color={Colors.primary} />
                  </TouchableOpacity>
                )}
                {vendor.contactLinks.instagram && (
                  <TouchableOpacity
                    style={styles.modalLink}
                    onPress={() => handleOpenLink(vendor.contactLinks!.instagram!)}
                  >
                    <Text style={styles.modalLinkText}>Instagram</Text>
                    <ExternalLink size={16} color={Colors.primary} />
                  </TouchableOpacity>
                )}
                {vendor.contactLinks.tiktok && (
                  <TouchableOpacity
                    style={styles.modalLink}
                    onPress={() => handleOpenLink(vendor.contactLinks!.tiktok!)}
                  >
                    <Text style={styles.modalLinkText}>TikTok</Text>
                    <ExternalLink size={16} color={Colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.modalSection}>
              <TouchableOpacity onPress={handleViewPolicy} style={styles.modalActionButton}>
                <Text style={styles.modalActionText}>Vendor Business Policy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowVendorDetails(false);
                  setTimeout(() => {
                    router.push('/report-vendor' as any);
                  }, 300);
                }}
                style={styles.modalActionButton}
                activeOpacity={0.7}
              >
                <Text style={styles.modalActionTextDestructive}>Report an issue</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBottomSpacer} />
          </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

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

      <LaektivaModal
        visible={showCopiedModal}
        title="Copied to Clipboard"
        message="The content has been copied to your clipboard. You can now paste it to share."
        primaryButton={{
          label: 'OK',
          onPress: () => setShowCopiedModal(false),
        }}
        onRequestClose={() => setShowCopiedModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  bannerImage: {
    width: width,
    height: 200,
    backgroundColor: Colors.cardBorder,
  },
  vendorInfo: {
    paddingHorizontal: 16,
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

  policyButton: {
    paddingVertical: 6,
  },
  policyText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500' as const,
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
    backgroundColor: Colors.background,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryCTAText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
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
  chatDisabledNotice: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
  },
  chatDisabledNoticeText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic' as const,
  },
  chatLimitedBanner: {
    backgroundColor: 'rgba(255,140,66,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,140,66,0.18)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 2,
  },
  chatLimitedBannerText: {
    fontSize: 12,
    color: '#FF8C42',
    textAlign: 'center' as const,
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
  categoryPills: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
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
    marginBottom: 16,
  },
  categorySectionHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  categorySectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  seeAllButton: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  categoryCarousel: {
    paddingLeft: 20,
    paddingRight: 20,
    gap: 12,
  },
  itemCard: {
    width: ITEM_CARD_WIDTH,
    backgroundColor: Colors.background,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
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
    backgroundColor: Colors.cardBorder,
  },
  itemImageDimmed: {
    opacity: 0.5,
  },
  outOfStockBadge: {
    position: 'absolute' as const,
    top: 8,
    left: 8,
    backgroundColor: Colors.error,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  outOfStockText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.text,
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
    color: Colors.text,
    flex: 1,
  },
  itemNameDisabled: {
    color: Colors.textMuted,
  },
  addAgainButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginLeft: 8,
  },
  itemMetadata: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  itemMetadataDisabled: {
    color: Colors.textMuted,
  },
  itemDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  itemDescriptionDisabled: {
    color: Colors.textMuted,
  },
  orderedBeforeText: {
    fontSize: 12,
    color: Colors.primary,
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
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quantityText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    minWidth: 20,
    textAlign: 'center' as const,
  },
  searchResults: {
    padding: 20,
  },
  searchResultsTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
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
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cartBadge: {
    position: 'absolute' as const,
    top: -4,
    right: -4,
    backgroundColor: Colors.error,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: Colors.text,
  },
  cartBadgeText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  bottomSpacer: {
    height: 120,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end' as const,
  },
  modalGlassContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalHeaderContent: {
    flex: 1,
    paddingRight: 12,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
  },
  modalSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalVendorName: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 6,
    lineHeight: 32,
  },
  modalMetadata: {
    fontSize: 15,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  modalSectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  modalSectionContent: {
    fontSize: 15,
    color: Colors.textMuted,
    lineHeight: 22,
  },
  modalSectionLabel: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '600' as const,
    marginBottom: 8,
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
  modalLink: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 14,
  },
  modalLinkText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  modalActionButton: {
    paddingVertical: 14,
  },
  modalActionText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  modalActionTextDestructive: {
    fontSize: 16,
    color: Colors.error,
    fontWeight: '500' as const,
  },
  modalBottomSpacer: {
    height: 40,
  },
  closedBadge: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: Colors.error,
    borderRadius: 6,
    alignSelf: 'flex-start' as const,
  },
  closedBadgeText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  orderAgainSection: {
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
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
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  orderAgainImageContainer: {
    position: 'relative' as const,
  },
  orderAgainImage: {
    width: 140,
    height: 100,
    backgroundColor: Colors.cardBorder,
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
  globalCartBadge: {
    position: 'absolute' as const,
    top: 4,
    right: 4,
    backgroundColor: Colors.error,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: Colors.text,
  },
  globalCartBadgeText: {
    color: Colors.text,
    fontSize: 10,
    fontWeight: '700' as const,
  },
  categoryListContainer: {
    paddingHorizontal: 20,
  },
  listItem: {
    flexDirection: 'row' as const,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  listItemDisabled: {
    opacity: 0.6,
  },
  listItemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: Colors.cardBorder,
  },
  listItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  listItemHeader: {
    flex: 1,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
  },
  listItemTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  listItemName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  listItemDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  listItemPriceRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  listItemPrice: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  hasAddOnsText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  listItemActions: {
    justifyContent: 'center' as const,
    alignItems: 'flex-end' as const,
  },
  listAddButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  listQuantityControls: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  listQuantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  listQuantityText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    minWidth: 24,
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
});