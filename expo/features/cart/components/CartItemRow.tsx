import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
} from 'react-native';
import { Alert } from '@/utils/alert';
import { Image } from 'expo-image';
import { Minus, Plus } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { CartItem } from '@/contexts/CartContext';
import { formatPriceWithCommas, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';

interface CartItemRowProps {
  item: CartItem;
  index: number;
  updateItemQuantity: (index: number, delta: number) => void;
  removeItemByIndex: (index: number) => void;
  onItemNamePress: (itemId: string, index: number) => void;
  isLocked?: boolean;
}

export function CartItemRow({
  item,
  index,
  updateItemQuantity,
  removeItemByIndex,
  onItemNamePress,
  isLocked = false,
}: CartItemRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const DELETE_THRESHOLD = -80;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        if (isLocked) return false;
        return (
          Math.abs(gestureState.dx) > 5 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
        );
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (isLocked) return;
        if (gestureState.dx < 0) {
          translateX.setValue(Math.max(gestureState.dx, DELETE_THRESHOLD));
        } else if (gestureState.dx > 0) {
          translateX.setValue(Math.min(gestureState.dx * 0.3, 0));
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (isLocked) return;
        if (gestureState.dx < DELETE_THRESHOLD / 2) {
          Animated.spring(translateX, {
            toValue: DELETE_THRESHOLD,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  const handleDelete = () => {
    Alert.alert('Remove Item', `Remove ${item.name} from cart?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          Animated.timing(translateX, {
            toValue: -500,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            removeItemByIndex(index);
          });
        },
      },
    ]);
  };

  const addOnTotal =
    item.addOns?.reduce((sum: number, addOn) => sum + addOn.price, 0) || 0;
  const unitPrice = item.price + addOnTotal;
  const lineTotal = unitPrice * item.quantity;
  const hasOriginalPrice = item.originalPrice !== undefined && item.originalPrice > item.price;
  const originalUnitPrice = hasOriginalPrice ? (item.originalPrice! + addOnTotal) : undefined;
  const unitSavings = hasOriginalPrice ? (item.originalPrice! - item.price) : 0;
  const lineSavings = unitSavings * item.quantity;

  const vendorCurrency: Currency =
    (mockVendor.currency as Currency) ||
    getCurrencyFromCountryCode(mockVendor.countryCode);

  return (
    <View style={styles.swipeableContainer}>
      {!isLocked && (
        <View style={styles.deleteButtonContainer}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      <Animated.View
        style={[styles.cartItem, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          onPress={() => onItemNamePress(item.id, index)}
          activeOpacity={0.7}
          style={styles.tappableRow}
        >
          <View style={styles.mediaRowContainer}>
            <View style={styles.itemImageContainer}>
              {item.image ? (
                <Image
                  source={{ uri: item.image }}
                  style={styles.itemImage}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.itemImagePlaceholder}>
                  <Text style={styles.itemImagePlaceholderText}>
                    {item.name.charAt(0)}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.itemDetailsContainer}>
              <View style={styles.itemTopRow}>
                <View style={styles.itemInfoLeft}>
                  <Text style={styles.cartItemName}>{item.name}</Text>
                  <View style={styles.unitPriceRow}>
                    {hasOriginalPrice && originalUnitPrice !== undefined && (
                      <Text style={styles.unitPriceStrike}>
                        {formatPriceWithCommas(originalUnitPrice, vendorCurrency)}
                      </Text>
                    )}
                    <Text style={[styles.unitPriceText, hasOriginalPrice && styles.unitPriceSale]}>
                      {formatPriceWithCommas(unitPrice, vendorCurrency)} each
                    </Text>
                  </View>
                  {item.addOns && item.addOns.length > 0 && (
                    <View style={styles.addOnsCompact}>
                      {item.addOns.map((addOn, idx) => (
                        <Text key={addOn.id} style={styles.addOnCompactItem}>
                          {idx > 0 && ' • '}
                          {addOn.name}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.itemBottomRow}>
                <View
                  style={styles.quantityControls}
                  onStartShouldSetResponder={() => true}
                  onTouchEnd={(e) => e.stopPropagation()}
                >
                  <TouchableOpacity
                    style={[
                      styles.quantityButton,
                      isLocked && styles.quantityButtonLocked,
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      if (!isLocked) updateItemQuantity(index, -1);
                    }}
                    activeOpacity={isLocked ? 1 : 0.7}
                    disabled={isLocked}
                  >
                    <Minus
                      size={14}
                      color={isLocked ? Colors.textMuted : Colors.text}
                    />
                  </TouchableOpacity>
                  <Text
                    style={[
                      styles.quantityValue,
                      isLocked && styles.quantityValueLocked,
                    ]}
                  >
                    {item.quantity}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.quantityButton,
                      isLocked && styles.quantityButtonLocked,
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      if (!isLocked) updateItemQuantity(index, 1);
                    }}
                    activeOpacity={isLocked ? 1 : 0.7}
                    disabled={isLocked}
                  >
                    <Plus
                      size={14}
                      color={isLocked ? Colors.textMuted : Colors.text}
                    />
                  </TouchableOpacity>
                </View>
                <View style={styles.lineTotalBlock}>
                  <Text style={styles.lineTotalText}>
                    {formatPriceWithCommas(lineTotal, vendorCurrency)}
                  </Text>
                  {lineSavings > 0 && (
                    <Text style={styles.lineSavingsText}>
                      Saved {formatPriceWithCommas(lineSavings, vendorCurrency)}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeableContainer: {
    position: 'relative',
    marginBottom: 0,
  },
  deleteButtonContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: Colors.error,
    height: '100%' as any,
    width: '100%' as any,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  cartItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: Colors.white,
  },
  tappableRow: {
    flex: 1,
  },
  mediaRowContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  itemImage: {
    width: '100%' as any,
    height: '100%' as any,
  },
  itemImagePlaceholder: {
    width: '100%' as any,
    height: '100%' as any,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemImagePlaceholderText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  itemDetailsContainer: {
    flex: 1,
    gap: 8,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  itemInfoLeft: {
    flex: 1,
    gap: 2,
  },
  cartItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 20,
  },
  unitPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unitPriceText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '400',
  },
  unitPriceSale: {
    color: Colors.primary,
    fontWeight: '600',
  },
  unitPriceStrike: {
    fontSize: 12,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  addOnsCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  addOnCompactItem: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  itemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quantityButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  quantityButtonLocked: {
    borderColor: Colors.surface,
    backgroundColor: Colors.surface,
    opacity: 0.5,
  },
  quantityValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    minWidth: 20,
    textAlign: 'center',
  },
  quantityValueLocked: {
    color: Colors.textMuted,
  },
  lineTotalBlock: {
    alignItems: 'flex-end' as const,
  },
  lineTotalText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2B2B2B',
  },
  lineSavingsText: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: '#16A34A',
    marginTop: 1,
  },
});
