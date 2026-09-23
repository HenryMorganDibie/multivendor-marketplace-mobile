import React, { useState, useMemo, useRef, useEffect } from 'react';
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
import { X, Minus, Plus, Zap, Check } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { MenuItem, mockVendor } from '@/mocks/vendorData';
import { CartItem } from '@/contexts/CartContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { formatPriceWithCommas, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';
import { getMenuItemDisplayPrice, hasItemSalePrice } from '@/utils/itemPricing';
import { getActivePromotions } from '@/mocks/promotionsData';
import { usePrimeVendorPromotions } from '@/contexts/PromoContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_HEIGHT = Math.round(SCREEN_WIDTH * 0.55);

interface ItemDetailsModalProps {
  visible: boolean;
  item: MenuItem | null;
  vendorId: string;
  onAddToCart: (item: Omit<CartItem, 'quantity'>, vendorId: string, quantity: number) => void;
  onClose: () => void;
}

function getGroupSubtext(group: { isRequired: boolean; selectionType: 'radio' | 'checkbox'; options: { id: string }[] }): string {
  if (group.selectionType === 'radio') {
    return group.isRequired ? 'Required · Select 1' : 'Optional · Select 1';
  }
  const max = group.options.length;
  return group.isRequired
    ? 'Required · Select at least 1'
    : `Optional · Select up to ${max}`;
}

export function ItemDetailsModal({
  visible,
  item,
  vendorId,
  onAddToCart,
  onClose,
}: ItemDetailsModalProps) {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const { getItemById } = useCatalog();

  const [quantity, setQuantity] = useState(1);
  const [selectedAddOns, setSelectedAddOns] = useState<Map<string, string[]>>(new Map());

  const catalogItem = item ? getItemById(item.id) : undefined;

  const vendorCurrency: Currency =
    (mockVendor.currency as Currency) || getCurrencyFromCountryCode(mockVendor.countryCode);

  useEffect(() => {
    if (visible && item) {
      setQuantity(1);
      setSelectedAddOns(new Map());
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
  }, [visible, item, slideAnim, backdropAnim]);

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
          onClose();
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

  const selectedAddOnObjects = useMemo(() => {
    if (!catalogItem?.addOnGroups) return [];
    const all: { id: string; groupId: string; name: string; price: number }[] = [];
    catalogItem.addOnGroups.forEach((group) => {
      const sel = selectedAddOns.get(group.id) || [];
      group.options.forEach((opt) => {
        if (sel.includes(opt.id)) {
          // groupId is required by repriceCart.ts's (groupId, optionId) lookup
          // — same fix as app/item/[id].tsx's selectedAddOnObjects. This
          // modal is a second, separate add-to-cart entry point with the
          // identical bug: a selected add-on silently priced at 0 server-side.
          all.push({ id: opt.id, groupId: group.id, name: opt.name, price: opt.price || 0 });
        }
      });
    });
    return all;
  }, [catalogItem?.addOnGroups, selectedAddOns]);

  const addOnsTotal = useMemo(
    () => selectedAddOnObjects.reduce((s, a) => s + a.price, 0),
    [selectedAddOnObjects]
  );

  const requiredGroupsFilled = useMemo(() => {
    if (!catalogItem?.addOnGroups) return true;
    return catalogItem.addOnGroups.every((g) => {
      if (!g.isRequired) return true;
      return (selectedAddOns.get(g.id) || []).length > 0;
    });
  }, [catalogItem?.addOnGroups, selectedAddOns]);

  const promoVersion = usePrimeVendorPromotions(vendorId);
  const itemPromoBadges = useMemo(() => {
    if (!vendorId || !item) return [];
    const activePromos = getActivePromotions(vendorId);
    const badges: string[] = [];
    for (const promo of activePromos) {
      if (promo.applicableItemIds?.includes(item.id)) {
        switch (promo.type) {
          case 'bogo': badges.push('BUY 1 GET 1'); break;
          case 'free_item': badges.push('FREE ITEM'); break;
          default: badges.push('OFFER'); break;
        }
      }
    }
    return badges;
  }, [vendorId, item, promoVersion]);

  if (!item) return null;

  const basePrice = catalogItem?.basePrice ?? item.price;
  const salePrice = catalogItem?.salePrice ?? item.salePrice;
  const displayPrice = salePrice ?? basePrice;
  const hasSale = salePrice !== undefined && salePrice > 0 && salePrice < basePrice;

  const itemTotal = displayPrice * quantity;
  const addOnsTotalWithQty = addOnsTotal * quantity;
  const grandTotal = itemTotal + addOnsTotalWithQty;

  const ctaEnabled = item.inStock && requiredGroupsFilled && quantity > 0;

  const toggleAddOn = (groupId: string, optionId: string, selType: 'radio' | 'checkbox', maxSel: number) => {
    setSelectedAddOns((prev) => {
      const next = new Map(prev);
      const cur = next.get(groupId) || [];
      if (selType === 'radio') {
        next.set(groupId, [optionId]);
      } else {
        if (cur.includes(optionId)) {
          const updated = cur.filter((x) => x !== optionId);
          if (updated.length === 0) { next.delete(groupId); } else { next.set(groupId, updated); }
        } else {
          if (cur.length >= maxSel) return prev;
          next.set(groupId, [...cur, optionId]);
        }
      }
      return next;
    });
  };

  const handleAdd = () => {
    if (!ctaEnabled) return;
    console.log('[ItemDetailsModal] Adding to cart:', item.name, 'qty:', quantity);
    for (let i = 0; i < quantity; i++) {
      onAddToCart(
        {
          id: item.id,
          name: item.name,
          price: displayPrice,
          image: item.image,
          addOns: selectedAddOnObjects.length > 0 ? selectedAddOnObjects : undefined,
        },
        vendorId,
        1
      );
    }
    onClose();
  };

  const hasAddOnGroups = (catalogItem?.addOnGroups?.length ?? 0) > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View
          style={[styles.backdrop, { opacity: backdropAnim }]}
          pointerEvents="box-only"
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
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
            {item.image ? (
              <Image
                source={{ uri: item.image }}
                style={styles.heroImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.heroImage, styles.heroPlaceholder]}>
                <Text style={styles.heroPlaceholderText}>{item.name.charAt(0)}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <X size={18} color={Colors.text} strokeWidth={2.5} />
            </TouchableOpacity>

            <View style={styles.infoSection}>
              <View style={styles.nameRow}>
                <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                <View style={styles.priceBlock}>
                  {hasSale ? (
                    <>
                      <Text style={styles.priceMain}>
                        {formatPriceWithCommas(displayPrice, vendorCurrency)}
                      </Text>
                      <Text style={styles.priceStrike}>
                        {formatPriceWithCommas(basePrice, vendorCurrency)}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.priceMain}>
                      {formatPriceWithCommas(displayPrice, vendorCurrency)}
                    </Text>
                  )}
                </View>
              </View>

              {hasSale && (
                <View style={styles.promoBannerRow}>
                  <View style={styles.promoAppliedBadge}>
                    <Zap size={10} color="#FFFFFF" fill="#FFFFFF" />
                    <Text style={styles.promoAppliedBadgeText}>Promo applied</Text>
                  </View>
                  <Text style={styles.promoSavingsText}>
                    You save {formatPriceWithCommas(basePrice - displayPrice, vendorCurrency)} per item
                  </Text>
                </View>
              )}

              {item.description ? (
                <Text style={styles.description} numberOfLines={4}>{item.description}</Text>
              ) : null}

              {itemPromoBadges.length > 0 && (
                <View style={styles.promoBadgesRow}>
                  {itemPromoBadges.map((label, idx) => (
                    <View key={idx} style={styles.greenPromoBadge}>
                      <Zap size={11} color="#FFFFFF" fill="#FFFFFF" />
                      <Text style={styles.greenPromoBadgeText}>{label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {!item.inStock && (
                <View style={styles.unavailableBanner}>
                  <Text style={styles.unavailableBannerText}>Currently unavailable</Text>
                </View>
              )}
            </View>

            {hasAddOnGroups && catalogItem?.addOnGroups.map((group) => {
              const groupSelections = selectedAddOns.get(group.id) || [];
              const maxSel = group.selectionType === 'radio' ? 1 : group.options.length;
              const subtext = group.subheading ?? getGroupSubtext({ ...group, selectionType: group.selectionType });
              const isGroupSatisfied = !group.isRequired || groupSelections.length > 0;

              return (
                <View key={group.id} style={styles.modifierGroup}>
                  <View style={styles.modifierGroupHeader}>
                    <View style={styles.modifierGroupTitleRow}>
                      <Text style={styles.modifierGroupTitle}>{group.heading}</Text>
                      {group.isRequired && !isGroupSatisfied && (
                        <View style={styles.requiredBadge}>
                          <Text style={styles.requiredBadgeText}>Required</Text>
                        </View>
                      )}
                      {group.isRequired && isGroupSatisfied && (
                        <View style={styles.satisfiedBadge}>
                          <Check size={11} color="#FFFFFF" />
                        </View>
                      )}
                    </View>
                    <Text style={styles.modifierGroupSubtext}>{subtext}</Text>
                  </View>
                  <View style={styles.modifierDivider} />

                  {group.options.map((option, idx) => {
                    const isSelected = groupSelections.includes(option.id);
                    const isDisabled = !option.isAvailable || !item.inStock;
                    const isMaxReached =
                      group.selectionType === 'checkbox' &&
                      groupSelections.length >= maxSel &&
                      !isSelected;
                    const effectiveDisabled = isDisabled || isMaxReached;
                    const isLast = idx === group.options.length - 1;

                    return (
                      <TouchableOpacity
                        key={option.id}
                        style={[
                          styles.modifierOption,
                          isSelected && styles.modifierOptionSelected,
                          isLast && styles.modifierOptionLast,
                          effectiveDisabled && styles.modifierOptionDisabled,
                        ]}
                        onPress={() =>
                          !effectiveDisabled && toggleAddOn(group.id, option.id, group.selectionType, maxSel)
                        }
                        activeOpacity={effectiveDisabled ? 1 : 0.7}
                      >
                        <View style={styles.modifierOptionLeft}>
                          {group.selectionType === 'radio' ? (
                            <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected, effectiveDisabled && styles.controlDisabled]}>
                              {isSelected && <View style={styles.radioDot} />}
                            </View>
                          ) : (
                            <View style={[styles.checkboxOuter, isSelected && styles.checkboxOuterSelected, effectiveDisabled && styles.controlDisabled]}>
                              {isSelected && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                            </View>
                          )}
                          <Text
                            style={[
                              styles.modifierOptionName,
                              isSelected && styles.modifierOptionNameSelected,
                              effectiveDisabled && styles.modifierOptionNameDisabled,
                            ]}
                          >
                            {option.name}
                          </Text>
                        </View>
                        {option.price && option.price > 0 ? (
                          <Text style={[styles.modifierOptionPrice, effectiveDisabled && styles.modifierOptionPriceDisabled]}>
                            +{formatPriceWithCommas(option.price, vendorCurrency)}
                          </Text>
                        ) : (
                          <Text style={[styles.modifierOptionPriceFree, effectiveDisabled && styles.modifierOptionPriceDisabled]}>
                            Free
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}

            <View style={styles.quantityCard}>
              <Text style={styles.quantityLabel}>Quantity</Text>
              <View style={styles.qtyControls}>
                <TouchableOpacity
                  style={[styles.qtyBtn, quantity <= 1 && styles.qtyBtnDisabled]}
                  onPress={() => quantity > 1 && setQuantity((q) => q - 1)}
                  disabled={quantity <= 1}
                  activeOpacity={0.7}
                >
                  <Minus size={18} color={quantity <= 1 ? '#BDBDBD' : Colors.text} />
                </TouchableOpacity>
                <Text style={styles.qtyValue}>{quantity}</Text>
                <TouchableOpacity
                  style={[
                    styles.qtyBtn,
                    item.stockCount !== undefined && quantity >= item.stockCount && styles.qtyBtnDisabled,
                  ]}
                  onPress={() => {
                    if (item.stockCount !== undefined && quantity >= item.stockCount) return;
                    setQuantity((q) => q + 1);
                  }}
                  disabled={item.stockCount !== undefined && quantity >= item.stockCount}
                  activeOpacity={0.7}
                >
                  <Plus size={18} color={Colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.ctaButton, !ctaEnabled && styles.ctaButtonDisabled]}
              onPress={handleAdd}
              activeOpacity={ctaEnabled ? 0.88 : 1}
              disabled={!ctaEnabled}
            >
              <Text style={[styles.ctaButtonText, !ctaEnabled && styles.ctaButtonTextDisabled]}>
                {!item.inStock
                  ? 'Currently unavailable'
                  : !requiredGroupsFilled
                  ? 'Select required options'
                  : `Add to order request · ${formatPriceWithCommas(grandTotal, vendorCurrency)}`}
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
    maxHeight: '92%',
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
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
  },
  heroPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8E8E8',
  },
  heroPlaceholderText: {
    fontSize: 40,
    fontWeight: '700' as const,
    color: Colors.textMuted,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: Colors.white,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 16,
  },
  itemName: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  priceBlock: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  priceMain: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  priceStrike: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
    marginTop: 1,
  },
  promoBannerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginTop: -4,
    marginBottom: 12,
  },
  promoAppliedBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: '#16A34A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  promoAppliedBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  promoSavingsText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#16A34A',
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  promoBadgesRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 10,
  },
  greenPromoBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#166534',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  greenPromoBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  unavailableBanner: {
    backgroundColor: '#FFF5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  unavailableBannerText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#E53E3E',
  },
  modifierGroup: {
    backgroundColor: Colors.white,
    borderTopWidth: 8,
    borderTopColor: '#F5F5F7',
  },
  modifierGroupHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  modifierGroupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  modifierGroupTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  requiredBadge: {
    backgroundColor: '#FFF0E8',
    borderWidth: 1,
    borderColor: 'rgba(255,140,66,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  requiredBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  satisfiedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#38A169',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modifierGroupSubtext: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '400' as const,
  },
  modifierDivider: {
    height: 1,
    backgroundColor: '#EFEFEF',
    marginHorizontal: 20,
  },
  modifierOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
    backgroundColor: Colors.white,
  },
  modifierOptionSelected: {
    backgroundColor: 'rgba(255,140,66,0.08)',
  },
  modifierOptionLast: {
    borderBottomWidth: 0,
    marginBottom: 8,
  },
  modifierOptionDisabled: {
    opacity: 0.45,
  },
  modifierOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  radioOuterSelected: {
    borderColor: Colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  checkboxOuter: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  checkboxOuterSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  controlDisabled: {
    borderColor: '#BDBDBD',
    backgroundColor: '#EFEFEF',
  },
  modifierOptionName: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '400' as const,
    flex: 1,
  },
  modifierOptionNameSelected: {
    fontWeight: '500' as const,
  },
  modifierOptionNameDisabled: {
    color: '#BDBDBD',
  },
  modifierOptionPrice: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginLeft: 12,
  },
  modifierOptionPriceFree: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: Colors.textMuted,
    marginLeft: 12,
  },
  modifierOptionPriceDisabled: {
    color: '#BDBDBD',
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
  ctaButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonDisabled: {
    backgroundColor: '#EFEFEF',
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
    letterSpacing: -0.2,
  },
  ctaButtonTextDisabled: {
    color: '#BDBDBD',
  },
});
