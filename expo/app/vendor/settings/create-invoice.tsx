import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Share, Platform, Modal, KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Alert } from '@/utils/alert';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useRouter, useLocalSearchParams } from 'expo-router';
import { Plus, Trash2, Package, MessageCircle, Share2, ChevronRight, User, MapPin, Truck, CalendarClock, Wrench, Ban, CheckCircle, Calendar, Users, Link2, X } from 'lucide-react-native';
import EditScreenHeader from '@/components/EditScreenHeader';
import ConversationPickerModal from '@/components/ConversationPickerModal';
import SchedulingSheet, { SchedulingTriggerRow } from '@/components/SchedulingSheet';
import { useSchedulingPicker, type TimingPreference } from '@/hooks/useSchedulingPicker';
import { useInvoices, getInvoiceShareUrl } from '@/contexts/InvoiceContext';
import type { Invoice, InvoiceLineItem, InvoiceCustomerSource, InvoiceFulfilmentMethod, InvoiceFulfilmentDetails } from '@/contexts/InvoiceContext';
import { useChats } from '@/contexts/ChatContext';
import { useInbox } from '@/contexts/InboxContext';
import type { Chat } from '@/mocks/chatData';
import type { InboxSnapshot } from '@/mocks/inboxData';
import { formatInvoiceCustomerName, formatInternalCustomerFromFull } from '@/utils/internalCustomerName';
import { ChatTypeBadge } from '@/components/ChatTypeBadge';
import { formatPrice, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';
import { useVendor } from '@/contexts/VendorContext';
import {
  INVOICE_TEXT_LIMITS,
  formatInvoiceCharacterCount,
  getInvoiceTextLimitError,
  sanitizeInvoiceText,
} from '@/constants/invoiceTextLimits';
import LaektivaModal from '@/components/LaektivaModal';
import { useUnsavedChanges } from '@/utils/useUnsavedChanges';
import { Colors } from '@/constants/colors';

export default function CreateInvoiceScreen() {
  // The signed-in vendor, not the demo fixture. This screen showed the demo
  // business name and currency to real vendors.
  const { vendor } = useVendor();
  const routerNav = useRouter();
  const { invoiceId } = useLocalSearchParams<{ invoiceId?: string }>();
  const { createInvoice, updateInvoice, getInvoiceById, sendInvoiceInChat, markInvoiceSharedExternally } = useInvoices();
  const { chats } = useChats();
  const { vendorInbox } = useInbox();

  const editingInvoice: Invoice | undefined = invoiceId ? getInvoiceById(invoiceId) : undefined;
  const isEditMode = !!editingInvoice;

  const [customerSource, setCustomerSource] = useState<InvoiceCustomerSource | null>(null);
  const [customerTypeCollapsed, setCustomerTypeCollapsed] = useState<boolean>(false);
  const effectiveCustomerSource: InvoiceCustomerSource = customerSource ?? 'the platform';
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  // Internal customers never allow a name override — the privacy-safe
  // "First L." form is always used. External customers enter their own name.
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  // Source tracking — preserved so Henry can link the invoice to the correct
  // conversation and prevent revenue double-counting. `order_chat` when the
  // vendor selected from an order chat, `inquiry_chat` for pre-order inquiries.
  const [sourceType, setSourceType] = useState<'order_chat' | 'inquiry_chat' | null>(null);
  const [sourceOrderId, setSourceOrderId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [items, setItems] = useState<InvoiceLineItem[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [taxRate, setTaxRate] = useState<string>('0');
  const [discount, setDiscount] = useState<string>('0');
  // Fulfilment Method — captured after customer selection, before line items.
  // Does NOT convert the invoice into an order. Mock-only; Henry should persist
  // `fulfilmentMethod` + `fulfilmentDetails` on the invoice document.
  //
  // All fulfilment details are OPTIONAL — the vendor can leave every field
  // blank and still create the invoice. No location, no date/time, no fee.
  const [fulfilmentMethod, setFulfilmentMethod] = useState<InvoiceFulfilmentMethod>('none');
  const [fulfilmentLocation, setFulfilmentLocation] = useState<string>('');
  const [fulfilmentAddress, setFulfilmentAddress] = useState<string>('');
  const [fulfilmentServiceLocation, setFulfilmentServiceLocation] = useState<string>('');
  const [fulfilmentDeliveryFee, setFulfilmentDeliveryFee] = useState<string>('0');
  const [fulfilmentInstructions, setFulfilmentInstructions] = useState<string>('');
  const [fulfilmentNotes, setFulfilmentNotes] = useState<string>('');
  // Shared scheduling picker — same calendar + time wheel + "I'm flexible" /
  // "Schedule a time" toggle as customer checkout. Reused via the
  // `useSchedulingPicker` hook so we do not build a second date/time system.
  const scheduling = useSchedulingPicker({ preference: 'none' });
  // PAYMENT DUE — simplified MVP: either no due date or a single calendar
  // date. No presets (Due on receipt / Net 7 / 14 / 30 are removed). The
  // vendor picks a concrete date via the native date picker. `none` means
  // the Due field is omitted entirely on the invoice (no "As agreed", no dash).
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [showPaymentDuePicker, setShowPaymentDuePicker] = useState<boolean>(false);
  const [showConversationPicker, setShowConversationPicker] = useState<boolean>(false);
  const [showFulfilmentSheet, setShowFulfilmentSheet] = useState<boolean>(false);
  const [pickerIntent, setPickerIntent] = useState<'select' | 'send'>('select');
  const [prefilled, setPrefilled] = useState<boolean>(false);
  // Inline validation errors keyed by field id. Empty string = no error.
  // We show these beside the affected field instead of a generic popup.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [validationAttempted, setValidationAttempted] = useState<boolean>(false);
  const [currency] = useState<Currency>((vendor.currency as Currency) || getCurrencyFromCountryCode(vendor.countryCode));

  useEffect(() => {
    if (!editingInvoice || prefilled) return;
    setCustomerSource(editingInvoice.customerSource ?? (editingInvoice.chatId ? 'the platform' : 'external'));
    setSelectedChatId(editingInvoice.chatId ?? null);
    setCustomerName(editingInvoice.customerName);
    setCustomerPhone(editingInvoice.customerPhone ?? '');
    setCustomerEmail(editingInvoice.customerEmail ?? '');
    setCustomerAddress(editingInvoice.customerAddress ?? '');
    setSourceType(editingInvoice.sourceType ?? null);
    setSourceOrderId(editingInvoice.orderId ?? null);
    setConversationId(editingInvoice.conversationId ?? editingInvoice.chatId ?? null);
    setItems(editingInvoice.items);
    setNotes(editingInvoice.notes ?? '');
    setFulfilmentMethod(editingInvoice.fulfilmentMethod ?? 'none');
    setFulfilmentLocation(editingInvoice.fulfilmentDetails?.location ?? '');
    setFulfilmentAddress(editingInvoice.fulfilmentDetails?.address ?? '');
    setFulfilmentServiceLocation(editingInvoice.fulfilmentDetails?.serviceLocation ?? '');
    setFulfilmentDeliveryFee(
      editingInvoice.fulfilmentDetails?.deliveryFee != null
        ? String(editingInvoice.fulfilmentDetails.deliveryFee)
        : '0',
    );
    setFulfilmentInstructions(editingInvoice.fulfilmentDetails?.instructions ?? '');
    setFulfilmentNotes(editingInvoice.fulfilmentDetails?.notes ?? '');
    // Restore scheduling state from the stored invoice. `dateTime` is the ISO
    // scheduled instant; `isFlexible` marks the "I'm flexible" preference.
    if (editingInvoice.fulfilmentDetails?.isFlexible) {
      scheduling.setTimingPreference('flexible');
    } else if (editingInvoice.fulfilmentDetails?.dateTime) {
      scheduling.setTimingPreference('schedule');
      const restored = new Date(editingInvoice.fulfilmentDetails.dateTime);
      scheduling.setPreferredDate(restored);
      scheduling.setSelectedMonth(
        new Date(restored.getFullYear(), restored.getMonth(), 1),
      );
      const h24 = restored.getHours();
      const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      scheduling.setSelectedHour(h12);
      scheduling.setSelectedMinute(restored.getMinutes());
      scheduling.setSelectedPeriod(period);
      scheduling.setPreferredTime(
        `${h12}:${restored.getMinutes().toString().padStart(2, '0')} ${period}`,
      );
    } else {
      scheduling.setTimingPreference('none');
    }
    setTaxRate(
      editingInvoice.subtotal > 0
        ? String(Math.round((editingInvoice.tax / editingInvoice.subtotal) * 10000) / 100)
        : '0'
    );
    setDiscount(String(editingInvoice.discount));
    // Restore the due date if one was saved on the invoice.
    setDueDate(editingInvoice.dueDate ?? null);
    setPrefilled(true);
  }, [editingInvoice, prefilled]);

  const selectedChat: Chat | undefined = useMemo(
    () => (selectedChatId ? chats.find((c) => c.id === selectedChatId) : undefined),
    [chats, selectedChatId]
  );

  const selectedSnapshot: InboxSnapshot | undefined = useMemo(
    () => (selectedChatId ? vendorInbox.find((s) => s.conversationId === selectedChatId || s.chatId === selectedChatId) : undefined),
    [vendorInbox, selectedChatId]
  );

  // Privacy: internal the platform customers always render as "First L." — the
  // vendor never sees a full surname on any invoice creation surface.
  const selectedDisplayName = useMemo(
    () => formatInternalCustomerFromFull(selectedSnapshot?.title ?? selectedChat?.customerName),
    [selectedSnapshot, selectedChat]
  );

  // Conversation type label — shown ONLY as context on the customer card
  // ("Order chat" / "Inquiry"). Never show the order number, and never state
  // that the invoice is linked to an order. A chat is just delivery routing.
  const selectedChatTypeBadge = useMemo<'order_chat' | 'pre_order_inquiry' | undefined>(() => {
    const snap = selectedSnapshot;
    if (!snap) return undefined;
    if (snap.conversationType === 'order' || snap.conversationType === 'custom_order') return 'order_chat';
    if (snap.conversationType === 'inquiry') return 'pre_order_inquiry';
    return undefined;
  }, [selectedSnapshot]);

  const unsavedChanges = useUnsavedChanges(
    { customerSource, selectedChatId, customerName, customerPhone, customerEmail, customerAddress, items, notes, taxRate, discount, fulfilmentMethod, fulfilmentLocation, fulfilmentAddress, fulfilmentServiceLocation, fulfilmentDeliveryFee, fulfilmentInstructions, fulfilmentNotes, sourceType, sourceOrderId, conversationId, schedulingPreference: scheduling.timingPreference, schedulingDate: scheduling.preferredDate, schedulingTime: scheduling.preferredTime, dueDate },
    !isEditMode
  );

  const addItem = () => {
    const newItem: InvoiceLineItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
    };
    setItems([...items, newItem]);
  };

  const updateItem = (id: string, field: keyof InvoiceLineItem, value: string | number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updated.total = updated.quantity * updated.unitPrice;
        }
        return updated;
      }
      return item;
    }));
  };

  const clampedSetCustomerName = (value: string) =>
    setCustomerName(value.slice(0, INVOICE_TEXT_LIMITS.externalCustomerName));
  const clampedSetCustomerAddress = (value: string) =>
    setCustomerAddress(value.slice(0, INVOICE_TEXT_LIMITS.notes));
  const clampedSetNotes = (value: string) =>
    setNotes(value.slice(0, INVOICE_TEXT_LIMITS.notes));
  const clampedSetItemName = (id: string, value: string) =>
    updateItem(id, 'name', value.slice(0, INVOICE_TEXT_LIMITS.lineItemName));
  const clampedSetItemDescription = (id: string, value: string) =>
    updateItem(id, 'description', value.slice(0, INVOICE_TEXT_LIMITS.lineItemDescription));
  const clampedSetFulfilmentLocation = (value: string) =>
    setFulfilmentLocation(value.slice(0, INVOICE_TEXT_LIMITS.fulfilmentLocation));
  const clampedSetFulfilmentAddress = (value: string) =>
    setFulfilmentAddress(value.slice(0, INVOICE_TEXT_LIMITS.fulfilmentLocation));
  const clampedSetFulfilmentServiceLocation = (value: string) =>
    setFulfilmentServiceLocation(value.slice(0, INVOICE_TEXT_LIMITS.fulfilmentLocation));
  const clampedSetFulfilmentInstructions = (value: string) =>
    setFulfilmentInstructions(value.slice(0, INVOICE_TEXT_LIMITS.fulfilmentInstructions));
  const clampedSetFulfilmentNotes = (value: string) =>
    setFulfilmentNotes(value.slice(0, INVOICE_TEXT_LIMITS.fulfilmentInstructions));

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const calculateSubtotal = () => items.reduce((sum, item) => sum + item.total, 0);
  const calculateTax = () => (calculateSubtotal() * (parseFloat(taxRate) || 0)) / 100;
  // Delivery fee is part of the invoice total when the vendor selects Delivery
  // and enters a fee. It is NEVER silently collected without being added to
  // the total. Tax is computed on the subtotal (line items only), not on the
  // delivery fee.
  const calculateDeliveryFee = () =>
    fulfilmentMethod === 'delivery' ? Math.max(0, parseFloat(fulfilmentDeliveryFee) || 0) : 0;
  const calculateTotal = () =>
    calculateSubtotal() + calculateTax() + calculateDeliveryFee() - (parseFloat(discount) || 0);

  /** Human label for the selected payment-due date, shown on the compact row. */
  const paymentDueLabel: string | null = (() => {
    if (!dueDate) return null;
    try {
      return new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return null;
    }
  })();

  const handlePaymentDueDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (selected) {
      // Store as a date-only ISO string (noon to avoid TZ edge cases).
      const iso = new Date(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate(),
        12, 0, 0,
      ).toISOString();
      setDueDate(iso);
    }
  };

  const clearPaymentDueDate = () => {
    setDueDate(null);
    setShowPaymentDuePicker(false);
  };

  /**
   * Build the fulfilment details payload for the invoice, surfacing only the
   * fields the vendor actually entered. `none` yields undefined so the
   * renderer skips the fulfilment block entirely.
   *
   * All fields are optional — empty strings become `undefined` and never reach
   * the customer-facing invoice. `isFlexible` is persisted when the vendor chose
   * "I'm flexible" (in which case `dateTime` is explicitly undefined — no
   * schedule is stored or displayed, even if one existed in a previous edit
   * session). `dateTime` is the ISO scheduled instant from the shared picker,
   * included only when the vendor picked "Schedule a time" and confirmed a
   * concrete date + time.
   *
   * Backend integration note (Henry): persist `fulfilmentMethod`,
   * `fulfilmentLocation`, `scheduledAt` (ISO, null when flexible), `isFlexible`,
   * and the method-specific `instructions` / `notes` / `deliveryFee`.
   */
  const buildFulfilmentDetails = (): InvoiceFulfilmentDetails | undefined => {
    if (fulfilmentMethod === 'none') return undefined;
    const isFlexible = scheduling.timingPreference === 'flexible';
    const isSchedule = scheduling.timingPreference === 'schedule';
    // Only "Schedule a time" produces a concrete dateTime. "I'm flexible" never
    // stores a schedule — the vendor explicitly chose to omit it, and any
    // previously selected date/time is discarded (the hook already clears it
    // on preference change, but we also null it here so stale state never
    // reaches the saved invoice).
    const base: InvoiceFulfilmentDetails = {
      dateTime: isSchedule ? scheduling.scheduledAtIso ?? undefined : undefined,
      isFlexible: isFlexible ? true : undefined,
    };
    if (fulfilmentMethod === 'pickup') {
      return { ...base, location: fulfilmentLocation.trim() || undefined, instructions: fulfilmentInstructions.trim() || undefined };
    }
    if (fulfilmentMethod === 'delivery') {
      const fee = parseFloat(fulfilmentDeliveryFee) || 0;
      return {
        ...base,
        address: fulfilmentAddress.trim() || undefined,
        deliveryFee: fee > 0 ? fee : undefined,
        instructions: fulfilmentInstructions.trim() || undefined,
      };
    }
    if (fulfilmentMethod === 'service') {
      return { ...base, serviceLocation: fulfilmentServiceLocation.trim() || undefined, notes: fulfilmentNotes.trim() || undefined };
    }
    return base;
  };

  /** Resolved customer display name based on the selected source. */
  const resolveCustomerName = (chat?: Chat): string => {
    if (effectiveCustomerSource === 'the platform') {
      // Privacy: internal the platform customers are always rendered as "First L."
      // The vendor cannot override this with a full surname.
      const rawName = chat?.customerName ?? selectedChat?.customerName ?? selectedSnapshot?.title ?? '';
      return formatInternalCustomerFromFull(rawName);
    }
    return customerName.trim();
  };

  const validate = (requireConversation: boolean): boolean => {
    const errors: Record<string, string> = {};
    const setErr = (key: string, msg: string) => { errors[key] = msg; };

    if (effectiveCustomerSource === 'the platform') {
      if (requireConversation && !selectedChat) {
        setErr('customer', 'Select a the platform customer.');
      }
    } else if (!customerName.trim()) {
      setErr('customerName', 'Customer name is required.');
    }

    // Items: at least one completed row (name + qty > 0 + price >= 0).
    // Empty item rows (blank name) do not count and are dropped on save.
    const completedItems = items.filter((it) => it.name.trim().length > 0);
    if (completedItems.length === 0) {
      setErr('items', 'Add at least one item with a name.');
    }
    items.forEach((item, index) => {
      const idxKey = `item-${item.id}`;
      const nameTrim = item.name.trim();
      // Only validate rows the vendor started filling in — empty rows are
      // ignored (and dropped) rather than flagged.
      if (nameTrim || item.quantity !== 1 || item.unitPrice !== 0) {
        if (!nameTrim) setErr(idxKey, 'Item name is required.');
        if (item.quantity <= 0) setErr(`item-qty-${item.id}`, 'Quantity must be greater than zero.');
        if (item.unitPrice < 0 || Number.isNaN(item.unitPrice)) setErr(`item-price-${item.id}`, 'Unit price cannot be negative.');
      }
    });

    // Total must be greater than zero (after tax + discount + delivery fee).
    if (calculateTotal() <= 0) {
      setErr('total', 'Invoice total must be greater than zero.');
    }

    // Fulfilment schedule: "Schedule a time" requires a concrete date + time
    // before the invoice can be issued. "I'm flexible" needs no schedule.
    if (fulfilmentMethod !== 'none' && scheduling.timingPreference === 'schedule') {
      if (!scheduling.hasScheduledDateTime) {
        setErr('fulfilmentSchedule', 'Pick a date and time, or switch to "I\'m flexible".');
      }
    }

    const textLimitErrors = validateTextLimits();
    textLimitErrors.forEach((e) => {
      // Surface text-limit errors inline under a generic key so they also
      // appear as an alert (they are cross-field and hard to pin to one row).
      if (!errors['textLimits']) errors['textLimits'] = e;
      else errors['textLimits'] = `${errors['textLimits']}\n\n${e}`;
    });

    setFieldErrors(errors);
    setValidationAttempted(true);

    if (Object.keys(errors).length > 0) {
      // Only show a generic alert for errors whose field is NOT visible on
      // the form (e.g. customer not selected when the picker is closed).
      // Inline-visible errors render beside their field instead.
      const inlineKeys = new Set([
        'customerName',
        'total',
        'fulfilmentSchedule',
        'textLimits',
        ...items.flatMap((it) => [`item-${it.id}`, `item-qty-${it.id}`, `item-price-${it.id}`]),
      ]);
      const offscreenMessages = Object.entries(errors)
        .filter(([k]) => !inlineKeys.has(k))
        .map(([, v]) => v);
      if (offscreenMessages.length > 0) {
        Alert.alert('Please fix the following', offscreenMessages.join('\n'));
      } else if (errors['items'] && items.length === 0) {
        Alert.alert('Add an item', errors['items']);
      }
      return false;
    }
    return true;
  };

  const buildInvoiceFields = (chat?: Chat) => ({
    customerName: sanitizeInvoiceText(resolveCustomerName(chat)) || 'Customer',
    customerPhone: effectiveCustomerSource === 'external' ? (customerPhone.trim() || undefined) : undefined,
    customerEmail: effectiveCustomerSource === 'external' ? (customerEmail.trim() || undefined) : undefined,
    customerAddress: effectiveCustomerSource === 'external' ? (customerAddress.trim() || undefined) : undefined,
    customerSource: effectiveCustomerSource,
    chatId: effectiveCustomerSource === 'the platform' ? (chat?.id ?? selectedChat?.id) : undefined,
    customerId: effectiveCustomerSource === 'the platform' ? (chat?.customerId ?? selectedChat?.customerId) : undefined,
    // Delivery routing only: conversationId tells the backend which the platform
    // chat thread to deliver the invoice card into. It does NOT link the
    // invoice to any order. sourceType / orderId stay unset on the normal
    // create-invoice flow — they'll only be populated by an explicit
    // "Create invoice from this order" workflow (Phase 2), which keeps
    // invoices and orders separate and prevents revenue double-counting.
    sourceType: undefined,
    conversationId: effectiveCustomerSource === 'the platform' ? (conversationId ?? chat?.id ?? selectedChat?.id ?? undefined) : undefined,
    orderId: undefined,
    // Payment-due date (simplified MVP): either a calendar date or none.
    // Henry should persist `dueDate` on the invoice document.
    paymentTerms: 'none' as const,
    dueDate: dueDate ?? undefined,
    items: items
      .filter((item) => item.name.trim().length > 0)
      .map((item) => ({
        ...item,
        name: sanitizeInvoiceText(item.name) || item.name,
        description: item.description ? sanitizeInvoiceText(item.description) : undefined,
      })),
    subtotal: calculateSubtotal(),
    tax: calculateTax(),
    discount: parseFloat(discount) || 0,
    total: calculateTotal(),
    notes: sanitizeInvoiceText(notes) || undefined,
    currency,
    fulfilmentMethod,
    fulfilmentDetails: buildFulfilmentDetails(),
  });

  /**
   * Validate all invoice free-text fields against the shared character limits.
   * Never silently truncate existing text; warn the vendor instead.
   * Backend integration note (Henry): enforce the same limits server-side and
   * reject oversized values rather than trimming them silently.
   */
  const validateTextLimits = (): string[] => {
    const errors: string[] = [];
    const add = (label: string, value: string | null | undefined, field: keyof typeof INVOICE_TEXT_LIMITS) => {
      const error = getInvoiceTextLimitError(field, value);
      if (error) errors.push(`${label}: ${error}`);
    };
    add('Customer name', customerName, 'externalCustomerName');
    add('Customer address', customerAddress, 'fulfilmentLocation');
    add('Invoice notes', notes, 'notes');
    if (fulfilmentMethod === 'pickup') {
      add('Pickup location', fulfilmentLocation, 'fulfilmentLocation');
      add('Pickup instructions', fulfilmentInstructions, 'fulfilmentInstructions');
    }
    if (fulfilmentMethod === 'delivery') {
      add('Delivery address', fulfilmentAddress, 'fulfilmentLocation');
      add('Delivery instructions', fulfilmentInstructions, 'fulfilmentInstructions');
    }
    if (fulfilmentMethod === 'service') {
      add('Service location', fulfilmentServiceLocation, 'fulfilmentLocation');
      add('Service notes', fulfilmentNotes, 'fulfilmentInstructions');
    }
    items.forEach((item, index) => {
      add(`Item ${index + 1} name`, item.name, 'lineItemName');
      add(`Item ${index + 1} description`, item.description, 'lineItemDescription');
    });
    return errors;
  };

  const handleSaveDraft = async () => {
    if (effectiveCustomerSource === 'the platform' && !selectedChat) {
      Alert.alert('Select a customer', 'Choose a the platform conversation before saving.');
      return;
    }
    if (!validate(false)) return;
    try {
      if (editingInvoice) {
        await updateInvoice(editingInvoice.id, buildInvoiceFields());
        unsavedChanges.resetChanges();
        Alert.alert('Saved', 'Invoice updated', [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        await createInvoice({ ...buildInvoiceFields(), status: 'draft' });
        unsavedChanges.resetChanges();
        Alert.alert('Success', 'Invoice saved as draft', [{ text: 'OK', onPress: () => router.back() }]);
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      Alert.alert('Error', 'Failed to save invoice');
    }
  };

  /** Attach the invoice card to a the platform chat thread. */
  const sendInChat = async (chat: Chat) => {
    try {
      let invoiceForMessage: { id: string; invoiceNumber: string; shareCode?: string; total: number };
      if (editingInvoice) {
        await updateInvoice(editingInvoice.id, buildInvoiceFields(chat));
        invoiceForMessage = {
          id: editingInvoice.id,
          invoiceNumber: editingInvoice.invoiceNumber,
          shareCode: editingInvoice.shareCode,
          total: calculateTotal(),
        };
      } else {
        const created = await createInvoice({ ...buildInvoiceFields(chat), status: 'draft' });
        invoiceForMessage = created;
      }
      // sendInvoiceInChat already writes the real chat message server-side
      // (type: "invoice", full invoiceData assembled from the trusted
      // invoice doc) — a second client-side addMessageToChat used to run
      // here too, but the backend only accepts text/contact-card/
      // catalog_item from clients, so it was silently rejected on every
      // real send. The live chat listener picks up the real message on its
      // own; nothing else needs to happen here.
      await sendInvoiceInChat(invoiceForMessage.id, chat.id, chat.customerId);
      unsavedChanges.resetChanges();
      // Privacy: confirmation copy uses the privacy-safe "First L." form.
      const confirmationName = formatInvoiceCustomerName(resolveCustomerName(chat) || chat.customerName, effectiveCustomerSource);
      Alert.alert('Invoice sent', `Invoice sent to ${confirmationName} in chat.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error sending invoice in chat:', error);
      Alert.alert('Error', 'Failed to send invoice');
    }
  };

  /** Share the unguessable public invoice link via the native share sheet. */
  const shareExternally = async () => {
    try {
      let inv: { id: string; invoiceNumber: string; shareCode?: string; total: number };
      if (editingInvoice) {
        await updateInvoice(editingInvoice.id, buildInvoiceFields());
        inv = {
          id: editingInvoice.id,
          invoiceNumber: editingInvoice.invoiceNumber,
          shareCode: editingInvoice.shareCode,
          total: calculateTotal(),
        };
      } else {
        inv = await createInvoice({ ...buildInvoiceFields(), status: 'draft' });
      }
      const shareUrl = inv.shareCode ? getInvoiceShareUrl(inv.shareCode) : undefined;
      const message =
        `Invoice ${inv.invoiceNumber} from ${vendor.name}\n` +
        `Total: ${formatPrice(inv.total, currency)}` +
        (shareUrl ? `\n\nView invoice: ${shareUrl}` : '');
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({ title: `Invoice ${inv.invoiceNumber}`, text: message });
        } else {
          await navigator.clipboard.writeText(message);
          Alert.alert('Copied', 'Invoice link copied to clipboard');
        }
      } else {
        await Share.share({ message, title: `Invoice ${inv.invoiceNumber}` });
      }
      await markInvoiceSharedExternally(inv.id);
      unsavedChanges.resetChanges();
      // External customers have no the platform chat — never say "sent in chat".
      Alert.alert(
        'Invoice created',
        'Share the secure link with your customer.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (error) {
      console.error('Error sharing invoice:', error);
      Alert.alert('Error', 'Failed to create invoice');
    }
  };

  const handleSend = async () => {
    if (!validate(false)) return;
    if (effectiveCustomerSource === 'the platform') {
      if (selectedChat) {
        await sendInChat(selectedChat);
      } else {
        // WhatsApp-style conversation selector when nothing is selected yet
        setPickerIntent('send');
        setShowConversationPicker(true);
      }
    } else {
      await shareExternally();
    }
  };

  const handleConversationSelected = (snapshot: InboxSnapshot) => {
    setShowConversationPicker(false);
    const chatRef = snapshot.chatId ?? snapshot.conversationId;
    setSelectedChatId(chatRef);
    // A chat identifies WHERE the invoice card is delivered. It does NOT link
    // the invoice to any order. Selecting a customer from an order chat is only
    // a way to locate the right the platform customer and the right conversation for
    // delivery — the invoice stays standalone.
    //
    // sourceType / sourceOrderId are intentionally NOT set here. They will only
    // be populated by an explicit "Create invoice from this order" flow (Phase 2)
    // so invoices and orders stay separate and revenue is never double-counted.
    setConversationId(chatRef);
    setSourceType(null);
    setSourceOrderId(null);
    if (pickerIntent === 'send') {
      const chat = chats.find((c) => c.id === chatRef);
      if (chat) {
        void sendInChat(chat);
      }
    }
  };

  const screenTitle = isEditMode ? 'Edit Invoice' : 'Create Invoice';
  const isSentEdit = isEditMode && editingInvoice?.status !== 'draft';

  // Fulfilment method labels shown inside the compact selector field and the
  // bottom sheet. `none` is intentionally NOT preselected — the field reads
  // "Select fulfilment method" until the vendor explicitly picks an option.
  const FULFILMENT_METHOD_LABELS: Record<InvoiceFulfilmentMethod, string> = {
    pickup: 'Pickup',
    delivery: 'Delivery',
    service: 'Service / Appointment',
    none: 'Not applicable',
  };
  const fulfilmentMethodLabel = fulfilmentMethod === 'none' ? null : FULFILMENT_METHOD_LABELS[fulfilmentMethod];
  const handleSelectFulfilmentMethod = (method: InvoiceFulfilmentMethod) => {
    setFulfilmentMethod(method);
    setShowFulfilmentSheet(false);
    // Reset timing preference when switching methods so stale state from a
    // previous method does not leak into the new selection.
    scheduling.setTimingPreference('none');
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader
          title={screenTitle}
          onBack={() => {
            if (!unsavedChanges.handleExitAttempt()) return;
            routerNav.back();
          }}
          showSave={false}
        />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* CUSTOMER TYPE — compact segmented selector.
              Two equal-width options in one rounded container, ~52px tall.
              No large cards. After a choice is made, the selector stays in
              place and only the relevant fields render below. */}
          <Text style={styles.customerTypeHeading}>Customer type</Text>
          <View
            style={styles.customerSegmentWrap}
            accessibilityRole="radiogroup"
            accessibilityLabel="Customer type"
          >
            <TouchableOpacity
              style={[
                styles.customerSegment,
                customerSource === 'the platform' && styles.customerSegmentActive,
              ]}
              onPress={() => { setCustomerSource('the platform'); setCustomerTypeCollapsed(true); }}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected: customerSource === 'the platform', checked: customerSource === 'the platform' }}
              accessibilityLabel="the platform customer"
            >
              <Users size={15} color={customerSource === 'the platform' ? Colors.primary : Colors.textMuted} />
              <Text style={[
                styles.customerSegmentText,
                customerSource === 'the platform' && styles.customerSegmentTextActive,
              ]}>
                the platform customer
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.customerSegment,
                customerSource === 'external' && styles.customerSegmentActive,
              ]}
              onPress={() => { setCustomerSource('external'); setCustomerTypeCollapsed(true); }}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected: customerSource === 'external', checked: customerSource === 'external' }}
              accessibilityLabel="External customer"
            >
              <Link2 size={15} color={customerSource === 'external' ? Colors.primary : Colors.textMuted} />
              <Text style={[
                styles.customerSegmentText,
                customerSource === 'external' && styles.customerSegmentTextActive,
              ]}>
                External customer
              </Text>
            </TouchableOpacity>
          </View>

          {customerSource === 'the platform' ? (
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.conversationRow}
                onPress={() => {
                  setPickerIntent('select');
                  setShowConversationPicker(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.conversationAvatar}>
                  {selectedSnapshot ? (
                    <Text style={styles.conversationAvatarText}>
                      {selectedDisplayName.charAt(0).toUpperCase()}
                    </Text>
                  ) : (
                    <User size={18} color={Colors.primary} />
                  )}
                </View>
                <View style={styles.conversationBody}>
                  {selectedSnapshot ? (
                    <>
                      <Text style={styles.conversationName}>{selectedDisplayName}</Text>
                      {selectedChatTypeBadge && (
                        <View style={styles.conversationMetaRow}>
                          <ChatTypeBadge variant={selectedChatTypeBadge} compact />
                        </View>
                      )}
                      <Text style={styles.conversationHint}>Tap to change customer</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.conversationName}>Select customer</Text>
                      <Text style={styles.conversationHint}>Choose an active or recent customer chat</Text>
                    </>
                  )}
                </View>
                <ChevronRight size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : customerSource === 'external' ? (
            <View style={styles.card}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Customer name <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={styles.fieldInput}
                  value={customerName}
                  onChangeText={clampedSetCustomerName}
                  placeholder="e.g. Jane Smith, ABC Events Ltd."
                  placeholderTextColor={Colors.inputPlaceholder}
                  maxLength={INVOICE_TEXT_LIMITS.externalCustomerName}
                />
                <Text style={styles.characterCount}>
                  {formatInvoiceCharacterCount('externalCustomerName', customerName)}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Phone <Text style={styles.optional}>(optional)</Text></Text>
                <TextInput
                  style={styles.fieldInput}
                  value={customerPhone}
                  onChangeText={setCustomerPhone}
                  placeholder="+234 XXX XXX XXXX"
                  placeholderTextColor={Colors.inputPlaceholder}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Email <Text style={styles.optional}>(optional)</Text></Text>
                <TextInput
                  style={styles.fieldInput}
                  value={customerEmail}
                  onChangeText={setCustomerEmail}
                  placeholder="customer@email.com"
                  placeholderTextColor={Colors.inputPlaceholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Address <Text style={styles.optional}>(optional)</Text></Text>
                <TextInput
                  style={styles.fieldInput}
                  value={customerAddress}
                  onChangeText={clampedSetCustomerAddress}
                  placeholder="Useful for delivery or invoice records"
                  placeholderTextColor={Colors.inputPlaceholder}
                  multiline
                  maxLength={INVOICE_TEXT_LIMITS.notes}
                />
                <Text style={styles.characterCount}>
                  {formatInvoiceCharacterCount('notes', customerAddress)}
                </Text>
              </View>
            </View>
          ) : null}

          {/* CUSTOMER INLINE ERROR (the platform customer not selected) */}
          {validationAttempted && effectiveCustomerSource === 'the platform' && !selectedChat && fieldErrors['customer'] ? (
            <Text style={styles.inlineError}>{fieldErrors['customer']}</Text>
          ) : null}
          {/* CUSTOMER INLINE ERROR (external) */}
          {validationAttempted && effectiveCustomerSource === 'external' && fieldErrors['customerName'] ? (
            <Text style={styles.inlineError}>{fieldErrors['customerName']}</Text>
          ) : null}

          {/* PAYMENT DUE — Optional. Simplified MVP: a single calendar date
              or no due date. No presets (Due on receipt / Net 7/14/30 removed).
              `none` means the Due field is omitted on the invoice entirely. */}
          <Text style={styles.sectionTitle}>PAYMENT DUE <Text style={styles.optional}>(OPTIONAL)</Text></Text>
          <TouchableOpacity
            style={styles.fulfilmentField}
            onPress={() => { Keyboard.dismiss(); setShowPaymentDuePicker(true); }}
            activeOpacity={0.7}
          >
            <View style={styles.fulfilmentFieldLeft}>
              <Text style={styles.fulfilmentFieldLabel}>Payment due</Text>
              <Text
                style={[
                  styles.fulfilmentFieldValue,
                  !paymentDueLabel && styles.fulfilmentFieldValuePlaceholder,
                ]}
                numberOfLines={1}
              >
                {paymentDueLabel ?? 'No due date'}
              </Text>
            </View>
            <CalendarClock size={18} color={Colors.textMuted} />
          </TouchableOpacity>
          {dueDate ? (
            <TouchableOpacity
              style={styles.clearDueDateRow}
              onPress={clearPaymentDueDate}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.clearDueDateText}>Clear date · No due date</Text>
            </TouchableOpacity>
          ) : null}

          {/* FULFILMENT METHOD — Optional. Compact full-width selector that
              opens a bottom sheet with the four method options. Nothing is
              preselected; the vendor explicitly picks a method. All fulfilment
              fields remain optional once a method is chosen. */}
          <Text style={styles.sectionTitle}>FULFILMENT <Text style={styles.optional}>(OPTIONAL)</Text></Text>
          <TouchableOpacity
            style={styles.fulfilmentField}
            onPress={() => setShowFulfilmentSheet(true)}
            activeOpacity={0.7}
          >
            <View style={styles.fulfilmentFieldLeft}>
              <Text style={styles.fulfilmentFieldLabel}>Fulfilment method</Text>
              <Text
                style={[
                  styles.fulfilmentFieldValue,
                  !fulfilmentMethodLabel && styles.fulfilmentFieldValuePlaceholder,
                ]}
                numberOfLines={1}
              >
                {fulfilmentMethodLabel ?? 'Select fulfilment method'}
              </Text>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          {fulfilmentMethod !== 'none' && (
            <View style={styles.card}>
              {/* Timing preference toggle — identical to customer checkout.
                  Vendor can leave blank, choose "I'm flexible", or pick a
                  concrete date/time via the shared scheduling sheet. */}
              <View style={styles.timingToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.timingOption,
                    scheduling.timingPreference === 'flexible' && styles.timingOptionSelected,
                  ]}
                  onPress={() => scheduling.handleTimingPreferenceChange('flexible')}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.timingRadio,
                    scheduling.timingPreference === 'flexible' && styles.timingRadioSelected,
                  ]}>
                    {scheduling.timingPreference === 'flexible' && <View style={styles.timingRadioDot} />}
                  </View>
                  <Text style={[
                    styles.timingOptionText,
                    scheduling.timingPreference === 'flexible' && styles.timingOptionTextSelected,
                  ]}>I'm flexible</Text>
                </TouchableOpacity>
                <View style={styles.timingDivider} />
                <TouchableOpacity
                  style={[
                    styles.timingOption,
                    scheduling.timingPreference === 'schedule' && styles.timingOptionSelected,
                  ]}
                  onPress={() => scheduling.handleTimingPreferenceChange('schedule')}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.timingRadio,
                    scheduling.timingPreference === 'schedule' && styles.timingRadioSelected,
                  ]}>
                    {scheduling.timingPreference === 'schedule' && <View style={styles.timingRadioDot} />}
                  </View>
                  <Text style={[
                    styles.timingOptionText,
                    scheduling.timingPreference === 'schedule' && styles.timingOptionTextSelected,
                  ]}>Schedule a time</Text>
                </TouchableOpacity>
              </View>

              {/* Inline validation: "Schedule a time" requires a concrete date + time. */}
              {validationAttempted &&
                scheduling.timingPreference === 'schedule' &&
                !scheduling.hasScheduledDateTime &&
                fieldErrors['fulfilmentSchedule'] ? (
                <Text style={styles.inlineError}>{fieldErrors['fulfilmentSchedule']}</Text>
              ) : null}

              {/* PICKUP — location → (date & time ONLY when Schedule a time) → instructions */}
              {fulfilmentMethod === 'pickup' && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Pickup location <Text style={styles.optional}>(optional)</Text></Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={fulfilmentLocation}
                      onChangeText={clampedSetFulfilmentLocation}
                      placeholder="Add pickup location"
                      placeholderTextColor={Colors.inputPlaceholder}
                      multiline
                      maxLength={INVOICE_TEXT_LIMITS.fulfilmentLocation}
                    />
                    <Text style={styles.characterCount}>
                      {formatInvoiceCharacterCount('fulfilmentLocation', fulfilmentLocation)}
                    </Text>
                  </View>
                  {/* Schedule field — ONLY when "Schedule a time" is selected.
                      "I'm flexible" hides the date/time picker entirely and no
                      schedule is stored on the invoice. */}
                  {scheduling.timingPreference === 'schedule' && (
                    <>
                      <View style={styles.divider} />
                      <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Pickup date & time <Text style={styles.required}>*</Text></Text>
                        <SchedulingTriggerRow
                          label="Pickup date & time"
                          placeholder="Choose date & time"
                          summary={scheduling.formatPreferredDateTime()}
                          hasValue={scheduling.hasScheduledDateTime}
                          onOpen={scheduling.handleOpenDateTimePicker}
                        />
                      </View>
                    </>
                  )}
                  <View style={styles.divider} />
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Pickup instructions <Text style={styles.optional}>(optional)</Text></Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={fulfilmentInstructions}
                      onChangeText={clampedSetFulfilmentInstructions}
                      placeholder="e.g. Bring this invoice number for reference"
                      placeholderTextColor={Colors.inputPlaceholder}
                      multiline
                      maxLength={INVOICE_TEXT_LIMITS.fulfilmentInstructions}
                    />
                    <Text style={styles.characterCount}>
                      {formatInvoiceCharacterCount('fulfilmentInstructions', fulfilmentInstructions)}
                    </Text>
                  </View>
                </>
              )}

              {/* DELIVERY — address → (date & time ONLY when Schedule a time) → fee → instructions */}
              {fulfilmentMethod === 'delivery' && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Delivery address <Text style={styles.optional}>(optional)</Text></Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={fulfilmentAddress}
                      onChangeText={clampedSetFulfilmentAddress}
                      placeholder="Add delivery address"
                      placeholderTextColor={Colors.inputPlaceholder}
                      multiline
                      maxLength={INVOICE_TEXT_LIMITS.fulfilmentLocation}
                    />
                    <Text style={styles.characterCount}>
                      {formatInvoiceCharacterCount('fulfilmentLocation', fulfilmentAddress)}
                    </Text>
                  </View>
                  {scheduling.timingPreference === 'schedule' && (
                    <>
                      <View style={styles.divider} />
                      <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Delivery date & time <Text style={styles.required}>*</Text></Text>
                        <SchedulingTriggerRow
                          label="Delivery date & time"
                          placeholder="Choose date & time"
                          summary={scheduling.formatPreferredDateTime()}
                          hasValue={scheduling.hasScheduledDateTime}
                          onOpen={scheduling.handleOpenDateTimePicker}
                        />
                      </View>
                    </>
                  )}
                  <View style={styles.divider} />
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Delivery fee <Text style={styles.optional}>(optional)</Text></Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={fulfilmentDeliveryFee}
                      onChangeText={setFulfilmentDeliveryFee}
                      placeholder="0.00"
                      placeholderTextColor={Colors.inputPlaceholder}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Delivery instructions <Text style={styles.optional}>(optional)</Text></Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={fulfilmentInstructions}
                      onChangeText={clampedSetFulfilmentInstructions}
                      placeholder="e.g. Setup at the backyard tent"
                      placeholderTextColor={Colors.inputPlaceholder}
                      multiline
                      maxLength={INVOICE_TEXT_LIMITS.fulfilmentInstructions}
                    />
                    <Text style={styles.characterCount}>
                      {formatInvoiceCharacterCount('fulfilmentInstructions', fulfilmentInstructions)}
                    </Text>
                  </View>
                </>
              )}

              {/* SERVICE / APPOINTMENT — location → (appointment date & time ONLY when Schedule a time) → notes */}
              {fulfilmentMethod === 'service' && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Service location <Text style={styles.optional}>(optional)</Text></Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={fulfilmentServiceLocation}
                      onChangeText={clampedSetFulfilmentServiceLocation}
                      placeholder="Add service location"
                      placeholderTextColor={Colors.inputPlaceholder}
                      multiline
                      maxLength={INVOICE_TEXT_LIMITS.fulfilmentLocation}
                    />
                    <Text style={styles.characterCount}>
                      {formatInvoiceCharacterCount('fulfilmentLocation', fulfilmentServiceLocation)}
                    </Text>
                  </View>
                  {scheduling.timingPreference === 'schedule' && (
                    <>
                      <View style={styles.divider} />
                      <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Appointment date & time <Text style={styles.required}>*</Text></Text>
                        <SchedulingTriggerRow
                          label="Appointment date & time"
                          placeholder="Choose date & time"
                          summary={scheduling.formatPreferredDateTime()}
                          hasValue={scheduling.hasScheduledDateTime}
                          onOpen={scheduling.handleOpenDateTimePicker}
                        />
                      </View>
                    </>
                  )}
                  <View style={styles.divider} />
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Service notes <Text style={styles.optional}>(optional)</Text></Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={fulfilmentNotes}
                      onChangeText={clampedSetFulfilmentNotes}
                      placeholder="e.g. Bring a reference photo"
                      placeholderTextColor={Colors.inputPlaceholder}
                      multiline
                      maxLength={INVOICE_TEXT_LIMITS.fulfilmentInstructions}
                    />
                    <Text style={styles.characterCount}>
                      {formatInvoiceCharacterCount('fulfilmentInstructions', fulfilmentNotes)}
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}

          {/* ITEMS */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>ITEMS</Text>
            {items.length > 0 && (
              <TouchableOpacity
                style={styles.addInlineButton}
                onPress={addItem}
                activeOpacity={0.7}
              >
                <Plus size={13} color={Colors.primary} />
                <Text style={styles.addInlineText}>Add Item</Text>
              </TouchableOpacity>
            )}
          </View>

          {items.length === 0 ? (
            <>
              <TouchableOpacity style={styles.emptyItemsCard} onPress={addItem} activeOpacity={0.7}>
                <View style={styles.emptyItemsIconWrap}>
                  <Package size={24} color={Colors.textMuted} />
                </View>
                <Text style={styles.emptyItemsTitle}>No items yet</Text>
                <Text style={styles.emptyItemsHint}>Tap to add your first item</Text>
                <View style={styles.addFirstButton}>
                  <Plus size={13} color={Colors.primary} />
                  <Text style={styles.addFirstButtonText}>Add Item</Text>
                </View>
              </TouchableOpacity>
              {validationAttempted && fieldErrors['items'] ? (
                <Text style={styles.inlineError}>{fieldErrors['items']}</Text>
              ) : null}
            </>
          ) : (
            <>
              {items.map((item, index) => (
                <View key={item.id} style={[styles.card, styles.itemCard]}>
                  <View style={styles.itemHeaderRow}>
                    <Text style={styles.itemLabel}>Item {index + 1}</Text>
                    <TouchableOpacity onPress={() => removeItem(item.id)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Trash2 size={17} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Name <Text style={styles.required}>*</Text></Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={item.name}
                      onChangeText={(text) => clampedSetItemName(item.id, text)}
                      placeholder="Item name"
                      placeholderTextColor={Colors.inputPlaceholder}
                      maxLength={INVOICE_TEXT_LIMITS.lineItemName}
                    />
                    <Text style={styles.characterCount}>
                      {formatInvoiceCharacterCount('lineItemName', item.name)}
                    </Text>
                    {validationAttempted && fieldErrors[`item-${item.id}`] ? (
                      <Text style={styles.inlineErrorSmall}>{fieldErrors[`item-${item.id}`]}</Text>
                    ) : null}
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Description <Text style={styles.optional}>(optional)</Text></Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={item.description ?? ''}
                      onChangeText={(text) => clampedSetItemDescription(item.id, text)}
                      placeholder="Add a short description"
                      placeholderTextColor={Colors.inputPlaceholder}
                      multiline
                      maxLength={INVOICE_TEXT_LIMITS.lineItemDescription}
                    />
                    <Text style={styles.characterCount}>
                      {formatInvoiceCharacterCount('lineItemDescription', item.description)}
                    </Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.twoColumnRow}>
                    <View style={styles.halfField}>
                      <Text style={styles.fieldLabel}>Qty <Text style={styles.required}>*</Text></Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={item.quantity.toString()}
                        onChangeText={(text) => updateItem(item.id, 'quantity', parseFloat(text) || 0)}
                        placeholder="1"
                        placeholderTextColor={Colors.inputPlaceholder}
                        keyboardType="numeric"
                      />
                      {validationAttempted && fieldErrors[`item-qty-${item.id}`] ? (
                        <Text style={styles.inlineErrorSmall}>{fieldErrors[`item-qty-${item.id}`]}</Text>
                      ) : null}
                    </View>
                    <View style={styles.halfDivider} />
                    <View style={styles.halfField}>
                      <Text style={styles.fieldLabel}>Unit price <Text style={styles.required}>*</Text></Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={item.unitPrice.toString()}
                        onChangeText={(text) => updateItem(item.id, 'unitPrice', parseFloat(text) || 0)}
                        placeholder="0.00"
                        placeholderTextColor={Colors.inputPlaceholder}
                        keyboardType="numeric"
                      />
                      {validationAttempted && fieldErrors[`item-price-${item.id}`] ? (
                        <Text style={styles.inlineErrorSmall}>{fieldErrors[`item-price-${item.id}`]}</Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.itemTotalRow}>
                    <Text style={styles.itemTotalLabel}>Line Total</Text>
                    <Text style={styles.itemTotalValue}>{formatPrice(item.total, currency)}</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* ADJUSTMENTS */}
          <Text style={styles.sectionTitle}>ADJUSTMENTS</Text>
          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Tax rate (%)</Text>
              <TextInput
                style={styles.fieldInput}
                value={taxRate}
                onChangeText={setTaxRate}
                placeholder="0"
                placeholderTextColor={Colors.inputPlaceholder}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Discount amount</Text>
              <TextInput
                style={styles.fieldInput}
                value={discount}
                onChangeText={setDiscount}
                placeholder="0.00"
                placeholderTextColor={Colors.inputPlaceholder}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* NOTES */}
          <Text style={styles.sectionTitle}>NOTES <Text style={styles.optional}>(OPTIONAL)</Text></Text>
          <View style={styles.card}>
            <TextInput
              style={styles.textArea}
              value={notes}
              onChangeText={clampedSetNotes}
              placeholder="Add a note about this invoice, customer request, or fulfilment details..."
              placeholderTextColor={Colors.inputPlaceholder}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={INVOICE_TEXT_LIMITS.notes}
            />
            <Text style={styles.characterCount}>
              {formatInvoiceCharacterCount('notes', notes)}
            </Text>
          </View>

          {/* TOTALS SUMMARY */}
          <Text style={styles.sectionTitle}>SUMMARY</Text>
          <View style={styles.card}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatPrice(calculateSubtotal(), currency)}</Text>
            </View>
            {calculateDeliveryFee() > 0 ? (
              <>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery fee</Text>
                  <Text style={styles.summaryValue}>{formatPrice(calculateDeliveryFee(), currency)}</Text>
                </View>
              </>
            ) : null}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax ({taxRate || 0}%)</Text>
              <Text style={styles.summaryValue}>{formatPrice(calculateTax(), currency)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount</Text>
              <Text style={[styles.summaryValue, { color: Colors.success }]}>
                -{formatPrice(parseFloat(discount) || 0, currency)}
              </Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPrice(calculateTotal(), currency)}</Text>
            </View>
          </View>

          {/* ACTIONS */}
          {isSentEdit ? (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleSaveDraft}
                activeOpacity={0.7}
              >
                <Text style={styles.sendButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.draftButton}
                onPress={handleSaveDraft}
                activeOpacity={0.7}
              >
                <Text style={styles.draftButtonText}>Save Draft</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleSend}
                activeOpacity={0.7}
              >
                {/* Internal customer → invoice is sent into the platform chat.
                    External customer → invoice is created and a secure share
                    link is generated (no chat to send into). */}
                <Text style={styles.sendButtonText}>
                  {effectiveCustomerSource === 'the platform' ? 'Send Invoice' : 'Create Invoice'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {isSentEdit && (
            <Text style={styles.liveUpdateNote}>
              This invoice was already sent. Saving updates the shared invoice page live.
            </Text>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <ConversationPickerModal
        visible={showConversationPicker}
        onClose={() => setShowConversationPicker(false)}
        onSelect={handleConversationSelected}
        onCreateExternal={() => {
          setShowConversationPicker(false);
          setCustomerSource('external');
          setSelectedChatId(null);
        }}
        title={pickerIntent === 'send' ? 'Send invoice to...' : 'Select customer'}
      />

      {/* Fulfilment method bottom sheet — four options, nothing preselected.
          Rendered here so the Fulfilment Method field's onPress actually opens
          it. The sheet handles its own overlay dismissal and stopPropagation so
          no transparent view blocks the field's press. */}
      <FulfilmentMethodSheet
        visible={showFulfilmentSheet}
        selected={fulfilmentMethod}
        onSelect={handleSelectFulfilmentMethod}
        onClose={() => setShowFulfilmentSheet(false)}
      />

      {/* Shared scheduling sheet — identical to customer checkout. Reused so
          vendors see one consistent date/time picker across the app. */}
      <SchedulingSheet vm={scheduling} title="Schedule fulfilment" />

      {/* Payment-due date picker — native calendar. Simplified MVP: a date
          or no date. No presets. */}
      {showPaymentDuePicker ? (
        <DateTimePicker
          value={dueDate ? new Date(dueDate) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={new Date()}
          onChange={(event, selected) => {
            if (event.type === 'dismissed' || !selected) {
              setShowPaymentDuePicker(false);
              return;
            }
            handlePaymentDueDateChange(event, selected);
            if (Platform.OS === 'android') {
              setShowPaymentDuePicker(false);
            }
          }}
        />
      ) : null}
      {showPaymentDuePicker && Platform.OS === 'ios' ? (
        <View style={styles.dueDateToolbar} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.dueDateToolbarClearBtn}
            onPress={clearPaymentDueDate}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.dueDateToolbarClearText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dueDateToolbarDoneBtn}
            onPress={() => setShowPaymentDuePicker(false)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.dueDateToolbarDoneText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <LaektivaModal
        visible={unsavedChanges.showDiscardModal}
        title="Discard changes?"
        message="If you leave now, your unsaved changes will be lost."
        primaryButton={{
          label: 'Discard',
          onPress: () => {
            unsavedChanges.handleDiscard();
            router.back();
          },
        }}
        secondaryButton={{
          label: 'Keep editing',
          onPress: unsavedChanges.handleKeepEditing,
        }}
        destructive
      />
    </View>
  );
}

/* Fulfilment method bottom sheet — four options, nothing preselected. */
function FulfilmentMethodSheet({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: InvoiceFulfilmentMethod;
  onSelect: (method: InvoiceFulfilmentMethod) => void;
  onClose: () => void;
}) {
  const options: {
    method: InvoiceFulfilmentMethod;
    label: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      method: 'pickup',
      label: 'Pickup',
      description: 'Customer collects from you',
      icon: <MapPin size={18} color={Colors.primary} />,
    },
    {
      method: 'delivery',
      label: 'Delivery',
      description: 'You ship to the customer',
      icon: <Truck size={18} color={Colors.primary} />,
    },
    {
      method: 'service',
      label: 'Service / Appointment',
      description: 'In-person service or booking',
      icon: <Wrench size={18} color={Colors.primary} />,
    },
    {
      method: 'none',
      label: 'Not applicable',
      description: 'No fulfilment needed',
      icon: <Ban size={18} color={Colors.primary} />,
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.fulfilmentSheetOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.fulfilmentSheetContainer}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.fulfilmentSheetHandle} />
          <View style={styles.fulfilmentSheetHeader}>
            <Text style={styles.fulfilmentSheetTitle}>Fulfilment method</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.fulfilmentSheetCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.fulfilmentSheetHint}>Optional. Choose how this invoice is fulfilled.</Text>
          {options.map((opt) => {
            const isSelected = selected === opt.method;
            return (
              <TouchableOpacity
                key={opt.method}
                style={[styles.fulfilmentSheetOption, isSelected && styles.fulfilmentSheetOptionActive]}
                onPress={() => onSelect(opt.method)}
                activeOpacity={0.7}
              >
                <View style={styles.fulfilmentSheetOptionIcon}>
                  {opt.icon}
                </View>
                <View style={styles.fulfilmentSheetOptionBody}>
                  <Text style={styles.fulfilmentSheetOptionLabel}>{opt.label}</Text>
                  <Text style={styles.fulfilmentSheetOptionDescription}>{opt.description}</Text>
                </View>
                {isSelected ? (
                  <CheckCircle size={20} color={Colors.primary} />
                ) : (
                  <View style={styles.fulfilmentSheetOptionRadio} />
                )}
              </TouchableOpacity>
            );
          })}
          <View style={styles.fulfilmentSheetSpacer} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

/* Payment-due sheet removed — simplified MVP uses a native date picker
   with a Clear/Done toolbar (iOS). See the showPaymentDuePicker block in
   the main render. */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundCanvas,
  },
  headerSafe: {
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    marginBottom: 10,
    marginTop: 20,
    paddingHorizontal: 2,
  },
  required: {
    color: Colors.error,
  },
  optional: {
    color: Colors.textMuted,
    fontWeight: '400' as const,
    textTransform: 'none' as const,
  },
  // Customer type — compact segmented selector (~52px tall).
  // Two equal-width options in one rounded container. Selected option uses
  // a subtle the platform tint + orange text/icon (not a solid orange block).
  customerTypeHeading: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  customerSegmentWrap: {
    flexDirection: 'row' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    marginBottom: 14,
  },
  customerSegment: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 7,
    paddingVertical: 11,
    borderRadius: 9,
    minHeight: 44,
  },
  customerSegmentActive: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.primary,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  customerSegmentText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  customerSegmentTextActive: {
    color: Colors.primary,
  },
  // Payment due — simplified MVP (native date picker + clear/done toolbar)
  clearDueDateRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 12,
    gap: 6,
  },
  clearDueDateText: {
    fontSize: 12.5,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  dueDateToolbar: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  dueDateToolbarClearBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  dueDateToolbarClearText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  dueDateToolbarDoneBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  dueDateToolbarDoneText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  // Legacy payment-due custom date picker styles (removed with the old
  // PaymentDueSheet — kept here only to keep the stylesheet valid).
  customDateWrap: {
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 12,
  },
  paymentModalLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
    marginBottom: 6,
    marginTop: 4,
  },
  customDateInputWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.surface,
    marginBottom: 10,
  },
  customDateInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 12,
  },
  customDateConfirmBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center' as const,
  },
  customDateConfirmText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  // Customer source segmented control — compact rounded container with
  // equal-width segments. Selected segment is a white card with orange
  // text/icon (not a solid orange block). Unselected uses neutral text.
  segmentWrap: {
    flexDirection: 'row' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    marginBottom: 12,
  },
  segment: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  segmentActive: {
    backgroundColor: Colors.background,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  segmentTextActive: {
    color: Colors.primary,
  },
  conversationRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  conversationAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  conversationAvatarText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  conversationBody: {
    flex: 1,
  },
  conversationName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  conversationMetaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 4,
  },
  conversationHint: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  fieldRow: {
    paddingVertical: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500' as const,
    marginBottom: 5,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  fieldInput: {
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 0,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  addInlineButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: Colors.primarySoft,
    borderRadius: 8,
    marginBottom: 10,
  },
  addInlineText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  emptyItemsCard: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center' as const,
    borderWidth: 1.5,
    borderStyle: 'dashed' as const,
    borderColor: Colors.borderDark,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 0,
  },
  emptyItemsIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 10,
  },
  emptyItemsTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 3,
  },
  emptyItemsHint: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 14,
  },
  addFirstButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: Colors.primarySoft,
    borderRadius: 8,
  },
  addFirstButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  itemCard: {
    marginBottom: 10,
  },
  itemHeaderRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 11,
  },
  itemLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  twoColumnRow: {
    flexDirection: 'row' as const,
  },
  halfField: {
    flex: 1,
    paddingVertical: 12,
  },
  halfDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  itemTotalRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 11,
  },
  itemTotalLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  itemTotalValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  textArea: {
    fontSize: 15,
    color: Colors.text,
    minHeight: 76,
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  characterCount: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 6,
    textAlign: 'right' as const,
    fontVariant: ['tabular-nums'] as const,
  },
  inlineError: {
    fontSize: 12.5,
    color: Colors.error,
    fontWeight: '500' as const,
    marginTop: 6,
    paddingHorizontal: 12,
    lineHeight: 17,
  },
  inlineErrorSmall: {
    fontSize: 11.5,
    color: Colors.error,
    fontWeight: '500' as const,
    marginTop: 5,
  },
  // Scheduling toggle (matches customer checkout exactly)
  timingToggleRow: {
    flexDirection: 'row' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
    marginVertical: 6,
  },
  timingOption: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 12,
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
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '400' as const,
  },
  timingOptionTextSelected: {
    color: Colors.text,
    fontWeight: '500' as const,
  },
  timingDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
  summaryRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  totalDivider: {
    height: 1,
    backgroundColor: Colors.borderDark,
    marginVertical: 2,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  buttonRow: {
    flexDirection: 'row' as const,
    gap: 10,
    marginTop: 24,
  },
  draftButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.borderDark,
  },
  draftButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  sendButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center' as const,
  },
  sendButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  liveUpdateNote: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginTop: 10,
    paddingHorizontal: 12,
    lineHeight: 17,
  },
  // Fulfilment method — compact full-width selector field
  fulfilmentField: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fulfilmentFieldLeft: {
    flex: 1,
    marginRight: 10,
  },
  fulfilmentFieldLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  fulfilmentFieldValue: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  fulfilmentFieldValuePlaceholder: {
    color: Colors.inputPlaceholder,
    fontWeight: '400' as const,
  },
  // Fulfilment method bottom sheet
  fulfilmentSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end' as const,
  },
  fulfilmentSheetContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingBottom: 24,
    maxHeight: '85%' as const,
  },
  fulfilmentSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center' as const,
    marginTop: 10,
    marginBottom: 14,
  },
  fulfilmentSheetHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 6,
  },
  fulfilmentSheetTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  fulfilmentSheetCancel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  fulfilmentSheetHint: {
    fontSize: 12.5,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  fulfilmentSheetOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
    backgroundColor: Colors.surface,
  },
  fulfilmentSheetOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  fulfilmentSheetOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fulfilmentSheetOptionBody: {
    flex: 1,
  },
  fulfilmentSheetOptionLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  fulfilmentSheetOptionDescription: {
    fontSize: 12.5,
    color: Colors.textSecondary,
  },
  fulfilmentSheetOptionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  fulfilmentSheetSpacer: {
    height: 8,
  },
  bottomSpacer: {
    height: 40,
  },
});
