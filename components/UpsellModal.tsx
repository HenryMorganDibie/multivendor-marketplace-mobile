import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { X, Plus, Minus } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { MenuItem, mockVendor } from '@/mocks/vendorData';
import { CartItem } from '@/contexts/CartContext';
import { formatPriceWithCommas, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';
import { getMenuItemDisplayPrice } from '@/utils/itemPricing';
import { ItemDetailsModal } from '@/components/ItemDetailsModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_WIDTH = (SCREEN_WIDTH - 48 - 12) / 2;

interface UpsellItem extends MenuItem {
  upsellQty: number;
}

interface UpsellModalProps {
  visible: boolean;
  vendorName: string;
  vendorId: string;
  suggestions: MenuItem[];
  cartItems: CartItem[];
  onAddItem: (item: Omit<CartItem, 'quantity'>, vendorId: string) => void;
  onContinue: () => void;
  onDismiss: () => void;
}

export function UpsellModal({
  visible,
  vendorName: _vendorName,
  vendorId,
  suggestions,
  cartItems,
  onAddItem,
  onContinue,
  onDismiss,
}: UpsellModalProps) {
  const slideAnim = useRef(new Animated.Value(500)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [upsellItems, setUpsellItems] = useState<UpsellItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const addedCount = upsellItems.reduce((sum, i) => sum + i.upsellQty, 0);

  useEffect(() => {
    const cartItemIds = new Set(cartItems.map((i) => i.id));
    const filtered = suggestions
      .filter((item) => item.inStock && !cartItemIds.has(item.id))
      .slice(0, 6)
      .map((item) => ({ ...item, upsellQty: 0 }));
    setUpsellItems(filtered);
  }, [suggestions, cartItems]);

  useEffect(() => {
    if (visible) {
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
          toValue: 500,
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
  }, [visible, slideAnim, backdropAnim]);

  const handleQtyChange = (itemId: string, delta: number) => {
    setUpsellItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const next = Math.max(0, item.upsellQty + delta);
        return { ...item, upsellQty: next };
      })
    );
  };

  const handleItemCardPress = useCallback((item: UpsellItem) => {
    console.log('[UPSELL] Opening item details modal for:', item.name);
    setSelectedItem(item);
  }, []);

  const handleModalAddToCart = useCallback(
    (cartItem: Omit<import('@/contexts/CartContext').CartItem, 'quantity'>, vid: string, qty: number) => {
      console.log('[UPSELL] Item added from modal:', cartItem.name);
      setUpsellItems((prev) =>
        prev.map((i) =>
          i.id === cartItem.id ? { ...i, upsellQty: i.upsellQty + qty } : i
        )
      );
    },
    []
  );

  const handleContinue = () => {
    upsellItems.forEach((item) => {
      if (item.upsellQty > 0) {
        for (let i = 0; i < item.upsellQty; i++) {
          onAddItem(
            {
              id: item.id,
              name: item.name,
              price: getMenuItemDisplayPrice(item),
              image: item.image,
            },
            vendorId
          );
        }
      }
    });
    console.log(`[UPSELL] Added ${addedCount} item(s) from upsell for vendor ${vendorId}`);
    onContinue();
  };

  if (upsellItems.length === 0 && !visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View
          style={[styles.backdrop, { opacity: backdropAnim }]}
          pointerEvents="box-only"
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onDismiss} activeOpacity={1} />
        </Animated.View>

        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
        >
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.headerTextBlock}>
              <Text style={styles.title} numberOfLines={1}>
                Add more to your order?
              </Text>
              <Text style={styles.subtitle}>Customers often add these</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onDismiss} activeOpacity={0.7}>
              <X size={18} color={Colors.textSecondary} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.grid}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.gridContent}
          >
            <View style={styles.row}>
              {upsellItems.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.card,
                    index % 2 === 0 ? styles.cardLeft : styles.cardRight,
                  ]}
                  onPress={() => handleItemCardPress(item)}
                  activeOpacity={0.85}
                >
                  <View style={styles.imageWrapper}>
                    {item.image ? (
                      <Image
                        source={{ uri: item.image }}
                        style={styles.itemImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Text style={styles.imagePlaceholderText}>
                          {item.name.charAt(0)}
                        </Text>
                      </View>
                    )}
                    {item.upsellQty > 0 && (
                      <View style={styles.qtyBadge}>
                        <Text style={styles.qtyBadgeText}>{item.upsellQty}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardBody}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    {item.salePrice !== undefined && item.salePrice > 0 && item.salePrice < item.price ? (
                      <View style={styles.priceRow}>
                        <Text style={styles.itemPriceStrike}>
                          {formatPriceWithCommas(item.price, (mockVendor.currency as Currency) || getCurrencyFromCountryCode(mockVendor.countryCode))}
                        </Text>
                        <Text style={styles.itemPriceSale}>
                          {formatPriceWithCommas(item.salePrice, (mockVendor.currency as Currency) || getCurrencyFromCountryCode(mockVendor.countryCode))}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.itemPrice}>
                        {formatPriceWithCommas(item.price, (mockVendor.currency as Currency) || getCurrencyFromCountryCode(mockVendor.countryCode))}
                      </Text>
                    )}

                    <View style={styles.cardFooter}>
                      {item.upsellQty === 0 ? (
                        <TouchableOpacity
                          style={styles.addBtn}
                          onPress={() => handleQtyChange(item.id, 1)}
                          activeOpacity={0.8}
                        >
                          <Plus size={14} color={Colors.white} strokeWidth={2.5} />
                          <Text style={styles.addBtnText}>Add</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.stepper}>
                          <TouchableOpacity
                            style={styles.stepBtn}
                            onPress={() => handleQtyChange(item.id, -1)}
                            activeOpacity={0.7}
                          >
                            <Minus size={13} color={Colors.text} strokeWidth={2.5} />
                          </TouchableOpacity>
                          <Text style={styles.stepValue}>{item.upsellQty}</Text>
                          <TouchableOpacity
                            style={styles.stepBtn}
                            onPress={() => handleQtyChange(item.id, 1)}
                            activeOpacity={0.7}
                          >
                            <Plus size={13} color={Colors.text} strokeWidth={2.5} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.continueBtn}
              onPress={handleContinue}
              activeOpacity={0.88}
            >
              <Text style={styles.continueBtnText}>
                {addedCount > 0
                  ? `Continue to Checkout (+${addedCount} item${addedCount !== 1 ? 's' : ''})`
                  : 'Continue to Checkout'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

      <ItemDetailsModal
        visible={selectedItem !== null}
        item={selectedItem}
        vendorId={vendorId}
        onAddToCart={handleModalAddToCart}
        onClose={() => setSelectedItem(null)}
      />
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
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '82%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.10,
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTextBlock: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 3,
    fontWeight: '400',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  grid: {
    flex: 1,
  },
  gridContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    width: ITEM_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLeft: {
    marginRight: 6,
  },
  cardRight: {
    marginLeft: 6,
  },
  imageWrapper: {
    width: '100%',
    height: 110,
    position: 'relative',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  qtyBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  cardBody: {
    padding: 10,
    gap: 4,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 18,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  priceRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  itemPriceStrike: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: Colors.textMuted,
    textDecorationLine: 'line-through' as const,
  },
  itemPriceSale: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#16A34A',
  },
  cardFooter: {
    marginTop: 6,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.text,
    borderRadius: 8,
    paddingVertical: 7,
    gap: 4,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  stepValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    minWidth: 20,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.white,
  },
  continueBtn: {
    backgroundColor: Colors.text,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    letterSpacing: -0.2,
  },
});
