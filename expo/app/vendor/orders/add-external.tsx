import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  Animated,
  PanResponder,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Alert } from '@/utils/alert';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import {
  Plus,
  Package,
  Edit3,
  Trash2,
  ChevronLeft,
  Upload,
  X,
  Calendar,
  ChevronDown,
  Check,
  Minus,
  Clock,
  Truck,
  Wrench,
  Tag,
  Lock,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCatalog } from '@/contexts/CatalogContext';
import LaektivaModal from '@/components/LaektivaModal';
import DiscardChangesModal from '@/components/DiscardChangesModal';
import EditScreenHeader from '@/components/EditScreenHeader';
import { useUnsavedChanges } from '@/utils/useUnsavedChanges';
import { formatPriceWithCommas, getCurrencySymbol, type Currency } from '@/utils/formatPrice';
import { useVendor } from '@/contexts/VendorContext';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import { callable } from '@/lib/firebase';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  /** Set only for items added from the catalog. createExternalOrder needs a
   * real catalogItems doc id and has no path for a manually typed item. */
  catalogItemId?: string;
}

interface SwipeableItemProps {
  item: OrderItem;
  onDelete: (id: string) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  currency: Currency;
}

function SwipeableItemRow({ item, onDelete, onUpdateQuantity, isOpen, onOpen, onClose, currency }: SwipeableItemProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(Math.max(gestureState.dx, -80));
        } else if (isOpen && gestureState.dx > 0) {
          translateX.setValue(Math.max(-80, -80 + gestureState.dx));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -40) {
          Animated.spring(translateX, {
            toValue: -80,
            useNativeDriver: true,
          }).start(() => onOpen());
        } else if (isOpen && gestureState.dx > 20) {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start(() => onClose());
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start(() => onClose());
        }
      },
    })
  ).current;

  useEffect(() => {
    if (!isOpen) {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  }, [isOpen, translateX]);

  const handleDelete = () => {
    Animated.timing(translateX, {
      toValue: -400,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onDelete(item.id);
      onClose();
    });
  };

  const lineTotal = item.quantity * item.price;

  return (
    <View style={styles.swipeableContainer}>
      <View style={styles.deleteButtonContainer}>
        <TouchableOpacity
          onPress={handleDelete}
          style={styles.deleteButton}
          activeOpacity={0.7}
        >
          <Trash2 size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <Animated.View
        style={[
          styles.itemCard,
          { transform: [{ translateX }] },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.itemCardLeft}>
          <Text style={styles.itemCardName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.itemCardUnitPrice}>
            {formatPriceWithCommas(item.price, currency)} × {item.quantity}
          </Text>
          <View style={styles.quantityStepper}>
            <TouchableOpacity
              onPress={() => onUpdateQuantity(item.id, -1)}
              style={[styles.stepperBtn, item.quantity <= 1 && styles.stepperBtnDisabled]}
              activeOpacity={0.7}
              disabled={item.quantity <= 1}
            >
              <Minus size={14} color={item.quantity <= 1 ? Colors.textMuted : Colors.text} />
            </TouchableOpacity>
            <Text style={styles.stepperValue}>{item.quantity}</Text>
            <TouchableOpacity
              onPress={() => onUpdateQuantity(item.id, 1)}
              style={styles.stepperBtn}
              activeOpacity={0.7}
            >
              <Plus size={14} color={Colors.text} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.itemCardTotal}>
          {formatPriceWithCommas(lineTotal, currency)}
        </Text>
      </Animated.View>
    </View>
  );
}

type FulfillmentType = 'Pickup' | 'Delivery' | 'Service' | 'Event' | 'Other';
type PaymentStatusOption = 'payment_pending' | 'partially_received' | 'payment_received';

const FULFILLMENT_OPTIONS: FulfillmentType[] = ['Pickup', 'Delivery', 'Service', 'Event', 'Other'];
const PAYMENT_STATUS_OPTIONS: { value: PaymentStatusOption; label: string }[] = [
  { value: 'payment_pending', label: 'Pending' },
  { value: 'partially_received', label: 'Partial Payment' },
  { value: 'payment_received', label: 'Paid' },
];

interface DropdownProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
  placeholder?: string;
}

function DropdownSelector({ label, value, options, onSelect, placeholder }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find(o => o.value === value)?.label || '';

  return (
    <>
      <TouchableOpacity
        style={styles.dropdownTrigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={selectedLabel ? styles.dropdownValue : styles.dropdownPlaceholder}>
          {selectedLabel || placeholder || 'Select...'}
        </Text>
        <ChevronDown size={18} color={Colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={styles.dropdownSheet}>
            <View style={styles.dropdownSheetHandle} />
            <Text style={styles.dropdownSheetTitle}>{label}</Text>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.dropdownOption,
                  opt.value === value && styles.dropdownOptionActive,
                ]}
                onPress={() => {
                  onSelect(opt.value);
                  setOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dropdownOptionText,
                  opt.value === value && styles.dropdownOptionTextActive,
                ]}>
                  {opt.label}
                </Text>
                {opt.value === value && (
                  <Check size={18} color={Colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

export default function RecordExternalOrderScreen() {
  const router = useRouter();
  const { plan } = useVendorPlan();
  const { vendor } = useVendor();
  const canUseScreenshots = plan === 'pro' || plan === 'pro+';
  const vendorCurrency = (vendor.currency as Currency) || 'NGN';

  const [items, setItems] = useState<OrderItem[]>([]);
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('Pickup');
  const [fulfillmentDateTime, setFulfillmentDateTime] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [address, setAddress] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');

  const [customerName, setCustomerName] = useState('');

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusOption>('payment_pending');
  const [amountReceived, setAmountReceived] = useState('');

  const [notes, setNotes] = useState('');
  const [screenshots, setScreenshots] = useState<string[]>([]);

  const [showAddItemMenu, setShowAddItemMenu] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showManualItemModal, setShowManualItemModal] = useState(false);
  const [manualItemName, setManualItemName] = useState('');
  const [manualItemPrice, setManualItemPrice] = useState('');
  const [manualItemQuantity, setManualItemQuantity] = useState('1');

  const [catalogSelectedIds, setCatalogSelectedIds] = useState<Set<string>>(new Set());
  const [showWebDatePicker, setShowWebDatePicker] = useState(false);

  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxPercentage, setTaxPercentage] = useState(0);

  const [showDeliveryFee, setShowDeliveryFee] = useState(false);
  const [deliveryFeeInput, setDeliveryFeeInput] = useState('');
  const [showServiceFee, setShowServiceFee] = useState(false);
  const [serviceFeeInput, setServiceFeeInput] = useState('');

  const [showDiscount, setShowDiscount] = useState(false);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('fixed');
  const [discountValueInput, setDiscountValueInput] = useState('');
  const [showDiscountTypeSheet, setShowDiscountTypeSheet] = useState(false);

  const { items: catalogItems } = useCatalog();

  useEffect(() => {
    const loadTaxSettings = async () => {
      try {
        const stored = await AsyncStorage.getItem('taxSettings');
        if (stored) {
          const settings = JSON.parse(stored);
          if (settings.collectTax && settings.taxPercentage > 0) {
            setTaxEnabled(true);
            setTaxPercentage(settings.taxPercentage);
            console.log('Tax settings loaded:', settings);
          }
        }
      } catch (error) {
        console.error('Error loading tax settings for external order:', error);
      }
    };
    void loadTaxSettings();
  }, []);

  const unsavedChanges = useUnsavedChanges(
    {
      items,
      fulfillmentType,
      fulfillmentDateTime,
      address,
      deliveryNote,
      customerName,
      paymentStatus,
      amountReceived,
      notes,
      screenshots,
      showDeliveryFee,
      deliveryFeeInput,
      showServiceFee,
      serviceFeeInput,
      showDiscount,
      discountType,
      discountValueInput,
    },
    false
  );

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = parseFloat(deliveryFeeInput) || 0;
  const serviceFee = parseFloat(serviceFeeInput) || 0;
  const discountInputVal = parseFloat(discountValueInput) || 0;
  const discountAmount = discountType === 'percentage'
    ? Math.round((subtotal * Math.min(discountInputVal, 100) / 100) * 100) / 100
    : Math.min(discountInputVal, subtotal);
  const afterFees = subtotal + deliveryFee + serviceFee - discountAmount;
  const taxAmount = taxEnabled ? Math.round((afterFees * taxPercentage / 100) * 100) / 100 : 0;
  const total = Math.max(0, afterFees + taxAmount);
  const canSave = items.length > 0;

  const formatDateTimeDisplay = useCallback((date: Date): string => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = days[date.getDay()];
    const month = months[date.getMonth()];
    const dateNum = date.getDate();
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minuteStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${day}, ${month} ${dateNum} \u2022 ${hours}:${minuteStr} ${ampm}`;
  }, []);

  const handlePickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5,
    });

    if (!result.canceled && result.assets) {
      const newUris = result.assets.map(asset => asset.uri);
      const totalImages = screenshots.length + newUris.length;
      if (totalImages > 5) {
        Alert.alert('Too Many Images', 'Maximum 5 screenshots per order.');
        return;
      }
      setScreenshots([...screenshots, ...newUris]);
    }
  };

  const handleRemoveScreenshot = (index: number) => {
    setScreenshots(screenshots.filter((_, i) => i !== index));
  };

  const handleAddItem = () => {
    setOpenRowId(null);
    setShowAddItemMenu(true);
  };

  const handleSelectFromCatalog = () => {
    setShowAddItemMenu(false);
    setCatalogSelectedIds(new Set());
    setShowCatalogModal(true);
  };

  const handleAddManualItem = () => {
    setShowAddItemMenu(false);
    setShowManualItemModal(true);
  };

  const handleToggleCatalogItem = (itemId: string) => {
    setCatalogSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleAddSelectedCatalogItems = () => {
    const newItems: OrderItem[] = [];
    catalogSelectedIds.forEach(id => {
      const catalogItem = catalogItems.find(ci => ci.id === id);
      if (catalogItem) {
        newItems.push({
          id: `${catalogItem.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: catalogItem.name,
          quantity: 1,
          price: catalogItem.salePrice || catalogItem.basePrice,
          catalogItemId: catalogItem.id,
        });
      }
    });
    setItems(prev => [...prev, ...newItems]);
    setCatalogSelectedIds(new Set());
    setShowCatalogModal(false);
    console.log('Added', newItems.length, 'items from catalog');
  };

  const handleSaveManualItem = () => {
    if (!manualItemName.trim()) {
      Alert.alert('Item Name Required', 'Please enter an item name.');
      return;
    }
    if (!manualItemPrice || parseFloat(manualItemPrice) <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price.');
      return;
    }
    const quantity = parseInt(manualItemQuantity) || 1;
    if (quantity <= 0) {
      Alert.alert('Invalid Quantity', 'Quantity must be at least 1.');
      return;
    }

    const newItem: OrderItem = {
      id: `manual_${Date.now()}`,
      name: manualItemName,
      quantity,
      price: parseFloat(manualItemPrice),
    };
    setItems([...items, newItem]);
    setShowManualItemModal(false);
    setManualItemName('');
    setManualItemPrice('');
    setManualItemQuantity('1');
    console.log('Manual item added:', newItem.name);
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
    setOpenRowId(null);
  };

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setItems(items.map(i => {
      if (i.id === itemId) {
        const newQuantity = i.quantity + delta;
        return newQuantity > 0 ? { ...i, quantity: newQuantity } : i;
      }
      return i;
    }));
  };

  const getFulfillmentDate = (): string => {
    return `${fulfillmentDateTime.getFullYear()}-${String(fulfillmentDateTime.getMonth() + 1).padStart(2, '0')}-${String(fulfillmentDateTime.getDate()).padStart(2, '0')}`;
  };

  const getFulfillmentTime = (): string => {
    let hours = fulfillmentDateTime.getHours();
    const minutes = fulfillmentDateTime.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes < 10 ? '0' : ''}${minutes} ${ampm}`;
  };

  /**
   * createExternalOrder (Milestone 2, real backend) only accepts customer
   * name/phone, real catalogItems by id, fulfillment type (pickup/delivery/
   * shipping), and a note. Everything below that isn't one of those is a
   * screen input with nowhere to go yet on the backend — order source,
   * payment status, fees, discount, tax, screenshots, manual items, editing
   * or deleting after save. Rather than silently drop what the vendor typed
   * (a fee they added would just vanish from the real order with no sign of
   * it), this blocks save and says exactly which field isn't wired rather
   * than pretending everything on screen was recorded.
   */
  const getUnsupportedFieldReason = (): string | null => {
    if (items.some((i) => !i.catalogItemId)) {
      return 'One or more items were typed in manually. Only items from your catalog can be recorded right now.';
    }
    if (fulfillmentType !== 'Pickup' && fulfillmentType !== 'Delivery') {
      return `"${fulfillmentType}" fulfillment isn't supported yet. Use Pickup or Delivery for now.`;
    }
    if (deliveryFee > 0 || serviceFee > 0) {
      return 'Delivery and service fees aren\'t recorded on the real order yet. Remove them to save, or note them separately for now.';
    }
    if (discountAmount > 0) {
      return 'Discounts aren\'t recorded on the real order yet. Remove the discount to save.';
    }
    if (taxEnabled) {
      return 'Tax isn\'t recorded on the real order yet. Turn off tax to save.';
    }
    if (paymentStatus !== 'payment_pending') {
      return 'Payment status isn\'t recorded on the real order yet, it would show as pending regardless. Recording is still fine if that\'s acceptable for now.';
    }
    if (screenshots.length > 0) {
      return 'Screenshots aren\'t saved anywhere yet. Remove them to save this order.';
    }
    return null;
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (items.length === 0) {
      Alert.alert('Items Required', 'Please add at least one item.');
      return;
    }

    if (paymentStatus === 'partially_received') {
      if (!amountReceived || parseFloat(amountReceived) <= 0) {
        Alert.alert('Amount Required', 'Please enter the amount received.');
        return;
      }
      if (parseFloat(amountReceived) >= total) {
        Alert.alert('Invalid Amount', 'Amount received must be less than the total.');
        return;
      }
    }

    const blockedReason = getUnsupportedFieldReason();
    if (blockedReason) {
      Alert.alert('Not recorded on the real order yet', blockedReason);
      return;
    }

    setIsSaving(true);
    try {
      const createExternalOrder = callable<
        {
          externalCustomerName: string;
          externalCustomerPhone?: string;
          items: { itemId: string; quantity: number }[];
          fulfillmentType: 'pickup' | 'delivery';
          orderNote?: string;
        },
        { success: true; orderId: string; publicOrderId: string }
      >('createExternalOrder');

      await createExternalOrder({
        externalCustomerName: customerName.trim() || 'Walk-in customer',
        items: items.map((i) => ({ itemId: i.catalogItemId!, quantity: i.quantity })),
        fulfillmentType: fulfillmentType === 'Delivery' ? 'delivery' : 'pickup',
        orderNote: notes.trim() || undefined,
      });

      unsavedChanges.resetChanges();
      Alert.alert(
        'Order recorded',
        'This order needs your acceptance within 48 hours, same as any other order, since it now lives on your real order list rather than just this device.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      const message = (error as { message?: string })?.message
        ?? 'Could not record this order. Please try again.';
      Alert.alert('Could not record order', message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (!unsavedChanges.handleExitAttempt()) {
      return;
    }
    router.back();
  };

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (selectedDate) {
        const newDate = new Date(fulfillmentDateTime);
        newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        setFulfillmentDateTime(newDate);
        setTimeout(() => setShowTimePicker(true), 300);
      }
    } else {
      if (selectedDate) {
        setFulfillmentDateTime(selectedDate);
      }
    }
  };

  const handleTimeChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (selectedDate) {
      if (Platform.OS === 'android') {
        const newDate = new Date(fulfillmentDateTime);
        newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
        setFulfillmentDateTime(newDate);
      } else {
        setFulfillmentDateTime(selectedDate);
      }
    }
  };

  const currencySymbol = getCurrencySymbol(vendorCurrency);

  /**
   * canAccessExternalOrders (PHASE_4_COLLECTION_MAPPING v10, Section 3) is
   * false only for Basic. createExternalOrder already rejects a Basic
   * vendor's submission server-side with permission-denied, but nothing on
   * this screen checked the flag first — a Basic vendor could fill out the
   * entire form (items, fulfilment, payment) and only discover the plan
   * requirement as a raw error on Save. Every other Phase 4 gate in this
   * codebase (dashboard widgets, reports, business insights) shows an
   * upgrade card before the user invests effort; this one didn't.
   */
  if (plan === 'basic') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
          <EditScreenHeader title="Record External Order" onBack={handleBack} showSave={false} />
          <View style={externalOrderLockStyles.lockedContainer}>
            <View style={externalOrderLockStyles.lockedIconWrap}>
              <Lock size={26} color={Colors.textMuted} />
            </View>
            <Text style={externalOrderLockStyles.lockedTitle}>External orders require Standard or higher</Text>
            <Text style={externalOrderLockStyles.lockedDescription}>
              Upgrade your plan to record orders placed outside the platform (WhatsApp, phone, walk-in) and keep them alongside your platform orders.
            </Text>
            <TouchableOpacity
              style={externalOrderLockStyles.upgradeButton}
              onPress={() => router.push('/vendor/settings/subscription' as any)}
              activeOpacity={0.8}
            >
              <Text style={externalOrderLockStyles.upgradeButtonText}>Upgrade Plan</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <EditScreenHeader
          title="Record External Order"
          onBack={handleBack}
          onSave={handleSave}
          saveEnabled={canSave}
          isSaving={isSaving}
          saveLabel="Save"
          testID="record-external-order-header"
        />
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={() => setOpenRowId(null)}
            keyboardShouldPersistTaps="handled"
          >
            {/* SECTION 1: ITEMS */}
            <View style={styles.sectionFirst}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Items</Text>
                {items.length > 0 && (
                  <Text style={styles.itemCount}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
                )}
              </View>

              <View style={styles.sectionCard}>
                {items.length === 0 && (
                  <View style={styles.emptyItems}>
                    <Package size={28} color={Colors.textMuted} />
                    <Text style={styles.emptyItemsText}>No items added yet</Text>
                    <Text style={styles.emptyItemsSubtext}>Tap below to add items</Text>
                  </View>
                )}

                {items.length > 0 && (
                  <View style={styles.itemsList}>
                    {items.map((item) => (
                      <SwipeableItemRow
                        key={item.id}
                        item={item}
                        onDelete={handleRemoveItem}
                        onUpdateQuantity={handleUpdateQuantity}
                        isOpen={openRowId === item.id}
                        onOpen={() => setOpenRowId(item.id)}
                        onClose={() => setOpenRowId(null)}
                        currency={vendorCurrency}
                      />
                    ))}
                  </View>
                )}

                <TouchableOpacity style={styles.addItemButton} onPress={handleAddItem} activeOpacity={0.7}>
                  <Plus size={16} color={Colors.primary} />
                  <Text style={styles.addItemButtonText}>Add Item</Text>
                </TouchableOpacity>

                {items.length > 0 && (
                <View style={styles.totalCard}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalRowLabel}>Subtotal</Text>
                    <Text style={styles.totalRowValue}>{formatPriceWithCommas(subtotal, vendorCurrency)}</Text>
                  </View>

                  {showDeliveryFee && (
                    <View style={styles.feeInputRow}>
                      <View style={styles.feeInputLabelRow}>
                        <Truck size={14} color={Colors.textSecondary} />
                        <Text style={styles.feeInputLabel}>Delivery Fee</Text>
                        <TouchableOpacity onPress={() => { setShowDeliveryFee(false); setDeliveryFeeInput(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <X size={14} color={Colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.feeAmountInput}>
                        <Text style={styles.feeAmountPrefix}>{currencySymbol}</Text>
                        <TextInput
                          style={styles.feeAmountField}
                          value={deliveryFeeInput}
                          onChangeText={setDeliveryFeeInput}
                          placeholder="0"
                          placeholderTextColor={Colors.inputPlaceholder}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                  )}

                  {showServiceFee && (
                    <View style={styles.feeInputRow}>
                      <View style={styles.feeInputLabelRow}>
                        <Wrench size={14} color={Colors.textSecondary} />
                        <Text style={styles.feeInputLabel}>Service Fee</Text>
                        <TouchableOpacity onPress={() => { setShowServiceFee(false); setServiceFeeInput(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <X size={14} color={Colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.feeAmountInput}>
                        <Text style={styles.feeAmountPrefix}>{currencySymbol}</Text>
                        <TextInput
                          style={styles.feeAmountField}
                          value={serviceFeeInput}
                          onChangeText={setServiceFeeInput}
                          placeholder="0"
                          placeholderTextColor={Colors.inputPlaceholder}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                  )}

                  {showDiscount && (
                    <View style={styles.feeInputRow}>
                      <View style={styles.feeInputLabelRow}>
                        <Tag size={14} color={Colors.success} />
                        <Text style={[styles.feeInputLabel, { color: Colors.success }]}>Discount</Text>
                        <TouchableOpacity onPress={() => { setShowDiscount(false); setDiscountValueInput(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <X size={14} color={Colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.discountRow}>
                        <TouchableOpacity
                          style={styles.discountTypeToggle}
                          onPress={() => setShowDiscountTypeSheet(true)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.discountTypeText}>
                            {discountType === 'percentage' ? '%' : currencySymbol}
                          </Text>
                          <ChevronDown size={12} color={Colors.textSecondary} />
                        </TouchableOpacity>
                        <View style={styles.feeAmountInputFlex}>
                          <TextInput
                            style={styles.feeAmountField}
                            value={discountValueInput}
                            onChangeText={setDiscountValueInput}
                            placeholder="0"
                            placeholderTextColor={Colors.inputPlaceholder}
                            keyboardType="decimal-pad"
                          />
                        </View>
                      </View>
                      {discountAmount > 0 && (
                        <Text style={styles.discountSummary}>
                          -{formatPriceWithCommas(discountAmount, vendorCurrency)}
                        </Text>
                      )}
                    </View>
                  )}

                  <View style={styles.addFeeButtons}>
                    {!showDeliveryFee && (
                      <TouchableOpacity style={styles.addFeeBtn} onPress={() => setShowDeliveryFee(true)} activeOpacity={0.7}>
                        <Plus size={13} color={Colors.primary} />
                        <Text style={styles.addFeeBtnText}>Delivery Fee</Text>
                      </TouchableOpacity>
                    )}
                    {!showServiceFee && (
                      <TouchableOpacity style={styles.addFeeBtn} onPress={() => setShowServiceFee(true)} activeOpacity={0.7}>
                        <Plus size={13} color={Colors.primary} />
                        <Text style={styles.addFeeBtnText}>Service Fee</Text>
                      </TouchableOpacity>
                    )}
                    {!showDiscount && (
                      <TouchableOpacity style={styles.addFeeBtn} onPress={() => setShowDiscount(true)} activeOpacity={0.7}>
                        <Plus size={13} color={Colors.primary} />
                        <Text style={styles.addFeeBtnText}>Discount</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {(showDeliveryFee || showServiceFee || showDiscount || taxEnabled) && (
                    <View style={styles.totalDivider} />
                  )}

                  {deliveryFee > 0 && showDeliveryFee && (
                    <View style={styles.totalRow}>
                      <Text style={styles.totalRowLabel}>Delivery Fee</Text>
                      <Text style={styles.totalRowValue}>+{formatPriceWithCommas(deliveryFee, vendorCurrency)}</Text>
                    </View>
                  )}
                  {serviceFee > 0 && showServiceFee && (
                    <View style={styles.totalRow}>
                      <Text style={styles.totalRowLabel}>Service Fee</Text>
                      <Text style={styles.totalRowValue}>+{formatPriceWithCommas(serviceFee, vendorCurrency)}</Text>
                    </View>
                  )}
                  {discountAmount > 0 && showDiscount && (
                    <View style={styles.totalRow}>
                      <Text style={[styles.totalRowLabel, { color: Colors.success }]}>Discount</Text>
                      <Text style={[styles.totalRowValue, { color: Colors.success }]}>-{formatPriceWithCommas(discountAmount, vendorCurrency)}</Text>
                    </View>
                  )}
                  {taxEnabled && (
                    <View style={styles.totalRow}>
                      <Text style={styles.totalRowLabel}>Tax ({taxPercentage}%)</Text>
                      <Text style={styles.totalRowValue}>+{formatPriceWithCommas(taxAmount, vendorCurrency)}</Text>
                    </View>
                  )}

                  <View style={styles.totalDivider} />
                  <View style={styles.totalRow}>
                    <Text style={styles.grandTotalLabel}>Total</Text>
                    <Text style={styles.grandTotalValue}>{formatPriceWithCommas(total, vendorCurrency)}</Text>
                  </View>
                </View>
              )}
              </View>
            </View>

            {/* SECTION 2: FULFILLMENT */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Fulfillment</Text>
              <View style={styles.sectionCardPadded}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Fulfillment Type</Text>
                  <DropdownSelector
                    label="Fulfillment Type"
                    value={fulfillmentType}
                    options={FULFILLMENT_OPTIONS.map(o => ({ value: o, label: o }))}
                    onSelect={(v) => setFulfillmentType(v as FulfillmentType)}
                    placeholder="Select type"
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Fulfillment Date & Time</Text>
                  <TouchableOpacity
                    style={styles.dateTimeTrigger}
                    onPress={() => {
                      if (Platform.OS === 'web') {
                        setShowWebDatePicker(true);
                      } else {
                        setShowDatePicker(true);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Calendar size={16} color={Colors.primary} />
                    <Text style={styles.dateTimeValue}>
                      {formatDateTimeDisplay(fulfillmentDateTime)}
                    </Text>
                    <Clock size={15} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                {fulfillmentType === 'Delivery' && (
                  <>
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>Delivery Address (optional)</Text>
                      <TextInput
                        style={styles.input}
                        value={address}
                        onChangeText={setAddress}
                        placeholder="Enter delivery address"
                        placeholderTextColor={Colors.inputPlaceholder}
                      />
                    </View>
                    <View style={[styles.field, { marginBottom: 0 }]}>
                      <Text style={styles.fieldLabel}>Delivery Note (optional)</Text>
                      <TextInput
                        style={[styles.input, styles.multilineInput]}
                        value={deliveryNote}
                        onChangeText={(text) => { if (text.length <= 300) setDeliveryNote(text); }}
                        placeholder="Add delivery instructions..."
                        placeholderTextColor={Colors.inputPlaceholder}
                        multiline
                        numberOfLines={2}
                        textAlignVertical="top"
                        maxLength={300}
                      />
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* SECTION 3: CUSTOMER INFO */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Customer Info</Text>
              <Text style={styles.sectionSubtitle}>Optional. Recorded for your reference only</Text>
              <View style={styles.sectionCardPadded}>
                <View style={[styles.field, { marginBottom: 0 }]}>
                  <Text style={styles.fieldLabel}>Customer Name (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={customerName}
                    onChangeText={setCustomerName}
                    placeholder="e.g. John Doe"
                    placeholderTextColor={Colors.inputPlaceholder}
                  />
                </View>
              </View>
            </View>

            {/* SECTION 4: PAYMENT STATUS */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment</Text>
              <View style={styles.sectionCardPadded}>
                <View style={[styles.field, paymentStatus !== 'partially_received' ? { marginBottom: 0 } : {}]}>
                  <Text style={styles.fieldLabel}>Payment Status</Text>
                  <DropdownSelector
                    label="Payment Status"
                    value={paymentStatus}
                    options={PAYMENT_STATUS_OPTIONS}
                    onSelect={(v) => {
                      setPaymentStatus(v as PaymentStatusOption);
                      if (v !== 'partially_received') setAmountReceived('');
                    }}
                    placeholder="Select status"
                  />
                  <Text style={styles.fieldHelper}>
                    {paymentStatus === 'payment_pending' ? 'Customer has not yet paid' : paymentStatus === 'partially_received' ? 'Customer has partially paid' : 'Order fully paid'}
                  </Text>
                </View>
                {paymentStatus === 'partially_received' && (
                  <View style={[styles.field, { marginBottom: 0 }]}>
                    <Text style={styles.fieldLabel}>Amount Received *</Text>
                    <View style={styles.currencyInputContainer}>
                      <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
                      <TextInput
                        style={styles.currencyInput}
                        value={amountReceived}
                        onChangeText={setAmountReceived}
                        placeholder="0.00"
                        placeholderTextColor={Colors.inputPlaceholder}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* SECTION 5: SCREENSHOTS (Optional) */}
            {canUseScreenshots && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Screenshots</Text>
                <Text style={styles.sectionSubtitle}>Optional. Attach screenshots from WhatsApp, Instagram, or other sources</Text>

                {screenshots.length > 0 ? (
                  <View>
                    <View style={styles.screenshotsRow}>
                      {screenshots.map((uri, index) => (
                        <View key={index} style={styles.screenshotThumb}>
                          <Image source={{ uri }} style={styles.screenshotImage} contentFit="cover" />
                          <TouchableOpacity
                            style={styles.removeScreenshotBtn}
                            onPress={() => handleRemoveScreenshot(index)}
                            activeOpacity={0.7}
                          >
                            <X size={12} color="#FFFFFF" strokeWidth={3} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                    {screenshots.length < 5 && (
                      <TouchableOpacity style={styles.uploadMoreBtn} onPress={handlePickImages} activeOpacity={0.7}>
                        <Plus size={14} color={Colors.primary} />
                        <Text style={styles.uploadMoreText}>Add more</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity style={styles.uploadPlaceholder} onPress={handlePickImages} activeOpacity={0.75}>
                    <View style={styles.uploadIconWrap}>
                      <Upload size={22} color={Colors.textSecondary} strokeWidth={1.5} />
                    </View>
                    <Text style={styles.uploadPlaceholderTitle}>Upload screenshots</Text>
                    <Text style={styles.uploadPlaceholderSub}>Up to 5 images</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* SECTION 6: NOTES (Optional) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Internal Notes</Text>
              <Text style={styles.sectionSubtitle}>Optional. Visible only to you</Text>
              <View style={styles.sectionCardPadded}>
                <TextInput
                  style={[styles.input, styles.notesInput, { borderWidth: 0, borderRadius: 0, paddingHorizontal: 0, paddingVertical: 0, backgroundColor: 'transparent' }]}
                  value={notes}
                  onChangeText={(text) => { if (text.length <= 200) setNotes(text); }}
                  placeholder="Add notes about this order..."
                  placeholderTextColor={Colors.inputPlaceholder}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  maxLength={200}
                />
                <Text style={[styles.charCount, { marginTop: 8 }]}>{notes.length}/200</Text>
              </View>
            </View>

            <View style={styles.bottomSpacer} />
          </ScrollView>

        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* ADD ITEM BOTTOM SHEET */}
      <Modal
        visible={showAddItemMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddItemMenu(false)}
      >
        <TouchableOpacity
          style={styles.bottomSheetOverlay}
          activeOpacity={1}
          onPress={() => setShowAddItemMenu(false)}
        >
          <View style={styles.bottomSheetContainer}>
            <View style={styles.bottomSheetHandle} />
            <TouchableOpacity
              style={styles.bottomSheetOption}
              onPress={handleSelectFromCatalog}
              activeOpacity={0.7}
            >
              <View style={styles.bottomSheetIconWrap}>
                <Package size={20} color={Colors.primary} />
              </View>
              <View style={styles.bottomSheetOptionContent}>
                <Text style={styles.bottomSheetOptionText}>Select from Catalog</Text>
                <Text style={styles.bottomSheetOptionSubtext}>Choose items from your product list</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.bottomSheetDivider} />
            <TouchableOpacity
              style={styles.bottomSheetOption}
              onPress={handleAddManualItem}
              activeOpacity={0.7}
            >
              <View style={styles.bottomSheetIconWrap}>
                <Edit3 size={20} color={Colors.primary} />
              </View>
              <View style={styles.bottomSheetOptionContent}>
                <Text style={styles.bottomSheetOptionText}>Add Manual Item</Text>
                <Text style={styles.bottomSheetOptionSubtext}>Enter item details yourself</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* CATALOG FULL-SCREEN MODAL */}
      <Modal
        visible={showCatalogModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowCatalogModal(false)}
      >
        <SafeAreaView edges={['top', 'bottom']} style={styles.catalogModalContainer}>
          <View style={styles.catalogModalHeader}>
            <TouchableOpacity
              onPress={() => { setShowCatalogModal(false); setCatalogSelectedIds(new Set()); }}
              style={styles.catalogHeaderSideButton}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ChevronLeft size={20} color={Colors.text} strokeWidth={2.2} />
            </TouchableOpacity>
            <View style={styles.catalogHeaderCenter}>
              <Text style={styles.catalogModalTitle}>Select from Catalog</Text>
              <Text style={styles.catalogSubtitle} numberOfLines={1}>
                Choose items to add to this order
              </Text>
            </View>
            <TouchableOpacity
              onPress={catalogSelectedIds.size > 0 ? handleAddSelectedCatalogItems : undefined}
              disabled={catalogSelectedIds.size === 0}
              style={[styles.catalogHeaderAddButton, catalogSelectedIds.size === 0 && styles.catalogHeaderAddButtonDisabled]}
              activeOpacity={0.75}
            >
              <Text style={[
                styles.catalogAddText,
                catalogSelectedIds.size === 0 && styles.catalogAddTextDisabled,
              ]}>
                Add{catalogSelectedIds.size > 0 ? ` ${catalogSelectedIds.size}` : ''}
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={catalogItems}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isSelected = catalogSelectedIds.has(item.id);
              return (
                <TouchableOpacity
                  style={styles.catalogRow}
                  onPress={() => handleToggleCatalogItem(item.id)}
                  activeOpacity={0.7}
                >
                  {item.photos[0] ? (
                    <Image source={{ uri: item.photos[0] }} style={styles.catalogThumbLarge} contentFit="cover" />
                  ) : (
                    <View style={styles.catalogThumbLargePlaceholder}>
                      <Package size={24} color={Colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.catalogRowInfo}>
                    <Text style={styles.catalogRowName} numberOfLines={1}>{item.name}</Text>
                    {item.description ? (
                      <Text style={styles.catalogRowDesc} numberOfLines={1}>{item.description}</Text>
                    ) : null}
                    <Text style={styles.catalogRowPrice}>
                      {formatPriceWithCommas(item.salePrice || item.basePrice, vendorCurrency)}
                    </Text>
                  </View>
                  <View style={[styles.catalogRadio, isSelected && styles.catalogRadioSelected]}>
                    {isSelected && <View style={styles.catalogRadioInner} />}
                  </View>
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.catalogSeparator} />}
            contentContainerStyle={styles.catalogList}
            showsVerticalScrollIndicator={false}
          />
        </SafeAreaView>
      </Modal>

      {/* MANUAL ITEM MODAL */}
      <Modal
        visible={showManualItemModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowManualItemModal(false)}
      >
        <SafeAreaView edges={['top']} style={styles.manualItemModalContainer}>
          <View style={styles.manualItemModalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowManualItemModal(false);
                setManualItemName('');
                setManualItemPrice('');
                setManualItemQuantity('1');
              }}
            >
              <Text style={styles.catalogCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.catalogTitle}>Add Item</Text>
            <TouchableOpacity onPress={handleSaveManualItem}>
              <Text style={styles.manualItemSaveText}>Add</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.manualItemContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.manualItemField}>
              <Text style={styles.fieldLabel}>Item Name *</Text>
              <TextInput
                style={styles.input}
                value={manualItemName}
                onChangeText={setManualItemName}
                placeholder="e.g. Custom cake"
                placeholderTextColor={Colors.inputPlaceholder}
              />
            </View>
            <View style={styles.manualItemField}>
              <Text style={styles.fieldLabel}>Price ({currencySymbol}) *</Text>
              <TextInput
                style={styles.input}
                value={manualItemPrice}
                onChangeText={setManualItemPrice}
                placeholder="0"
                placeholderTextColor={Colors.inputPlaceholder}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.manualItemField}>
              <Text style={styles.fieldLabel}>Quantity *</Text>
              <TextInput
                style={styles.input}
                value={manualItemQuantity}
                onChangeText={setManualItemQuantity}
                placeholder="1"
                placeholderTextColor={Colors.inputPlaceholder}
                keyboardType="numeric"
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* DISCOUNT TYPE SHEET */}
      <Modal
        visible={showDiscountTypeSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDiscountTypeSheet(false)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setShowDiscountTypeSheet(false)}
        >
          <View style={styles.dropdownSheet}>
            <View style={styles.dropdownSheetHandle} />
            <Text style={styles.dropdownSheetTitle}>Discount Type</Text>
            <TouchableOpacity
              style={[
                styles.dropdownOption,
                discountType === 'percentage' && styles.dropdownOptionActive,
              ]}
              onPress={() => {
                setDiscountType('percentage');
                setShowDiscountTypeSheet(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.dropdownOptionText,
                discountType === 'percentage' && styles.dropdownOptionTextActive,
              ]}>Percentage (%)</Text>
              {discountType === 'percentage' && <Check size={18} color={Colors.primary} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.dropdownOption,
                discountType === 'fixed' && styles.dropdownOptionActive,
              ]}
              onPress={() => {
                setDiscountType('fixed');
                setShowDiscountTypeSheet(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.dropdownOptionText,
                discountType === 'fixed' && styles.dropdownOptionTextActive,
              ]}>Fixed Amount ({currencySymbol})</Text>
              {discountType === 'fixed' && <Check size={18} color={Colors.primary} />}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* DISCARD MODAL */}
      <DiscardChangesModal
        visible={unsavedChanges.showDiscardModal}
        onKeepEditing={unsavedChanges.handleKeepEditing}
        onDiscard={() => {
          unsavedChanges.handleDiscard();
          router.back();
        }}
        message="If you leave now, your changes will not be saved."
      />

      {/* WEB DATE/TIME PICKER MODAL */}
      {showWebDatePicker && Platform.OS === 'web' && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setShowWebDatePicker(false)}
        >
          <View style={styles.datePickerOverlay}>
            <View style={styles.datePickerModal}>
              <View style={styles.datePickerHandleBar} />
              <View style={styles.datePickerHeaderRow}>
                <TouchableOpacity
                  onPress={() => setShowWebDatePicker(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.datePickerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.datePickerTitleText}>Date & Time</Text>
                <TouchableOpacity
                  onPress={() => setShowWebDatePicker(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.datePickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.webDatePickerContent}>
                <Text style={styles.webDatePickerLabel}>Date</Text>
                <input
                  type="date"
                  value={`${fulfillmentDateTime.getFullYear()}-${String(fulfillmentDateTime.getMonth() + 1).padStart(2, '0')}-${String(fulfillmentDateTime.getDate()).padStart(2, '0')}`}
                  onChange={(e: any) => {
                    const val = e.target.value;
                    if (val) {
                      const [year, month, day] = val.split('-').map(Number);
                      const newDate = new Date(fulfillmentDateTime);
                      newDate.setFullYear(year, month - 1, day);
                      setFulfillmentDateTime(newDate);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: 13,
                    fontSize: 16,
                    borderRadius: 10,
                    border: `1px solid ${Colors.border}`,
                    backgroundColor: Colors.surface,
                    color: Colors.text,
                    boxSizing: 'border-box' as any,
                  }}
                />
                <Text style={[styles.webDatePickerLabel, { marginTop: 16 }]}>Time</Text>
                <input
                  type="time"
                  value={`${String(fulfillmentDateTime.getHours()).padStart(2, '0')}:${String(fulfillmentDateTime.getMinutes()).padStart(2, '0')}`}
                  onChange={(e: any) => {
                    const val = e.target.value;
                    if (val) {
                      const [hours, minutes] = val.split(':').map(Number);
                      const newDate = new Date(fulfillmentDateTime);
                      newDate.setHours(hours, minutes);
                      setFulfillmentDateTime(newDate);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: 13,
                    fontSize: 16,
                    borderRadius: 10,
                    border: `1px solid ${Colors.border}`,
                    backgroundColor: Colors.surface,
                    color: Colors.text,
                    boxSizing: 'border-box' as any,
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* iOS DATE/TIME PICKER MODAL */}
      {showDatePicker && Platform.OS === 'ios' && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.datePickerOverlay}>
            <View style={styles.datePickerModal}>
              <View style={styles.datePickerHandleBar} />
              <View style={styles.datePickerHeaderRow}>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.datePickerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.datePickerTitleText}>Date & Time</Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.datePickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={fulfillmentDateTime}
                mode="datetime"
                display="spinner"
                onChange={(_, date) => {
                  if (date) setFulfillmentDateTime(date);
                }}
                style={styles.datePickerWheel}
              />
            </View>
          </View>
        </Modal>
      )}
      {/* ANDROID DATE PICKER */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={fulfillmentDateTime}
          mode="date"
          display="default"
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}
      {showTimePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={fulfillmentDateTime}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
}

const externalOrderLockStyles = StyleSheet.create({
  lockedContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 32,
  },
  lockedIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  lockedTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  lockedDescription: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: 24,
  },
  upgradeButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  upgradeButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundCanvas,
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  headerBackButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginLeft: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionFirst: {
    marginBottom: 22,
  },
  section: {
    marginBottom: 22,
  },
  sectionCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
  },
  sectionCardPadded: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  field: {
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 10,
    textTransform: 'uppercase' as const,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: -6,
    marginBottom: 10,
    lineHeight: 16,
  },
  fieldHelper: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 5,
    lineHeight: 15,
    fontStyle: 'italic' as const,
  },
  itemCount: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 5,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  multilineInput: {
    minHeight: 60,
    textAlignVertical: 'top' as const,
  },
  notesInput: {
    minHeight: 72,
    textAlignVertical: 'top' as const,
  },
  charCount: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'right' as const,
  },
  emptyItems: {
    alignItems: 'center' as const,
    paddingVertical: 32,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  emptyItemsText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginTop: 10,
  },
  emptyItemsSubtext: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  itemsList: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 8,
  },
  swipeableContainer: {
    position: 'relative' as const,
    overflow: 'hidden' as const,
    borderRadius: 12,
  },
  deleteButtonContainer: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.error,
  },
  deleteButton: {
    backgroundColor: Colors.error,
    width: 80,
    height: '100%',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  itemCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    zIndex: 1,
  },
  itemCardLeft: {
    flex: 1,
    marginRight: 12,
  },
  itemCardName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 3,
  },
  itemCardUnitPrice: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  itemCardTotal: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  quantityStepper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignSelf: 'flex-start' as const,
  },
  stepperBtn: {
    width: 32,
    height: 30,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  stepperBtnDisabled: {
    opacity: 0.35,
  },
  stepperValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    minWidth: 24,
    textAlign: 'center' as const,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 5,
  },
  addItemButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  addItemButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  totalCard: {
    backgroundColor: Colors.backgroundCanvas,
    borderRadius: 0,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  totalDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 10,
  },
  totalRowLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  totalRowValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  dropdownTrigger: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dropdownValue: {
    fontSize: 15,
    color: Colors.text,
  },
  dropdownPlaceholder: {
    fontSize: 15,
    color: Colors.inputPlaceholder,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end' as const,
  },
  dropdownSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    paddingTop: 8,
  },
  dropdownSheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center' as const,
    marginBottom: 16,
  },
  dropdownSheetTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  dropdownOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  dropdownOptionActive: {
    backgroundColor: Colors.primarySoft,
  },
  dropdownOptionText: {
    fontSize: 16,
    color: Colors.text,
  },
  dropdownOptionTextActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  dateTimeTrigger: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  dateTimeValue: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  currencyInputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currencyPrefix: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginRight: 6,
  },
  currencyInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 15,
    color: Colors.text,
  },
  amountReceivedField: {
    marginTop: 16,
  },
  screenshotsRow: {
    flexDirection: 'row' as const,
    gap: 10,
    marginBottom: 12,
    flexWrap: 'wrap' as const,
  },
  screenshotThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    position: 'relative' as const,
  },
  screenshotImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: Colors.surface,
  },
  removeScreenshotBtn: {
    position: 'absolute' as const,
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.error,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  uploadPlaceholder: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed' as const,
    paddingVertical: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  },
  uploadIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 2,
  },
  uploadPlaceholderTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  uploadPlaceholderSub: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  uploadMoreBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: Colors.primarySoft,
    alignSelf: 'flex-start' as const,
  },
  uploadMoreText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  bottomSpacer: {
    height: 32,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  createButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonDisabled: {
    backgroundColor: Colors.primaryDisabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end' as const,
  },
  bottomSheetContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  bottomSheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center' as const,
    marginTop: 12,
    marginBottom: 12,
  },
  bottomSheetOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 14,
  },
  bottomSheetIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  bottomSheetOptionContent: {
    flex: 1,
  },
  bottomSheetOptionText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  bottomSheetOptionSubtext: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  bottomSheetDivider: {
    height: 0.5,
    backgroundColor: Colors.border,
    marginHorizontal: 20,
  },
  catalogModalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  catalogModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  catalogHeaderSideButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  catalogHeaderCenter: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 10,
  },
  catalogHeaderAddButton: {
    minWidth: 54,
    height: 34,
    borderRadius: 17,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 12,
    backgroundColor: Colors.primaryTint,
  },
  catalogHeaderAddButtonDisabled: {
    backgroundColor: Colors.surface,
  },
  catalogCancelText: {
    fontSize: 16,
    color: Colors.primary,
    minWidth: 60,
  },
  catalogTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
  },
  catalogModalTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    letterSpacing: -0.2,
  },
  catalogSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
    textAlign: 'center' as const,
  },
  catalogAddText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  catalogAddTextDisabled: {
    color: Colors.textMuted,
  },
  catalogList: {
    paddingBottom: 24,
  },
  catalogRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
  },
  catalogSeparator: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 96,
  },
  catalogThumbLarge: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: Colors.border,
  },
  catalogThumbLargePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  catalogRowInfo: {
    flex: 1,
  },
  catalogRowName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  catalogRowDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  catalogRowPrice: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  catalogRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.borderDark,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  catalogRadioSelected: {
    borderColor: Colors.primary,
  },
  catalogRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  manualItemModalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  manualItemModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  manualItemSaveText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600' as const,
    minWidth: 60,
    textAlign: 'right' as const,
  },
  manualItemContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  manualItemField: {
    marginBottom: 20,
  },
  feeInputRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  feeInputLabelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 8,
  },
  feeInputLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  feeAmountInput: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
  },
  feeAmountPrefix: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginRight: 4,
  },
  feeAmountField: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
  },
  feeAmountInputFlex: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
  },
  discountRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  discountTypeToggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
  },
  discountTypeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  discountSummary: {
    fontSize: 13,
    color: Colors.success,
    marginTop: 6,
    fontWeight: '500' as const,
  },
  addFeeButtons: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 12,
  },
  addFeeBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.primarySoft,
  },
  addFeeBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end' as const,
  },
  datePickerModal: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  datePickerHandleBar: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center' as const,
    marginTop: 12,
    marginBottom: 4,
  },
  datePickerHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  datePickerTitleText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  datePickerCancelText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  datePickerDoneText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  datePickerWheel: {
    backgroundColor: Colors.background,
  },
  webDatePickerContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  webDatePickerLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
});
