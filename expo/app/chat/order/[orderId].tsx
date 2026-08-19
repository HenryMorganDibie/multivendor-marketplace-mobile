import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ChevronLeft, Send, User, Copy, Plus, Package, ChevronRight, Truck, Clock as ClockIcon, Lock } from 'lucide-react-native';
import MessageStatusIcon from '@/components/MessageStatusIcon';
import { PaymentRequestCard } from '@/components/PaymentRequestCard';
import * as Clipboard from 'expo-clipboard';
import Toast from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { getActiveOrdersForChat } from '@/utils/chatOrders';
import { ChatMessage, MessageStatus, getChatByOrderId } from '@/mocks/chatData';
import { chatService } from '@/services/chatService';
import { CustomerInvoiceChatCard } from '@/features/chat/components/CustomerInvoiceChatCard';
import { useChatSubscription, mergeChatMessages } from '@/hooks/useChatMessages';
import { mockOrders, OrderStatus, Order } from '@/mocks/ordersData';
import { mockVendors, type Vendor } from '@/mocks/vendorData';
import { vendorRepository } from '@/services/repositories/vendorRepository';
import { useOrders } from '@/contexts/OrdersContext';

import { useBlockedUsers } from '@/contexts/BlockedUsersContext';
import { useCustomOrders } from '@/contexts/CustomOrderContext';
import { useInbox } from '@/contexts/InboxContext';
import { useChatRead } from '@/contexts/ChatReadContext';
import { MOCK_CUSTOMER_ID } from '@/mocks/inboxData';

import { getChatAvailability } from '@/utils/chatAvailability';
import OrderChangesCard from '@/components/OrderChangesCard';
import { validateChatMessage } from '@/utils/chatValidation';
import { ContactCardPickerModal } from '@/components/ContactCardPickerModal';
import { ContactCard } from '@/contexts/ContactCardsContext';
import { useVendorChatMode } from '@/contexts/VendorChatModeContext';
import { formatPriceWithCommas, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';
import {
  CHAT_INPUT_PLACEHOLDERS,
  CHAT_BANNERS,
} from '@/constants/chatStrings';

const SYSTEM_TEMPLATES: Record<string, (vendorName: string) => string> = {
  ORDER_CONFIRMED: (vendorName) => `${vendorName} accepted your order request.`,
  ORDER_READY: (vendorName) => `${vendorName} marked your order as ready.`,
  ORDER_COMPLETED: (vendorName) => `${vendorName} marked this order as completed.`,
  ORDER_CANCELLED_BY_VENDOR: (vendorName) => `${vendorName} cancelled your order.`,
};

const generateStatusMessages = (status: OrderStatus, vendorName: string): ChatMessage[] => {
  const messages: ChatMessage[] = [];
  const baseTimestamp = new Date();

  if (status === 'cancelled') {
    messages.push({
      id: 'sys-cancelled',
      type: 'system',
      content: SYSTEM_TEMPLATES.ORDER_CANCELLED_BY_VENDOR(vendorName),
      sender: 'system',
      timestamp: new Date(baseTimestamp.getTime() - 240000).toISOString(),
    });
    return messages;
  }

  if (['accepted', 'confirmed', 'in_progress', 'completed'].includes(status)) {
    messages.push({
      id: 'sys-confirmed',
      type: 'system',
      content: SYSTEM_TEMPLATES.ORDER_CONFIRMED(vendorName),
      sender: 'system',
      timestamp: new Date(baseTimestamp.getTime() - 240000).toISOString(),
    });
  }

  if (['in_progress', 'completed'].includes(status)) {
    messages.push({
      id: 'sys-ready',
      type: 'system',
      content: SYSTEM_TEMPLATES.ORDER_READY(vendorName),
      sender: 'system',
      timestamp: new Date(baseTimestamp.getTime() - 180000).toISOString(),
    });
  }

  if (status === 'completed') {
    messages.push({
      id: 'sys-completed',
      type: 'system',
      content: SYSTEM_TEMPLATES.ORDER_COMPLETED(vendorName),
      sender: 'system',
      timestamp: new Date(baseTimestamp.getTime() - 60000).toISOString(),
    });
  }

  return messages;
};

const formatScheduledDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

function getOrderPaymentStatus(order: Order): 'UNPAID' | 'PAYMENT_SUBMITTED' | 'PAID_CONFIRMED' {
  const ps = order.paymentState;
  if (ps === 'CUSTOMER_MARKED_PAID' || ps === 'PAYMENT_UNDER_REVIEW') return 'PAYMENT_SUBMITTED';
  if (ps === 'VENDOR_PAYMENT_CONFIRMED' || ps === 'ORDER_READY' || ps === 'ORDER_COMPLETED') return 'PAID_CONFIRMED';
  return 'UNPAID';
}

const shouldShowPinnedCard = (o: Order): boolean => {
  const activeStatuses: OrderStatus[] = ['accepted', 'confirmed', 'in_progress'];
  if (activeStatuses.includes(o.status)) return true;
  if (o.status === 'completed' && o.completedAt) {
    const completedAt = new Date(o.completedAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return completedAt > sevenDaysAgo;
  }
  return false;
};

export default function OrderChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.orderId as string;
  const vendorName = params.vendorName as string;
  const publicOrderId = params.publicOrderId as string;
  const scrollViewRef = useRef<ScrollView>(null);
  const { getBlockedUserByChatId } = useBlockedUsers();
  const { proposals } = useCustomOrders();
  const { chatMode } = useVendorChatMode();
  const { customerInbox, updateInboxAfterMessage } = useInbox();
  const { markChatAsRead } = useChatRead();

  const { getOrder, setOrderPendingChanges } = useOrders();
  const orderFromContext = getOrder(orderId);
  const order = orderFromContext || mockOrders.find((o) => o.id === orderId);
  const resolvedChat = getChatByOrderId(orderId);
  const chatId = resolvedChat?.id ?? '';
  const blockedUser = chatId ? getBlockedUserByChatId(chatId) : undefined;
  const isBlocked = !!blockedUser;

  const orderVendor = order ? mockVendors.find(v => v.id === order.vendorId) : null;
  const isVendorSuspendedOnActiveOrder =
    orderVendor?.vendorStatus === 'SUSPENDED' &&
    order != null &&
    ['requested', 'accepted', 'confirmed', 'in_progress'].includes(order.status);
  console.log('[ORDER CHAT] Vendor status:', orderVendor?.vendorStatus, '| Safety freeze active:', isVendorSuspendedOnActiveOrder);

  // Real vendor doc, fetched separately from orderVendor above (which stays
  // on mockVendors for the unrelated suspension check). Only used to show the
  // vendor's actual configured payment instructions instead of the previous
  // hardcoded bank details in the Payment Details modal.
  const [paymentVendor, setPaymentVendor] = useState<Vendor | undefined>(undefined);
  useEffect(() => {
    if (!order?.vendorId) return;
    let cancelled = false;
    void vendorRepository.getById(order.vendorId).then((v) => {
      if (!cancelled) setPaymentVendor(v);
    });
    return () => { cancelled = true; };
  }, [order?.vendorId]);

  const fulfillmentTypeFromParams = (params.fulfillmentType as string) || 'Pickup';
  const orderTotalFromParams = params.orderTotal ? Number(params.orderTotal) : 0;
  const orderItemsFromParams = params.orderItems ? JSON.parse(params.orderItems as string) : [];
  const orderSubtotal = params.orderSubtotal ? Number(params.orderSubtotal) : orderTotalFromParams;
  const orderTax = params.orderTax ? Number(params.orderTax) : 0;
  const orderDiscount = params.orderDiscount ? Number(params.orderDiscount) : 0;

  const chatAvailability = getChatAvailability(
    order?.status || 'requested',
    order?.completedAt
  );

  const isChatDisabledByVendor = chatMode === 'disabled';
  const isLimitedMode = chatMode === 'limited';

  const currentOrder: Order = order || {
    id: orderId,
    publicOrderId: publicOrderId || orderId,
    vendorId: 'v1',
    vendorName: vendorName || 'Vendor',
    status: 'requested',
    orderDate: new Date().toISOString(),
    fulfillmentType: fulfillmentTypeFromParams as 'Pickup' | 'Delivery',
    fulfillmentMethod: (fulfillmentTypeFromParams.toLowerCase() === 'pickup' ? 'pickup' : 'delivery') as 'pickup' | 'delivery',
    items: orderItemsFromParams,
    subtotal: orderSubtotal,
    tax: orderTax,
    discount: orderDiscount,
    total: orderTotalFromParams,
    orderSource: 'internal',
  };

  const activeOrders = order && order.customerId
    ? getActiveOrdersForChat(mockOrders, order.vendorId, order.customerId)
    : [];

  console.log('📌 CUSTOMER CHAT - Pinned Active Orders:');
  console.log('Current order:', orderId, order?.vendorId, order?.customerId);
  console.log('Pinned count:', activeOrders.length);
  console.log('Pinned orders:', activeOrders.map(o => ({ id: o.id, status: o.status })));

  const orderStatus = currentOrder.status;
  // Step 4: read messages from the centralized chat store (chatService /
  // mockChats) when available, so previously-sent messages persist across
  // navigation. Fall back to synthesized status messages only when the
  // resolved chat has no stored messages.
  const initialMessages = useMemo(() => {
    if (resolvedChat?.messages?.length) {
      console.log('[ORDER CHAT] Hydrating from chatService store, count:', resolvedChat.messages.length);
      return resolvedChat.messages;
    }
    return generateStatusMessages(currentOrder.status, currentOrder.vendorName);
  }, [resolvedChat, currentOrder.status, currentOrder.vendorName]);

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  // Step 5: subscribe to chatService writes so in-session sends and system
  // events appear immediately without requiring navigation.
  const { version: chatVersion } = useChatSubscription(chatId || undefined);
  useEffect(() => {
    if (!chatId) return;
    const fresh = chatService.getByIdSync(chatId)?.messages;
    if (!fresh) return;
    setMessages(prev => mergeChatMessages(prev, fresh));
  }, [chatId, chatVersion]);

  /** Clear unread for customer when this chat opens / new message lands. */
  useEffect(() => {
    if (!chatId) return;
    markChatAsRead(chatId, 'customer');
  }, [chatId, chatVersion, markChatAsRead]);
  const [messageText, setMessageText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showChatActionsMenu, setShowChatActionsMenu] = useState(false);
  const [showContactCardPicker, setShowContactCardPicker] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState<string | null>(null);
  const [changeRequestStatuses, setChangeRequestStatuses] = useState<Record<string, 'pending' | 'accepted' | 'rejected'>>({});
  const { toastVisible, showToast } = useToast();

  const vendorCurrency = useMemo(() => {
    const v = mockVendors.find(vv => vv.id === currentOrder.vendorId);
    return (v?.currency as Currency) || getCurrencyFromCountryCode(v?.countryCode || 'NG');
  }, [currentOrder.vendorId]);

  const hasPendingChangeRequest = useMemo(() => {
    return messages.some((m) => {
      if (m.type !== 'change_request' || !m.changeRequestData) return false;
      const effectiveStatus = changeRequestStatuses[m.id] || m.changeRequestData.status;
      return effectiveStatus === 'pending';
    });
  }, [messages, changeRequestStatuses]);

  const pendingPaymentRequest = useMemo(() => {
    const paymentMessages = messages.filter(
      (m) => m.type === 'payment-request' && m.paymentRequestData
    );
    if (paymentMessages.length === 0) return null;
    const lastPayment = paymentMessages[paymentMessages.length - 1];
    if (lastPayment.paymentRequestData?.status === 'confirmed') return null;
    return lastPayment;
  }, [messages]);

  const handleViewPaymentInstructions = () => {
    if (pendingPaymentRequest) {
      setShowPaymentDetails(pendingPaymentRequest.id);
    }
  };

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 100);
  }, [messages]);

  const handleBackPress = () => {
    try {
      router.back();
    } catch {
      router.replace('/customer/(tabs)/chats' as any);
    }
  };

  const handleSendMessage = () => {
    if (messageText.trim() === '') return;

    const messageContent = messageText.trim();

    const validation = validateChatMessage(messageContent);
    if (!validation.isValid) {
      setValidationError(validation.errorMessage || 'Invalid message');
      setTimeout(() => setValidationError(null), 4000);
      return;
    }

    setMessageText('');

    if (chatId) {
      chatService
        .sendMessage({
          chatId,
          type: 'text',
          content: messageContent,
          sender: 'customer',
        })
        .then((m) => console.log('[ORDER CHAT] Message persisted via chatService:', m.id))
        .catch((err) => console.log('[ORDER CHAT] sendMessage failed:', err));
    } else {
      const newMessage: ChatMessage = {
        id: `m${Date.now()}`,
        type: 'text',
        content: messageContent,
        sender: 'customer',
        timestamp: new Date().toISOString(),
        status: 'sent',
      };
      setMessages((prev) => [...prev, newMessage]);
      console.log('[ORDER CHAT] No chatId resolved, message not persisted to chatService');
    }

    console.log('[ORDER CHAT] Customer message sent:', messageContent);

    const conv = customerInbox.find(item => item.orderId === orderId);
    if (conv) {
      updateInboxAfterMessage({
        conversationId: conv.conversationId,
        lastMessageText: messageContent,
        lastSenderId: MOCK_CUSTOMER_ID,
        senderRole: 'customer',
      });
      console.log('[ORDER CHAT] Inbox snapshot updated:', conv.conversationId);
    }
  };

  const handleOpenContactCard = () => {
    setShowChatActionsMenu(false);
    setShowContactCardPicker(true);
  };

  const handleSendContactCard = (card: ContactCard) => {
    const newMessage: ChatMessage = {
      id: `m${Date.now()}`,
      type: 'contact-card',
      content: 'Contact details shared',
      sender: 'customer',
      timestamp: new Date().toISOString(),
      contactCardData: {
        name: card.name,
        phone: card.phone,
        address: card.address,
        note: card.note,
      },
    };

    if (chatId) {
      chatService
        .sendMessage({
          chatId,
          type: 'contact-card',
          content: 'Contact details shared',
          sender: 'customer',
          contactCardData: {
            name: card.name,
            phone: card.phone,
            address: card.address,
            note: card.note,
          },
        })
        .then((m) => console.log('[ORDER CHAT] Contact card persisted via chatService:', m.id))
        .catch((err) => console.log('[ORDER CHAT] sendMessage (contact-card) failed:', err));
    } else {
      setMessages((prev) => [...prev, newMessage]);
    }
    console.log('Contact card sent:', card.label);
  };

  const handleViewOrderDetails = (orderIdToView?: string) => {
    const targetOrderId = orderIdToView || orderId;
    router.push({ pathname: `/order/${targetOrderId}` as any, params: { fromChat: 'true' } });
  };

  const getOrderStatusLabel = (status: string): { label: string; color: string; bgColor: string } => {
    switch (status) {
      case 'accepted':
      case 'confirmed':
        return { label: 'Confirmed', color: Colors.primary, bgColor: 'rgba(255,140,66,0.1)' };
      case 'in_progress':
        return { label: 'In Progress', color: Colors.primary, bgColor: 'rgba(255,140,66,0.1)' };
      case 'completed':
        return { label: 'Completed', color: Colors.success, bgColor: Colors.successLight };
      default:
        return { label: 'Pending', color: Colors.textSecondary, bgColor: Colors.surface };
    }
  };

  const renderOrderSummaryCard = () => {
    if (!shouldShowPinnedCard(currentOrder)) return null;

    const itemCount = currentOrder.items.reduce((sum, item) => sum + item.quantity, 0);
    const displayOrderId = (currentOrder.publicOrderId || currentOrder.id).toUpperCase();

    let fulfillmentLine = currentOrder.fulfillmentType || 'Pickup';
    if (currentOrder.scheduledDate) {
      fulfillmentLine += ` • ${formatScheduledDate(currentOrder.scheduledDate)}`;
    }
    if (currentOrder.scheduledTime) {
      fulfillmentLine += ` • ${currentOrder.scheduledTime}`;
    }

    const hasPaymentPending = pendingPaymentRequest && pendingPaymentRequest.paymentRequestData;
    const orderStatusInfo = getOrderStatusLabel(currentOrder.status);

    console.log('[PINNED CARD] Showing for order:', displayOrderId, '| status:', currentOrder.status);

    const paymentStatus = getOrderPaymentStatus(currentOrder);
    const showPaymentSubmittedState = currentOrder.status === 'accepted' && paymentStatus === 'PAYMENT_SUBMITTED';

    return (
      <View style={styles.pinnedOrderCard} testID="pinned-order-card">
        <TouchableOpacity style={styles.pinnedOrderTopSection} onPress={() => handleViewOrderDetails()} activeOpacity={0.8}>
          <View style={styles.pinnedOrderAccent} />
          <View style={styles.pinnedOrderContent}>
            <View style={styles.pinnedOrderTopRow}>
              <Package size={13} color={Colors.primary} />
              <Text style={styles.pinnedOrderId} numberOfLines={1}>
                Order #{displayOrderId}
              </Text>
            </View>
            <Text style={styles.pinnedOrderFulfillment} numberOfLines={1}>
              {fulfillmentLine}
            </Text>
            <View style={styles.pinnedOrderBottomRow}>
              <Text style={styles.pinnedOrderMeta}>
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </Text>
              <Text style={styles.pinnedOrderDot}>·</Text>
              <Text style={styles.pinnedOrderTotal}>
                {formatPriceWithCommas(currentOrder.total, vendorCurrency)}
              </Text>
            </View>
            {hasPaymentPending ? (
              <TouchableOpacity
                style={styles.pinnedOrderStatusRow}
                onPress={handleViewPaymentInstructions}
                activeOpacity={0.7}
              >
                <View style={styles.pinnedPaymentPendingBadge}>
                  <View style={styles.pinnedPaymentDot} />
                  <Text style={styles.pinnedPaymentPendingText}>Payment Pending</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.pinnedOrderStatusRow}>
                <View style={[styles.pinnedOrderStatusBadge, { backgroundColor: orderStatusInfo.bgColor }]}>
                  <Text style={[styles.pinnedOrderStatusText, { color: orderStatusInfo.color }]}>
                    {orderStatusInfo.label}
                  </Text>
                </View>
              </View>
            )}
          </View>
          <View style={styles.pinnedChevronBtn}>
            <ChevronRight size={16} color={Colors.textMuted} />
          </View>
        </TouchableOpacity>

        {showPaymentSubmittedState && (
          <>
            <View style={styles.pinnedCardDivider} />
            <View style={styles.paymentSubmittedCardBadge}>
              <ClockIcon size={13} color={Colors.textMuted} strokeWidth={2} />
              <Text style={styles.paymentSubmittedCardText}>Payment submitted · Awaiting confirmation</Text>
            </View>
          </>
        )}
      </View>
    );
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const customerProposal = proposals.find((p) => p.chatId === chatId && p.state === 'PROPOSAL_SENT');

  const renderCustomOrderPreview = (proposal: typeof customerProposal) => {
    if (!proposal) return null;

    const itemCount = proposal.items.reduce((sum, item) => sum + item.quantity, 0);

    const handleViewCustomOrder = () => {
      router.push(`/custom-order-proposal/${proposal.id}` as any);
    };

    return (
      <View style={styles.systemMessageContainer}>
        <View style={styles.customOrderPreviewCard}>
          <View style={styles.customOrderPreviewContent}>
            <View style={styles.customOrderPreviewImagePlaceholder}>
              <Text style={styles.customOrderPreviewImagePlaceholderText}>🛒</Text>
            </View>
            <View style={styles.customOrderPreviewInfo}>
              <Text style={styles.customOrderPreviewTitle}>Custom Order</Text>
              <Text style={styles.customOrderPreviewItems}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
              <Text style={styles.customOrderPreviewTotal}>{formatPriceWithCommas(proposal.total, (() => { const v = mockVendors.find(vv => vv.id === proposal.vendorId); return (v?.currency as Currency) || 'NGN'; })())}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.customOrderPreviewButton}
            onPress={handleViewCustomOrder}
            activeOpacity={0.7}
          >
            <Text style={styles.customOrderPreviewButtonText}>View custom order</Text>
          </TouchableOpacity>
          <Text style={styles.customOrderPreviewTimestamp}>{formatTime(proposal.updatedAt)}</Text>
        </View>
      </View>
    );
  };

  const renderMessage = (message: ChatMessage, groupInfo: { isFirstInGroup: boolean; isLastInGroup: boolean } = { isFirstInGroup: true, isLastInGroup: true }) => {
    if (message.type === 'system') {
      return (
        <View key={message.id} style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{message.content}</Text>
        </View>
      );
    }

    if (message.type === 'catalog_item' && message.catalogItemData) {
      const item = message.catalogItemData;
      const displayPrice = (item.price || 0).toFixed(2);

      return (
        <View key={message.id} style={styles.menuItemCardContainer}>
          <View style={styles.menuItemCard}>
            <View style={styles.menuItemCardContent}>
              <View style={styles.menuItemImageContainer}>
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={styles.menuItemImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.menuItemImagePlaceholder}>
                    <Text style={styles.menuItemImagePlaceholderText}>🍴</Text>
                  </View>
                )}
              </View>
              <View style={styles.menuItemInfo}>
                <Text style={styles.menuItemName}>{item.name}</Text>
                <Text style={styles.menuItemPrice}>{formatPriceWithCommas(Number(displayPrice) || 0, (() => { const v = mockVendors.find(vv => vv.id === order?.vendorId); return (v?.currency as Currency) || 'NGN'; })())}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.menuItemButton}
              onPress={() => {
                console.log('View catalog item:', item.id);
                if (item.id) {
                  router.push(`/item/${item.id}` as any);
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.menuItemButtonText}>View</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (message.type === 'payment-request' && message.paymentRequestData) {
      const vendorDisplayName = order?.vendorName || vendorName || 'Vendor';
      const orderIdDisplay = order?.publicOrderId || orderId;

      return (
        <View key={message.id} style={styles.paymentRequestWrapper}>
          <PaymentRequestCard
            vendorName={vendorDisplayName}
            orderId={orderIdDisplay}
            paymentData={message.paymentRequestData}
            timestamp={message.timestamp}
            role="customer"
            onViewOrderDetails={() => handleViewOrderDetails()}
          />
        </View>
      );
    }

    if (message.type === 'invoice' && message.invoiceData) {
      // Customer-facing invoice card: vendor name, invoice number, status
      // (Unpaid/Overdue/Paid), total, item count, issue/due date, and a
      // single "View Invoice" action that opens the read-only branded
      // invoice screen via InvoiceRenderer. No payment processing.
      return (
        <View key={message.id} style={styles.invoiceCardWrapper}>
          <CustomerInvoiceChatCard
            data={message.invoiceData}
            timestamp={message.timestamp}
            orderId={orderId as string}
          />
        </View>
      );
    }

    if (message.type === 'receipt' && message.receiptData) {
      const data = message.receiptData;

      const handleCopy = async (text: string) => {
        await Clipboard.setStringAsync(text);
        showToast();
      };

      const orderIdDisplay = order?.publicOrderId ? order.publicOrderId.toUpperCase() : (orderId as string).toUpperCase();
      const receiptIdDisplay = data.receiptId.toUpperCase();

      return (
        <View key={message.id} style={styles.systemMessageContainer}>
          <View style={styles.paymentRequestCard}>
            <Text style={styles.paymentRequestHeader}>🧾 Receipt received</Text>
            
            <View style={styles.paymentRequestSection}>
              <View style={styles.paymentRequestRow}>
                <Text style={styles.paymentRequestLabel}>Receipt ID</Text>
                <TouchableOpacity 
                  onPress={() => handleCopy(data.receiptId)} 
                  style={styles.copyIconButton} 
                  activeOpacity={0.7}
                >
                  <Copy size={16} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.paymentRequestValue}>{receiptIdDisplay}</Text>

            </View>

            <View style={styles.paymentRequestSection}>
              <View style={styles.paymentRequestRow}>
                <Text style={styles.paymentRequestLabel}>Order</Text>
                <TouchableOpacity 
                  onPress={() => handleCopy(order?.publicOrderId || orderId)} 
                  style={styles.copyIconButton} 
                  activeOpacity={0.7}
                >
                  <Copy size={16} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.paymentRequestValue}>{orderIdDisplay}</Text>

            </View>

            <View style={styles.paymentRequestSection}>
              <Text style={styles.paymentRequestLabel}>Amount paid</Text>
              <Text style={styles.paymentRequestValue}>{formatPriceWithCommas(data.amountPaid, (() => { const v = mockVendors.find(vv => vv.id === order?.vendorId); return (v?.currency as Currency) || 'NGN'; })())}</Text>
            </View>

            <Text style={styles.paymentRequestTimestamp}>{formatTime(message.timestamp)}</Text>
          </View>
        </View>
      );
    }

    if (message.type === 'pickup-details' && message.pickupDetailsData) {
      const data = message.pickupDetailsData;
      const isOrderPaid = messages.some(m => 
        m.type === 'payment-request' && 
        m.paymentRequestData?.status === 'confirmed'
      ) || messages.some(m => 
        m.type === 'system' && 
        m.content.toLowerCase().includes('payment confirmed')
      );
      
      return (
        <View key={message.id} style={styles.systemMessageContainer}>
          <View style={styles.pickupDetailsCard}>
            <Text style={styles.pickupDetailsHeader}>📍 Pickup Details</Text>
            
            <View style={styles.pickupDetailsSection}>
              <Text style={styles.pickupDetailsLabel}>Pickup Address</Text>
              <Text style={styles.pickupDetailsValue}>{data.address}</Text>
            </View>

            {data.instructions && data.instructions.trim() !== '' && (
              <View style={styles.pickupDetailsSection}>
                <Text style={styles.pickupDetailsLabel}>Instructions</Text>
                <Text style={styles.pickupDetailsValue}>{data.instructions}</Text>
              </View>
            )}

            {data.contactPhone && data.contactPhone.trim() !== '' && (
              <View style={styles.pickupDetailsSection}>
                <Text style={styles.pickupDetailsLabel}>Contact Phone</Text>
                <Text style={styles.pickupDetailsValue}>{data.contactPhone}</Text>
              </View>
            )}

            {(data.scheduledDate || data.scheduledTime) && (
              <View style={styles.pickupDetailsSection}>
                <Text style={styles.pickupDetailsLabel}>Scheduled Pickup</Text>
                <Text style={styles.pickupDetailsValue}>
                  {data.scheduledDate} {data.scheduledTime && `at ${data.scheduledTime}`}
                </Text>
              </View>
            )}

            {data.verificationCode && (
              <View style={styles.pickupDetailsSection}>
                <Text style={styles.pickupDetailsLabel}>Verification Code</Text>
                {isOrderPaid ? (
                  <Text style={styles.pickupDetailsValueHighlight}>{data.verificationCode}</Text>
                ) : (
                  <Text style={styles.pickupDetailsHelper}>Verification code will be shared after payment.</Text>
                )}
              </View>
            )}

            <Text style={styles.pickupDetailsTimestamp}>{formatTime(message.timestamp)}</Text>
          </View>
        </View>
      );
    }

    if (message.type === 'change_request' && message.changeRequestData) {
      const vendorCurrency = (() => {
        const v = mockVendors.find(vv => vv.id === order?.vendorId);
        return (v?.currency as Currency) || 'NGN';
      })();
      const effectiveStatus = changeRequestStatuses[message.id] || message.changeRequestData.status;
      const effectiveChangeRequest = { ...message.changeRequestData, status: effectiveStatus };
      return (
        <View key={message.id} style={styles.changeRequestContainer}>
          <OrderChangesCard
            changeRequest={effectiveChangeRequest}
            currency={vendorCurrency}
            isVendorView={false}
            onAccept={() => {
              console.log('[ORDER CHAT] Customer accepted changes for message:', message.id);
              setChangeRequestStatuses(prev => {
                const updated = { ...prev, [message.id]: 'accepted' as const };
                const stillPending = messages.some(m => {
                  if (m.type !== 'change_request' || !m.changeRequestData) return false;
                  if (m.id === message.id) return false;
                  return (updated[m.id] || m.changeRequestData.status) === 'pending';
                });
                setOrderPendingChanges(orderId, stillPending);
                return updated;
              });
              const acceptedContent = 'You accepted the order changes.';
              if (chatId) {
                chatService
                  .sendMessage({
                    chatId,
                    type: 'system',
                    content: acceptedContent,
                    sender: 'system',
                  })
                  .then((m) => console.log('[ORDER CHAT] Change-request accept system msg persisted:', m.id))
                  .catch((err) => console.log('[ORDER CHAT] sendMessage (cr-accept) failed:', err));
              } else {
                const sysMsg: ChatMessage = {
                  id: `sys-cr-accepted-${Date.now()}`,
                  type: 'system',
                  content: acceptedContent,
                  sender: 'system',
                  timestamp: new Date().toISOString(),
                };
                setMessages(prev => [...prev, sysMsg]);
              }
            }}
            onReject={() => {
              console.log('[ORDER CHAT] Customer rejected changes for message:', message.id);
              setChangeRequestStatuses(prev => {
                const updated = { ...prev, [message.id]: 'rejected' as const };
                const stillPending = messages.some(m => {
                  if (m.type !== 'change_request' || !m.changeRequestData) return false;
                  if (m.id === message.id) return false;
                  return (updated[m.id] || m.changeRequestData.status) === 'pending';
                });
                setOrderPendingChanges(orderId, stillPending);
                return updated;
              });
              const rejectedContent = 'You declined the order changes.';
              if (chatId) {
                chatService
                  .sendMessage({
                    chatId,
                    type: 'system',
                    content: rejectedContent,
                    sender: 'system',
                  })
                  .then((m) => console.log('[ORDER CHAT] Change-request reject system msg persisted:', m.id))
                  .catch((err) => console.log('[ORDER CHAT] sendMessage (cr-reject) failed:', err));
              } else {
                const sysMsg: ChatMessage = {
                  id: `sys-cr-rejected-${Date.now()}`,
                  type: 'system',
                  content: rejectedContent,
                  sender: 'system',
                  timestamp: new Date().toISOString(),
                };
                setMessages(prev => [...prev, sysMsg]);
              }
            }}
          />
          <Text style={styles.changeRequestTimestamp}>{formatTime(message.timestamp)}</Text>
        </View>
      );
    }

    if (message.type === 'new_inquiry') {
      return (
        <View key={message.id} style={styles.newInquiryContainer}>
          <View style={styles.newInquiryDividerRow}>
            <View style={styles.newInquiryDividerLine} />
            <Text style={styles.newInquiryLabel}>New Inquiry</Text>
            <View style={styles.newInquiryDividerLine} />
          </View>
          <Text style={styles.newInquiryTimestamp}>{formatTime(message.timestamp)}</Text>
        </View>
      );
    }

    if (message.type === 'order_context' && message.orderContextData) {
      const ocd = message.orderContextData;
      const isPickup = ocd.orderType === 'pickup';
      const statusMap: Record<string, { label: string; color: string; bg: string }> = {
        accepted: { label: 'Accepted', color: '#FF8C42', bg: 'rgba(255,140,66,0.1)' },
        confirmed: { label: 'Confirmed', color: '#FF8C42', bg: 'rgba(255,140,66,0.1)' },
        in_progress: { label: 'In Progress', color: '#FF8C42', bg: 'rgba(255,140,66,0.1)' },
        completed: { label: 'Completed', color: '#22C55E', bg: '#F0FDF4' },
      };
      const si = statusMap[ocd.orderStatus] || { label: 'Active', color: '#FF8C42', bg: 'rgba(255,140,66,0.1)' };
      return (
        <View key={message.id} style={styles.orderBlockContainer}>
          <View style={styles.orderBlockDividerRow}>
            <View style={styles.orderBlockDividerLine} />
            <Text style={styles.orderBlockDividerLabel}>Order started</Text>
            <View style={styles.orderBlockDividerLine} />
          </View>
          <TouchableOpacity
            style={styles.orderBlockCard}
            onPress={() => router.push(`/order/${ocd.orderId}` as any)}
            activeOpacity={0.7}
            testID={`order-context-block-${ocd.orderId}`}
          >
            <View style={styles.orderBlockIcon}>
              {isPickup ? <Package size={18} color={Colors.primary} /> : <Truck size={18} color={Colors.primary} />}
            </View>
            <View style={styles.orderBlockContent}>
              <Text style={styles.orderBlockTitle}>Order #{(ocd.publicOrderId || ocd.orderId.slice(0, 8)).toUpperCase()}</Text>
              <View style={styles.orderBlockMetaRow}>
                <Text style={styles.orderBlockType}>{isPickup ? 'Pickup' : 'Delivery'}</Text>
                <View style={styles.orderBlockDot} />
                <View style={[styles.orderBlockStatusBadge, { backgroundColor: si.bg }]}>
                  <Text style={[styles.orderBlockStatusText, { color: si.color }]}>{si.label}</Text>
                </View>
              </View>
            </View>
            <ChevronRight size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          <Text style={styles.orderBlockTimestamp}>{formatTime(message.timestamp)}</Text>
        </View>
      );
    }

    if (message.type === 'contact-card' && message.contactCardData) {
      return (
        <View key={message.id} style={styles.messageBubbleContainer}>
          <View style={styles.contactCardContainer}>
            <View style={styles.contactCardHeader}>
              <User size={16} color={Colors.textSecondary} style={{ marginRight: 6 }} />
              <Text style={styles.contactCardHeaderText}>Contact details shared</Text>
            </View>
            <View style={styles.contactCardContent}>
              {message.contactCardData.name && (
                <>
                  <Text style={styles.contactCardLabel}>Name</Text>
                  <Text style={styles.contactCardValue}>{message.contactCardData.name}</Text>
                </>
              )}
              {message.contactCardData.phone && (
                <>
                  <Text style={styles.contactCardLabel}>Phone</Text>
                  <Text style={styles.contactCardValue}>{message.contactCardData.phone}</Text>
                </>
              )}
              {message.contactCardData.address && (
                <>
                  <Text style={styles.contactCardLabel}>Address</Text>
                  <Text style={styles.contactCardValue}>{message.contactCardData.address}</Text>
                </>
              )}
              {message.contactCardData.note && (
                <>
                  <Text style={styles.contactCardLabel}>Delivery / Pickup Note</Text>
                  <Text style={styles.contactCardValueMultiline}>{message.contactCardData.note}</Text>
                </>
              )}
            </View>
            <Text style={styles.contactCardTime}>{formatTime(message.timestamp)}</Text>
          </View>
        </View>
      );
    }

    const { isFirstInGroup, isLastInGroup } = groupInfo;
    const isOutgoing = message.sender === 'customer';
    const messageStatus = message.status || (isOutgoing ? 'read' as MessageStatus : undefined);

    const outgoingGroupRadius = {
      borderTopRightRadius: isFirstInGroup ? 20 : 6,
      borderBottomRightRadius: isLastInGroup ? 4 : 6,
    };
    const incomingGroupRadius = {
      borderTopLeftRadius: isFirstInGroup ? 20 : 6,
      borderBottomLeftRadius: isLastInGroup ? 4 : 6,
    };

    return (
      <View
        key={message.id}
        style={[
          styles.messageBubbleContainer,
          isOutgoing ? styles.outgoingMessageContainer : styles.incomingMessageContainer,
          !isLastInGroup && styles.messageBubbleCompact,
        ]}
      >
        <View style={styles.bubbleWithTail}>
          {!isOutgoing && isLastInGroup && (
            <View style={styles.bubbleTailIncoming} />
          )}
          <View
            style={[
              styles.messageBubble,
              isOutgoing ? styles.outgoingBubble : styles.incomingBubble,
              isOutgoing ? outgoingGroupRadius : incomingGroupRadius,
            ]}
          >
            <Text style={[styles.messageText, isOutgoing && styles.outgoingMessageText]}>
              {message.content}
            </Text>
            {isLastInGroup && (
              <View style={styles.messageMeta}>
                <Text style={[styles.messageTime, isOutgoing && styles.outgoingMessageTime]}>
                  {formatTime(message.timestamp)}
                </Text>
                {isOutgoing && messageStatus && (
                  <MessageStatusIcon status={messageStatus} outgoingBubble />
                )}
              </View>
            )}
          </View>
          {isOutgoing && isLastInGroup && (
            <View style={styles.bubbleTailOutgoing} />
          )}
        </View>
      </View>
    );
  };

  const GROUP_TIME_THRESHOLD_MS = 3 * 60 * 1000;
  const TIMESTAMP_DIVIDER_THRESHOLD_MS = 5 * 60 * 1000;

  const formatTimestampDivider = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    if (isToday) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (isYesterday) return 'Yesterday · ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const renderMessageList = (msgs: ChatMessage[]): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];
    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      const prev = i > 0 ? msgs[i - 1] : null;
      const next = i < msgs.length - 1 ? msgs[i + 1] : null;
      const msgTime = new Date(msg.timestamp).getTime();
      const prevTime = prev ? new Date(prev.timestamp).getTime() : 0;
      const nextTime = next ? new Date(next.timestamp).getTime() : 0;
      if (!prev || msgTime - prevTime > TIMESTAMP_DIVIDER_THRESHOLD_MS) {
        elements.push(
          <View key={`divider-${i}`} style={styles.timestampDivider}>
            <Text style={styles.timestampDividerText}>{formatTimestampDivider(msg.timestamp)}</Text>
          </View>
        );
      }
      const isTextMsg = msg.type === 'text';
      const isSameSenderAsPrev = !!(prev?.sender === msg.sender && prev?.type === 'text' && isTextMsg && msgTime - prevTime <= GROUP_TIME_THRESHOLD_MS);
      const isSameSenderAsNext = !!(next?.sender === msg.sender && next?.type === 'text' && isTextMsg && nextTime - msgTime <= GROUP_TIME_THRESHOLD_MS);
      elements.push(renderMessage(msg, { isFirstInGroup: !isSameSenderAsPrev, isLastInGroup: !isSameSenderAsNext }));
    }
    return elements;
  };

  if (!orderId) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
              <ChevronLeft size={24} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.vendorName}>Order Chat</Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
          <View style={styles.errorState}>
            <Text style={styles.errorStateText}>Order not found.</Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerTapZone}
            onPress={() => router.push({
              pathname: '/chat/vendor-info/[vendorId]' as any,
              params: { vendorId: order?.vendorId || currentOrder.vendorId || '', orderId, chatId },
            })}
            activeOpacity={0.7}
            testID="chat-header-info"
            accessibilityLabel={`Open ${vendorName || 'vendor'} chat info`}
          >
            <View style={styles.avatarCircleHeader}>
              <Text style={styles.avatarTextHeader}>{(() => {
                const parts = (vendorName || order?.vendorName || 'Vendor').trim().split(' ').filter(p => p.length > 0);
                if (parts.length === 0) return 'V';
                if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
                return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
              })()}</Text>
            </View>
            <View style={styles.headerCenter}>
              <Text style={styles.vendorName} numberOfLines={1}>{vendorName || order?.vendorName || 'Vendor'}</Text>
              <Text style={styles.orderInfo} numberOfLines={1}>{(publicOrderId || order?.publicOrderId || orderId).toUpperCase()}</Text>
            </View>
          </TouchableOpacity>
          {/* Reserved for future call/video actions. Intentionally empty. */}
          <View style={styles.headerActionsSlot} />
        </View>
      </SafeAreaView>

      {renderOrderSummaryCard()}

      {isVendorSuspendedOnActiveOrder && (
        <View style={styles.safetyFreezeBanner}>
          <Text style={styles.safetyFreezeBannerText}>
            {CHAT_BANNERS.vendorUnderReview}
          </Text>
        </View>
      )}

      {isBlocked && (
        <View style={styles.blockedBanner}>
          <Text style={styles.blockedText}>
            {blockedUser?.direction === 'other' ? CHAT_BANNERS.blockedOther : CHAT_BANNERS.blockedSelf}
          </Text>
        </View>
      )}

      {(() => {
        const hasHumanMessages = messages.some(
          (m) => m.type === 'text' || m.type === 'contact-card' || m.type === 'payment-request'
        );
        const showUnavailableEmptyState =
          chatAvailability.isCustomerInputDisabled &&
          !!chatAvailability.reason &&
          !hasHumanMessages &&
          !customerProposal;

        if (showUnavailableEmptyState) {
          return (
            <View style={styles.unavailableEmptyState} testID="chat-unavailable-empty">
              <View style={styles.unavailableEmptyIcon}>
                <Lock size={26} color={Colors.textSecondary} strokeWidth={2} />
              </View>
              <Text style={styles.unavailableEmptyTitle}>Chat unavailable</Text>
              <Text style={styles.unavailableEmptyText}>{chatAvailability.reason}</Text>
            </View>
          );
        }

        return (
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {renderMessageList(messages)}
            {customerProposal && renderCustomOrderPreview(customerProposal)}
          </ScrollView>
        );
      })()}

      {chatAvailability.isCustomerInputDisabled && chatAvailability.reason && (
        <View style={[
          styles.disabledBanner,
          orderStatus === 'completed' && styles.completedBanner,
          (orderStatus === 'cancelled') && styles.disabledBanner
        ]}>
          <Text style={[
            styles.disabledText,
            orderStatus === 'completed' && styles.completedText,
            (orderStatus === 'cancelled') && styles.disabledText
          ]}>
            {chatAvailability.reason}
          </Text>
        </View>
      )}

      {chatAvailability.isCustomerRestrictedMode && chatAvailability.customerReason && (
        <View style={styles.restrictedBanner}>
          <Text style={styles.restrictedText}>
            {chatAvailability.customerReason}
          </Text>
        </View>
      )}

      {!chatAvailability.isCustomerInputDisabled && isLimitedMode && (
        <View style={styles.clarificationBanner}>
          <Text style={styles.clarificationText}>
            {CHAT_BANNERS.limitedClarifications}
          </Text>
        </View>
      )}

      {currentOrder && hasPendingChangeRequest && (
        <View style={styles.pendingChangesNotice}>
          <View style={styles.pendingChangesNoticeInner}>
            <View style={styles.pendingChangesDot} />
            <Text style={styles.pendingChangesNoticeText}>
              Respond to the vendor's changes above to continue
            </Text>
          </View>
        </View>
      )}

      <SafeAreaView edges={['bottom']} style={styles.inputSafeArea}>
        {isVendorSuspendedOnActiveOrder && (
          <View style={styles.contactSupportContainer}>
            <TouchableOpacity
              style={styles.contactSupportButton}
              onPress={() => console.log('[ORDER CHAT] Contact support pressed')}
              activeOpacity={0.8}
            >
              <Text style={styles.contactSupportButtonText}>Contact Support</Text>
            </TouchableOpacity>
          </View>
        )}
        {validationError && (
          <View style={styles.validationErrorContainer}>
            <Text style={styles.validationErrorText}>{validationError}</Text>
          </View>
        )}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.plusButton}
            onPress={() => setShowChatActionsMenu(true)}
            activeOpacity={0.7}
            disabled={isBlocked || chatAvailability.isCustomerInputDisabled || chatAvailability.isCustomerRestrictedMode || isVendorSuspendedOnActiveOrder}
          >
            <Plus size={24} color={(isBlocked || chatAvailability.isCustomerInputDisabled || chatAvailability.isCustomerRestrictedMode || isVendorSuspendedOnActiveOrder) ? Colors.textSecondary : Colors.text} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder={isVendorSuspendedOnActiveOrder ? CHAT_INPUT_PLACEHOLDERS.messagingUnavailableUnderReview : isBlocked ? (blockedUser?.direction === 'other' ? CHAT_INPUT_PLACEHOLDERS.messagingUnavailable : CHAT_INPUT_PLACEHOLDERS.unblockToSend) : chatAvailability.isCustomerInputDisabled ? CHAT_INPUT_PLACEHOLDERS.chatNoLongerAvailable : chatAvailability.isCustomerRestrictedMode ? CHAT_INPUT_PLACEHOLDERS.followUpMessage : CHAT_INPUT_PLACEHOLDERS.default}
            placeholderTextColor={Colors.textSecondary}
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={500}
            editable={!isBlocked && !chatAvailability.isCustomerInputDisabled && !isChatDisabledByVendor && !isVendorSuspendedOnActiveOrder}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (messageText.trim() === '' || isBlocked || chatAvailability.isCustomerInputDisabled || isVendorSuspendedOnActiveOrder) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={messageText.trim() === '' || isBlocked || chatAvailability.isCustomerInputDisabled || isChatDisabledByVendor || isVendorSuspendedOnActiveOrder}
            activeOpacity={0.7}
          >
            <Send
              size={20}
              color='#FFFFFF'
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Modal
        visible={showChatActionsMenu}
        animationType="fade"
        transparent
        onRequestClose={() => setShowChatActionsMenu(false)}
      >
        <TouchableOpacity
          style={styles.actionsMenuOverlay}
          activeOpacity={1}
          onPress={() => setShowChatActionsMenu(false)}
        >
          <View style={styles.actionsMenuContainer}>
            <TouchableOpacity
              style={styles.actionsMenuItem}
              onPress={handleOpenContactCard}
              activeOpacity={0.7}
            >
              <User size={20} color={Colors.text} style={{ marginRight: 12 }} />
              <Text style={styles.actionsMenuItemText}>Contact card</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showPaymentDetails !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPaymentDetails(null)}
      >
        <SafeAreaView edges={['top']} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowPaymentDetails(null)}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Payment Details</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>
          <ScrollView style={styles.modalContent}>
            {showPaymentDetails && messages.find(m => m.id === showPaymentDetails)?.paymentRequestData && (
              <>
                <View style={styles.paymentDetailSection}>
                  <Text style={styles.paymentDetailLabel}>Amount</Text>
                  <Text style={styles.paymentDetailValue}>{formatPriceWithCommas(messages.find(m => m.id === showPaymentDetails)?.paymentRequestData?.amount || 0, (() => { const v = mockVendors.find(vv => vv.id === order?.vendorId); return (v?.currency as Currency) || 'NGN'; })())}</Text>
                </View>
                <View style={styles.paymentDetailSection}>
                  <Text style={styles.paymentDetailLabel}>Payment Method</Text>
                  <Text style={styles.paymentDetailValue}>{messages.find(m => m.id === showPaymentDetails)?.paymentRequestData?.paymentMethod}</Text>
                </View>
                {paymentVendor?.paymentInstructionsEnabled && paymentVendor?.paymentInstructions?.trim() ? (
                  <View style={styles.paymentInstructionsSection}>
                    <Text style={styles.paymentInstructionsTitle}>Payment Instructions</Text>
                    <Text style={styles.paymentInstructionsText}>
                      {paymentVendor.paymentInstructions}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.paymentInstructionsSection}>
                    <Text style={styles.paymentInstructionsTitle}>Payment Instructions</Text>
                    <Text style={styles.paymentInstructionsText}>
                      Your order will be confirmed once payment is received. Contact the vendor if you need payment details.
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <ContactCardPickerModal
        visible={showContactCardPicker}
        onClose={() => setShowContactCardPicker(false)}
        onSend={handleSendContactCard}
      />
      <Toast visible={toastVisible} />
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  headerButton: {
    padding: 8,
    flexShrink: 0,
  },
  headerTapZone: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    minWidth: 0,
  },
  headerActionsSlot: {
    width: 40,
    height: 40,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 8,
    minWidth: 0,
  },
  headerSpacer: {
    width: 40,
  },
  vendorName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  orderInfo: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  pinnedOrderStatusRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginLeft: 18,
    marginTop: 2,
  },
  pinnedPaymentPendingBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 5,
  },
  pinnedPaymentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  pinnedPaymentPendingText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#92400E',
  },
  pinnedOrderStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pinnedOrderStatusText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  pinnedOrderCard: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pinnedOrderTopSection: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 12,
  },
  pinnedCardDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  ivePaidCardButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 11,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
  },
  ivePaidCardButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  paymentSubmittedCardBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 9,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  paymentSubmittedCardText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textMuted,
  },
  pinnedChevronBtn: {
    padding: 4,
  },
  pinnedOrderAccent: {
    width: 3,
    height: 44,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  pinnedOrderContent: {
    flex: 1,
    gap: 2,
  },
  pinnedOrderTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  pinnedOrderId: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    flex: 1,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  pinnedOrderFulfillment: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
    marginLeft: 18,
  },
  pinnedOrderBottomRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginLeft: 18,
  },
  pinnedOrderMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  pinnedOrderDot: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  pinnedOrderTotal: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  stickyOrderSummaryContainer: {
    backgroundColor: Colors.surface,
    paddingTop: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  orderCardsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#F7F3EF',
  },
  unavailableEmptyState: {
    flex: 1,
    backgroundColor: '#F7F3EF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 40,
  },
  unavailableEmptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  unavailableEmptyTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 6,
    textAlign: 'center' as const,
  },
  unavailableEmptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  messagesContent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  messageBubbleContainer: {
    marginBottom: 6,
  },
  messageBubbleCompact: {
    marginBottom: 2,
  },
  incomingAvatarSlot: {
    width: 26,
    marginRight: 6,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
  },
  incomingAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#22C55E',
  },
  incomingAvatarText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  outgoingMessageContainer: {
    alignItems: 'flex-end' as const,
    justifyContent: 'flex-end' as const,
  },
  incomingMessageContainer: {
    alignItems: 'flex-start' as const,
    justifyContent: 'flex-start' as const,
  },
  timestampDivider: {
    alignItems: 'center' as const,
    marginVertical: 10,
  },
  timestampDividerText: {
    fontSize: 11,
    color: Colors.textMuted,
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden' as const,
  },

  avatarCircleHeader: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.success,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 8,
  },
  avatarTextHeader: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  messageMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-end' as const,
    gap: 3,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  outgoingBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  incomingBubble: {
    backgroundColor: '#F1F3F6',
    borderBottomLeftRadius: 4,
  },
  bubbleWithTail: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
  },
  bubbleTailOutgoing: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderTopColor: Colors.primary,
    borderRightWidth: 8,
    borderRightColor: 'transparent' as const,
    marginBottom: 2,
    marginLeft: -2,
  },
  bubbleTailIncoming: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderTopColor: '#F1F3F6',
    borderLeftWidth: 8,
    borderLeftColor: 'transparent' as const,
    marginBottom: 2,
    marginRight: -2,
  },
  messageText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 1,
  },
  outgoingMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 10,
    color: 'rgba(0,0,0,0.4)',
    alignSelf: 'flex-end' as const,
  },
  outgoingMessageTime: {
    color: 'rgba(255,255,255,0.75)',
  },
  systemMessageContainer: {
    alignItems: 'center' as const,
    marginVertical: 8,
    paddingHorizontal: 32,
  },
  systemMessageText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  paymentRequestWrapper: {
    alignItems: 'center' as const,
    marginBottom: 8,
    width: '100%',
  },
  invoiceCardWrapper: {
    alignItems: 'flex-start' as const,
    marginVertical: 6,
    paddingHorizontal: 10,
    width: '100%',
  },
  menuItemCardContainer: {
    marginBottom: 12,
    alignItems: 'flex-start' as const,
    maxWidth: '85%',
  },
  menuItemCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
    minWidth: 240,
  },
  menuItemCardContent: {
    flexDirection: 'row' as const,
    padding: 12,
  },
  menuItemImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden' as const,
    marginRight: 12,
  },
  menuItemImage: {
    width: 60,
    height: 60,
  },
  menuItemImagePlaceholder: {
    width: 60,
    height: 60,
    backgroundColor: Colors.border,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  menuItemImagePlaceholderText: {
    fontSize: 24,
  },
  menuItemInfo: {
    flex: 1,
    justifyContent: 'center' as const,
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  menuItemPrice: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  menuItemButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  menuItemButtonText: {
    fontSize: 15,
    color: Colors.white,
    fontWeight: '600' as const,
  },
  paymentRequestCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    maxWidth: '90%',
    width: '100%',
  },
  paymentRequestHeader: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  paymentRequestSection: {
    marginBottom: 14,
  },
  paymentRequestRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 4,
  },
  paymentRequestLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#6B7280',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  paymentRequestValue: {
    fontSize: 15,
    color: '#2B2B2B',
    fontWeight: '500' as const,
  },
  paymentRequestTimestamp: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 14,
    textAlign: 'right' as const,
  },
  pickupDetailsCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    maxWidth: '85%',
    width: '100%',
  },
  pickupDetailsHeader: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  pickupDetailsSection: {
    marginBottom: 14,
  },
  pickupDetailsLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  pickupDetailsValue: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  pickupDetailsTimestamp: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 12,
    textAlign: 'right' as const,
  },
  pickupDetailsValueHighlight: {
    fontSize: 18,
    color: Colors.text,
    fontWeight: '700' as const,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  pickupDetailsHelper: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic' as const,
    lineHeight: 20,
  },
  copyIconButton: {
    padding: 4,
  },
  copiedText: {
    fontSize: 12,
    color: Colors.success,
    marginTop: 4,
  },
  paymentDetailSection: {
    marginBottom: 24,
    position: 'relative' as const,
  },
  paymentDetailLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  paymentDetailValue: {
    fontSize: 17,
    color: Colors.text,
  },
  copyPaymentButton: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
    borderRadius: 8,
  },
  copyPaymentButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  paymentInstructionsSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  paymentInstructionsTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  paymentInstructionsText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  modalHeaderSpacer: {
    width: 60,
  },
  contactCardContainer: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '85%',
  },
  contactCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  contactCardHeaderText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  contactCardContent: {},
  contactCardLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    marginTop: 8,
  },
  contactCardValue: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  contactCardValueMultiline: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  addressInput: {
    minHeight: 60,
    paddingTop: 12,
  },
  contactCardTime: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'right' as const,
  },
  disabledBanner: {
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  disabledText: {
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center' as const,
  },
  completedBanner: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  completedText: {
    fontSize: 13,
    color: Colors.link,
    textAlign: 'center' as const,
  },
  restrictedBanner: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  restrictedText: {
    fontSize: 13,
    color: Colors.link,
    textAlign: 'center' as const,
  },
  clarificationBanner: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  clarificationText: {
    fontSize: 13,
    color: Colors.link,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  inputSafeArea: {
    backgroundColor: Colors.surface,
  },
  inputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 6,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 7,
  },
  plusButton: {
    width: 36,
    height: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  input: {
    flex: 1,
    backgroundColor: '#EDEDF0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15.5,
    color: Colors.text,
    minHeight: 40,
    maxHeight: 96,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E5EA',
    opacity: 1,
  },
  errorState: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  errorStateText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
  },
  modalCloseButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modalCloseText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  modalSubmitText: {
    fontWeight: '600' as const,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  fieldInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 16,
  },
  noteInput: {
    minHeight: 80,
    paddingTop: 12,
    marginBottom: 4,
  },
  characterCount: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'right' as const,
    marginBottom: 16,
  },
  actionsMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end' as const,
  },
  actionsMenuContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  actionsMenuItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  actionsMenuItemText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  destructiveText: {
    color: Colors.error,
  },
  contactCardsList: {
    marginBottom: 16,
  },
  savedContactCardItem: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  savedContactCardContent: {},
  savedContactCardName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  savedContactCardPhone: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  savedContactCardAddress: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  savedContactCardNote: {
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic' as const,
  },
  addNewContactCardButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginTop: 8,
  },
  addNewContactCardText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  emptyContactCardsState: {
    alignItems: 'center' as const,
    paddingVertical: 40,
  },
  emptyContactCardsText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  emptyContactCardsSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    paddingHorizontal: 20,
  },
  blockedBanner: {
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  blockedText: {
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center' as const,
  },
  compactOrderSummary: {
    backgroundColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    minWidth: 280,
  },
  compactOrderLine: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 3,
  },
  compactOrderViewDetails: {
    fontSize: 14,
    color: Colors.primary,
    marginTop: 6,
    fontWeight: '500' as const,
  },
  customOrderPreviewCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    maxWidth: '85%',
    width: '100%',
  },
  customOrderPreviewContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  customOrderPreviewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: Colors.cardBorder,
    marginRight: 12,
  },
  customOrderPreviewImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: Colors.cardBorder,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 12,
  },
  customOrderPreviewImagePlaceholderText: {
    fontSize: 28,
  },
  customOrderPreviewInfo: {
    flex: 1,
  },
  customOrderPreviewTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  customOrderPreviewItems: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  customOrderPreviewTotal: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  customOrderPreviewButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center' as const,
  },
  customOrderPreviewButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  customOrderPreviewTimestamp: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'right' as const,
  },
  catalogItemCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 12,
    maxWidth: '90%',
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catalogItemCardLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  catalogItemCardContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  catalogItemCardImageContainer: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 12,
    overflow: 'hidden' as const,
  },
  catalogItemCardImage: {
    width: 56,
    height: 56,
  },
  catalogItemCardImagePlaceholder: {
    width: 56,
    height: 56,
    backgroundColor: Colors.border,
    borderRadius: 8,
  },
  catalogItemCardInfo: {
    flex: 1,
  },
  catalogItemCardName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  catalogItemCardDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  catalogItemCardPrice: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  catalogItemCardButton: {
    paddingVertical: 10,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  catalogItemCardButtonText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  catalogItemCardTimestamp: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'right' as const,
  },
  validationErrorContainer: {
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  validationErrorText: {
    fontSize: 13,
    color: Colors.primary,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  safetyFreezeBanner: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  safetyFreezeBannerText: {
    fontSize: 13,
    color: '#92400E',
    textAlign: 'center' as const,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  contactSupportContainer: {
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  contactSupportButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  contactSupportButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  orderBlockContainer: {
    alignItems: 'center' as const,
    marginVertical: 8,
    paddingHorizontal: 4,
  },
  orderBlockDividerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    width: '100%' as const,
    marginBottom: 8,
    gap: 10,
  },
  orderBlockDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,140,66,0.25)',
  },
  orderBlockDividerLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.primary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  orderBlockCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '100%' as const,
    borderWidth: 1,
    borderColor: 'rgba(255,140,66,0.2)',
    gap: 12,
  },
  orderBlockIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,140,66,0.08)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  orderBlockContent: {
    flex: 1,
    gap: 3,
  },
  orderBlockTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: 0.2,
  },
  orderBlockMetaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  orderBlockType: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  orderBlockDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
  },
  orderBlockStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  orderBlockStatusText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  orderBlockTimestamp: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
  },
  newInquiryContainer: {
    alignItems: 'center' as const,
    marginVertical: 12,
    paddingHorizontal: 4,
  },
  newInquiryDividerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    width: '100%' as const,
    gap: 10,
  },
  newInquiryDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(59,130,246,0.25)',
  },
  newInquiryLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#3B82F6',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  newInquiryTimestamp: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
  },
  changeRequestContainer: {
    marginVertical: 8,
    paddingHorizontal: 12,
    width: '100%',
  },
  changeRequestTimestamp: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center' as const,
  },
  pendingChangesNotice: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFBEB',
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },
  pendingChangesNoticeInner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  },
  pendingChangesDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  pendingChangesNoticeText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#92400E',
    textAlign: 'center' as const,
  },

});
