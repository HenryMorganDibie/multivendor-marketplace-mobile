import React, { useState, useMemo } from 'react';
import { Animated } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { useResponsive } from '@/constants/layout';
import { useCart } from '@/contexts/CartContext';
import { useChats } from '@/contexts/ChatContext';
import { useVendorChatMode } from '@/contexts/VendorChatModeContext';
import { useVendorStatusPermissions } from '@/components/VendorStatusGate';
import { useVendorRelationships } from '@/contexts/VendorRelationshipContext';
import { useBlockedUsers } from '@/contexts/BlockedUsersContext';
import { useRecentlyViewed } from '@/contexts/RecentlyViewedContext';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useVendorMenu } from '@/data/hooks';
import { useOrders } from '@/contexts/OrdersContext';
import { useSafeBack } from '@/utils/useSafeBack';
import { Alert } from '@/utils/alert';
import { MenuItem, Vendor } from '@/mocks/vendorData';
import { getStorefrontSections } from '@/utils/itemTagging';
import { getMenuItemDisplayPrice, hasItemSalePrice } from '@/utils/itemPricing';

export function useStorefrontViewModel(vendor: Vendor) {
  const router = useRouter();
  const safeBack = useSafeBack();
  const layout = useResponsive();

  const { getOrCreateConversation, getConversationByPair, startNewInquiry } = useChats();
  const { data: menuData } = useVendorMenu(vendor.id);
  const menuItems = useMemo(() => menuData?.items ?? [], [menuData]);
  const categories = useMemo(() => menuData?.categories ?? [], [menuData]);
  const { orders } = useOrders();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [showVendorDetails, setShowVendorDetails] = useState<boolean>(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState<boolean>(false);
  const [showPolicyModal, setShowPolicyModal] = useState<boolean>(false);
  const [showCopiedModal, setShowCopiedModal] = useState<boolean>(false);
  const [showClosedModal, setShowClosedModal] = useState<boolean>(false);

  const { items: cartItems, addItem, removeItem, getVendorCart, setActiveVendor } = useCart();
  const { chatMode } = useVendorChatMode();
  const { addRelationship } = useVendorRelationships();
  const { canChat, canAccessAI, canAddToCart } = useVendorStatusPermissions();
  const { isUserBlocked } = useBlockedUsers();
  const isVendorBlocked = isUserBlocked(vendor.id);
  const { trackVendorView } = useRecentlyViewed();
  const { isFavorite, toggleFavorite } = useFavorites();
  const vendorFavorited = isFavorite(vendor.id);

  const isStoreOpen = !vendor.storeStatus || vendor.storeStatus === 'open';

  const cartScaleAnim = React.useRef(new Animated.Value(0)).current;
  const [cartVisible, setCartVisible] = React.useState<boolean>(false);
  const cartVisibleRef = React.useRef(false);
  const currentVendorCart = getVendorCart(vendor.id);
  const currentVendorItemCount = useMemo(() => {
    if (!currentVendorCart) return 0;
    return currentVendorCart.items.reduce((sum, item) => sum + item.quantity, 0);
  }, [currentVendorCart]);

  const shouldShowCart = currentVendorItemCount > 0 && canAddToCart;

  React.useEffect(() => {
    if (shouldShowCart && !cartVisibleRef.current) {
      cartVisibleRef.current = true;
      setCartVisible(true);
      cartScaleAnim.setValue(0.7);
      Animated.spring(cartScaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 200,
        friction: 8,
      }).start();
    } else if (!shouldShowCart && cartVisibleRef.current) {
      cartVisibleRef.current = false;
      Animated.timing(cartScaleAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start(() => setCartVisible(false));
    }
  }, [shouldShowCart, cartScaleAnim]);

  React.useEffect(() => {
    setActiveVendor(vendor.id, vendor.name);
  }, [setActiveVendor, vendor.id, vendor.name]);

  React.useEffect(() => {
    trackVendorView({
      id: vendor.id,
      username: vendor.username,
      name: vendor.name,
      bannerImage: vendor.bannerImage,
      category: vendor.category,
      rating: vendor.rating,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor.id]);

  React.useEffect(() => {
    if (!isStoreOpen) {
      console.log('[STORE] Store is not open, status:', vendor.storeStatus);
      setShowClosedModal(true);
    }
  }, [isStoreOpen, vendor.storeStatus]);

  const handleBackPress = () => {
    safeBack();
  };

  const handleMenuPress = async () => {
    const shareUrl = `https://example.com/@${vendor.username}`;
    try {
      await Clipboard.setStringAsync(shareUrl);
      console.log('[Share Store] URL copied to clipboard:', shareUrl);
      setShowCopiedModal(true);
    } catch (error) {
      console.error('[Share Store] Failed to copy to clipboard:', error);
    }
  };

  const handleAddToCart = (item: MenuItem) => {
    if (isVendorBlocked) {
      Alert.alert('', 'You cannot place orders with this vendor.');
      return;
    }
    if (!canAddToCart) return;
    if (item.addOns && item.addOns.length > 0) {
      handleItemPress(item.id);
      return;
    }
    const displayPrice = getMenuItemDisplayPrice(item);
    const isOnSale = hasItemSalePrice(item, undefined);
    addItem({
      id: item.id,
      name: item.name,
      price: displayPrice,
      originalPrice: isOnSale ? item.price : undefined,
      image: item.image,
    });
    addRelationship(vendor.id, 'cart_created');
    console.log('Added to cart:', item.name);
  };

  const getItemQuantityInCart = (itemId: string) => {
    return cartItems
      .filter((cartItem) => cartItem.id === itemId)
      .reduce((sum, cartItem) => sum + cartItem.quantity, 0);
  };

  const handleIncrementItem = (item: MenuItem, e: any) => {
    e.stopPropagation();
    if (isVendorBlocked) {
      Alert.alert('', 'You cannot place orders with this vendor.');
      return;
    }
    if (!canAddToCart) return;
    if (item.addOns && item.addOns.length > 0) {
      handleItemPress(item.id);
      return;
    }
    const displayPrice = getMenuItemDisplayPrice(item);
    const isOnSale = hasItemSalePrice(item, undefined);
    addItem({
      id: item.id,
      name: item.name,
      price: displayPrice,
      originalPrice: isOnSale ? item.price : undefined,
      image: item.image,
    });
  };

  const handleDecrementItem = (itemId: string, e: any) => {
    e.stopPropagation();
    if (!canAddToCart) return;
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
    if (isVendorBlocked) {
      Alert.alert('', 'You cannot initiate communication with this vendor.');
      return;
    }
    console.log('Ask Platform AI pressed');
    router.push(`/chat/platform-ai?vendorName=${encodeURIComponent(vendor.name)}` as any);
  };

  const handleMessageVendor = () => {
    if (isVendorBlocked) {
      Alert.alert('', 'You cannot initiate communication with this vendor.');
      return;
    }
    console.log('[STORE] Message vendor pressed, checking for existing conversation');

    const existingChat = getConversationByPair(vendor.id, 'customer-001');

    if (existingChat) {
      console.log('[STORE] Found existing conversation:', existingChat.id, 'type:', existingChat.chatType);

      const isOrderCompleted = existingChat.chatType === 'order_chat' && !existingChat.vendorCanReply;
      const lastMsg = existingChat.messages[existingChat.messages.length - 1];
      const lastActivityTime = lastMsg ? new Date(lastMsg.timestamp).getTime() : 0;
      const isExpired = lastMsg && (Date.now() - lastActivityTime > 72 * 60 * 60 * 1000);

      if (isOrderCompleted || isExpired) {
        console.log('[STORE] Conversation expired/locked, starting new inquiry');
        startNewInquiry(vendor.id);
      }

      router.push(`/chat/pre-order/${vendor.id}` as any);
      return;
    }

    const chat = getOrCreateConversation(vendor.id, vendor.name, 'pre-order');
    console.log('[STORE] New inquiry conversation created:', chat.id);
    router.push(`/chat/pre-order/${vendor.id}` as any);
  };

  const handleItemPress = (itemId: string) => {
    router.push({
      pathname: `/item/[id]` as any,
      params: { id: itemId, vendorId: vendor.id },
    });
  };

  const handleToggleFavorite = () => {
    toggleFavorite(vendor.id);
  };

  const handleReportPress = () => {
    setShowVendorDetails(false);
    setTimeout(() => {
      router.push('/report-vendor' as any);
    }, 300);
  };

  const completedOrders = useMemo(() => {
    return orders.filter(
      (order) => order.vendorId === vendor.id && order.status === 'completed'
    );
  }, [orders, vendor.id]);

  const hasCompletedOrderWithVendor = completedOrders.length > 0;

  const orderAgainItems = useMemo(() => {
    if (!hasCompletedOrderWithVendor) return [];

    const itemMap = new Map<string, { item: MenuItem; orderCount: number; lastOrdered: string }>();

    completedOrders.forEach((order) => {
      order.items.forEach((orderItem) => {
        const menuItem = menuItems.find((m) => m.id === orderItem.id);
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

    return Array.from(itemMap.values()).sort(
      (a, b) => new Date(b.lastOrdered).getTime() - new Date(a.lastOrdered).getTime()
    );
  }, [completedOrders, hasCompletedOrderWithVendor, menuItems]);

  const filteredItems = useMemo(() => {
    let items = menuItems.filter((item) => {
      const catalogItem = item as any;
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
  }, [searchQuery, selectedCategory, menuItems]);

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

  const storefrontSections = useMemo(() => {
    const approvedItems = menuItems.filter((item) => {
      const cat = item as any;
      return !cat?.moderationStatus || cat.moderationStatus === 'approved';
    });
    return getStorefrontSections(approvedItems, approvedItems);
  }, [menuItems]);

  return {
    layout,
    menuItems,
    categories,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    showSearch,
    setShowSearch,
    showVendorDetails,
    setShowVendorDetails,
    descriptionExpanded,
    setDescriptionExpanded,
    showPolicyModal,
    setShowPolicyModal,
    showCopiedModal,
    setShowCopiedModal,
    showClosedModal,
    setShowClosedModal,
    vendorCartCount: currentVendorItemCount,
    cartVisible,
    cartScaleAnim,
    isStoreOpen,
    isVendorBlocked,
    vendorFavorited,
    canChat,
    canAccessAI,
    canAddToCart,
    chatMode,
    filteredItems,
    groupedItems,
    storefrontSections,
    orderAgainItems,
    hasCompletedOrderWithVendor,
    getItemQuantityInCart,
    handleBackPress,
    handleMenuPress,
    handleAddToCart,
    handleIncrementItem,
    handleDecrementItem,
    handleCartPress,
    handleViewPolicy,
    handleVendorNamePress,
    handleOpenLink,
    handleAskAI,
    handleMessageVendor,
    handleItemPress,
    handleToggleFavorite,
    handleReportPress,
  };
}
