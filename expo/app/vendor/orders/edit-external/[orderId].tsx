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
  ActivityIndicator,
} from 'react-native';
import { Alert } from '@/utils/alert';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import {
  Plus,
  Package,
  Edit3,
  Trash2,
  ChevronLeft,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useExternalOrders, type ExternalOrder } from '@/contexts/ExternalOrdersContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { formatPriceWithCommas, getCurrencySymbol, type Currency } from '@/utils/formatPrice';
import { useVendor } from '@/contexts/VendorContext';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
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
type OrderSource = 'WhatsApp' | 'Instagram' | 'TikTok' | 'Phone' | 'Walk-in' | 'Website' | 'Other';

const FULFILLMENT_OPTIONS: FulfillmentType[] = ['Pickup', 'Delivery', 'Service', 'Event', 'Other'];
const ORDER_SOURCE_OPTIONS: OrderSource[] = ['WhatsApp', 'Instagram', 'TikTok', 'Phone', 'Walk-in', 'Website', 'Other'];

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

function parseFulfillmentDateTime(dateStr: string, timeStr?: string): Date {
  const parts = dateStr.split('-');
  const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  if (timeStr) {
    const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (timeParts) {
      let hours = parseInt(timeParts[1]);
      const minutes = parseInt(timeParts[2]);
      const isPM = timeParts[3].toUpperCase() === 'PM';
      if (isPM && hours !== 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
      date.setHours(hours, minutes, 0, 0);
    }
  }
  return date;
}

export default function EditExternalOrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.orderId as string;
  const { externalOrders, updateExternalOrder } = useExternalOrders();
  const { vendor } = useVendor();
  const vendorCurrency = (vendor.currency as Currency) || 'NGN';

  const order = externalOrders.find(o => o.id === orderId);

  const [items, setItems] = useState<OrderItem[]>([]);
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('Pickup');
  const [fulfillmentDateTime, setFulfillmentDateTime] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [address, setAddress] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [orderSource, setOrderSource] = useState<OrderSource>('WhatsApp');

  const [notes, setNotes] = useState('');

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

  const [isSaving, setIsSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

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
          }
        }
      } catch (error) {
        console.error('[EditExternalOrder] Error loading tax settings:', error);
      }
    };
    void loadTaxSettings();
  }, []);

  useEffect(() => {
    if (order && !initialized) {
      console.log('[EditExternalOrder] Pre-filling from order:', order.id);
      setItems(order.items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })));
      setFulfillmentType(order.fulfillmentType);
      setFulfillmentDateTime(parseFulfillmentDateTime(order.fulfillmentDate, order.fulfillmentTime));
      setAddress(order.address || '');
      setDeliveryNote(order.deliveryNote || '');
      const name = order.customerName === 'Walk-in customer' ? '' : order.customerName;
      setCustomerName(name);
      const source = order.externalReference as OrderSource || 'WhatsApp';
      if (ORDER_SOURCE_OPTIONS.includes(source)) {
        setOrderSource(source);
      } else {
        setOrderSource('WhatsApp');
      }
      setNotes(order.notes || '');

      if (order.deliveryFee && order.deliveryFee > 0) {
        setShowDeliveryFee(true);
        setDeliveryFeeInput(order.deliveryFee.toString());
      }
      if (order.serviceFee && order.serviceFee > 0) {
        setShowServiceFee(true);
        setServiceFeeInput(order.serviceFee.toString());
      }
      if (order.discountAmount && order.discountAmount > 0) {
        setShowDiscount(true);
        setDiscountType(order.discountType || 'fixed');
        setDiscountValueInput(order.discountValue?.toString() || '');
      }
      setInitialized(true);
    }
  }, [order, initialized]);

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
        });
      }
    });
    setItems(prev => [...prev, ...newItems]);
    setCatalogSelectedIds(new Set());
    setShowCatalogModal(false);
    console.log('[EditExternalOrder] Added', newItems.length, 'items from catalog');
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
    console.log('[EditExternalOrder] Manual item added:', newItem.name);
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

  const handleSave = async () => {
    if (!order) return;
    if (items.length === 0) {
      Alert.alert('Items Required', 'Please add at least one item.');
      return;
    }

    setIsSaving(true);

    try {
      const updates: Partial<ExternalOrder> = {
        customerName: customerName.trim() || 'Walk-in customer',
        externalReference: orderSource || undefined,
        items: items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
        fulfillmentType,
        fulfillmentDate: getFulfillmentDate(),
        fulfillmentTime: getFulfillmentTime(),
        address: fulfillmentType === 'Delivery' ? address || undefined : undefined,
        deliveryNote: fulfillmentType === 'Delivery' ? deliveryNote || undefined : undefined,
        notes,
        subtotal,
        tax: taxAmount,
        taxPercentage: taxEnabled ? taxPercentage : undefined,
        deliveryFee: deliveryFee > 0 ? deliveryFee : undefined,
        serviceFee: serviceFee > 0 ? serviceFee : undefined,
        discountType: discountAmount > 0 ? discountType : undefined,
        discountValue: discountAmount > 0 ? discountInputVal : undefined,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        total,
      };

      await updateExternalOrder(order.id, updates);
      console.log('[EditExternalOrder] Order updated successfully:', order.id);

      router.back();
    } catch (error) {
      console.error('[EditExternalOrder] Error updating order:', error);
      Alert.alert('Error', 'Failed to save changes. Please try again.');
      setIsSaving(false);
    }
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

  if (!order) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={['top']} style={styles.safeAreaTop}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
              <ChevronLeft size={24} color={Colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit External Order</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Order not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView edges={['top']} style={styles.safeAreaTop}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
            <ChevronLeft size={24} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit External Order</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
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
            <View style={styles.lockedFieldCard}>
              <View style={styles.lockedFieldRow}>
                <Lock size={14} color={Colors.textMuted} />
                <Text style={styles.lockedFieldLabel}>Order ID</Text>
              </View>
              <Text style={styles.lockedFieldValue}>{order.externalOrderId}</Text>
            </View>

            <View style={styles.sectionFirst}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Items</Text>
                {items.length > 0 && (
                  <Text style={styles.itemCount}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
                )}
              </View>

              {items.length === 0 && (
                <View style={styles.emptyItems}>
                  <Package size={32} color={Colors.textMuted} />
                  <Text style={styles.emptyItemsText}>No items added yet</Text>
                  <Text style={styles.emptyItemsSubtext}>Tap the button below to add items</Text>
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
                <Plus size={18} color={Colors.primary} />
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

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Fulfillment</Text>

              <Text style={styles.fieldLabel}>Fulfillment Type</Text>
              <DropdownSelector
                label="Fulfillment Type"
                value={fulfillmentType}
                options={FULFILLMENT_OPTIONS.map(o => ({ value: o, label: o }))}
                onSelect={(v) => setFulfillmentType(v as FulfillmentType)}
                placeholder="Select type"
              />

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Fulfillment Date & Time</Text>
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
                <Calendar size={18} color={Colors.primary} />
                <Text style={styles.dateTimeValue}>
                  {formatDateTimeDisplay(fulfillmentDateTime)}
                </Text>
                <Clock size={16} color={Colors.textSecondary} />
              </TouchableOpacity>

              {fulfillmentType === 'Delivery' && (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Delivery Address (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Enter delivery address"
                    placeholderTextColor={Colors.inputPlaceholder}
                  />
                  <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Delivery Note (optional)</Text>
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
                </>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Customer Info</Text>
              <Text style={styles.sectionSubtitle}>Optional</Text>

              <Text style={styles.fieldLabel}>Customer Name (optional)</Text>
              <TextInput
                style={styles.input}
                value={customerName}
                onChangeText={setCustomerName}
                placeholderTextColor={Colors.inputPlaceholder}
              />

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Order Source</Text>
              <DropdownSelector
                label="Order Source"
                value={orderSource}
                options={ORDER_SOURCE_OPTIONS.map(o => ({ value: o, label: o }))}
                onSelect={(v) => setOrderSource(v as OrderSource)}
                placeholder="Select source"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Internal Notes</Text>
              <Text style={styles.sectionSubtitle}>Visible only to you</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={(text) => { if (text.length <= 200) setNotes(text); }}
                placeholder="Add notes about this order..."
                placeholderTextColor={Colors.inputPlaceholder}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={200}
              />
              <Text style={styles.charCount}>{notes.length}/200</Text>
            </View>

            <View style={styles.bottomSpacer} />
          </ScrollView>

          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.saveButton, (!canSave || isSaving) && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!canSave || isSaving}
              activeOpacity={0.8}
            >
              <Text style={styles.saveButtonText}>
                {isSaving ? 'Saving...' : items.length > 0
                  ? `Save Changes  ${formatPriceWithCommas(total, vendorCurrency)}`
                  : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

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

      <Modal
        visible={showCatalogModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowCatalogModal(false)}
      >
        <SafeAreaView edges={['top', 'bottom']} style={styles.catalogModalContainer}>
          <View style={styles.catalogModalHeader}>
            <TouchableOpacity onPress={() => { setShowCatalogModal(false); setCatalogSelectedIds(new Set()); }}>
              <Text style={styles.catalogCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.catalogTitle}>Select Items</Text>
            <TouchableOpacity
              onPress={catalogSelectedIds.size > 0 ? handleAddSelectedCatalogItems : undefined}
              disabled={catalogSelectedIds.size === 0}
            >
              <Text style={[
                styles.catalogAddText,
                catalogSelectedIds.size === 0 && styles.catalogAddTextDisabled,
              ]}>
                Add{catalogSelectedIds.size > 0 ? ` (${catalogSelectedIds.size})` : ''}
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

      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={fulfillmentDateTime}
          mode="date"
          display="default"
          onChange={handleDateChange}
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
      {isSaving && (
        <Modal visible transparent animationType="fade">
          <View style={styles.savingOverlay}>
            <View style={styles.savingContainer}>
              <Text style={styles.savingText}>Saving…</Text>
              <ActivityIndicator size="small" color={Colors.textSecondary} style={styles.savingSpinner} />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeAreaTop: {
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBackButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
  },
  headerSpacer: {
    width: 32,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center' as const,
  },
  lockedFieldCard: {
    marginHorizontal: 0,
    marginTop: 16,
    padding: 14,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  lockedFieldRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 6,
  },
  lockedFieldLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  lockedFieldValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionFirst: {
    marginTop: 12,
    paddingBottom: 8,
  },
  section: {
    marginTop: 28,
  },
  sectionHeaderRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: 12,
  },
  itemCount: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: '#3A3A3A',
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
    paddingVertical: 28,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed' as const,
    marginBottom: 12,
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
    marginBottom: 12,
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
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed' as const,
    gap: 6,
    backgroundColor: 'rgba(255,140,66,0.04)',
  },
  addItemButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  totalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dropdownValue: {
    fontSize: 16,
    color: Colors.text,
  },
  dropdownPlaceholder: {
    fontSize: 16,
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
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  dateTimeValue: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  bottomSpacer: {
    height: 24,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.primaryDisabled,
  },
  saveButtonText: {
    fontSize: 17,
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
  catalogAddText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600' as const,
    minWidth: 60,
    textAlign: 'right' as const,
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
  savingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  savingContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 40,
    paddingVertical: 28,
    alignItems: 'center' as const,
    minWidth: 160,
  },
  savingText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 14,
  },
  savingSpinner: {
    marginTop: 2,
  },
});
