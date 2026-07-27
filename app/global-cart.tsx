import React, { useRef, useState } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Animated,
  PanResponder,
} from 'react-native';
import { useResponsive } from '@/constants/layout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Receipt, ShoppingCart, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafeBack } from '@/utils/useSafeBack';
import { useCart } from '@/contexts/CartContext';
import { getVendorStorefrontPath } from '@/utils/vendorLookup';
import { formatPriceWithCommas, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';
import { mockVendors } from '@/mocks/vendorData';

export default function GlobalCartScreen() {
  const router = useRouter();
  const layout = useResponsive();
  const { vendorCarts, vendorCartCount, clearCart } = useCart();
  const [confirmModal, setConfirmModal] = useState<{ visible: boolean; vendorId: string; vendorName: string }>({
    visible: false,
    vendorId: '',
    vendorName: '',
  });

  const safeBack = useSafeBack();

  const handleBackPress = () => {
    safeBack();
  };

  const handleOrdersPress = () => {
    console.log('Navigate to orders screen');
    router.push('/orders' as any);
  };

  const handleViewCart = (vendorId: string) => {
    console.log('View cart for vendor:', vendorId);
    router.push({
      pathname: '/cart' as any,
      params: { vendorId },
    });
  };

  const handleViewStore = (vendorId: string) => {
    console.log('View store for vendor:', vendorId);
    router.push(getVendorStorefrontPath(vendorId) as any);
  };

  const handleRemoveCart = (vendorId: string, vendorName: string) => {
    setConfirmModal({ visible: true, vendorId, vendorName });
  };

  const handleConfirmRemove = () => {
    clearCart(confirmModal.vendorId);
    console.log('Cart removed for vendor:', confirmModal.vendorId);
    setConfirmModal({ visible: false, vendorId: '', vendorName: '' });
  };

  const handleCancelRemove = () => {
    setConfirmModal({ visible: false, vendorId: '', vendorName: '' });
  };

  const getCartTotal = (vendorId: string) => {
    const cart = vendorCarts.find((c) => c.vendorId === vendorId);
    if (!cart) return 0;
    return cart.items.reduce((sum, item) => {
      const addOnTotal = item.addOns?.reduce((addOnSum, addOn) => addOnSum + addOn.price, 0) || 0;
      return sum + (item.price + addOnTotal) * item.quantity;
    }, 0);
  };

  const getCartItemCount = (vendorId: string) => {
    const cart = vendorCarts.find((c) => c.vendorId === vendorId);
    if (!cart) return 0;
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const hPad = layout.horizontalPadding;

  if (vendorCartCount === 0) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={[styles.header, { paddingHorizontal: hPad }]}>
            <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
              <ChevronLeft size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Cart</Text>
            <TouchableOpacity onPress={handleOrdersPress} style={styles.ordersButton}>
              <Receipt size={16} color={Colors.textMuted} />
              <Text style={styles.ordersText}>Orders</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <View style={styles.emptyCart}>
          <ShoppingCart size={64} color={Colors.textSecondary} />
          <Text style={styles.emptyCartText}>Your cart is empty</Text>
          <Text style={styles.emptyCartSubtext}>Add items from vendors to get started</Text>
          <TouchableOpacity style={styles.browseVendorsButton} onPress={() => router.push('/' as any)}>
            <Text style={styles.browseVendorsText}>Browse vendors</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={[styles.header, { paddingHorizontal: hPad }]}>
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cart</Text>
          <TouchableOpacity onPress={handleOrdersPress} style={styles.ordersButton}>
            <Receipt size={16} color={Colors.textMuted} />
            <Text style={styles.ordersText}>Orders</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.sectionHeaderRow, { paddingHorizontal: hPad }]}>
          <Text style={styles.sectionHeaderText}>Active Vendor Carts</Text>
          <Text style={styles.sectionHeaderCount}>{vendorCartCount}</Text>
        </View>

        <View style={[styles.vendorCardsContainer, { paddingHorizontal: hPad }]}>
          {vendorCarts.map((cart) => {
            const itemCount = getCartItemCount(cart.vendorId);
            const total = getCartTotal(cart.vendorId);

            return (
              <SwipeableVendorCard
                key={cart.vendorId}
                cart={cart}
                itemCount={itemCount}
                total={total}
                onRemove={() => handleRemoveCart(cart.vendorId, cart.vendorName)}
                onViewStore={() => handleViewStore(cart.vendorId)}
                onViewCart={() => handleViewCart(cart.vendorId)}
              />
            );
          })}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal
        visible={confirmModal.visible}
        animationType="fade"
        transparent
        onRequestClose={handleCancelRemove}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>Remove Cart</Text>
            <Text style={styles.confirmBody}>
              Remove all items from {confirmModal.vendorName}?
            </Text>
            <TouchableOpacity
              style={styles.confirmRemoveButton}
              onPress={handleConfirmRemove}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmRemoveText}>Remove Cart</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmCancelButton}
              onPress={handleCancelRemove}
              activeOpacity={0.7}
            >
              <Text style={styles.confirmCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

interface SwipeableVendorCardProps {
  cart: any;
  itemCount: number;
  total: number;
  onRemove: () => void;
  onViewStore: () => void;
  onViewCart: () => void;
}

const CART_REVEAL_WIDTH = 110;

function SwipeableVendorCard({ cart, itemCount, total, onRemove, onViewStore, onViewCart }: SwipeableVendorCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;

  const vendorMatch = mockVendors.find(v => v.id === cart.vendorId);
  const vendorDisplayName = vendorMatch?.name || cart.vendorId;
  const vendorCurrency: Currency = (vendorMatch?.currency as Currency) || getCurrencyFromCountryCode(vendorMatch?.countryCode || 'NG');

  const springClose = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 20,
    }).start();
  };

  const springOpen = () => {
    Animated.spring(translateX, {
      toValue: -CART_REVEAL_WIDTH,
      useNativeDriver: true,
      tension: 80,
      friction: 20,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(Math.max(gestureState.dx, -CART_REVEAL_WIDTH));
        } else if (gestureState.dx > 0) {
          translateX.setValue(Math.min(gestureState.dx * 0.15, 0));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -CART_REVEAL_WIDTH / 2) {
          springOpen();
        } else {
          springClose();
        }
      },
    })
  ).current;

  const handleDeletePress = () => {
    springClose();
    setTimeout(() => onRemove(), 120);
  };

  return (
    <View style={styles.swipeableContainer}>
      <View style={styles.deleteActionContainer}>
        <TouchableOpacity
          onPress={handleDeletePress}
          style={styles.deleteAction}
          activeOpacity={0.85}
        >
          <Trash2 size={20} color='#FFFFFF' />
          <Text style={styles.deleteActionLabel}>Remove</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[styles.vendorCard, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.vendorCardHeader}>
          <View style={styles.vendorAvatar}>
            <Text style={styles.vendorAvatarText}>{(cart.vendorName || vendorDisplayName).charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.vendorCardHeaderInfo}>
            <Text style={styles.vendorName} numberOfLines={1}>{cart.vendorName || vendorDisplayName}</Text>
            <Text style={styles.vendorCardMeta}>
              {itemCount} item{itemCount !== 1 ? 's' : ''} · {formatPriceWithCommas(total, vendorCurrency)}
            </Text>
          </View>
        </View>

        <View style={styles.vendorCardActions}>
          <TouchableOpacity
            style={styles.viewStoreButton}
            onPress={onViewStore}
            activeOpacity={0.7}
          >
            <Text style={styles.viewStoreButtonText}>View store</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.viewCartButton}
            onPress={onViewCart}
            activeOpacity={0.7}
          >
            <Text style={styles.viewCartButtonText}>View cart</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  safeArea: {
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  ordersButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
    borderRadius: 16,
  },
  ordersText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  content: {
    flex: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 8,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  sectionHeaderCount: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    backgroundColor: '#EAEAEA',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 8,
    overflow: 'hidden' as const,
  },
  vendorCardsContainer: {
    gap: 10,
  },
  swipeableContainer: {
    position: 'relative' as const,
  },
  deleteActionContainer: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    bottom: 0,
    width: CART_REVEAL_WIDTH,
    backgroundColor: '#D92D20',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden' as const,
  },
  deleteAction: {
    flex: 1,
    width: '100%' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  deleteActionLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  vendorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  vendorCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 12,
  },
  vendorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  vendorAvatarText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  vendorCardHeaderInfo: {
    flex: 1,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 3,
  },
  vendorCardMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  vendorCardActions: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  viewStoreButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#FFFFFF',
    minHeight: 42,
  },
  viewStoreButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  viewCartButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.primary,
    minHeight: 42,
  },
  viewCartButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  emptyCart: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 40,
  },
  emptyCartText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 24,
    marginBottom: 8,
  },
  emptyCartSubtext: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginBottom: 32,
  },
  browseVendorsButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  browseVendorsText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  bottomSpacer: {
    height: 40,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 28,
  },
  confirmModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%' as const,
    maxWidth: 480,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  confirmBody: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 24,
  },
  confirmRemoveButton: {
    backgroundColor: '#E53935',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center' as const,
    marginBottom: 10,
  },
  confirmRemoveText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  confirmCancelButton: {
    paddingVertical: 12,
    alignItems: 'center' as const,
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.textMuted,
  },
});
