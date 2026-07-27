import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import { Image } from 'expo-image';
import { Minus, Plus, Zap } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { MenuItem, mockMenuItems, mockVendor } from '@/mocks/vendorData';
import { CartItem } from '@/contexts/CartContext';
import { formatPriceWithCommas, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';
import { getMenuItemDisplayPrice, hasItemSalePrice } from '@/utils/itemPricing';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CartItemEditModalProps {
  visible: boolean;
  cartItem: CartItem | null;
  cartItemIndex: number;
  onUpdateQuantity: (index: number, delta: number) => void;
  onClose: () => void;
}

export function CartItemEditModal({
  visible,
  cartItem,
  cartItemIndex,
  onUpdateQuantity,
  onClose,
}: CartItemEditModalProps) {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const [localQuantity, setLocalQuantity] = useState(1);

  const vendorCurrency: Currency =
    (mockVendor.currency as Currency) || getCurrencyFromCountryCode(mockVendor.countryCode);

  const menuItem = useMemo(() => {
    if (!cartItem) return undefined;
    return mockMenuItems.find((m) => m.id === cartItem.id);
  }, [cartItem]);

  const basePrice = menuItem?.price ?? cartItem?.price ?? 0;
  const displayPrice = menuItem ? getMenuItemDisplayPrice(menuItem) : (cartItem?.price ?? 0);
  const hasSale = hasItemSalePrice(menuItem, undefined);

  const addOnTotal = cartItem?.addOns?.reduce((sum, a) => sum + a.price, 0) ?? 0;
  const unitPrice = displayPrice + addOnTotal;

  useEffect(() => {
    if (visible && cartItem) {
      setLocalQuantity(cartItem.quantity);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 230,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, cartItem, slideAnim, backdropAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 12,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) {
          slideAnim.setValue(g.dy);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.8) {
          handleClose();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    })
  ).current;

  const handleClose = () => {
    onClose();
  };

  const handleUpdate = () => {
    if (!cartItem) return;
    const delta = localQuantity - cartItem.quantity;
    if (delta !== 0) {
      onUpdateQuantity(cartItemIndex, delta);
    }
    onClose();
  };

  if (!cartItem) return null;

  const grandTotal = unitPrice * localQuantity;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View
          style={[styles.backdrop, { opacity: backdropAnim }]}
          pointerEvents="box-only"
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1} />
        </Animated.View>

        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
        >
          <View {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContentContainer}
            bounces={false}
          >
            {cartItem.image ? (
              <Image
                source={{ uri: cartItem.image }}
                style={styles.heroImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.heroImage, styles.heroPlaceholder]}>
                <Text style={styles.heroPlaceholderText}>{cartItem.name.charAt(0)}</Text>
              </View>
            )}

            <View style={styles.infoSection}>
              <Text style={styles.itemName} numberOfLines={2}>{cartItem.name}</Text>

              <View style={styles.priceBlock}>
                {hasSale ? (
                  <View style={styles.priceRow}>
                    <Text style={styles.salePrice}>
                      {formatPriceWithCommas(displayPrice, vendorCurrency)}
                    </Text>
                    <Text style={styles.originalPrice}>
                      {formatPriceWithCommas(basePrice, vendorCurrency)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.regularPrice}>
                    {formatPriceWithCommas(displayPrice, vendorCurrency)}
                  </Text>
                )}
              </View>

              {hasSale && (
                <View style={styles.promoRow}>
                  <View style={styles.promoBadge}>
                    <Zap size={10} color="#FFFFFF" fill="#FFFFFF" />
                    <Text style={styles.promoBadgeText}>Promo applied</Text>
                  </View>
                </View>
              )}

              {menuItem?.description ? (
                <Text style={styles.description} numberOfLines={3}>{menuItem.description}</Text>
              ) : null}

              {cartItem.addOns && cartItem.addOns.length > 0 && (
                <View style={styles.addOnsSection}>
                  <Text style={styles.addOnsLabel}>Add-ons</Text>
                  {cartItem.addOns.map((addOn) => (
                    <View key={addOn.id} style={styles.addOnRow}>
                      <Text style={styles.addOnName}>{addOn.name}</Text>
                      <Text style={styles.addOnPrice}>
                        +{formatPriceWithCommas(addOn.price, vendorCurrency)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.quantityCard}>
              <Text style={styles.quantityLabel}>Quantity</Text>
              <View style={styles.qtyControls}>
                <TouchableOpacity
                  style={[styles.qtyBtn, localQuantity <= 1 && styles.qtyBtnDisabled]}
                  onPress={() => localQuantity > 1 && setLocalQuantity((q) => q - 1)}
                  disabled={localQuantity <= 1}
                  activeOpacity={0.7}
                >
                  <Minus size={18} color={localQuantity <= 1 ? '#BDBDBD' : Colors.text} />
                </TouchableOpacity>
                <Text style={styles.qtyValue}>{localQuantity}</Text>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setLocalQuantity((q) => q + 1)}
                  activeOpacity={0.7}
                >
                  <Plus size={18} color={Colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ height: 80 }} />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleUpdate}
              activeOpacity={0.88}
            >
              <Text style={styles.ctaButtonText}>
                Update cart · {formatPriceWithCommas(grandTotal, vendorCurrency)}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 0,
  },
  heroImage: {
    width: '100%',
    height: 200,
  },
  heroPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8E8E8',
  },
  heroPlaceholderText: {
    fontSize: 36,
    fontWeight: '700' as const,
    color: Colors.textMuted,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  itemName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    lineHeight: 26,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  priceBlock: {
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  salePrice: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  originalPrice: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  regularPrice: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  promoRow: {
    flexDirection: 'row' as const,
    marginBottom: 10,
  },
  promoBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: '#16A34A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  promoBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  addOnsSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  addOnsLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  addOnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  addOnName: {
    fontSize: 14,
    color: Colors.text,
  },
  addOnPrice: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  quantityCard: {
    backgroundColor: Colors.white,
    borderTopWidth: 8,
    borderTopColor: '#F5F5F7',
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  qtyBtnDisabled: {
    borderColor: '#EFEFEF',
    backgroundColor: '#F8F9FA',
  },
  qtyValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    minWidth: 28,
    textAlign: 'center' as const,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.white,
  },
  ctaButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
    letterSpacing: -0.2,
  },
});
