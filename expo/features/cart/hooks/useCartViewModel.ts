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
import { mockVendor, mockMenuItems, type Vendor, type MenuItem } from '@/mocks/vendorData';
import { vendorRepository } from '@/services/repositories/vendorRepository';
import { catalogService } from '@/services/catalogService';
import {
  calculateTax,
  calculateTotal,
  validatePromoCode,
  checkCanSubmitOrder,
} from '@/features/cart/selectors/cartSelectors';
import { buildReviewOrderNavigationParams } from '@/features/cart/actions/cartActions';
import { evaluatePromotionsWithStatus, getActivePromotions, type AppliedPromotion, type VendorPromotion, type EvaluatedPromotion, type StackingMode } from '@/mocks/promotionsData';
import { usePrimeVendorPromotions } from '@/contexts/PromoContext';
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

  /**
   * Every field below used to read from `mockVendor` (the single hardcoded
   * "Spicy Restaurant" fixture) directly and unconditionally — not even
   * `mockVendors.find(v => v.id === vendorId)`. That meant every real
   * vendor's cart screen showed Spicy Restaurant's name, policy, tax rate
   * and enabled/disabled state, currency, minimum order amount, fulfillment
   * types and open/closed status, regardless of which vendor the customer
   * actually had items from — the exact "wrong vendor shown" / "wrong
   * currency" class of bug already fixed elsewhere (see
   * app/chat/[vendorId].tsx's vendorRepository.getById lookup). Resolving
   * the real vendor live and falling back to the fixture only while it is
   * still loading (or if it never resolves) fixes this without changing the
   * shape CartScreen.tsx already reads (`vm.mockVendor.*`).
   */
  const effectiveVendorId = vendorId || activeVendorId;
  const [liveCartVendor, setLiveCartVendor] = useState<Vendor | undefined>(undefined);
  useEffect(() => {
    if (!effectiveVendorId) {
      setLiveCartVendor(undefined);
      return;
    }
    let cancelled = false;
    void vendorRepository.getById(effectiveVendorId).then((v) => {
      if (!cancelled) setLiveCartVendor(v);
    });
    return () => { cancelled = true; };
  }, [effectiveVendorId]);
  const effectiveVendor: Vendor = liveCartVendor ?? mockVendor;

  // The upsell modal's "suggestions" (below, in handleSubmitOrderRequest)
  // and the raw `mockMenuItems` this hook hands back to CartScreen.tsx were
  // always the fixed twelve-item fixture catalog, regardless of which real
  // vendor the cart belongs to. A customer could tap "add" on a suggested
  // item that isn't in the real vendor's catalog at all, which the backend's
  // repriceCart would then reject at checkout. catalogService.getVendorMenu
  // is the same live per-vendor catalog read already used for storefront
  // listings and the item-detail "More from this vendor" section.
  const [liveCartMenuItems, setLiveCartMenuItems] = useState<MenuItem[]>([]);
  useEffect(() => {
    if (!effectiveVendorId) {
      setLiveCartMenuItems([]);
      return;
    }
    let cancelled = false;
    void catalogService.getVendorMenu(effectiveVendorId).then((menu) => {
      if (!cancelled) setLiveCartMenuItems(menu.items);
    }).catch((err) => {
      console.error('[Cart] Could not load vendor menu for upsell suggestions:', err);
      if (!cancelled) setLiveCartMenuItems([]);
    });
    return () => { cancelled = true; };
  }, [effectiveVendorId]);
  const effectiveMenuItems: MenuItem[] = effectiveVendorId ? liveCartMenuItems : mockMenuItems;

  const isCartLocked = orderStatusParam ? isOrderLocked(orderStatusParam) : false;
  const lockConfig = orderStatusParam ? getOrderLockConfig(orderStatusParam, effectiveVendor.name) : null;

  const [reorderIssues, setReorderIssues] = useState<ReorderIssue[]>([]);
  const [showReorderBanner, setShowReorderBanner] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState(false);

  const [selectedFulfillment, setSelectedFulfillment] = useState<FulfillmentType>(
    effectiveVendor.fulfillmentTypes.length === 1
      ? (effectiveVendor.fulfillmentTypes[0] as FulfillmentType)
      : 'Pickup'
  );

  // The live vendor resolves asynchronously (see effectiveVendor above), so
  // the useState initializer above only ever saw the mockVendor fixture on
  // first render. Once the real vendor loads, re-derive the selection the
  // same way so a delivery-only (or pickup-only) vendor doesn't leave the
  // customer stuck on a default the vendor doesn't actually offer, with the
  // toggle disabled because it only has one real option.
  useEffect(() => {
    if (effectiveVendor.fulfillmentTypes.length === 1) {
      setSelectedFulfillment(effectiveVendor.fulfillmentTypes[0] as FulfillmentType);
    }
  }, [effectiveVendor.fulfillmentTypes]);

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
  const vendorStackingMode: StackingMode = effectiveVendor.promoStackingMode || 'single';
  usePrimeVendorPromotions(currentVendorIdForPromo);

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
  const tax = calculateTax(subtotal, effectiveVendor.taxEnabled, effectiveVendor.taxRate);
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

  const isBelowMinimum = !!(effectiveVendor.minimumOrderAmount && subtotal < effectiveVendor.minimumOrderAmount);
  const isVendorUnavailable = effectiveVendor.storeStatus === 'closed';
  const hasItemsRequiringSelection = items.some((item) => item.requiresSelection);
  const requiresOrderTiming = !!effectiveVendor.requiresOrderTiming;
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
    (effectiveVendor.currency as Currency) || getCurrencyFromCountryCode(effectiveVendor.countryCode);


  useEffect(() => {
    if (vendorId) {
      // Re-runs once the live vendor resolves (effectiveVendor.name changes
      // from the fixture "Spicy Restaurant" to the real name), so the
      // active-vendor label tracked in CartContext catches up.
      setActiveVendor(vendorId, effectiveVendor.name);
    }
  }, [vendorId, effectiveVendor.name, setActiveVendor]);

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
    // getVendorStorefrontPath only resolves a username for the ten demo
    // vendor ids — a dead "Add more" tap for a real vendor's cart.
    // effectiveVendor carries the live vendor's real username once resolved.
    const path = effectiveVendor.username ? `/store/${effectiveVendor.username.toLowerCase()}` : getVendorStorefrontPath(vid);
    console.log('[Cart] Add more → navigating to storefront:', path);
    router.push(path as any);
  }, [vendorId, activeVendorId, effectiveVendor.username, router]);

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
      vendor: effectiveVendor.name,
      fulfillmentType: selectedFulfillment,
      subtotal,
      tax,
      discount,
      total,
    });

    const navParams = buildReviewOrderNavigationParams({
      // buildReviewOrderNavigationParams accepts vendorId specifically so
      // review-order.tsx knows which real vendor this basket belongs to
      // (its own comment there explains why: without it, every order was
      // attributed to the demo vendor). This call site never actually
      // passed it, so `vendorId` on the review screen was always ''
      // regardless of that fix — every checkout still landed on
      // review-order.tsx unable to resolve a real vendor.
      vendorId: effectiveVendorId ?? undefined,
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
    effectiveVendorId,
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
    const availableSuggestions = effectiveMenuItems.filter(
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
    effectiveMenuItems,
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
    // Keys kept as `mockVendor`/`mockMenuItems` for CartScreen.tsx's existing
    // `vm.mockVendor.*` / `vm.mockMenuItems` reads, but the values are now
    // the live-resolved vendor/catalog (see effectiveVendor/effectiveMenuItems
    // above), falling back to the fixtures only while unresolved.
    mockVendor: effectiveVendor,
    mockMenuItems: effectiveMenuItems,
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
