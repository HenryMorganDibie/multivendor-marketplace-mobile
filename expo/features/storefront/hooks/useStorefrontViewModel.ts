import React, { useState, useMemo } from 'react';
import { Animated, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useToast } from '@/hooks/useToast';

import { useResponsive } from '@/constants/layout';
import { useCart } from '@/contexts/CartContext';
import { useChats } from '@/contexts/ChatContext';
import { useMessageVendor } from '@/features/chat/hooks/useMessageVendor';
import { useAuth } from '@/contexts/AuthContext';
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
import { vendorPlanAllowsAi, PLATFORM_AI_CUSTOMER_ENABLED } from '@/utils/platformAiLimits';
import { MenuItem, Vendor } from '@/mocks/vendorData';

const SOCIAL_LINK_HOSTS: Record<'instagram' | 'tiktok', string[]> = {
  instagram: ['instagram.com', 'www.instagram.com'],
  tiktok: ['tiktok.com', 'www.tiktok.com'],
};

export function useStorefrontViewModel(vendor: Vendor) {
  const router = useRouter();
  const safeBack = useSafeBack();
  const layout = useResponsive();

  const { getOrCreateConversation: _getOrCreateConversation, getConversationByPair: _getConversationByPair, startNewInquiry: _startNewInquiry } = useChats();
  void _getOrCreateConversation; void _getConversationByPair; void _startNewInquiry;
  const { handleMessageVendorPress } = useMessageVendor();
  const { user } = useAuth();
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
  const { toastVisible: showCopiedToast, showToast: triggerCopiedToast } = useToast();

  const { items: cartItems, addItem, removeItem, getVendorCart, setActiveVendor } = useCart();
  const { chatMode } = useVendorChatMode();
  const { addRelationship } = useVendorRelationships();
  const { canChat, canAccessAI, canAddToCart } = useVendorStatusPermissions();
  const { isUserBlocked } = useBlockedUsers();
  const isVendorBlocked = isUserBlocked(vendor.id);
  // Plan gate: Basic vendors cannot offer Platform AI to customers at all.
  // Combined with the existing vendor-status gate (UNVERIFIED/SUSPENDED/etc.)
  // which already sets canAccessAI=false. Backend will own the plan tier —
  // Henry can swap `vendor.plan` for a Firestore read later.
  const canUsePlatformAi =
    PLATFORM_AI_CUSTOMER_ENABLED &&
    canAccessAI &&
    vendorPlanAllowsAi(vendor);
  const { trackVendorView } = useRecentlyViewed();
  const { isFavorite, toggleFavorite } = useFavorites();
  const vendorFavorited = isFavorite(vendor.id);

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

  const handleBackPress = () => {
    safeBack();
  };

  const handleMenuPress = async () => {
    // example.com does not resolve, and /@{username} was never the real
    // route anyway — /store/[username].tsx is. Matches shareStorefront.ts's
    // storefrontUrl() so there is one link format, not two.
    const shareUrl = `https://platform-dev.web.app/store/${vendor.username}`;
    try {
      await Clipboard.setStringAsync(shareUrl);
      console.log('[Share Store] URL copied to clipboard:', shareUrl);
      triggerCopiedToast();
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
    const effectivePrice = item.salePrice ?? item.price;
    const hasDiscount = item.salePrice !== undefined && item.salePrice !== null && item.salePrice < item.price;
    addItem({
      id: item.id,
      name: item.name,
      price: effectivePrice,
      originalPrice: hasDiscount ? item.price : undefined,
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
    const effectivePrice = item.salePrice ?? item.price;
    const hasDiscount = item.salePrice !== undefined && item.salePrice !== null && item.salePrice < item.price;
    addItem({
      id: item.id,
      name: item.name,
      price: effectivePrice,
      originalPrice: hasDiscount ? item.price : undefined,
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

  const handleOpenLink = async (url: string, platform: 'website' | 'instagram' | 'tiktok' = 'website') => {
    // Was console.log-only — the Website/Instagram/TikTok rows in the vendor
    // details modal looked tappable but did nothing (same class as the
    // no-op tap targets found elsewhere this session). Matches the
    // Linking.openURL pattern already used for external links, e.g.
    // app/settings/privacy.tsx's handleOpenPrivacyPolicy/handleOpenTerms.
    //
    // Re-validated here rather than trusted as stored: backend normalization
    // (updateVendorStorefront.ts) guards new saves, but a legacy vendor doc
    // written before that validation existed could still hold an unsafe or
    // malformed value. Failing closed with a visible error is safer than
    // silently no-op'ing or handing an arbitrary scheme to Linking.openURL.
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      Alert.alert('Cannot open link', 'This link is not valid.');
      return;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      Alert.alert('Cannot open link', 'This link is not valid.');
      return;
    }
    if (platform !== 'website') {
      const allowedHosts = SOCIAL_LINK_HOSTS[platform];
      if (!allowedHosts.includes(parsed.hostname.toLowerCase())) {
        Alert.alert('Cannot open link', 'This link is not valid.');
        return;
      }
    }
    console.log('Opening link:', url);
    try {
      await Linking.openURL(parsed.toString());
    } catch (error) {
      console.error('[STORE] Failed to open link:', url, error);
      Alert.alert('Cannot open link', 'This link could not be opened.');
    }
  };

  const handleAskAI = () => {
    if (isVendorBlocked) {
      Alert.alert('', 'You cannot initiate communication with this vendor.');
      return;
    }
    if (!canUsePlatformAi) {
      // Basic plan or vendor status blocks AI. Stay silent — the button is
      // hidden in the catalog when canUsePlatformAi is false. This is a guard
      // against any other entry point.
      return;
    }
    console.log('Ask Platform AI pressed for vendor:', vendor.id);
    router.push(`/chat/ai/${vendor.id}` as any);
  };

  const handleMessageVendor = () => {
    if (isVendorBlocked) {
      Alert.alert('', 'You cannot initiate communication with this vendor.');
      return;
    }
    if (!user?.id) {
      // Real messaging requires a real signed-in customer — createCommerceConversation
      // derives the thread's participant from the authenticated request, so there is
      // nothing correct to do here for a signed-out user.
      Alert.alert('', 'Please sign in to message this vendor.');
      return;
    }
    console.log('[STORE] Message vendor pressed, resolving thread for vendor:', vendor.id);
    void handleMessageVendorPress(vendor.id, user.id, vendor.name);
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

  // NOTE: `selectedCategory` is now a navigation/scroll anchor only (DoorDash-style).
  // It no longer filters items — all category sections stay visible so customers can
  // scroll between them. Only the search query filters the list.
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

    return items;
  }, [searchQuery, menuItems]);

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
    showCopiedToast,
    vendorCartCount: currentVendorItemCount,
    cartVisible,
    cartScaleAnim,
    isVendorBlocked,
    vendorFavorited,
    canChat,
    canAccessAI,
    canUsePlatformAi,
    canAddToCart,
    chatMode,
    filteredItems,
    groupedItems,
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
