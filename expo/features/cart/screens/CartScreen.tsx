import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Zap, X, Percent, Gift, Truck, Tag, Check, Lock, ShoppingBag, Plus, Calendar, CheckCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { Colors } from '@/constants/colors';
import { UpsellModal } from '@/components/UpsellModal';
import { ContactCardPickerModal } from '@/components/ContactCardPickerModal';
import { useCartViewModel } from '@/features/cart/hooks/useCartViewModel';
import { CartItemRow } from '@/features/cart/components/CartItemRow';
import { CartVendorSection } from '@/features/cart/components/CartVendorSection';
import { CartSummaryBar } from '@/features/cart/components/CartSummaryBar';
import { SmartUpsellBanner } from '@/features/cart/components/SmartUpsellBanner';
import { CartItemDetailModal } from '@/features/cart/components/CartItemDetailModal';

export function CartScreen() {
  const vm = useCartViewModel();
  const router = useRouter();
  const [noteInputFocused, setNoteInputFocused] = useState<boolean>(false);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={vm.handleBackPress} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cart</Text>
          <View style={styles.headerSpacer} />
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
            onPress={() => router.push('/(tabs)' as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyBrowseBtnText}>Browse Menu</Text>
          </TouchableOpacity>
        </View>
      )}

      {!vm.isCartEmpty && <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
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
                {vm.reorderIssues.filter((i) => i.type === 'unavailable').length > 0 && (
                  <View style={styles.reorderDetailSection}>
                    <Text style={styles.reorderDetailTitle}>Unavailable:</Text>
                    {vm.reorderIssues
                      .filter((i) => i.type === 'unavailable')
                      .map((issue, idx) => (
                        <Text key={idx} style={styles.reorderDetailItem}>
                          • {issue.itemName}
                        </Text>
                      ))}
                  </View>
                )}
                {vm.reorderIssues.filter((i) => i.type === 'removed').length > 0 && (
                  <View style={styles.reorderDetailSection}>
                    <Text style={styles.reorderDetailTitle}>Not added:</Text>
                    {vm.reorderIssues
                      .filter((i) => i.type === 'removed')
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

        <CartVendorSection
          vendorName={vm.mockVendor.name}
          isCartLocked={vm.isCartLocked}
          lockConfig={vm.lockConfig}
          selectedFulfillment={vm.selectedFulfillment}
          onSelectFulfillment={vm.setSelectedFulfillment}
          fulfillmentTypes={vm.mockVendor.fulfillmentTypes}
        />

        {vm.mockVendor.policy && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>VENDOR POLICY</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.policyButton}
                onPress={() => vm.setIsPolicyModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.policyButtonText}>{vm.mockVendor.name}'s Business Policy</Text>
                <Text style={styles.policyButtonSubtext}>
                  (Cancellation, pickup & delivery terms)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>ITEMS</Text>
            <TouchableOpacity onPress={vm.handleAddMore} activeOpacity={0.7}>
              <Text style={styles.addMoreInlineText}>Add more</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            {vm.items.map((item, index) => {
              const hasUpdate = item.isUpdated;
              const requiresSelection = item.requiresSelection;

              return (
                <View key={`${item.id}-${index}`}>
                  <CartItemRow
                    item={item}
                    index={index}
                    updateItemQuantity={vm.updateItemQuantity}
                    removeItemByIndex={vm.removeItemByIndex}
                    onItemNamePress={vm.handleItemNamePress}
                    isLocked={vm.isCartLocked}
                  />
                  {hasUpdate && (
                    <View style={styles.itemUpdateBanner}>
                      <Text style={styles.itemUpdateBannerText}>Item updated</Text>
                      <Text style={styles.itemUpdateBannerSubtext}>
                        Tap item name to review changes
                      </Text>
                    </View>
                  )}
                  {requiresSelection && (
                    <View style={styles.itemRequiredBanner}>
                      <Text style={styles.itemRequiredBannerText}>Selection needed</Text>
                      <Text style={styles.itemRequiredBannerSubtext}>
                        Complete your selection to proceed
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {vm.vendorPromotions.length > 0 && !vm.isCartEmpty && (
          <View style={styles.progressBarSection}>
            <SmartUpsellBanner
              promotions={vm.vendorPromotions}
              subtotal={vm.subtotal}
              currency={vm.vendorCurrency}
              appliedPromotions={vm.appliedPromotions}
              cartItems={vm.items}
            />
          </View>
        )}

        <View style={[styles.section, vm.isCartLocked && styles.sectionLocked]}>
          <Text style={styles.sectionTitle}>PROMOTIONS</Text>
          <View style={styles.card}>
            {vm.appliedPromotions.length > 0 && (
              <View style={styles.appliedPromosContainer}>
                {vm.appliedPromotions.map((ap) => (
                  <View key={ap.promotion.id} style={styles.appliedPromoInlineBanner}>
                    <Text style={styles.appliedPromoInlineText}>
                      🎉 {ap.description}
                    </Text>
                    {ap.discountAmount > 0 && (
                      <Text style={styles.appliedPromoInlineDiscount}>
                        −₦{ap.discountAmount.toLocaleString()}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {vm.vendorPromotions.length > 0 && (
              <View style={styles.availablePromosSection}>
                <View style={styles.availablePromosHeader}>
                  <Text style={styles.availablePromosTitle}>Available Promotions</Text>
                  <TouchableOpacity
                    onPress={() => vm.setShowPromotionsModal(true)}
                    activeOpacity={0.7}
                    style={styles.viewOffersButton}
                  >
                    <Text style={styles.viewOffersText}>View Offers</Text>
                    <ChevronRight size={14} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                {vm.appliedPromotions.length === 0 && (
                  <Text style={styles.noPromosAppliedText}>
                    Add more items to unlock promotions
                  </Text>
                )}
              </View>
            )}

            <View style={styles.promoCodeSection}>
              {!vm.promoApplied ? (
                <View>
                  <Text style={styles.promoLabel}>Have a promo code?</Text>
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
                      onChangeText={(text) => {
                        vm.setPromoInputValue(text);
                      }}
                      autoCapitalize="characters"
                      editable={!vm.isValidating && !vm.isCartLocked}
                    />
                    <TouchableOpacity
                      style={[
                        styles.promoApplyButton,
                        vm.isValidating && styles.promoApplyButtonDisabled,
                      ]}
                      onPress={vm.handleApplyPromo}
                      disabled={vm.isValidating || vm.isCartLocked}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.promoApplyButtonText}>
                        {vm.isValidating ? '...' : 'Apply'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {vm.promoError ? (
                    <Text style={styles.promoErrorText}>{vm.promoError}</Text>
                  ) : null}
                </View>
              ) : (
                <View>
                  <View style={styles.promoAppliedRow}>
                    <View style={styles.promoAppliedLeft}>
                      <Text style={styles.promoAppliedTag}>{vm.promoCode}</Text>
                      {vm.promoSuccess ? (
                        <Text style={styles.promoSuccessText}>{vm.promoSuccess}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity onPress={vm.handleRemovePromo} activeOpacity={0.7}>
                      <Text style={styles.promoRemoveText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>

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
                <Text style={styles.promosModalTitle}>Available Promotions</Text>
                <TouchableOpacity
                  onPress={() => vm.setShowPromotionsModal(false)}
                  style={styles.promosModalClose}
                >
                  <X size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.promosModalContent}
                showsVerticalScrollIndicator={false}
              >
                {vm.evaluatedPromotions.map((ep) => {
                  const promo = ep.promotion;
                  const isSelected = ep.status === 'selected';
                  const isUnavailable = ep.status === 'unavailable';
                  return (
                    <View
                      key={promo.id}
                      style={[
                        styles.promosModalCard,
                        isSelected && styles.promosModalCardSelected,
                        isUnavailable && styles.promosModalCardUnavailable,
                      ]}
                    >
                      <View style={styles.promosModalCardHeader}>
                        <View style={[
                          styles.promosModalCardIconWrap,
                          isUnavailable && styles.promosModalCardIconUnavailable,
                        ]}>
                          {promo.icon === 'percent' && <Percent size={16} color={isUnavailable ? Colors.textMuted : Colors.primary} />}
                          {promo.icon === 'gift' && <Gift size={16} color={isUnavailable ? Colors.textMuted : '#16A34A'} />}
                          {promo.icon === 'truck' && <Truck size={16} color={isUnavailable ? Colors.textMuted : '#2563EB'} />}
                          {promo.icon === 'tag' && <Tag size={16} color={isUnavailable ? Colors.textMuted : '#D97706'} />}
                          {promo.icon === 'zap' && <Zap size={16} color={isUnavailable ? Colors.textMuted : '#DB2777'} />}
                        </View>
                        <View style={styles.promosModalCardText}>
                          <Text style={[
                            styles.promosModalCardTitle,
                            isUnavailable && styles.promosModalCardTitleUnavailable,
                          ]}>{promo.title}</Text>
                          <Text style={styles.promosModalCardDesc}>
                            {promo.shortDescription}
                          </Text>
                        </View>
                        {isSelected && (
                          <View style={styles.promosModalSelectedBadge}>
                            <Check size={10} color={Colors.white} />
                            <Text style={styles.promosModalSelectedBadgeText}>Selected</Text>
                          </View>
                        )}
                        {!isSelected && !isUnavailable && (
                          <View style={styles.promosModalSelectBadge}>
                            <Text style={styles.promosModalSelectBadgeText}>Select</Text>
                          </View>
                        )}
                        {isUnavailable && (
                          <View style={styles.promosModalUnavailableBadge}>
                            <Lock size={10} color={Colors.textMuted} />
                            <Text style={styles.promosModalUnavailableBadgeText}>Unavailable</Text>
                          </View>
                        )}
                      </View>
                      {promo.minimumOrder > 0 && (
                        <Text style={[
                          styles.promosModalMinOrder,
                          isUnavailable && styles.promosModalMinOrderUnavailable,
                        ]}>
                          Min. order: ₦{promo.minimumOrder.toLocaleString()}
                        </Text>
                      )}
                    </View>
                  );
                })}
                {vm.vendorStackingMode === 'single' && (
                  <View style={styles.promosModalStackingNote}>
                    <Lock size={13} color={Colors.textMuted} />
                    <Text style={styles.promosModalStackingNoteText}>
                      Only one promotion can be applied per order
                    </Text>
                  </View>
                )}
                {vm.vendorStackingMode === 'delivery_only' && (
                  <View style={styles.promosModalStackingNote}>
                    <Truck size={13} color={Colors.primary} />
                    <Text style={styles.promosModalStackingNoteText}>
                      Free delivery can stack with one other promotion
                    </Text>
                  </View>
                )}
                <View style={styles.promosModalAutoNote}>
                  <Zap size={13} color={Colors.primary} fill={Colors.primary} />
                  <Text style={styles.promosModalAutoNoteText}>
                    Best promotion is auto-selected when conditions are met
                  </Text>
                </View>
                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </View>
        </Modal>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            CONTACT DETAILS{' '}
            <Text style={styles.optionalLabel}>(Optional)</Text>
          </Text>
          {vm.selectedContactCard ? (
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.selectedContactCard}
                onPress={() => vm.setShowContactCardPicker(true)}
                activeOpacity={0.7}
              >
                <View style={styles.contactCardInfo}>
                  <Text style={styles.contactCardLabel}>
                    {vm.selectedContactCard.label}
                  </Text>
                  <Text style={styles.contactCardDetail}>
                    {vm.selectedContactCard.name}
                  </Text>
                  <Text style={styles.contactCardDetail}>
                    {vm.selectedContactCard.phone}
                  </Text>
                </View>
                <ChevronRight size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.contactAddRow}
              onPress={() => vm.setShowContactCardPicker(true)}
              activeOpacity={0.7}
            >
              <View style={styles.contactAddIcon}>
                <Plus size={14} color={Colors.primary} />
              </View>
              <Text style={styles.contactAddText}>Add contact details</Text>
              <ChevronRight size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            DELIVERY/PICKUP TIME
            {!vm.requiresOrderTiming && (
              <Text style={styles.optionalLabel}> (Optional)</Text>
            )}
          </Text>

          <View style={styles.timingToggleRow}>
            <TouchableOpacity
              style={[
                styles.timingOption,
                vm.timingPreference === 'flexible' && styles.timingOptionSelected,
              ]}
              onPress={() => vm.handleTimingPreferenceChange('flexible')}
              activeOpacity={0.7}
            >
              <View style={[
                styles.timingRadio,
                vm.timingPreference === 'flexible' && styles.timingRadioSelected,
              ]}>
                {vm.timingPreference === 'flexible' && (
                  <View style={styles.timingRadioDot} />
                )}
              </View>
              <Text style={[
                styles.timingOptionText,
                vm.timingPreference === 'flexible' && styles.timingOptionTextSelected,
              ]}>I&apos;m flexible</Text>
            </TouchableOpacity>

            <View style={styles.timingDivider} />

            <TouchableOpacity
              style={[
                styles.timingOption,
                vm.timingPreference === 'schedule' && styles.timingOptionSelected,
              ]}
              onPress={() => vm.handleTimingPreferenceChange('schedule')}
              activeOpacity={0.7}
            >
              <View style={[
                styles.timingRadio,
                vm.timingPreference === 'schedule' && styles.timingRadioSelected,
              ]}>
                {vm.timingPreference === 'schedule' && (
                  <View style={styles.timingRadioDot} />
                )}
              </View>
              <Text style={[
                styles.timingOptionText,
                vm.timingPreference === 'schedule' && styles.timingOptionTextSelected,
              ]}>Schedule a time</Text>
            </TouchableOpacity>
          </View>

          {vm.timingPreference === 'schedule' && (
            <TouchableOpacity
              style={[
                styles.schedulePickerRow,
                vm.dateTimeError ? styles.schedulePickerRowError : null,
                vm.hasScheduledDateTime ? styles.schedulePickerRowFilled : null,
              ]}
              onPress={vm.handleOpenDateTimePicker}
              activeOpacity={0.7}
            >
              <Calendar
                size={17}
                color={vm.hasScheduledDateTime ? Colors.primary : Colors.textMuted}
              />
              <Text
                style={[
                  styles.schedulePickerText,
                  vm.hasScheduledDateTime && styles.schedulePickerTextFilled,
                ]}
              >
                {vm.formatPreferredDateTime() || 'Choose date & time'}
              </Text>
              {vm.hasScheduledDateTime ? (
                <CheckCircle size={16} color={Colors.primary} />
              ) : (
                <ChevronRight size={16} color={Colors.textMuted} />
              )}
            </TouchableOpacity>
          )}

          {!!vm.dateTimeError && (
            <Text style={styles.timingErrorText}>{vm.dateTimeError}</Text>
          )}
        </View>

        <View style={[styles.noteSection, vm.isCartLocked && styles.sectionLocked]}>
          {!vm.isCartLocked && (
            <Text style={styles.noteSectionLabel}>
              Add a note to {vm.mockVendor.name}
            </Text>
          )}
          {vm.isCartLocked && (
            <Text style={styles.noteSectionLabel}>Order note</Text>
          )}
          <View style={[
            styles.noteInputWrapper,
            noteInputFocused && styles.noteInputWrapperFocused,
            vm.isCartLocked && styles.noteInputWrapperLocked,
          ]}>
            <TextInput
              style={[styles.orderNoteInput, vm.isCartLocked ? styles.inputLocked : null]}
              placeholder="e.g. No onions, extra spicy"
              placeholderTextColor="#9CA3AF"
              value={vm.orderNote}
              onChangeText={(text) => {
                if (!vm.isCartLocked) vm.setOrderNote(text.slice(0, 200));
              }}
              onFocus={() => setNoteInputFocused(true)}
              onBlur={() => setNoteInputFocused(false)}
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

        <View style={styles.scrollBottomPad} />
      </ScrollView>}

      {!vm.isCartEmpty && <CartSummaryBar
        subtotal={vm.subtotal}
        tax={vm.tax}
        discount={vm.discount}
        total={vm.total}
        taxEnabled={vm.mockVendor.taxEnabled}
        isCartLocked={vm.isCartLocked}
        isBelowMinimum={vm.isBelowMinimum}
        minimumOrderAmount={vm.mockVendor.minimumOrderAmount}
        hasItemsRequiringSelection={vm.hasItemsRequiringSelection}
        canSubmit={vm.canSubmit}
        onSubmit={vm.handleSubmitOrderRequest}
        currency={vm.vendorCurrency}
        paddingBottom={vm.insets.bottom}
        totalItemSavings={vm.totalItemSavings}
        originalSubtotal={vm.originalSubtotal}
        totalSavings={vm.totalSavings}
      />}

      <Modal
        visible={vm.isPolicyModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => vm.setIsPolicyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{vm.mockVendor.name}'s Policy</Text>
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

      <Modal
        visible={vm.isDateTimeModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => vm.setIsDateTimeModalVisible(false)}
      >
        <View style={styles.dateTimeSheetOverlay}>
          <View style={styles.dateTimeSheetContainer}>
            <View style={styles.dateTimeSheetHandle} />
            <View style={styles.dateTimeSheetHeader}>
              <TouchableOpacity
                onPress={() => vm.setIsDateTimeModalVisible(false)}
                style={styles.modalActionButton}
              >
                <Text style={styles.modalActionText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Schedule Time</Text>
              <TouchableOpacity
                onPress={vm.handleConfirmDateTime}
                style={styles.modalActionButton}
              >
                <Text style={[styles.modalActionText, styles.modalActionTextPrimary]}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.dateTimeSheetContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalHelper}>
                This is a preference only. Availability is confirmed by{' '}
                {vm.mockVendor.name} after your order request.
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
                    {vm.selectedMonth.toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}
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
                    <Text key={index} style={styles.weekDayText}>
                      {day}
                    </Text>
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
                      const isSelected =
                        vm.preferredDate &&
                        date.toDateString() === vm.preferredDate.toDateString();
                      const isPast = date < today;
                      const dayNum = day;

                      days.push(
                        <TouchableOpacity
                          key={day}
                          style={[
                            styles.calendarDay,
                            !isPast && styles.calendarDayActive,
                          ]}
                          onPress={() => {
                            if (!isPast) {
                              vm.setPreferredDate(new Date(year, month, dayNum));
                            }
                          }}
                          activeOpacity={isPast ? 1 : 0.7}
                          disabled={isPast}
                        >
                          <View
                            style={[
                              styles.dayCircle,
                              isSelected && styles.dayCircleSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.dayText,
                                isSelected && styles.dayTextSelected,
                                isPast && styles.dayTextDisabled,
                              ]}
                            >
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

              {vm.preferredDate &&
                (() => {
                  const now = new Date();
                  const isToday =
                    vm.preferredDate.toDateString() === now.toDateString();
                  const currentHour24 = now.getHours();
                  const currentMinute = now.getMinutes();
                  const bufferMinutes = 15;

                  const isTimeDisabled = (
                    hour: number,
                    minute: number,
                    period: 'AM' | 'PM'
                  ) => {
                    if (!isToday) return false;

                    let hour24 = hour;
                    if (period === 'PM' && hour !== 12) {
                      hour24 = hour + 12;
                    } else if (period === 'AM' && hour === 12) {
                      hour24 = 0;
                    }

                    const selectedTimeInMinutes = hour24 * 60 + minute;
                    const currentTimeInMinutes =
                      currentHour24 * 60 + currentMinute + bufferMinutes;

                    return selectedTimeInMinutes < currentTimeInMinutes;
                  };

                  return (
                    <View style={styles.timePickerSection}>
                      <Text style={styles.timePickerSectionTitle}>Time</Text>
                      <View style={styles.timePickerColumns}>
                        <ScrollView
                          style={styles.timePickerColumn}
                          showsVerticalScrollIndicator={false}
                          contentContainerStyle={styles.timePickerColumnContent}
                        >
                          {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((hour) => {
                            const isDisabled =
                              vm.selectedPeriod === 'AM'
                                ? isTimeDisabled(hour, vm.selectedMinute, 'AM')
                                : isTimeDisabled(hour, vm.selectedMinute, 'PM');

                            return (
                              <TouchableOpacity
                                key={hour}
                                style={styles.timePickerItem}
                                onPress={() => !isDisabled && vm.setSelectedHour(hour)}
                                activeOpacity={isDisabled ? 1 : 0.7}
                                disabled={isDisabled}
                              >
                                <Text
                                  style={[
                                    styles.timePickerItemText,
                                    vm.selectedHour === hour &&
                                      styles.timePickerItemTextSelected,
                                    isDisabled && styles.timePickerItemTextDisabled,
                                  ]}
                                >
                                  {hour}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>

                        <ScrollView
                          style={styles.timePickerColumn}
                          showsVerticalScrollIndicator={false}
                          contentContainerStyle={styles.timePickerColumnContent}
                        >
                          {[0, 15, 30, 45].map((minute) => {
                            const isDisabled = isTimeDisabled(
                              vm.selectedHour,
                              minute,
                              vm.selectedPeriod
                            );

                            return (
                              <TouchableOpacity
                                key={minute}
                                style={styles.timePickerItem}
                                onPress={() =>
                                  !isDisabled && vm.setSelectedMinute(minute)
                                }
                                activeOpacity={isDisabled ? 1 : 0.7}
                                disabled={isDisabled}
                              >
                                <Text
                                  style={[
                                    styles.timePickerItemText,
                                    vm.selectedMinute === minute &&
                                      styles.timePickerItemTextSelected,
                                    isDisabled && styles.timePickerItemTextDisabled,
                                  ]}
                                >
                                  {minute.toString().padStart(2, '0')}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>

                        <ScrollView
                          style={styles.timePickerColumn}
                          showsVerticalScrollIndicator={false}
                          contentContainerStyle={styles.timePickerColumnContent}
                        >
                          {(['AM', 'PM'] as const).map((period) => {
                            const isDisabled = isTimeDisabled(
                              vm.selectedHour,
                              vm.selectedMinute,
                              period
                            );

                            return (
                              <TouchableOpacity
                                key={period}
                                style={styles.timePickerItem}
                                onPress={() =>
                                  !isDisabled && vm.setSelectedPeriod(period)
                                }
                                activeOpacity={isDisabled ? 1 : 0.7}
                                disabled={isDisabled}
                              >
                                <Text
                                  style={[
                                    styles.timePickerItemText,
                                    vm.selectedPeriod === period &&
                                      styles.timePickerItemTextSelected,
                                    isDisabled && styles.timePickerItemTextDisabled,
                                  ]}
                                >
                                  {period}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    </View>
                  );
                })()}

              {vm.preferredDate && (
                <TouchableOpacity
                  style={styles.removePreferenceButton}
                  onPress={vm.handleRemoveDateTime}
                  activeOpacity={0.7}
                >
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

      <CartItemDetailModal
        visible={vm.selectedCartItemIndex !== null}
        item={vm.selectedCartItemIndex !== null ? vm.items[vm.selectedCartItemIndex] ?? null : null}
        itemIndex={vm.selectedCartItemIndex ?? 0}
        currency={vm.vendorCurrency}
        onClose={() => vm.setSelectedCartItemIndex(null)}
        onUpdateQuantity={vm.updateItemQuantity}
        onRemove={vm.removeItemByIndex}
      />

      <UpsellModal
        visible={vm.isUpsellVisible}
        vendorName={vm.mockVendor.name}
        vendorId={vm.vendorId || vm.activeVendorId || vm.mockVendor.id}
        suggestions={vm.mockMenuItems}
        cartItems={vm.items}
        onAddItem={vm.addItem}
        onRemoveItem={(id, vendorId) => vm.removeItem(id, vendorId)}
        onContinue={() => {
          vm.setIsUpsellVisible(false);
          vm.proceedToReviewOrder();
        }}
        onDismiss={() => {
          vm.setIsUpsellVisible(false);
          vm.proceedToReviewOrder();
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
    marginRight: 40,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 160,
    gap: 0,
  },
  scrollBottomPad: {
    height: 0,
  },
  section: {
    marginTop: 14,
  },
  sectionLocked: {
    opacity: 0.65,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  addMoreInlineText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.primary,
  },
  optionalLabel: {
    fontWeight: '400',
    color: Colors.textMuted,
    fontSize: 11,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
      },
    }),
  },
  policyButton: {
    padding: 16,
  },
  policyButtonText: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
    marginBottom: 3,
  },
  policyButtonSubtext: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  itemUpdateBanner: {
    backgroundColor: '#FFFBF5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  itemUpdateBannerText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemUpdateBannerSubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  itemRequiredBanner: {
    backgroundColor: '#FFF8F5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
  },
  itemRequiredBannerText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemRequiredBannerSubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  promoLabel: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  promoInputRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: '#F8F9FA',
  },
  promoInputError: {
    borderColor: Colors.error,
  },
  promoApplyButton: {
    backgroundColor: '#2B2B2B',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 68,
  },
  promoApplyButtonDisabled: {
    backgroundColor: '#BBBBBB',
  },
  promoApplyButtonText: {
    fontSize: 14,
    color: Colors.white,
    fontWeight: '600',
  },
  browsePromosText: {
    fontSize: 13,
    color: Colors.textSecondary,
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 2,
  },
  promoErrorText: {
    fontSize: 13,
    color: Colors.error,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  promoSuccessText: {
    fontSize: 13,
    color: Colors.success,
    marginTop: 2,
  },
  promoAppliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  promoAppliedLeft: {
    flex: 1,
  },
  promoAppliedTag: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  promoRemoveText: {
    fontSize: 14,
    color: Colors.error,
    fontWeight: '500',
  },
  softButton: {
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    margin: 4,
    backgroundColor: '#FAFAFA',
  },
  softButtonText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  softButtonTextFilled: {
    color: Colors.text,
    fontWeight: '500',
  },
  pickupTimeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 48,
    paddingHorizontal: 14,
    gap: 10,
  },
  pickupTimeText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textMuted,
    fontWeight: '400' as const,
  },
  pickupTimeTextSelected: {
    color: Colors.text,
    fontWeight: '500' as const,
  },
  timingToggleRow: {
    flexDirection: 'row' as const,
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
      web: { boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
    }),
  },
  timingOption: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 8,
  },
  timingOptionSelected: {
    backgroundColor: '#FFF8F4',
  },
  timingRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  timingRadioSelected: {
    borderColor: Colors.primary,
  },
  timingRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  timingOptionText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '400' as const,
  },
  timingOptionTextSelected: {
    color: Colors.text,
    fontWeight: '500' as const,
  },
  timingDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 10,
  },
  schedulePickerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: 8,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 48,
    paddingHorizontal: 14,
    gap: 10,
  },
  schedulePickerRowError: {
    borderColor: Colors.error,
    backgroundColor: '#FFF8F8',
  },
  schedulePickerRowFilled: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF8F4',
  },
  schedulePickerText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '400' as const,
  },
  schedulePickerTextFilled: {
    color: Colors.text,
    fontWeight: '500' as const,
  },
  timingErrorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 6,
    paddingHorizontal: 2,
    fontWeight: '500' as const,
  },
  selectedContactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  contactCardInfo: {
    flex: 1,
    marginRight: 12,
  },
  contactCardLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 3,
  },
  contactCardDetail: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 1,
  },
  noteSection: {
    marginTop: 14,
    marginBottom: 2,
  },
  noteSectionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  noteInputWrapper: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: 12,
    overflow: 'hidden',
  },
  noteInputWrapperFocused: {
    borderColor: Colors.primary,
  },
  noteInputWrapperLocked: {
    backgroundColor: Colors.surface,
  },
  orderNoteInput: {
    padding: 13,
    paddingBottom: 28,
    fontSize: 15,
    color: Colors.text,
    minHeight: 72,
    backgroundColor: 'transparent',
  },
  characterCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    position: 'absolute',
    bottom: 8,
    right: 12,
  },
  inputLocked: {
    backgroundColor: Colors.surface,
    color: Colors.textMuted,
  },
  reorderBanner: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
    }),
  },
  reorderBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  reorderBannerBody: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: 10,
  },
  reorderBannerButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  reorderBannerButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  reorderDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  reorderDetailSection: {
    marginBottom: 10,
  },
  reorderDetailTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  reorderDetailItem: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    width: '100%' as any,
    maxWidth: 420,
    maxHeight: '70%' as any,
    overflow: 'hidden',
  },
  dateTimeSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end' as const,
  },
  dateTimeSheetContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '78%' as any,
    overflow: 'hidden',
  },
  dateTimeSheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center' as const,
    marginTop: 12,
    marginBottom: 4,
  },
  dateTimeSheetHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  dateTimeSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    flex: 1,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    top: 12,
  },
  modalCloseText: {
    fontSize: 18,
    color: Colors.textMuted,
    fontWeight: '400',
  },
  modalActionButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modalActionText: {
    fontSize: 16,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  modalActionTextPrimary: {
    color: Colors.text,
    fontWeight: '600',
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  policyText: {
    fontSize: 15,
    lineHeight: 24,
    color: Colors.textSecondary,
    paddingBottom: 40,
  },
  modalHelper: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  calendarContainer: {
    paddingBottom: 32,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  monthButton: {
    padding: 10,
    minWidth: 40,
    alignItems: 'center',
  },
  monthButtonText: {
    fontSize: 18,
    color: Colors.primary,
    fontWeight: '500',
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  weekDaysHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%' as any,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayActive: {
    padding: 4,
  },
  dayCircle: {
    width: '100%' as any,
    height: '100%' as any,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: Colors.primary,
  },
  dayText: {
    fontSize: 15,
    color: Colors.text,
  },
  dayTextSelected: {
    color: Colors.white,
    fontWeight: '600',
  },
  dayTextDisabled: {
    color: Colors.textMuted,
    opacity: 0.4,
  },
  timePickerSection: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  timePickerSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  timePickerColumns: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 16,
  },
  timePickerColumn: {
    flex: 1,
    maxHeight: 200,
  },
  timePickerColumnContent: {
    paddingVertical: 80,
  },
  timePickerItem: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  timePickerItemText: {
    fontSize: 20,
    color: Colors.textMuted,
  },
  timePickerItemTextSelected: {
    fontSize: 26,
    color: Colors.text,
    fontWeight: '600',
  },
  timePickerItemTextDisabled: {
    color: Colors.textSecondary,
    opacity: 0.4,
  },
  removePreferenceButton: {
    marginTop: 28,
    marginBottom: 20,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  removePreferenceText: {
    fontSize: 15,
    color: Colors.error,
    fontWeight: '600',
  },
  progressBarSection: {
    marginTop: 20,
  },
  appliedPromosContainer: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  appliedPromoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  appliedPromoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  appliedPromoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,140,66,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appliedPromoTextWrap: {
    flex: 1,
  },
  appliedPromoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.success,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  appliedPromoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  appliedPromoDiscount: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.success,
    marginLeft: 8,
  },
  availablePromosSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  availablePromosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  availablePromosTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  viewOffersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewOffersText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  noPromosAppliedText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 6,
  },
  promoCodeSection: {
    borderTopWidth: 0,
  },
  promosModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end' as const,
  },
  promosModalContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '80%' as any,
    paddingBottom: 32,
  },
  promosModalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center' as const,
    marginTop: 12,
    marginBottom: 4,
  },
  promosModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  promosModalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
  },
  promosModalClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promosModalContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  promosModalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  promosModalCardSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  promosModalCardUnavailable: {
    backgroundColor: '#FAFAFA',
    borderColor: Colors.border,
    opacity: 0.7,
  },
  promosModalCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  promosModalCardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  promosModalCardText: {
    flex: 1,
  },
  promosModalCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  promosModalCardDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  promosModalSelectedBadge: {
    backgroundColor: Colors.success,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  promosModalSelectedBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  promosModalSelectBadge: {
    backgroundColor: 'rgba(255,140,66,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  promosModalSelectBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  promosModalUnavailableBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  promosModalUnavailableBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  promosModalCardIconUnavailable: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  promosModalCardTitleUnavailable: {
    color: Colors.textMuted,
  },
  promosModalMinOrderUnavailable: {
    color: Colors.textMuted,
  },
  promosModalStackingNote: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 6,
    marginBottom: 4,
  },
  promosModalStackingNoteText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    flex: 1,
  },
  promosModalMinOrder: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 10,
    marginLeft: 48,
  },
  promosModalAutoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,140,66,0.08)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 6,
  },
  promosModalAutoNoteText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginBottom: 32,
    lineHeight: 22,
  },
  emptyBrowseBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 15,
    borderRadius: 100,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emptyBrowseBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  contactAddRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 10,
  },
  contactAddIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  contactAddText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  appliedPromoInlineBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  appliedPromoInlineText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
    flex: 1,
  },
  appliedPromoInlineDiscount: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.success,
    marginLeft: 8,
  },
});
