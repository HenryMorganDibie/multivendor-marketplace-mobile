import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert } from '@/utils/alert';
import { useCart, type ReorderIssue } from '@/contexts/CartContext';
import { useCountryStatus } from '@/contexts/CountryStatusContext';
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
import {
  evaluatePromotionsWithStatus,
  getActivePromotions,
  type AppliedPromotion,
  type VendorPromotion,
  type EvaluatedPromotion,
  type StackingMode,
} from '@/mocks/promotionsData';
import { getVendorStorefrontPath } from '@/utils/vendorLookup';
import { getMenuItemDisplayPrice, hasItemSalePrice } from '@/utils/itemPricing';
import { isVendorCurrentlyOpen, getNextOpenTime } from '@/utils/vendorAvailability';

type FulfillmentType = 'Pickup' | 'Delivery' | null;

export function useCartViewModel() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const safeBack = useSafeBack();

  const vendorId = params.vendorId as string | undefined;
  const reorderIssuesParam = params.reorderIssues as string | undefined;
  const orderStatusParam = params.orderStatus as OrderStatus | undefined;

  const { items, addItem, updateItemQuantity, removeItemByIndex, totalPrice, setActiveVendor, activeVendorId } =
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
  const [preferredDate, setPreferredDate] = useState<Date | null>(null);
  const [preferredTime, setPreferredTime] = useState<string>('');
  const [isDateTimeModalVisible, setIsDateTimeModalVisible] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('PM');
  const [showContactCardPicker, setShowContactCardPicker] = useState(false);
  const [selectedContactCard, setSelectedContactCard] = useState<ContactCard | null>(null);
  const [isUpsellVisible, setIsUpsellVisible] = useState(false);
  const [manuallySelectedPromoId, setManuallySelectedPromoId] = useState<string | null>(null);
  const [editingCartItemIndex, setEditingCartItemIndex] = useState<number | null>(null);
  const [isCartItemEditModalVisible, setIsCartItemEditModalVisible] = useState(false);
  const upsellShownRef = useRef<Set<string>>(new Set());

  const subtotal = totalPrice;

  const cartItemIds = items.map((i) => i.id);
  const cartItemQuantities = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.id] = (acc[item.id] || 0) + item.quantity;
    return acc;
  }, {});

  const currentVendorIdForPromo = vendorId || activeVendorId || mockVendor.id;
  const vendorStackingMode: StackingMode = mockVendor.promoStackingMode || 'single';

  const rawEvaluatedPromotions: EvaluatedPromotion[] = evaluatePromotionsWithStatus(
    currentVendorIdForPromo,
    subtotal,
    cartItemIds,
    cartItemQuantities,
    vendorStackingMode
  );

  let evaluatedPromotions = rawEvaluatedPromotions;
  if (manuallySelectedPromoId) {
    const targetEp = rawEvaluatedPromotions.find(e => e.promotion.id === manuallySelectedPromoId);
    if (targetEp && targetEp.eligible) {
      evaluatedPromotions = rawEvaluatedPromotions.map(e => {
        if (e.promotion.id === manuallySelectedPromoId) {
          return { ...e, status: 'selected' as const };
        }
        if (e.status === 'selected') {
          return { ...e, status: 'available' as const };
        }
        return e;
      });
    } else if (targetEp && !targetEp.eligible) {
      setManuallySelectedPromoId(null);
    }
  }

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
  const isVendorClosed = !isVendorCurrentlyOpen(mockVendor);
  const vendorNextOpenTime = isVendorClosed ? getNextOpenTime(mockVendor) : '';
  const hasItemsRequiringSelection = items.some((item) => item.requiresSelection);
  const [showClosedVendorModal, setShowClosedVendorModal] = useState(false);

  const canSubmit = checkCanSubmitOrder({
    selectedFulfillment,
    itemsCount: items.length,
    isBelowMinimum,
    isVendorUnavailable: false,
    hasItemsRequiringSelection,
  });

  const vendorCurrency: Currency =
    (mockVendor.currency as Currency) || getCurrencyFromCountryCode(mockVendor.countryCode);

  const { orderingAllowed, isComingSoon, countryName } = useCountryStatus();

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

  useEffect(() => {
    if (manuallySelectedPromoId) {
      const targetEp = rawEvaluatedPromotions.find(e => e.promotion.id === manuallySelectedPromoId);
      if (targetEp && !targetEp.eligible) {
        console.log('[PromoSelection] Manual selection became ineligible, resetting');
        setManuallySelectedPromoId(null);
      }
    }
  }, [subtotal, manuallySelectedPromoId, rawEvaluatedPromotions]);

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

  const handlePromoSelection = useCallback((promoId: string) => {
    const ep = rawEvaluatedPromotions.find(e => e.promotion.id === promoId);
    if (!ep || !ep.eligible) {
      console.log('[PromoSelection] Cannot select ineligible promo:', promoId);
      return;
    }
    setManuallySelectedPromoId(prev => {
      const next = prev === promoId ? null : promoId;
      console.log('[PromoSelection] Manual selection:', next);
      return next;
    });
  }, [rawEvaluatedPromotions]);

  const handleItemNamePress = useCallback(
    (itemId: string) => {
      console.log('[Cart] Opening item edit modal for:', itemId);
      const idx = items.findIndex((i) => i.id === itemId);
      if (idx >= 0) {
        setEditingCartItemIndex(idx);
        setIsCartItemEditModalVisible(true);
      }
    },
    [items]
  );

  const editingCartItem = editingCartItemIndex !== null ? items[editingCartItemIndex] ?? null : null;

  const handleCloseCartItemEditModal = useCallback(() => {
    setIsCartItemEditModalVisible(false);
    setEditingCartItemIndex(null);
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

  const handleSubmitOrderRequest = useCallback(() => {
    if (!orderingAllowed) {
      Alert.alert(
        'Ordering Unavailable',
        isComingSoon
          ? `Platform is coming soon to ${countryName}. Ordering is not yet available.`
          : `Ordering is not yet available in ${countryName}. Vendors are currently waitlisted.`,
        [{ text: 'OK' }]
      );
      return;
    }

    if (!canSubmit) {
      Alert.alert('Select Fulfillment', 'Please select a fulfillment type to continue');
      return;
    }

    if (isVendorClosed) {
      console.log('[Cart] Vendor is closed, showing closed vendor modal');
      setShowClosedVendorModal(true);
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
    orderingAllowed,
    isComingSoon,
    countryName,
    canSubmit,
    vendorId,
    activeVendorId,
    items,
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
    items,
    mockVendor,
    mockMenuItems,
    vendorId,
    activeVendorId,
    vendorCurrency,
    insets,

    subtotal,
    originalSubtotal,
    tax,
    total,
    discount,
    isCartLocked,
    lockConfig,
    isVendorClosed,
    vendorNextOpenTime,
    showClosedVendorModal,
    setShowClosedVendorModal,
    isBelowMinimum,
    hasItemsRequiringSelection,
    canSubmit,

    reorderIssues,
    showReorderBanner,
    expandedDetails,
    setExpandedDetails,

    selectedFulfillment,
    setSelectedFulfillment,

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

    preferredDate,
    setPreferredDate,
    preferredTime,
    isDateTimeModalVisible,
    setIsDateTimeModalVisible,
    selectedMonth,
    setSelectedMonth,
    selectedHour,
    setSelectedHour,
    selectedMinute,
    setSelectedMinute,
    selectedPeriod,
    setSelectedPeriod,

    showContactCardPicker,
    setShowContactCardPicker,
    selectedContactCard,

    orderNote,
    setOrderNote,

    isPolicyModalVisible,
    setIsPolicyModalVisible,

    isUpsellVisible,
    setIsUpsellVisible,

    isCartItemEditModalVisible,
    editingCartItem,
    editingCartItemIndex: editingCartItemIndex ?? -1,
    handleCloseCartItemEditModal,

    addItem,
    updateItemQuantity,
    removeItemByIndex,

    isCartEmpty,
    totalItemSavings,
    totalSavings,

    handleBackPress,
    handleAddMore,
    handleApplyPromo,
    handleRemovePromo,
    handlePromoSelection,
    handleItemNamePress,
    proceedToReviewOrder,
    handleSubmitOrderRequest,
    formatPreferredDateTime,
    handleConfirmDateTime,
    handleRemoveDateTime,
    handleSelectContactCard,
  };
}
