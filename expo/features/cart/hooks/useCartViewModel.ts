import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert } from '@/utils/alert';
import { useCart, type ReorderIssue } from '@/contexts/CartContext';
import { useSafeBack } from '@/utils/useSafeBack';
import type { ContactCard } from '@/contexts/ContactCardsContext';
import type { OrderStatus } from '@/mocks/ordersData';
import { getOrderLockConfig, isOrderLocked } from '@/utils/orderImmutability';
import { getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';
import { mockVendor, mockMenuItems } from '@/mocks/vendorData';
import {
  calculateTax,
  calculateTotal,
  validatePromoCode,
  checkCanSubmitOrder,
} from '@/features/cart/selectors/cartSelectors';
import { buildReviewOrderNavigationParams } from '@/features/cart/actions/cartActions';
import { evaluatePromotionsWithStatus, getActivePromotions, type AppliedPromotion, type VendorPromotion, type EvaluatedPromotion, type StackingMode } from '@/mocks/promotionsData';
import { getVendorStorefrontPath } from '@/utils/vendorLookup';

type FulfillmentType = 'Pickup' | 'Delivery' | null;

export function useCartViewModel() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const safeBack = useSafeBack();

  const vendorId = params.vendorId as string | undefined;
  const reorderIssuesParam = params.reorderIssues as string | undefined;
  const orderStatusParam = params.orderStatus as OrderStatus | undefined;

  const { items, addItem, removeItem, updateItemQuantity, removeItemByIndex, totalPrice, setActiveVendor, activeVendorId } =
    useCart();

  const isCartLocked = orderStatusParam ? isOrderLocked(orderStatusParam) : false;
  const lockConfig = orderStatusParam ? getOrderLockConfig(orderStatusParam, mockVendor.name) : null;

  const [reorderIssues, setReorderIssues] = useState<ReorderIssue[]>([]);
  const [showReorderBanner, setShowReorderBanner] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState(false);

  const [selectedFulfillment, setSelectedFulfillment] = useState<FulfillmentType>(
    mockVendor.fulfillmentTypes.length === 1
      ? (mockVendor.fulfillmentTypes[0] as FulfillmentType)
      : 'Pickup'
  );

  const [orderNote, setOrderNote] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [manualDiscount, setManualDiscount] = useState(0);
  const [promoInputValue, setPromoInputValue] = useState('');
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [showPromotionsModal, setShowPromotionsModal] = useState(false);
  const [isPolicyModalVisible, setIsPolicyModalVisible] = useState(false);
  const [timingPreference, setTimingPreference] = useState<'flexible' | 'schedule'>('flexible');
  const [preferredDate, setPreferredDate] = useState<Date | null>(null);
  const [preferredTime, setPreferredTime] = useState<string>('');
  const [dateTimeError, setDateTimeError] = useState<string>('');
  const [isDateTimeModalVisible, setIsDateTimeModalVisible] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('PM');
  const [showContactCardPicker, setShowContactCardPicker] = useState(false);
  const [selectedContactCard, setSelectedContactCard] = useState<ContactCard | null>(null);
  const [isUpsellVisible, setIsUpsellVisible] = useState(false);
  const upsellShownRef = useRef<Set<string>>(new Set());
  const [selectedCartItemIndex, setSelectedCartItemIndex] = useState<number | null>(null);

  const subtotal = totalPrice;

  const cartItemIds = items.map((i) => i.id);
  const cartItemQuantities = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.id] = (acc[item.id] || 0) + item.quantity;
    return acc;
  }, {});

  const currentVendorIdForPromo = vendorId || activeVendorId || mockVendor.id;
  const vendorStackingMode: StackingMode = mockVendor.promoStackingMode || 'single';

  const evaluatedPromotions: EvaluatedPromotion[] = evaluatePromotionsWithStatus(
    currentVendorIdForPromo,
    subtotal,
    cartItemIds,
    cartItemQuantities,
    vendorStackingMode
  );

  const appliedPromotions: AppliedPromotion[] = evaluatedPromotions
    .filter((e) => e.status === 'selected')
    .map((e) => ({
      promotion: e.promotion,
      discountAmount: e.discountAmount,
      description: e.description,
    }));

  const autoDiscount = appliedPromotions.reduce((sum, ap) => sum + ap.discountAmount, 0);
  const vendorPromotions: VendorPromotion[] = getActivePromotions(currentVendorIdForPromo);

  const discount = autoDiscount > 0 ? autoDiscount : manualDiscount;
  const tax = calculateTax(subtotal, mockVendor.taxEnabled, mockVendor.taxRate);
  const total = calculateTotal(subtotal, tax, discount);

  const totalItemSavings = items.reduce((acc, cartItem) => {
    const basePrice = cartItem.originalPrice ?? cartItem.price;
    if (cartItem.price < basePrice) {
      return acc + (basePrice - cartItem.price) * cartItem.quantity;
    }
    return acc;
  }, 0);

  const originalSubtotal = items.reduce((acc, cartItem) => {
    const basePrice = cartItem.originalPrice ?? cartItem.price;
    const addOnTotal = cartItem.addOns?.reduce((sum, a) => sum + a.price, 0) || 0;
    return acc + (basePrice + addOnTotal) * cartItem.quantity;
  }, 0);

  const totalSavings = totalItemSavings + discount;

  const isBelowMinimum = !!(mockVendor.minimumOrderAmount && subtotal < mockVendor.minimumOrderAmount);
  const isVendorUnavailable = mockVendor.storeStatus === 'closed';
  const hasItemsRequiringSelection = items.some((item) => item.requiresSelection);
  const requiresOrderTiming = !!mockVendor.requiresOrderTiming;
  const hasScheduledDateTime = !!(preferredDate);

  const canSubmit = checkCanSubmitOrder({
    selectedFulfillment,
    itemsCount: items.length,
    isBelowMinimum,
    isVendorUnavailable,
    hasItemsRequiringSelection,
    requiresOrderTiming,
    timingPreference,
    hasScheduledDateTime,
  });

  const vendorCurrency: Currency =
    (mockVendor.currency as Currency) || getCurrencyFromCountryCode(mockVendor.countryCode);


  useEffect(() => {
    if (vendorId) {
      setActiveVendor(vendorId, mockVendor.name);
    }
  }, [vendorId, setActiveVendor]);

  useEffect(() => {
    if (reorderIssuesParam) {
      try {
        const issues: ReorderIssue[] = JSON.parse(reorderIssuesParam);
        if (issues.length > 0) {
          setReorderIssues(issues);
          setShowReorderBanner(true);
        }
      } catch (error) {
        console.error('Failed to parse reorder issues:', error);
      }
    }
  }, [reorderIssuesParam]);

  const isCartEmpty = items.length === 0;

  const handleBackPress = useCallback(() => {
    safeBack();
  }, [safeBack]);

  const handleAddMore = useCallback(() => {
    const vid = vendorId || activeVendorId || mockVendor.id;
    const path = getVendorStorefrontPath(vid);
    console.log('[Cart] Add more → navigating to storefront:', path);
    router.push(path as any);
  }, [vendorId, activeVendorId, router]);

  const handleApplyPromo = useCallback(() => {
    setPromoError('');
    setPromoSuccess('');

    if (!promoInputValue.trim()) {
      setPromoError('Please enter a promo code');
      return;
    }

    setIsValidating(true);

    setTimeout(() => {
      const validation = validatePromoCode(promoInputValue, subtotal);

      if (validation.valid) {
        console.log('Applying promo code:', promoInputValue.toUpperCase());
        setPromoCode(promoInputValue.toUpperCase());
        setPromoApplied(true);
        setManualDiscount(validation.discount);
        setPromoSuccess(validation.message);
        setPromoError('');
      } else {
        setPromoError(validation.message);
        setPromoSuccess('');
      }

      setIsValidating(false);
    }, 500);
  }, [promoInputValue, subtotal]);

  const handleRemovePromo = useCallback(() => {
    setPromoApplied(false);
    setManualDiscount(0);
    setPromoCode('');
    setPromoInputValue('');
    setPromoError('');
    setPromoSuccess('');
  }, []);

  const handleItemNamePress = useCallback(
    (_itemId: string, index: number) => {
      console.log('[Cart] Opening item detail modal for index:', index);
      setSelectedCartItemIndex(index);
    },
    []
  );

  const handleOpenDateTimePicker = useCallback(() => {
    setDateTimeError('');
    setIsDateTimeModalVisible(true);
  }, []);

  const proceedToReviewOrder = useCallback(() => {
    console.log('Navigating to review order:', {
      vendor: mockVendor.name,
      fulfillmentType: selectedFulfillment,
      subtotal,
      tax,
      discount,
      total,
    });

    const navParams = buildReviewOrderNavigationParams({
      fulfillmentType: selectedFulfillment,
      orderNote,
      subtotal,
      tax,
      discount,
      total,
      items,
      promoCode,
      promoApplied,
      preferredDate,
      preferredTime,
      selectedContactCard,
    });

    router.push({ pathname: '/review-order' as any, params: navParams as any });
  }, [
    selectedFulfillment,
    orderNote,
    subtotal,
    tax,
    discount,
    total,
    items,
    promoCode,
    promoApplied,
    preferredDate,
    preferredTime,
    selectedContactCard,
    router,
  ]);

  const handleTimingPreferenceChange = useCallback((pref: 'flexible' | 'schedule') => {
    setTimingPreference(pref);
    setDateTimeError('');
    if (pref === 'flexible') {
      setPreferredDate(null);
      setPreferredTime('');
    }
  }, []);

  const handleSubmitOrderRequest = useCallback(() => {
    if (!canSubmit) {
      if (requiresOrderTiming && timingPreference === 'schedule' && !hasScheduledDateTime) {
        setDateTimeError('Please select a preferred date & time');
        return;
      }
      Alert.alert('Select Fulfillment', 'Please select a fulfillment type to continue');
      return;
    }

    const currentVendorId = vendorId || activeVendorId || mockVendor.id;
    const availableSuggestions = mockMenuItems.filter(
      (menuItem) => menuItem.inStock && !items.some((cartItem) => cartItem.id === menuItem.id)
    );
    const shouldShowUpsell =
      availableSuggestions.length > 0 && !upsellShownRef.current.has(currentVendorId);

    if (shouldShowUpsell) {
      console.log(
        `[UPSELL] Showing upsell modal for vendor ${currentVendorId}, ${availableSuggestions.length} suggestions`
      );
      upsellShownRef.current.add(currentVendorId);
      setIsUpsellVisible(true);
      return;
    }

    proceedToReviewOrder();
  }, [
    canSubmit,
    vendorId,
    activeVendorId,
    items,
    requiresOrderTiming,
    timingPreference,
    hasScheduledDateTime,
    proceedToReviewOrder,
  ]);

  const formatPreferredDateTime = useCallback(() => {
    if (!preferredDate) return null;
    const dateStr = preferredDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return preferredTime ? `${dateStr} • ${preferredTime}` : dateStr;
  }, [preferredDate, preferredTime]);

  const handleConfirmDateTime = useCallback(() => {
    if (preferredDate) {
      const now = new Date();
      const selectedDateTime = new Date(preferredDate);

      let hour24 = selectedHour;
      if (selectedPeriod === 'PM' && selectedHour !== 12) {
        hour24 = selectedHour + 12;
      } else if (selectedPeriod === 'AM' && selectedHour === 12) {
        hour24 = 0;
      }

      selectedDateTime.setHours(hour24, selectedMinute, 0, 0);

      const isToday = preferredDate.toDateString() === now.toDateString();
      if (isToday && selectedDateTime <= now) {
        Alert.alert('Invalid Time', 'Please select a future time.');
        return;
      }

      const formattedTime = `${selectedHour}:${selectedMinute.toString().padStart(2, '0')} ${selectedPeriod}`;
      setPreferredTime(formattedTime);
    }
    setIsDateTimeModalVisible(false);
  }, [preferredDate, selectedHour, selectedMinute, selectedPeriod]);

  const handleRemoveDateTime = useCallback(() => {
    setPreferredDate(null);
    setPreferredTime('');
    setIsDateTimeModalVisible(false);
  }, []);

  const handleSelectContactCard = useCallback((card: ContactCard) => {
    setSelectedContactCard(card);
    setShowContactCardPicker(false);
  }, []);

  return {
    // Data
    items,
    mockVendor,
    mockMenuItems,
    vendorId,
    activeVendorId,
    vendorCurrency,
    insets,

    // Cart state
    subtotal,
    tax,
    total,
    discount,
    isCartLocked,
    lockConfig,
    isVendorUnavailable,
    isBelowMinimum,
    hasItemsRequiringSelection,
    canSubmit,

    // Reorder
    reorderIssues,
    showReorderBanner,
    expandedDetails,
    setExpandedDetails,

    // Fulfillment
    selectedFulfillment,
    setSelectedFulfillment,

    // Promo
    promoApplied,
    promoCode,
    promoInputValue,
    setPromoInputValue,
    promoError,
    promoSuccess,
    isValidating,
    appliedPromotions,
    evaluatedPromotions,
    vendorPromotions,
    vendorStackingMode,
    autoDiscount,
    showPromotionsModal,
    setShowPromotionsModal,

    // Date/Time
    timingPreference,
    handleTimingPreferenceChange,
    requiresOrderTiming,
    hasScheduledDateTime,
    dateTimeError,
    setDateTimeError,
    preferredDate,
    setPreferredDate,
    preferredTime,
    isDateTimeModalVisible,
    setIsDateTimeModalVisible,
    handleOpenDateTimePicker,
    selectedMonth,
    setSelectedMonth,
    selectedHour,
    setSelectedHour,
    selectedMinute,
    setSelectedMinute,
    selectedPeriod,
    setSelectedPeriod,

    // Contact
    showContactCardPicker,
    setShowContactCardPicker,
    selectedContactCard,

    // Note
    orderNote,
    setOrderNote,

    // Policy
    isPolicyModalVisible,
    setIsPolicyModalVisible,

    // Cart item modal
    selectedCartItemIndex,
    setSelectedCartItemIndex,

    // Upsell
    isUpsellVisible,
    setIsUpsellVisible,

    // Cart actions
    addItem,
    removeItem,
    updateItemQuantity,
    removeItemByIndex,

    // State
    isCartEmpty,

    // Savings
    totalItemSavings,
    originalSubtotal,
    totalSavings,

    // Handlers
    handleBackPress,
    handleAddMore,
    handleApplyPromo,
    handleRemovePromo,
    handleItemNamePress,
    proceedToReviewOrder,
    handleSubmitOrderRequest,
    formatPreferredDateTime,
    handleConfirmDateTime,
    handleRemoveDateTime,
    handleSelectContactCard,
  };
}
