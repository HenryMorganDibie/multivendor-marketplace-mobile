import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  X,
  Check,
  Lock,
  ShoppingBag,
  Plus,
  Clock,
  Tag,
  Sparkles,
  Truck,
  MapPin,
  User,
  FileText,
  Store,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { Colors } from '@/constants/colors';
import { UpsellModal } from '@/components/UpsellModal';
import { ContactCardPickerModal } from '@/components/ContactCardPickerModal';
import { CartItemEditModal } from '@/components/CartItemEditModal';
import { useCartViewModel } from '@/features/cart/hooks/useCartViewModel';
import { CartItemRow } from '@/features/cart/components/CartItemRow';
import { formatPriceWithCommas, getCurrencySymbol, type Currency } from '@/utils/formatPrice';
import type { VendorPromotion } from '@/mocks/promotionsData';
import type { MenuItem } from '@/mocks/vendorData';

function getPromoValueLine(promo: VendorPromotion, currency: Currency): string {
  const sym = getCurrencySymbol(currency);
  switch (promo.type) {
    case 'percentage':
      return `${promo.discountValue}% OFF`;
    case 'flat':
      return `${sym}${promo.discountValue.toLocaleString()} OFF`;
    case 'free_item':
      return `Free ${promo.freeItemName || 'Item'}`;
    case 'free_delivery':
      return 'Free Delivery';
    case 'bogo':
      return 'Buy 1 Get 1';
    default:
      return promo.title;
  }
}

function getPromoConditionLine(promo: VendorPromotion, currency: Currency): string {
  const sym = getCurrencySymbol(currency);
  switch (promo.type) {
    case 'bogo':
      return promo.bogoItemName || '';
    default:
      if (promo.minimumOrder > 0) {
        return `on ${sym}${promo.minimumOrder.toLocaleString()}+`;
      }
      return '';
  }
}

function estimatePromotionSavings(promo: VendorPromotion, subtotal: number): number {
  if (promo.type === 'percentage') {
    let d = Math.round(promo.minimumOrder * (promo.discountValue / 100));
    if (promo.maxDiscount && d > promo.maxDiscount) d = promo.maxDiscount;
    return d;
  }
  if (promo.type === 'flat') return promo.discountValue;
  return 0;
}



export function CartScreen() {
  const vm = useCartViewModel();
  const router = useRouter();
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast(null));
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  }, [toastAnim]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const formatAmount = (amount: number) =>
    formatPriceWithCommas(amount, vm.vendorCurrency);

  const nextUnlockablePromo = vm.evaluatedPromotions
    .filter(
      (ep) =>
        ep.status === 'unavailable' &&
        ep.promotion.minimumOrder > 0 &&
        ep.promotion.type !== 'bogo'
    )
    .sort((a, b) => a.promotion.minimumOrder - b.promotion.minimumOrder)[0] ?? null;

  const amountToUnlock = nextUnlockablePromo
    ? Math.max(nextUnlockablePromo.promotion.minimumOrder - vm.subtotal, 0)
    : 0;

  const promoThreshold = nextUnlockablePromo?.promotion.minimumOrder ?? 0;
  const progressPercent = promoThreshold > 0
    ? Math.min((vm.subtotal / promoThreshold) * 100, 100)
    : 0;

  const estimatedSavings = nextUnlockablePromo
    ? estimatePromotionSavings(nextUnlockablePromo.promotion, vm.subtotal)
    : 0;

  const isUnlocked = nextUnlockablePromo === null && vm.appliedPromotions.length > 0;
  const isNearUnlock = amountToUnlock > 0 && amountToUnlock <= 500;
  const isVeryClose = amountToUnlock > 0 && amountToUnlock <= 200;



  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={vm.handleBackPress} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Your cart</Text>
            {vm.items.length > 0 && (
              <Text style={styles.headerItemCount}>{vm.items.reduce((s, i) => s + i.quantity, 0)} items</Text>
            )}
          </View>
          <TouchableOpacity onPress={vm.handleAddMore} style={styles.headerButton}>
            <Text style={styles.headerAddMore}>Add more</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {vm.isCartEmpty && (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <ShoppingBag size={40} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Browse items to get started</Text>
          <TouchableOpacity
            style={styles.emptyBrowseBtn}
            onPress={() => router.push('/' as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyBrowseBtnText}>Browse Menu</Text>
          </TouchableOpacity>
        </View>
      )}

      {!vm.isCartEmpty && (
        <>
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.contentContainer}
          >
            {vm.showReorderBanner && vm.reorderIssues.length > 0 && (
              <View style={styles.reorderBanner}>
                <Text style={styles.reorderBannerTitle}>Items updated</Text>
                <Text style={styles.reorderBannerBody}>
                  {vm.reorderIssues.some((i) => i.type === 'updated') &&
                    'Changes have been made to some items since your last order.'}
                  {vm.reorderIssues.some(
                    (i) => i.type === 'unavailable' || i.type === 'removed'
                  ) && ' Some items are currently unavailable.'}
                </Text>
                <TouchableOpacity
                  style={styles.reorderBannerButton}
                  onPress={() => vm.setExpandedDetails(!vm.expandedDetails)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.reorderBannerButtonText}>
                    {vm.expandedDetails ? 'Hide details' : 'View details'}
                  </Text>
                </TouchableOpacity>
                {vm.expandedDetails && (
                  <View style={styles.reorderDetails}>
                    {vm.reorderIssues.filter((i) => i.type === 'updated').length > 0 && (
                      <View style={styles.reorderDetailSection}>
                        <Text style={styles.reorderDetailTitle}>Updated:</Text>
                        {vm.reorderIssues
                          .filter((i) => i.type === 'updated')
                          .map((issue, idx) => (
                            <Text key={idx} style={styles.reorderDetailItem}>
                              • {issue.itemName} - {issue.reason}
                            </Text>
                          ))}
                      </View>
                    )}
                    {vm.reorderIssues.filter((i) => i.type === 'unavailable' || i.type === 'removed').length > 0 && (
                      <View style={styles.reorderDetailSection}>
                        <Text style={styles.reorderDetailTitle}>Unavailable:</Text>
                        {vm.reorderIssues
                          .filter((i) => i.type === 'unavailable' || i.type === 'removed')
                          .map((issue, idx) => (
                            <Text key={idx} style={styles.reorderDetailItem}>
                              • {issue.itemName}
                            </Text>
                          ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* ── VENDOR INFO CARD ── */}
            <View style={styles.vendorCard}>
              <View style={styles.vendorCardRow}>
                {vm.mockVendor.logoImage ? (
                  <Image
                    source={{ uri: vm.mockVendor.logoImage }}
                    style={styles.vendorLogo}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.vendorLogoPlaceholder}>
                    <Store size={18} color={Colors.textMuted} />
                  </View>
                )}
                <View style={styles.vendorCardInfo}>
                  <Text style={styles.vendorCardName}>{vm.mockVendor.name}</Text>
                  <Text style={styles.vendorCardHelper}>
                    Orders and payments are handled directly by the vendor.
                  </Text>
                </View>
              </View>
              {vm.mockVendor.policy && (
                <TouchableOpacity
                  style={styles.vendorPolicyLink}
                  onPress={() => vm.setIsPolicyModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <FileText size={14} color={Colors.primary} />
                  <Text style={styles.vendorPolicyLinkText}>View business policy</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── CART ITEMS ── */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>ITEMS</Text>
                <TouchableOpacity onPress={vm.handleAddMore} activeOpacity={0.7}>
                  <Text style={styles.addMoreInlineText}>Add more</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.card}>
                {vm.items.map((item, index) => (
                  <View key={`${item.id}-${index}`}>
                    <CartItemRow
                      item={item}
                      index={index}
                      updateItemQuantity={vm.updateItemQuantity}
                      removeItemByIndex={vm.removeItemByIndex}
                      onItemNamePress={vm.handleItemNamePress}
                      isLocked={vm.isCartLocked}
                    />
                    {item.isUpdated && (
                      <View style={styles.itemUpdateBanner}>
                        <Text style={styles.itemUpdateBannerText}>Item updated</Text>
                        <Text style={styles.itemUpdateBannerSubtext}>Tap item name to review changes</Text>
                      </View>
                    )}
                    {item.requiresSelection && (
                      <View style={styles.itemRequiredBanner}>
                        <Text style={styles.itemRequiredBannerText}>Selection needed</Text>
                        <Text style={styles.itemRequiredBannerSubtext}>Complete your selection to proceed</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>

            {/* ── SMART UNLOCK BLOCK ── */}
            {!vm.isCartLocked && (
              <>
                {isUnlocked && vm.discount > 0 ? (
                  <View style={styles.unlockSuccess}>
                    <Text style={styles.unlockSuccessText}>
                      🎉 You're saving {formatAmount(vm.discount)}
                    </Text>
                  </View>
                ) : nextUnlockablePromo && amountToUnlock > 0 ? (
                  <View style={styles.unlockBlock}>
                    <Text style={styles.unlockMessage}>
                      {isVeryClose
                        ? `🔥 Just ${formatAmount(amountToUnlock)} more to unlock your discount`
                        : isNearUnlock
                        ? `👀 Almost there — add ${formatAmount(amountToUnlock)} more`
                        : `🔥 Add ${formatAmount(amountToUnlock)} more to save ${formatAmount(estimatedSavings)}`}
                    </Text>
                    <View style={styles.progressBarContainer}>
                      <View style={styles.progressBarTrack}>
                        <View
                          style={[
                            styles.progressBarFill,
                            { width: `${progressPercent}%` as any },
                            isNearUnlock && styles.progressBarFillNear,
                          ]}
                        />
                      </View>
                      <View style={styles.progressBarLabels}>
                        <Text style={styles.progressBarLabel}>{formatAmount(vm.subtotal)}</Text>
                        <Text style={styles.progressBarLabel}>
                          {formatAmount(promoThreshold)} 🎯
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : null}


              </>
            )}

            {/* ── PROMOTIONS CARD ── */}
            <View style={[styles.section, vm.isCartLocked && styles.sectionLocked]}>
              <Text style={styles.sectionTitle}>PROMOTIONS</Text>
              <View style={styles.card}>
                {vm.appliedPromotions.map((ap) => {
                  const valueLine = getPromoValueLine(ap.promotion, vm.vendorCurrency);
                  const conditionLine = getPromoConditionLine(ap.promotion, vm.vendorCurrency);
                  return (
                    <View key={ap.promotion.id} style={styles.appliedPromoCard}>
                      <View style={styles.appliedPromoCardContent}>
                        <Text style={styles.appliedPromoValue}>{valueLine}</Text>
                        {conditionLine ? (
                          <Text style={styles.appliedPromoCondition}>{conditionLine}</Text>
                        ) : null}
                        {ap.discountAmount > 0 && (
                          <Text style={styles.appliedPromoSaved}>
                            Saving {formatAmount(ap.discountAmount)}
                          </Text>
                        )}
                      </View>
                      <View style={styles.appliedBadge}>
                        <Check size={11} color={Colors.success} />
                        <Text style={styles.appliedBadgeText}>Applied</Text>
                      </View>
                    </View>
                  );
                })}

                {vm.appliedPromotions.length === 0 && vm.vendorPromotions.length > 0 && (
                  <TouchableOpacity
                    style={styles.viewOffersRow}
                    onPress={() => vm.setShowPromotionsModal(true)}
                    activeOpacity={0.7}
                  >
                    <Tag size={15} color={Colors.primary} />
                    <View style={styles.viewOffersTextWrap}>
                      <Text style={styles.viewOffersLabel}>Available promotions</Text>
                      <Text style={styles.viewOffersSubtext}>View offers</Text>
                    </View>
                    <ChevronRight size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}

                {vm.appliedPromotions.length > 0 && vm.vendorPromotions.length > 0 && (
                  <>
                    <View style={styles.promoInnerDivider} />
                    <TouchableOpacity
                      style={styles.viewOffersRowCompact}
                      onPress={() => vm.setShowPromotionsModal(true)}
                      activeOpacity={0.7}
                    >
                      <Tag size={13} color={Colors.primary} />
                      <Text style={styles.viewOffersTextCompact}>
                        View {vm.vendorPromotions.length} offer{vm.vendorPromotions.length !== 1 ? 's' : ''}
                      </Text>
                      <ChevronRight size={14} color={Colors.primary} />
                    </TouchableOpacity>
                  </>
                )}

                <View style={styles.autoAppliedRow}>
                  <Zap size={11} color={Colors.textMuted} />
                  <Text style={styles.autoAppliedText}>Best promotion is automatically applied</Text>
                </View>

                <View style={styles.promoInnerDivider} />

                <TouchableOpacity
                  style={styles.addPromoCodeRow}
                  onPress={() => setShowPromoInput(!showPromoInput)}
                  activeOpacity={0.7}
                >
                  <Plus size={14} color={Colors.primary} />
                  <Text style={styles.addPromoCodeText}>Add promo code</Text>
                  <ChevronRight
                    size={14}
                    color={Colors.textMuted}
                    style={showPromoInput ? { transform: [{ rotate: '90deg' }] } : undefined}
                  />
                </TouchableOpacity>

                {showPromoInput && (
                  <View style={styles.promoInputContainer}>
                    {!vm.promoApplied ? (
                      <View>
                        <View style={styles.promoInputRow}>
                          <TextInput
                            style={[
                              styles.promoInput,
                              vm.promoError ? styles.promoInputError : null,
                              vm.isCartLocked ? styles.inputLocked : null,
                            ]}
                            placeholder="Enter code"
                            placeholderTextColor={Colors.textMuted}
                            value={vm.promoInputValue}
                            onChangeText={vm.setPromoInputValue}
                            autoCapitalize="characters"
                            editable={!vm.isValidating && !vm.isCartLocked}
                          />
                          <TouchableOpacity
                            style={[styles.promoApplyButton, vm.isValidating && styles.promoApplyButtonDisabled]}
                            onPress={vm.handleApplyPromo}
                            disabled={vm.isValidating || vm.isCartLocked}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.promoApplyButtonText}>
                              {vm.isValidating ? '...' : 'Apply'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        {vm.promoError ? <Text style={styles.promoErrorText}>{vm.promoError}</Text> : null}
                      </View>
                    ) : (
                      <View style={styles.promoAppliedRow}>
                        <View style={styles.promoAppliedLeft}>
                          <Text style={styles.promoAppliedTag}>{vm.promoCode}</Text>
                          {vm.promoSuccess ? <Text style={styles.promoSuccessText}>{vm.promoSuccess}</Text> : null}
                        </View>
                        <TouchableOpacity onPress={vm.handleRemovePromo} activeOpacity={0.7}>
                          <Text style={styles.promoRemoveText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* ── FULFILLMENT PREVIEW ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>FULFILLMENT</Text>
              <View style={styles.card}>
                <View style={[styles.segmentedControl, vm.isCartLocked && styles.segmentedControlLocked]}>
                  {vm.mockVendor.fulfillmentTypes.map((type) => {
                    const isSelected = vm.selectedFulfillment === type;
                    const isDisabled = vm.mockVendor.fulfillmentTypes.length === 1 || vm.isCartLocked;
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.segmentedButton,
                          isSelected && styles.segmentedButtonActive,
                        ]}
                        onPress={() => !isDisabled && vm.setSelectedFulfillment(type as any)}
                        disabled={isDisabled}
                        activeOpacity={0.7}
                      >
                        {type === 'Pickup' ? (
                          <MapPin size={14} color={isSelected ? Colors.primary : Colors.textMuted} />
                        ) : (
                          <Truck size={14} color={isSelected ? Colors.primary : Colors.textMuted} />
                        )}
                        <Text style={[styles.segmentedButtonText, isSelected && styles.segmentedButtonTextActive]}>
                          {type}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.fulfillmentDivider} />

                <TouchableOpacity
                  style={styles.fulfillmentRow}
                  onPress={() => vm.setIsDateTimeModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <Clock size={16} color={vm.formatPreferredDateTime() ? Colors.text : Colors.textMuted} />
                  <View style={styles.fulfillmentRowContent}>
                    <Text style={styles.fulfillmentRowLabel}>Preferred time</Text>
                    <Text style={[
                      styles.fulfillmentRowValue,
                      !vm.formatPreferredDateTime() && styles.fulfillmentRowValueEmpty
                    ]}>
                      {vm.formatPreferredDateTime() || 'Not set'}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={Colors.textMuted} />
                </TouchableOpacity>

                <View style={styles.fulfillmentDivider} />

                <TouchableOpacity
                  style={styles.fulfillmentRow}
                  onPress={() => vm.setShowContactCardPicker(true)}
                  activeOpacity={0.7}
                >
                  <User size={16} color={vm.selectedContactCard ? Colors.text : Colors.textMuted} />
                  <View style={styles.fulfillmentRowContent}>
                    <Text style={styles.fulfillmentRowLabel}>Contact details</Text>
                    <Text style={[
                      styles.fulfillmentRowValue,
                      !vm.selectedContactCard && styles.fulfillmentRowValueEmpty
                    ]}>
                      {vm.selectedContactCard
                        ? `${vm.selectedContactCard.name} · ${vm.selectedContactCard.phone}`
                        : 'Optional'}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* ── ORDER NOTE ── */}
            <View style={[styles.section, vm.isCartLocked && styles.sectionLocked]}>
              <Text style={styles.sectionTitle}>
                ORDER NOTE <Text style={styles.optionalLabel}>(Optional)</Text>
              </Text>
              <View style={styles.card}>
                <TextInput
                  style={[styles.orderNoteInput, vm.isCartLocked && styles.inputLocked]}
                  placeholder="e.g. Extra napkins, no onions..."
                  placeholderTextColor={Colors.textMuted}
                  value={vm.orderNote}
                  onChangeText={(text) => {
                    if (!vm.isCartLocked) vm.setOrderNote(text.slice(0, 200));
                  }}
                  maxLength={200}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  editable={!vm.isCartLocked}
                />
                {!vm.isCartLocked && (
                  <Text style={styles.characterCount}>{vm.orderNote.length}/200</Text>
                )}
              </View>
            </View>

            {/* ── ORDER SUMMARY ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ORDER SUMMARY</Text>
              <View style={styles.card}>
                <View style={styles.summaryCardInner}>
                  {vm.totalItemSavings > 0 ? (
                    <>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Subtotal (before discount)</Text>
                        <Text style={styles.summaryStrikeValue}>{formatAmount(vm.originalSubtotal)}</Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Sale savings</Text>
                        <Text style={styles.summaryDiscountValue}>−{formatAmount(vm.totalItemSavings)}</Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Subtotal</Text>
                        <Text style={styles.summaryValue}>{formatAmount(vm.subtotal)}</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Subtotal</Text>
                      <Text style={styles.summaryValue}>{formatAmount(vm.subtotal)}</Text>
                    </View>
                  )}
                  {vm.mockVendor.taxEnabled && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Tax</Text>
                      <Text style={styles.summaryValue}>{formatAmount(vm.tax)}</Text>
                    </View>
                  )}
                  {vm.discount > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Discount</Text>
                      <Text style={styles.summaryDiscountValue}>−{formatAmount(vm.discount)}</Text>
                    </View>
                  )}
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryTotalLabel}>Total</Text>
                    <Text style={styles.summaryTotalValue}>{formatAmount(vm.total)}</Text>
                  </View>
                  {vm.totalSavings > 0 && (
                    <View style={styles.savingsRow}>
                      <Sparkles size={13} color="#16A34A" />
                      <Text style={styles.savingsText}>
                        You're saving{' '}
                        <Text style={styles.savingsAmount}>{formatAmount(vm.totalSavings)}</Text>
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.scrollBottomPad} />
          </ScrollView>

          {/* ── STICKY CTA ── */}
          <View style={[styles.stickyFooter, { paddingBottom: Math.max(vm.insets.bottom, 16) }]}>
            {vm.isCartLocked ? (
              <View style={styles.lockedSubmitBanner}>
                <Lock size={16} color={Colors.textMuted} />
                <Text style={styles.lockedSubmitText}>Order editing is locked</Text>
              </View>
            ) : (
              <>
                {vm.isBelowMinimum && vm.mockVendor.minimumOrderAmount != null && (
                  <View style={styles.footerWarning}>
                    <Text style={styles.footerWarningText}>
                      Minimum order {formatAmount(vm.mockVendor.minimumOrderAmount)} — Add{' '}
                      {formatAmount(vm.mockVendor.minimumOrderAmount - vm.subtotal)} more
                    </Text>
                  </View>
                )}
                {vm.hasItemsRequiringSelection && (
                  <View style={styles.footerWarning}>
                    <Text style={styles.footerWarningText}>Some items require selection updates</Text>
                  </View>
                )}
                <View style={styles.ctaRow}>
                  <View style={styles.ctaTotalWrap}>
                    <Text style={styles.ctaTotalLabel}>Total</Text>
                    <Text style={styles.ctaTotalValue}>{formatAmount(vm.total)}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.ctaButton, !vm.canSubmit && styles.ctaButtonDisabled]}
                    onPress={vm.handleSubmitOrderRequest}
                    disabled={!vm.canSubmit}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.ctaButtonText}>Review & Send Order</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </>
      )}

      {/* ── PROMOTIONS MODAL ── */}
      <Modal
        visible={vm.showPromotionsModal}
        animationType="slide"
        transparent
        onRequestClose={() => vm.setShowPromotionsModal(false)}
      >
        <View style={styles.promosModalOverlay}>
          <View style={styles.promosModalContainer}>
            <View style={styles.promosModalHandle} />
            <View style={styles.promosModalHeader}>
              <Text style={styles.promosModalTitle}>Promotions</Text>
              <TouchableOpacity
                onPress={() => vm.setShowPromotionsModal(false)}
                style={styles.promosModalClose}
              >
                <X size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.promosModalContent} showsVerticalScrollIndicator={false}>
              {vm.evaluatedPromotions.map((ep) => {
                const promo = ep.promotion;
                const isSelected = ep.status === 'selected';
                const isUnavailable = ep.status === 'unavailable';
                const isAvailable = ep.status === 'available';
                const valueLine = getPromoValueLine(promo, vm.vendorCurrency);
                const conditionLine = getPromoConditionLine(promo, vm.vendorCurrency);
                const remainingForPromo =
                  promo.minimumOrder > 0 ? Math.max(promo.minimumOrder - vm.subtotal, 0) : 0;

                return (
                  <TouchableOpacity
                    key={promo.id}
                    style={[
                      styles.promoModalCard,
                      isSelected && styles.promoModalCardSelected,
                      isUnavailable && styles.promoModalCardLocked,
                    ]}
                    onPress={() => {
                      if (isAvailable || isSelected) {
                        vm.handlePromoSelection(promo.id);
                      }
                    }}
                    activeOpacity={isUnavailable ? 1 : 0.75}
                    disabled={isUnavailable}
                  >
                    <View style={styles.promoModalCardMain}>
                      <View style={styles.promoModalCardTextWrap}>
                        <Text style={[styles.promoModalCardValue, isUnavailable && styles.promoModalCardValueLocked]}>
                          {valueLine}
                        </Text>
                        {conditionLine ? (
                          <Text style={[styles.promoModalCardCondition, isUnavailable && styles.promoModalCardConditionLocked]}>
                            {conditionLine}
                          </Text>
                        ) : null}
                        {isAvailable && <Text style={styles.promoModalTapToApply}>Tap to apply</Text>}
                        {isUnavailable && remainingForPromo > 0 && (
                          <Text style={styles.promoModalUnlockHint}>
                            Add {formatAmount(remainingForPromo)} more to unlock
                          </Text>
                        )}
                      </View>
                      {isSelected && (
                        <View style={styles.promoModalAppliedBadge}>
                          <Check size={11} color={Colors.success} />
                          <Text style={styles.promoModalAppliedBadgeText}>Applied</Text>
                        </View>
                      )}
                      {isUnavailable && (
                        <View style={styles.promoModalLockedIcon}>
                          <Lock size={14} color={Colors.textMuted} />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
              <View style={styles.promosModalAutoNote}>
                <Zap size={12} color={Colors.textMuted} />
                <Text style={styles.promosModalAutoNoteText}>Best promotion is automatically applied</Text>
              </View>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── POLICY MODAL ── */}
      <Modal
        visible={vm.isPolicyModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => vm.setIsPolicyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Vendor Policy</Text>
              <TouchableOpacity
                onPress={() => vm.setIsPolicyModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.policyText}>{vm.mockVendor.policy}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── DATE/TIME MODAL ── */}
      <Modal
        visible={vm.isDateTimeModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => vm.setIsDateTimeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.modalCardLarge]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => vm.setIsDateTimeModalVisible(false)} style={styles.modalActionButton}>
                <Text style={styles.modalActionText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Preferred Time</Text>
              <TouchableOpacity onPress={vm.handleConfirmDateTime} style={styles.modalActionButton}>
                <Text style={[styles.modalActionText, styles.modalActionTextPrimary]}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalHelper}>
                This is a preference only. Availability is confirmed by {vm.mockVendor.name} after your order request.
              </Text>
              <View style={styles.calendarContainer}>
                <View style={styles.monthHeader}>
                  <TouchableOpacity
                    onPress={() => {
                      const newMonth = new Date(vm.selectedMonth);
                      newMonth.setMonth(newMonth.getMonth() - 1);
                      vm.setSelectedMonth(newMonth);
                    }}
                    style={styles.monthButton}
                  >
                    <Text style={styles.monthButtonText}>{'<'}</Text>
                  </TouchableOpacity>
                  <Text style={styles.monthTitle}>
                    {vm.selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      const newMonth = new Date(vm.selectedMonth);
                      newMonth.setMonth(newMonth.getMonth() + 1);
                      vm.setSelectedMonth(newMonth);
                    }}
                    style={styles.monthButton}
                  >
                    <Text style={styles.monthButtonText}>{'>'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.weekDaysHeader}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                    <Text key={index} style={styles.weekDayText}>{day}</Text>
                  ))}
                </View>
                <View style={styles.calendarGrid}>
                  {(() => {
                    const year = vm.selectedMonth.getFullYear();
                    const month = vm.selectedMonth.getMonth();
                    const firstDay = new Date(year, month, 1).getDay();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const days: React.ReactElement[] = [];
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    for (let i = 0; i < firstDay; i++) {
                      days.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
                    }
                    for (let day = 1; day <= daysInMonth; day++) {
                      const date = new Date(year, month, day);
                      date.setHours(0, 0, 0, 0);
                      const isSelected = vm.preferredDate && date.toDateString() === vm.preferredDate.toDateString();
                      const isPast = date < today;
                      const dayNum = day;
                      days.push(
                        <TouchableOpacity
                          key={day}
                          style={[styles.calendarDay, !isPast && styles.calendarDayActive]}
                          onPress={() => { if (!isPast) vm.setPreferredDate(new Date(year, month, dayNum)); }}
                          activeOpacity={isPast ? 1 : 0.7}
                          disabled={isPast}
                        >
                          <View style={[styles.dayCircle, isSelected && styles.dayCircleSelected]}>
                            <Text style={[styles.dayText, isSelected && styles.dayTextSelected, isPast && styles.dayTextDisabled]}>
                              {dayNum}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    }
                    return days;
                  })()}
                </View>
              </View>

              {vm.preferredDate && (() => {
                const now = new Date();
                const isToday = vm.preferredDate.toDateString() === now.toDateString();
                const currentHour24 = now.getHours();
                const currentMinute = now.getMinutes();
                const bufferMinutes = 15;
                const isTimeDisabled = (hour: number, minute: number, period: 'AM' | 'PM') => {
                  if (!isToday) return false;
                  let hour24 = hour;
                  if (period === 'PM' && hour !== 12) hour24 = hour + 12;
                  else if (period === 'AM' && hour === 12) hour24 = 0;
                  return hour24 * 60 + minute < currentHour24 * 60 + currentMinute + bufferMinutes;
                };
                return (
                  <View style={styles.timePickerSection}>
                    <Text style={styles.timePickerSectionTitle}>Time</Text>
                    <View style={styles.timePickerColumns}>
                      <ScrollView style={styles.timePickerColumn} showsVerticalScrollIndicator={false} contentContainerStyle={styles.timePickerColumnContent}>
                        {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((hour) => {
                          const disabled = isTimeDisabled(hour, vm.selectedMinute, vm.selectedPeriod);
                          return (
                            <TouchableOpacity key={hour} style={styles.timePickerItem} onPress={() => !disabled && vm.setSelectedHour(hour)} disabled={disabled}>
                              <Text style={[styles.timePickerItemText, vm.selectedHour === hour && styles.timePickerItemTextSelected, disabled && styles.timePickerItemTextDisabled]}>{hour}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                      <ScrollView style={styles.timePickerColumn} showsVerticalScrollIndicator={false} contentContainerStyle={styles.timePickerColumnContent}>
                        {[0, 15, 30, 45].map((minute) => {
                          const disabled = isTimeDisabled(vm.selectedHour, minute, vm.selectedPeriod);
                          return (
                            <TouchableOpacity key={minute} style={styles.timePickerItem} onPress={() => !disabled && vm.setSelectedMinute(minute)} disabled={disabled}>
                              <Text style={[styles.timePickerItemText, vm.selectedMinute === minute && styles.timePickerItemTextSelected, disabled && styles.timePickerItemTextDisabled]}>{minute.toString().padStart(2, '0')}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                      <ScrollView style={styles.timePickerColumn} showsVerticalScrollIndicator={false} contentContainerStyle={styles.timePickerColumnContent}>
                        {(['AM', 'PM'] as const).map((period) => {
                          const disabled = isTimeDisabled(vm.selectedHour, vm.selectedMinute, period);
                          return (
                            <TouchableOpacity key={period} style={styles.timePickerItem} onPress={() => !disabled && vm.setSelectedPeriod(period)} disabled={disabled}>
                              <Text style={[styles.timePickerItemText, vm.selectedPeriod === period && styles.timePickerItemTextSelected, disabled && styles.timePickerItemTextDisabled]}>{period}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </View>
                );
              })()}
              {vm.preferredDate && (
                <TouchableOpacity style={styles.removePreferenceButton} onPress={vm.handleRemoveDateTime} activeOpacity={0.7}>
                  <Text style={styles.removePreferenceText}>Remove preference</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ContactCardPickerModal
        visible={vm.showContactCardPicker}
        onClose={() => vm.setShowContactCardPicker(false)}
        onSend={vm.handleSelectContactCard}
        ctaLabel="Confirm"
        showCta={true}
      />

      {toast !== null && (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: toastAnim,
              transform: [{
                translateY: toastAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [8, 0],
                }),
              }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      )}

      <CartItemEditModal
        visible={vm.isCartItemEditModalVisible}
        cartItem={vm.editingCartItem}
        cartItemIndex={vm.editingCartItemIndex}
        onUpdateQuantity={vm.updateItemQuantity}
        onClose={vm.handleCloseCartItemEditModal}
      />

      {/* ── CLOSED VENDOR MODAL ── */}
      <Modal
        visible={vm.showClosedVendorModal}
        animationType="fade"
        transparent
        onRequestClose={() => vm.setShowClosedVendorModal(false)}
      >
        <View style={styles.closedModalOverlay}>
          <View style={styles.closedModalCard}>
            <View style={styles.closedModalIcon}>
              <Clock size={28} color={Colors.primary} />
            </View>
            <Text style={styles.closedModalTitle}>Vendor is currently closed</Text>
            <Text style={styles.closedModalBody}>
              {vm.mockVendor.name}{vm.vendorNextOpenTime ? ` opens ${vm.vendorNextOpenTime}` : ' is currently closed'}.{`\n\n`}You can still place this order now.{`\n`}The vendor will review it when they reopen.
            </Text>
            <View style={styles.closedModalActions}>
              <TouchableOpacity
                style={styles.closedModalPrimaryBtn}
                onPress={() => {
                  vm.setShowClosedVendorModal(false);
                  vm.proceedToReviewOrder();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.closedModalPrimaryText}>Send Order Anyway</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closedModalSecondaryBtn}
                onPress={() => vm.setShowClosedVendorModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.closedModalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <UpsellModal
        visible={vm.isUpsellVisible}
        vendorName={vm.mockVendor.name}
        vendorId={vm.vendorId || vm.activeVendorId || vm.mockVendor.id}
        suggestions={vm.mockMenuItems}
        cartItems={vm.items}
        onAddItem={vm.addItem}
        onContinue={() => {
          vm.setIsUpsellVisible(false);
          vm.proceedToReviewOrder();
        }}
        onDismiss={() => {
          vm.setIsUpsellVisible(false);
          vm.proceedToReviewOrder();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  safeArea: { backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerButton: { padding: 8 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' as const },
  headerItemCount: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  headerAddMore: { fontSize: 14, fontWeight: '600' as const, color: Colors.primary },

  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingTop: 12 },
  scrollBottomPad: { height: 24 },

  vendorCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 10px rgba(0,0,0,0.06)' },
    }),
  },
  vendorCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vendorLogo: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0F0F0' },
  vendorLogoPlaceholder: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0F0F0',
    alignItems: 'center', justifyContent: 'center',
  },
  vendorCardInfo: { flex: 1 },
  vendorCardName: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  vendorCardHelper: { fontSize: 12, color: Colors.textMuted, lineHeight: 16 },
  vendorPolicyLink: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0F2',
  },
  vendorPolicyLinkText: { fontSize: 13, fontWeight: '500', color: Colors.primary },

  section: { marginTop: 20 },
  sectionLocked: { opacity: 0.65 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 2 },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, letterSpacing: 0.8 },
  addMoreInlineText: { fontSize: 13, fontWeight: '500', color: Colors.primary },
  optionalLabel: { fontWeight: '400', color: Colors.textMuted, fontSize: 11 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 10px rgba(0,0,0,0.06)' },
    }),
  },

  itemUpdateBanner: { backgroundColor: '#FFFBF5', paddingHorizontal: 16, paddingVertical: 10, borderLeftWidth: 3, borderLeftColor: Colors.primary },
  itemUpdateBannerText: { fontSize: 13, color: Colors.text, fontWeight: '600', marginBottom: 2 },
  itemUpdateBannerSubtext: { fontSize: 12, color: Colors.textMuted, lineHeight: 16 },
  itemRequiredBanner: { backgroundColor: '#FFF8F5', paddingHorizontal: 16, paddingVertical: 10, borderLeftWidth: 3, borderLeftColor: Colors.warning },
  itemRequiredBannerText: { fontSize: 13, color: Colors.text, fontWeight: '600', marginBottom: 2 },
  itemRequiredBannerSubtext: { fontSize: 12, color: Colors.textMuted, lineHeight: 16 },

  unlockBlock: {
    marginTop: 16,
    backgroundColor: '#FFF8F0',
    borderRadius: 14,
    padding: 14,
  },
  unlockMessage: { fontSize: 14, fontWeight: '600', color: '#92400E', lineHeight: 20, marginBottom: 10 },
  progressBarContainer: {},
  progressBarTrack: {
    height: 8, backgroundColor: '#FDE68A', borderRadius: 4, overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%' as any, backgroundColor: Colors.primary, borderRadius: 4,
  },
  progressBarFillNear: { backgroundColor: '#F59E0B' },
  progressBarLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressBarLabel: { fontSize: 11, color: '#92400E', fontWeight: '500' },

  unlockSuccess: {
    marginTop: 16,
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 14,
  },
  unlockSuccessText: { fontSize: 14, fontWeight: '600', color: '#065F46' },



  appliedPromoCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#F0FDF4',
  },
  appliedPromoCardContent: { flex: 1, gap: 2 },
  appliedPromoValue: { fontSize: 18, fontWeight: '700', color: '#065F46', letterSpacing: -0.3 },
  appliedPromoCondition: { fontSize: 13, color: '#16A34A', fontWeight: '500' },
  appliedPromoSaved: { fontSize: 12, color: '#16A34A', fontWeight: '500', marginTop: 2 },
  appliedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.successLight, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.successBorder,
  },
  appliedBadgeText: { fontSize: 12, fontWeight: '600', color: Colors.success },

  viewOffersRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16,
  },
  viewOffersTextWrap: { flex: 1 },
  viewOffersLabel: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 2 },
  viewOffersSubtext: { fontSize: 13, color: Colors.primary, fontWeight: '500' },
  viewOffersRowCompact: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  viewOffersTextCompact: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.primary },

  promoInnerDivider: { height: 1, backgroundColor: '#F0F0F2' },
  autoAppliedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  autoAppliedText: { fontSize: 12, color: Colors.textMuted },
  addPromoCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 13 },
  addPromoCodeText: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.primary },
  promoInputContainer: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 4 },
  promoInputRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  promoInput: {
    flex: 1, borderWidth: 1, borderColor: '#EBEBEB', borderRadius: 100,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: Colors.text, backgroundColor: '#F8F9FA',
  },
  promoInputError: { borderColor: Colors.error },
  promoApplyButton: {
    backgroundColor: '#2B2B2B', paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 100, justifyContent: 'center', alignItems: 'center', minWidth: 68,
  },
  promoApplyButtonDisabled: { backgroundColor: '#BBBBBB' },
  promoApplyButtonText: { fontSize: 14, color: Colors.white, fontWeight: '600' },
  promoErrorText: { fontSize: 13, color: Colors.error, marginTop: 2 },
  promoAppliedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
  promoAppliedLeft: { flex: 1 },
  promoAppliedTag: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  promoSuccessText: { fontSize: 13, color: Colors.success },
  promoRemoveText: { fontSize: 14, color: Colors.error, fontWeight: '500' },
  inputLocked: { backgroundColor: Colors.surface, color: Colors.textMuted },

  segmentedControl: {
    flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 10,
    padding: 3, gap: 3, margin: 14, marginBottom: 0,
  },
  segmentedControlLocked: { opacity: 0.6 },
  segmentedButton: {
    flex: 1, flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  segmentedButtonActive: { backgroundColor: Colors.background },
  segmentedButtonText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  segmentedButtonTextActive: { color: Colors.text },

  fulfillmentDivider: { height: 1, backgroundColor: '#F0F0F2', marginHorizontal: 14 },
  fulfillmentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  fulfillmentRowContent: { flex: 1 },
  fulfillmentRowLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 2 },
  fulfillmentRowValue: { fontSize: 14, fontWeight: '500', color: Colors.text },
  fulfillmentRowValueEmpty: { color: Colors.textMuted, fontWeight: '400' },

  orderNoteInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 12, fontSize: 15, color: Colors.text, minHeight: 76,
    backgroundColor: '#FAFAFA', margin: 14, marginBottom: 4,
  },
  characterCount: { fontSize: 12, color: Colors.textMuted, textAlign: 'right', paddingRight: 16, paddingBottom: 12 },

  summaryCardInner: { padding: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  summaryLabel: { fontSize: 14, color: Colors.textSecondary },
  summaryValue: { fontSize: 14, fontWeight: '500', color: Colors.text },
  summaryStrikeValue: { fontSize: 14, fontWeight: '400', color: Colors.textMuted, textDecorationLine: 'line-through' as const },
  summaryDiscountValue: { fontSize: 14, fontWeight: '500', color: Colors.success },
  summaryDivider: { height: 1, backgroundColor: '#F0F0F2', marginVertical: 8 },
  summaryTotalLabel: { fontSize: 17, fontWeight: '700', color: Colors.text },
  summaryTotalValue: { fontSize: 20, fontWeight: '700', color: Colors.text },
  savingsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F0F2',
  },
  savingsText: { fontSize: 13, color: '#166534', fontWeight: '500' },
  savingsAmount: { fontWeight: '700', color: '#16A34A' },

  stickyFooter: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 8 },
    }),
  },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ctaTotalWrap: { minWidth: 80 },
  ctaTotalLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '500', marginBottom: 2 },
  ctaTotalValue: { fontSize: 18, fontWeight: '700', color: Colors.text },
  ctaButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonDisabled: { backgroundColor: 'rgba(255,140,66,0.35)' },
  ctaButtonText: { fontSize: 16, fontWeight: '600', color: Colors.white, letterSpacing: 0.2 },
  lockedSubmitBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.surface, paddingVertical: 16, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  lockedSubmitText: { fontSize: 15, fontWeight: '500', color: Colors.textMuted },
  footerWarning: {
    backgroundColor: '#FFF8F5', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
    marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,140,66,0.2)',
  },
  footerWarningText: { fontSize: 13, color: Colors.text, textAlign: 'center' },

  promosModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  promosModalContainer: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%' as any, paddingBottom: 32,
  },
  promosModalHandle: { width: 36, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  promosModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  promosModalTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  promosModalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  promosModalContent: { paddingHorizontal: 16, paddingTop: 16 },
  promoModalCard: {
    borderRadius: 16, padding: 16, marginBottom: 10, backgroundColor: Colors.surface,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 },
      android: { elevation: 1 },
      web: { boxShadow: '0 1px 6px rgba(0,0,0,0.04)' },
    }),
  },
  promoModalCardSelected: { backgroundColor: '#F0FDF4' },
  promoModalCardLocked: { backgroundColor: '#FAFAFA', opacity: 0.7 },
  promoModalCardMain: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  promoModalCardTextWrap: { flex: 1, gap: 3 },
  promoModalCardValue: { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  promoModalCardValueLocked: { color: Colors.textMuted },
  promoModalCardCondition: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  promoModalCardConditionLocked: { color: Colors.textMuted },
  promoModalTapToApply: { fontSize: 12, color: Colors.primary, fontWeight: '500', marginTop: 4 },
  promoModalUnlockHint: { fontSize: 12, color: '#D97706', fontWeight: '600', marginTop: 4 },
  promoModalAppliedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.successLight, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.successBorder, alignSelf: 'flex-start',
  },
  promoModalAppliedBadgeText: { fontSize: 12, fontWeight: '600', color: Colors.success },
  promoModalLockedIcon: { padding: 4, alignSelf: 'flex-start' },
  promosModalAutoNote: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 4, marginTop: 4 },
  promosModalAutoNoteText: { fontSize: 12, color: Colors.textMuted },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: Colors.white, borderRadius: 24, width: '100%' as any, maxWidth: 420, maxHeight: '70%' as any, overflow: 'hidden' },
  modalCardLarge: { maxHeight: '80%' as any },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: Colors.text, textAlign: 'center', flex: 1 },
  modalCloseButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', position: 'absolute', right: 16, top: 12 },
  modalCloseText: { fontSize: 18, color: Colors.textMuted },
  modalActionButton: { paddingHorizontal: 8, paddingVertical: 4 },
  modalActionText: { fontSize: 16, color: Colors.textMuted, fontWeight: '500' },
  modalActionTextPrimary: { color: Colors.text, fontWeight: '600' },
  modalContent: { paddingHorizontal: 20, paddingTop: 20 },
  policyText: { fontSize: 15, lineHeight: 24, color: Colors.textSecondary, paddingBottom: 40 },
  modalHelper: { fontSize: 13, color: Colors.textMuted, lineHeight: 19, marginBottom: 20, paddingHorizontal: 4 },

  calendarContainer: { paddingBottom: 32 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  monthButton: { padding: 10, minWidth: 40, alignItems: 'center' },
  monthButtonText: { fontSize: 18, color: Colors.primary, fontWeight: '500' },
  monthTitle: { fontSize: 16, fontWeight: '600', color: Colors.text },
  weekDaysHeader: { flexDirection: 'row', marginBottom: 10 },
  weekDayText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDay: { width: '14.28%' as any, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calendarDayActive: { padding: 4 },
  dayCircle: { width: '100%' as any, height: '100%' as any, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: Colors.primary },
  dayText: { fontSize: 15, color: Colors.text },
  dayTextSelected: { color: Colors.white, fontWeight: '600' },
  dayTextDisabled: { color: Colors.textMuted, opacity: 0.4 },

  timePickerSection: { marginTop: 28, paddingTop: 20, borderTopWidth: 1, borderTopColor: Colors.cardBorder },
  timePickerSectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 16, paddingHorizontal: 4 },
  timePickerColumns: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 16 },
  timePickerColumn: { flex: 1, maxHeight: 200 },
  timePickerColumnContent: { paddingVertical: 80 },
  timePickerItem: { paddingVertical: 14, alignItems: 'center' },
  timePickerItemText: { fontSize: 20, color: Colors.textMuted },
  timePickerItemTextSelected: { fontSize: 26, color: Colors.text, fontWeight: '600' },
  timePickerItemTextDisabled: { color: Colors.textSecondary, opacity: 0.4 },
  removePreferenceButton: { marginTop: 28, marginBottom: 20, paddingVertical: 14, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.error },
  removePreferenceText: { fontSize: 15, color: Colors.error, fontWeight: '600' },

  reorderBanner: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 },
      android: { elevation: 1 },
    }),
  },
  reorderBannerTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  reorderBannerBody: { fontSize: 13, color: Colors.textMuted, lineHeight: 18, marginBottom: 10 },
  reorderBannerButton: { alignSelf: 'flex-start', paddingVertical: 6 },
  reorderBannerButtonText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  reorderDetails: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  reorderDetailSection: { marginBottom: 10 },
  reorderDetailTitle: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  reorderDetailItem: { fontSize: 12, color: Colors.textMuted, lineHeight: 18, marginBottom: 2 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingVertical: 60 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 15, color: Colors.textMuted, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  emptyBrowseBtn: { backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 15, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  emptyBrowseBtnText: { fontSize: 16, fontWeight: '600', color: Colors.white },

  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(28,28,30,0.88)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    zIndex: 999,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  closedModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 24,
  },
  closedModalCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    width: '100%' as any,
    maxWidth: 380,
    padding: 24,
    alignItems: 'center' as const,
  },
  closedModalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,140,66,0.1)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  closedModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 12,
  },
  closedModalBody: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 24,
  },
  closedModalActions: {
    width: '100%' as any,
    gap: 10,
  },
  closedModalPrimaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center' as const,
    minHeight: 52,
    justifyContent: 'center' as const,
  },
  closedModalPrimaryText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  closedModalSecondaryBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center' as const,
    minHeight: 48,
    justifyContent: 'center' as const,
  },
  closedModalSecondaryText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
});
