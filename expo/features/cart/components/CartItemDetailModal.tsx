import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
  Image,
} from 'react-native';
import { Minus, Plus, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { CartItem } from '@/contexts/CartContext';
import { mockMenuItems } from '@/mocks/vendorData';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';

interface CartItemDetailModalProps {
  visible: boolean;
  item: CartItem | null;
  itemIndex: number;
  currency: Currency;
  onClose: () => void;
  onUpdateQuantity: (index: number, delta: number) => void;
  onRemove: (index: number) => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

export function CartItemDetailModal({
  visible,
  item,
  itemIndex,
  currency,
  onClose,
  onUpdateQuantity,
  onRemove,
}: CartItemDetailModalProps) {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [localQty, setLocalQty] = useState(item?.quantity ?? 1);

  const menuItem = useMemo(() => {
    if (!item) return null;
    return mockMenuItems.find((m) => m.id === item.id) ?? null;
  }, [item]);

  const basePrice = menuItem?.price ?? item?.price ?? 0;
  const salePrice = menuItem?.salePrice;
  const displayPrice = salePrice ?? basePrice;
  const addOnsTotal = item?.addOns?.reduce((s, a) => s + a.price, 0) ?? 0;
  const unitPrice = displayPrice + addOnsTotal;
  const lineTotal = unitPrice * localQty;

  useEffect(() => {
    if (visible && item) {
      setLocalQty(item.quantity);
      slideAnim.setValue(SCREEN_HEIGHT);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    }
  }, [visible, item, slideAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gs) =>
        gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_evt, gs) => {
        if (gs.dy > 0) slideAnim.setValue(gs.dy);
      },
      onPanResponderRelease: (_evt, gs) => {
        if (gs.dy > 80 || gs.vy > 0.5) {
          Animated.timing(slideAnim, {
            toValue: SCREEN_HEIGHT,
            duration: 240,
            useNativeDriver: true,
          }).start(onClose);
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start();
        }
      },
    })
  ).current;

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 240,
      useNativeDriver: true,
    }).start(onClose);
  };

  const handleDecrement = () => {
    if (localQty <= 1) return;
    setLocalQty((q) => q - 1);
  };

  const handleIncrement = () => {
    setLocalQty((q) => q + 1);
  };

  const handleUpdate = () => {
    if (!item) return;
    const delta = localQty - item.quantity;
    if (delta !== 0) {
      onUpdateQuantity(itemIndex, delta);
    }
    handleClose();
  };

  const handleRemove = () => {
    onRemove(itemIndex);
    handleClose();
  };

  if (!item) return null;

  const ctaLabel = `Update cart · ${formatPriceWithCommas(lineTotal, currency)}`;
  const hasChanged = localQty !== item.quantity;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleClose}
      >
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
        >
          <TouchableOpacity activeOpacity={1}>
            <View {...panResponder.panHandlers} style={styles.handleArea}>
              <View style={styles.handle} />
            </View>

            {item.image ? (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: item.image }}
                  style={styles.image}
                  resizeMode="cover"
                />
              </View>
            ) : null}

            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.contentContainer}
            >
              <View style={styles.nameRow}>
                <Text style={styles.itemName}>{item.name}</Text>
                <TouchableOpacity onPress={handleRemove} style={styles.removeBtn} activeOpacity={0.7}>
                  <X size={16} color={Colors.error} />
                </TouchableOpacity>
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.priceMain}>
                  {formatPriceWithCommas(displayPrice, currency)}
                </Text>
                {salePrice !== undefined && (
                  <Text style={styles.priceStrike}>
                    {formatPriceWithCommas(basePrice, currency)}
                  </Text>
                )}
              </View>

              {menuItem?.description ? (
                <Text style={styles.description}>{menuItem.description}</Text>
              ) : null}

              {item.addOns && item.addOns.length > 0 && (
                <View style={styles.addOnsBlock}>
                  <Text style={styles.addOnsLabel}>Add-ons</Text>
                  {item.addOns.map((a) => (
                    <View key={a.id} style={styles.addOnRow}>
                      <Text style={styles.addOnName}>{a.name}</Text>
                      <Text style={styles.addOnPrice}>+{formatPriceWithCommas(a.price, currency)}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.qtyRow}>
                <Text style={styles.qtyLabel}>Quantity</Text>
                <View style={styles.qtyControls}>
                  <TouchableOpacity
                    style={[styles.qtyBtn, localQty <= 1 && styles.qtyBtnDisabled]}
                    onPress={handleDecrement}
                    disabled={localQty <= 1}
                    activeOpacity={0.7}
                  >
                    <Minus size={16} color={localQty <= 1 ? Colors.textMuted : Colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{localQty}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={handleIncrement}
                    activeOpacity={0.7}
                  >
                    <Plus size={16} color={Colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.ctaButton, !hasChanged && styles.ctaButtonSecondary]}
                onPress={hasChanged ? handleUpdate : handleClose}
                activeOpacity={0.85}
              >
                <Text style={[styles.ctaText, !hasChanged && styles.ctaTextSecondary]}>
                  {hasChanged ? ctaLabel : 'Done'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    overflow: 'hidden',
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
  },
  imageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#F5F5F5',
  },
  image: {
    width: '100%',
    height: 200,
  },
  content: {
    maxHeight: 340,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  itemName: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  priceMain: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  priceStrike: {
    fontSize: 14,
    fontWeight: '400',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  addOnsBlock: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  addOnsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  addOnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  addOnName: {
    fontSize: 13,
    color: '#4B5563',
  },
  addOnPrice: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginTop: 4,
  },
  qtyLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
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
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  qtyBtnDisabled: {
    borderColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
  },
  qtyValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    minWidth: 28,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  ctaButton: {
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonSecondary: {
    backgroundColor: '#F3F4F6',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ctaTextSecondary: {
    color: '#6B7280',
  },
});
