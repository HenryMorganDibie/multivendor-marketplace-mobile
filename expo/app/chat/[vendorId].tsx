import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  Modal,
  FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Send, MessageCircle, Plus, User, Clock as ClockIcon, CheckCircle, Search as SearchIcon, ChevronUp, ChevronDown, X as XIcon } from 'lucide-react-native';
import { Alert } from '@/utils/alert';
import { renderHighlightedText, messageMatchesQuery } from '@/utils/highlightText';
import MessageStatusIcon from '@/components/MessageStatusIcon';
import { PaymentRequestCard } from '@/components/PaymentRequestCard';
import { useRouter, useLocalSearchParams, Stack, useFocusEffect } from 'expo-router';
import { consumeChatSearchSignal } from '@/utils/chatSearchSignal';
import { ChatMessage, getChatByVendorId, getChatByOrderId, MessageStatus } from '@/mocks/chatData';
import { chatService } from '@/services/chatService';
import { useChatSubscription, mergeChatMessages } from '@/hooks/useChatMessages';
import { OrderStatus, Order } from '@/mocks/ordersData';
import { mockVendor, mockVendors } from '@/mocks/vendorData';
import { useBlockedUsers } from '@/contexts/BlockedUsersContext';
import { useChatRead } from '@/contexts/ChatReadContext';
import { useVendorChatMode } from '@/contexts/VendorChatModeContext';
import { ContactCardBubble } from '@/components/ContactCardBubble';
import { CatalogItemBubble } from '@/components/CatalogItemBubble';
import { ContactCardPickerModal } from '@/components/ContactCardPickerModal';
import { useCatalog } from '@/contexts/CatalogContext';
import { getStatusMessage } from '@/utils/systemMessages';
import { formatPriceWithCommas, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';
import { getPaymentStateShortLabel, getPaymentStateConfig } from '@/constants/paymentStates';
import { useOrders } from '@/contexts/OrdersContext';
import {
  CHAT_INPUT_PLACEHOLDERS,
  CHAT_BANNERS,
  CHAT_HEADER_SUBTITLES,
  CHAT_EMPTY_STATES,
  CHAT_DIVIDERS,
  getAvatarInitials,
} from '@/constants/chatStrings';



const generateStatusMessages = (status: OrderStatus, vendorName: string, fulfillmentType?: string): ChatMessage[] => {
  const messages: ChatMessage[] = [];
  const baseTimestamp = new Date();
  
  messages.push({
    id: 'sys-pending',
    type: 'system',
    content: getStatusMessage('requested', { vendorName, fulfillmentType }),
    sender: 'system',
    timestamp: new Date(baseTimestamp.getTime() - 300000).toISOString(),
  });

  if (status === 'cancelled') {
    messages.push({
      id: 'sys-cancelled',
      type: 'system',
      content: getStatusMessage('cancelled', { vendorName, fulfillmentType }),
      sender: 'system',
      timestamp: new Date(baseTimestamp.getTime() - 240000).toISOString(),
    });
    return messages;
  }

  if (['accepted', 'confirmed', 'in_progress', 'completed'].includes(status)) {
    messages.push({
      id: 'sys-confirmed',
      type: 'system',
      content: getStatusMessage('accepted', { vendorName, fulfillmentType }),
      sender: 'system',
      timestamp: new Date(baseTimestamp.getTime() - 240000).toISOString(),
    });
  }

  if (['in_progress', 'completed'].includes(status)) {
    messages.push({
      id: 'sys-inprogress',
      type: 'system',
      content: getStatusMessage('in_progress', { vendorName, fulfillmentType }),
      sender: 'system',
      timestamp: new Date(baseTimestamp.getTime() - 180000).toISOString(),
    });
  }



  if (status === 'completed') {
    messages.push({
      id: 'sys-completed',
      type: 'system',
      content: getStatusMessage('completed', { vendorName, fulfillmentType }),
      sender: 'system',
      timestamp: new Date(baseTimestamp.getTime() - 60000).toISOString(),
    });
  }

  return messages;
};

export default function CanonicalChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const vendorId = params.vendorId as string;
  const highlightOrderId = params.orderId as string;
  const forwardItemId = params.forwardItemId as string;
  const searchParam = params.search as string | undefined;
  const scrollViewRef = useRef<ScrollView>(null);
  const { getBlockedUserByChatId } = useBlockedUsers();
  const { isChatLimited } = useVendorChatMode();
  const { markChatAsRead } = useChatRead();
  const { orders } = useOrders();

  const preOrderChat = getChatByVendorId(vendorId, 'pre_order_inquiry');
  const resolvedVendor = mockVendors.find(v => v.id === vendorId) ?? mockVendor;
  const vendorName = resolvedVendor.name;
  const isVendorSuspended = resolvedVendor.vendorStatus === 'SUSPENDED';
  console.log('[CHAT] Vendor status:', resolvedVendor.vendorStatus, '| Suspended:', isVendorSuspended);

  const activeOrders = useMemo(() => {
    // Real order statuses (types2.ts / OrdersContext) are lowercase
    // requested/accepted/confirmed/in_progress/... — this used to filter
    // against 'ORDER_REQUESTED'/'CONFIRMED'/'READY', values that don't
    // exist anywhere in the real status enum, so it silently matched
    // nothing for a real signed-in customer and this screen always fell
    // back to the pre-order thread even with a live active order.
    const ACTIVE: OrderStatus[] = ['requested', 'accepted', 'confirmed', 'in_progress'];
    return orders.filter(
      (o: Order) => o.vendorId === vendorId && ACTIVE.includes(o.status)
    );
  }, [vendorId, orders]);

  const hasActiveOrders = activeOrders.length > 0;
  const resolvedChat = hasActiveOrders ? getChatByOrderId(activeOrders[0].id) : preOrderChat;
  const chatId = resolvedChat?.id ?? '';
  const blockedUser = chatId ? getBlockedUserByChatId(chatId) : undefined;
  const isBlocked = !!blockedUser;

  const initialMessages = useMemo(() => {
    // Step 4: prefer stored chat.messages from chatService / mockChats so
    // previously-sent messages persist across navigation. Fall back to
    // synthesized status messages only when no stored chat exists.
    if (resolvedChat?.messages?.length) {
      console.log('[LEGACY CHAT] Hydrating from chatService store, count:', resolvedChat.messages.length);
      return resolvedChat.messages;
    }
    if (hasActiveOrders) {
      const order = activeOrders[0];
      return generateStatusMessages(order.status, vendorName, order.fulfillmentType);
    }
    return preOrderChat?.messages || [];
  }, [resolvedChat, hasActiveOrders, activeOrders, preOrderChat, vendorName]);

  const { hasOrderPendingChanges } = useOrders();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showContactCardPicker, setShowContactCardPicker] = useState(false);

  // In-chat search overlay state. Activated via ?search=1 param from
  // Vendor Chat Info or future entry points. Architecture is intentionally
  // generic so we can later extend `messageMatchesQuery` to cover media,
  // documents, invoices, payment references and AI-powered search without
  // touching this screen.
  const [searchActive, setSearchActive] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const messagePositionsRef = useRef<Record<string, number>>({});
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (searchParam === '1' || searchParam === 'true') {
      setSearchActive(true);
    }
  }, [searchParam]);

  // Consume a pending search signal set by the vendor-info screen before it
  // called router.back(). This activates search on the already-mounted screen
  // (which has messages loaded) rather than remounting fresh and showing the
  // empty state.
  useFocusEffect(
    useCallback(() => {
      if (consumeChatSearchSignal(vendorId)) {
        setSearchActive(true);
        // Let the layout settle before auto-focusing the input
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 200);
      }
    }, [vendorId]),
  );

  const matchIds = useMemo<string[]>(() => {
    const term = searchQuery.trim();
    if (!term) return [];
    return messages.filter((m) => messageMatchesQuery(m, term)).map((m) => m.id);
  }, [messages, searchQuery]);

  useEffect(() => {
    if (currentMatchIndex >= matchIds.length) {
      setCurrentMatchIndex(matchIds.length > 0 ? matchIds.length - 1 : 0);
    }
  }, [matchIds.length, currentMatchIndex]);

  useEffect(() => {
    if (!searchActive || matchIds.length === 0) return;
    const id = matchIds[currentMatchIndex];
    const y = id ? messagePositionsRef.current[id] : undefined;
    if (typeof y === 'number') {
      scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 40), animated: true });
    }
  }, [searchActive, currentMatchIndex, matchIds]);

  const closeSearch = useCallback(() => {
    setSearchActive(false);
    setSearchQuery('');
    setCurrentMatchIndex(0);
  }, []);

  const goPrevMatch = useCallback(() => {
    if (matchIds.length === 0) return;
    setCurrentMatchIndex((i) => (i - 1 + matchIds.length) % matchIds.length);
  }, [matchIds.length]);

  const goNextMatch = useCallback(() => {
    if (matchIds.length === 0) return;
    setCurrentMatchIndex((i) => (i + 1) % matchIds.length);
  }, [matchIds.length]);

  const currentMatchId = matchIds[currentMatchIndex];

  // Step 5: subscribe to chatService writes so in-session sends from this
  // screen (or background flows) update the visible message list without a
  // remount. The merge keeps synthesized status headers intact.
  const { version: chatVersion } = useChatSubscription(chatId || undefined);
  useEffect(() => {
    if (!chatId) return;
    const fresh = chatService.getByIdSync(chatId)?.messages;
    if (!fresh) return;
    setMessages(prev => mergeChatMessages(prev, fresh, hiddenIds));
  }, [chatId, chatVersion, hiddenIds]);

  /** Clear unread for customer when this chat opens / new message lands. */
  useEffect(() => {
    if (!chatId) return;
    markChatAsRead(chatId, 'customer');
  }, [chatId, chatVersion, markChatAsRead]);

  const { getItemById } = useCatalog();

  function getCardPaymentStatus(order: Order): 'UNPAID' | 'PAYMENT_SUBMITTED' | 'PAID_CONFIRMED' {
    const ps = order.paymentState;
    if (ps === 'CUSTOMER_MARKED_PAID' || ps === 'PAYMENT_UNDER_REVIEW') return 'PAYMENT_SUBMITTED';
    if (ps === 'VENDOR_PAYMENT_CONFIRMED' || ps === 'ORDER_READY' || ps === 'ORDER_COMPLETED') return 'PAID_CONFIRMED';
    return 'UNPAID';
  }

  useEffect(() => {
    if (!forwardItemId) return;
    const catalogItem = getItemById(forwardItemId);
    if (!catalogItem) return;

    const catalogItemData: NonNullable<ChatMessage['catalogItemData']> = {
      id: catalogItem.id,
      name: catalogItem.name,
      description: catalogItem.description,
      price: catalogItem.salePrice || catalogItem.basePrice,
      image: catalogItem.photos[0],
    };

    if (chatId) {
      // Persist via chatService so the catalog forward survives navigation
      // and reaches the vendor side via the same shared store.
      chatService
        .sendMessage({
          chatId,
          type: 'catalog_item',
          content: '',
          sender: 'customer',
          catalogItemData,
        })
        .then((m) => console.log('[LEGACY CHAT] Catalog item forwarded via chatService:', m.id))
        .catch((err) => console.log('[LEGACY CHAT] forward catalog_item failed:', err));
    } else {
      const newMessage: ChatMessage = {
        id: `m${Date.now()}`,
        type: 'catalog_item',
        content: '',
        sender: 'customer',
        timestamp: new Date().toISOString(),
        catalogItemData,
      };
      setMessages((prev) => [...prev, newMessage]);
    }
    console.log('Catalog item forwarded:', catalogItem.name);
  }, [forwardItemId, getItemById, chatId]);

  useEffect(() => {
    if (searchActive) return;
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 100);
  }, [messages, searchActive]);

  const handleBackPress = () => {
    try {
      router.back();
    } catch {
      router.replace('/customer/(tabs)/chats' as any);
    }
  };

  const handleOpenVendorInfo = () => {
    router.push({
      pathname: '/chat/vendor-info/[vendorId]' as any,
      params: {
        vendorId,
        orderId: hasActiveOrders ? activeOrders[0].id : '',
        chatId,
      },
    });
  };

  const handleSendMessage = async () => {
    const content = messageText.trim();
    // isSendingMessage guard: a rapid double-tap used to fire two real
    // sendChatMessage calls (each minting its own message doc server-side —
    // there is no idempotency key), producing two identical messages.
    if (content === '' || isSendingMessage) return;

    if (!chatId) {
      // No resolved chat — this used to silently append a local-only
      // message that was never persisted anywhere, so the sender believed
      // it sent while the vendor never saw it. Surfacing the real failure
      // instead of faking success.
      Alert.alert('Could not send', 'This conversation could not be found. Please go back and try again.');
      return;
    }

    setIsSendingMessage(true);
    // Composer is NOT cleared until the send actually succeeds, so a
    // failure leaves the draft intact rather than silently discarding it.
    try {
      const sent = await chatService.sendMessage({
        chatId,
        type: 'text',
        content,
        sender: 'customer',
      });
      console.log('[LEGACY CHAT] Message persisted via chatService:', sent.id);
      setMessageText('');
    } catch (err) {
      console.error('[LEGACY CHAT] sendMessage failed:', err);
      const message = err instanceof Error ? err.message : 'Could not send your message.';
      Alert.alert('Message not sent', message);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handlePlusButtonPress = () => {
    setShowActionsMenu(true);
  };

  const handleOpenContactCardPicker = () => {
    setShowActionsMenu(false);
    setTimeout(() => {
      setShowContactCardPicker(true);
    }, 300);
  };

  const handleSendContactCard = (card: any) => {
    if (chatId) {
      chatService
        .sendMessage({
          chatId,
          type: 'contact-card',
          content: '',
          sender: 'customer',
          contactCardData: card,
        })
        .then((m) => console.log('[LEGACY CHAT] Contact card persisted via chatService:', m.id))
        .catch((err) => console.log('[LEGACY CHAT] sendMessage (contact-card) failed:', err));
    } else {
      const newMessage: ChatMessage = {
        id: `m${Date.now()}`,
        type: 'contact-card',
        content: '',
        sender: 'customer',
        timestamp: new Date().toISOString(),
        contactCardData: card,
      };
      setMessages((prev) => [...prev, newMessage]);
    }
    console.log('Contact card sent:', card);
  };

  const handleViewOrderDetails = (orderIdToView: string) => {
    router.push({ pathname: `/order/${orderIdToView}` as any, params: { fromChat: 'true' } });
  };

  const renderOrderSummaryCard = () => {
    if (activeOrders.length === 0) return null;

    const renderOrderCard = (orderItem: Order) => {
      const itemCount = orderItem.items.reduce((sum: number, item) => sum + item.quantity, 0);
      const isHighlighted = highlightOrderId === orderItem.id;
      const paymentStateConfig = orderItem.paymentState ? getPaymentStateConfig(orderItem.paymentState) : null;
      const paymentShortLabel = orderItem.paymentState ? getPaymentStateShortLabel(orderItem.paymentState) : null;
      const cardPaymentStatus = getCardPaymentStatus(orderItem);
      const showPaymentSubmitted = orderItem.status === 'accepted' && cardPaymentStatus === 'PAYMENT_SUBMITTED';
      const showPaymentConfirmed = cardPaymentStatus === 'PAID_CONFIRMED';
      const orderCurrency = (() => { const v = mockVendors.find(vv => vv.id === orderItem.vendorId); return (v?.currency as Currency) || getCurrencyFromCountryCode(v?.countryCode || 'NG'); })();

      return (
        <View
          key={orderItem.id}
          style={[
            styles.compactOrderSummary,
            isHighlighted && styles.compactOrderSummaryHighlighted,
          ]}
        >
          <TouchableOpacity
            style={styles.compactOrderPressable}
            onPress={() => handleViewOrderDetails(orderItem.id)}
            activeOpacity={0.7}
          >
            <View style={styles.compactOrderTopRow}>
              <View style={styles.compactOrderMeta}>
                <Text style={styles.compactOrderPublicId} numberOfLines={1}>
                  {orderItem.publicOrderId.toUpperCase()}
                </Text>
                <Text style={styles.compactOrderLine}>
                  {itemCount} {itemCount === 1 ? 'item' : 'items'} · {orderItem.fulfillmentType || 'Pickup'} · {formatPriceWithCommas(orderItem.total, orderCurrency)}
                </Text>
              </View>
              {paymentStateConfig && paymentShortLabel && (
                <View style={[styles.compactPaymentBadge, { backgroundColor: paymentStateConfig.backgroundColor }]}>
                  <Text style={[styles.compactPaymentBadgeText, { color: paymentStateConfig.color }]}>
                    {paymentShortLabel}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.compactOrderViewDetails}>View details →</Text>
          </TouchableOpacity>

          {showPaymentSubmitted && (
            <>
              <View style={styles.compactCardDivider} />
              <View style={styles.compactPaymentSubmittedRow}>
                <ClockIcon size={13} color={Colors.textMuted} strokeWidth={2} />
                <Text style={styles.compactPaymentSubmittedText}>Payment submitted · Awaiting confirmation</Text>
              </View>
            </>
          )}

          {showPaymentConfirmed && (
            <>
              <View style={styles.compactCardDivider} />
              <View style={styles.compactPaymentConfirmedRow}>
                <CheckCircle size={13} color={Colors.success} strokeWidth={2} />
                <Text style={styles.compactPaymentConfirmedText}>Payment confirmed</Text>
              </View>
            </>
          )}
        </View>
      );
    };

    return (
      <View style={styles.stickyOrderSummaryContainer}>
        {activeOrders.length > 1 ? (
          <FlatList
            data={activeOrders}
            renderItem={({ item }) => renderOrderCard(item)}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.orderCardsContainer}
            snapToInterval={300}
            decelerationRate="fast"
          />
        ) : (
          renderOrderCard(activeOrders[0])
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

  const renderMessage = (message: ChatMessage) => {
    if (message.type === 'new_inquiry') {
      return (
        <View key={message.id} style={styles.newInquiryContainer}>
          <View style={styles.newInquiryDividerRow}>
            <View style={styles.newInquiryDividerLine} />
            <Text style={styles.newInquiryLabel}>{CHAT_DIVIDERS.newInquiry}</Text>
            <View style={styles.newInquiryDividerLine} />
          </View>
          <Text style={styles.newInquiryTimestamp}>{formatTime(message.timestamp)}</Text>
        </View>
      );
    }

    if (message.type === 'system') {
      return (
        <View key={message.id} style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{message.content}</Text>
        </View>
      );
    }

    if (message.type === 'payment-request' && message.paymentRequestData) {
      return (
        <View key={message.id} style={styles.paymentRequestWrapper}>
          <PaymentRequestCard
            vendorName={vendorName}
            orderId={activeOrders[0]?.publicOrderId || ''}
            paymentData={message.paymentRequestData}
            timestamp={message.timestamp}
            role="customer"
            onViewOrderDetails={activeOrders[0] ? () => handleViewOrderDetails(activeOrders[0].id) : undefined}
          />
        </View>
      );
    }

    if (message.type === 'contact-card' && message.contactCardData) {
      return (
        <View key={message.id} style={styles.messageBubbleContainer}>
          <ContactCardBubble data={message.contactCardData} timestamp={message.timestamp} />
        </View>
      );
    }

    if (message.type === 'catalog_item' && message.catalogItemData) {
      return (
        <View key={message.id} style={styles.messageBubbleContainer}>
          <CatalogItemBubble 
            data={message.catalogItemData} 
            timestamp={message.timestamp}
            sender={message.sender}
            vendorId={vendorId}
          />
        </View>
      );
    }

    const isOutgoing = message.sender === 'customer';
    const messageStatus = message.status || (isOutgoing ? 'read' as MessageStatus : undefined);
    const vendorInitial = getAvatarInitials(vendorName).charAt(0);
    const isMatch = searchActive && searchQuery.trim().length > 0 && matchIds.includes(message.id);
    const isCurrent = isMatch && message.id === currentMatchId;
    const baseTextStyle = [styles.messageText, isOutgoing && styles.outgoingMessageText];
    const highlightStyle = isOutgoing ? styles.highlightOnOutgoing : styles.highlightOnIncoming;

    return (
      <View
        key={message.id}
        style={[
          styles.messageBubbleContainer,
          isOutgoing ? styles.outgoingMessageContainer : styles.incomingMessageContainer,
        ]}
      >
        <View style={styles.bubbleWithTail}>
          {!isOutgoing && (
            <View style={styles.incomingAvatarSlot}>
              <View style={styles.incomingAvatar}>
                <Text style={styles.incomingAvatarText}>{vendorInitial}</Text>
              </View>
            </View>
          )}
          {!isOutgoing && <View style={styles.bubbleTailIncoming} />}
          <View
            style={[
              styles.messageBubble,
              isOutgoing ? styles.outgoingBubble : styles.incomingBubble,
            ]}
          >
            <Text style={baseTextStyle}>
              {isMatch ? renderHighlightedText(message.content, searchQuery, baseTextStyle, highlightStyle) : message.content}
            </Text>
            <View style={styles.messageMeta}>
              <Text style={[styles.messageTime, isOutgoing && styles.outgoingMessageTime]}>
                {formatTime(message.timestamp)}
              </Text>
              {isOutgoing && messageStatus && (
                <MessageStatusIcon status={messageStatus} outgoingBubble />
              )}
            </View>
          </View>
          {isOutgoing && <View style={styles.bubbleTailOutgoing} />}
        </View>
        {isCurrent && <View style={styles.currentMatchUnderline} />}
      </View>
    );
  };

  const canSendMessages = !isVendorSuspended && !isBlocked;
  
  const inputPlaceholder = isVendorSuspended
    ? CHAT_INPUT_PLACEHOLDERS.messagingUnavailable
    : isBlocked
    ? (blockedUser?.direction === 'other' ? CHAT_INPUT_PLACEHOLDERS.messagingUnavailable : CHAT_INPUT_PLACEHOLDERS.unblockToSend)
    : CHAT_INPUT_PLACEHOLDERS.default;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          {searchActive ? (
            <View style={styles.searchHeader}>
              <View style={styles.searchHeaderRow}>
                <TouchableOpacity onPress={closeSearch} style={styles.headerButton} hitSlop={10} accessibilityLabel="Close search">
                  <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <View style={styles.searchInputWrap}>
                  <SearchIcon size={16} color={Colors.textMuted} />
                  <TextInput
                    ref={searchInputRef}
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search messages"
                    placeholderTextColor={Colors.textMuted}
                    autoFocus
                    returnKeyType="search"
                    testID="chat-search-input"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={10} accessibilityLabel="Clear search">
                      <XIcon size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <View style={styles.searchMetaRow}>
                <Text style={styles.searchMetaText}>
                  {searchQuery.trim().length === 0
                    ? 'Type at least one character to search this conversation.'
                    : matchIds.length === 0
                    ? 'No messages found.'
                    : `${currentMatchIndex + 1} of ${matchIds.length}`}
                </Text>
                <View style={styles.searchNavBtns}>
                  <TouchableOpacity
                    onPress={goPrevMatch}
                    disabled={matchIds.length === 0}
                    style={[styles.searchNavBtn, matchIds.length === 0 && styles.searchNavBtnDisabled]}
                    hitSlop={8}
                    accessibilityLabel="Previous match"
                  >
                    <ChevronUp size={18} color={matchIds.length === 0 ? Colors.textMuted : Colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={goNextMatch}
                    disabled={matchIds.length === 0}
                    style={[styles.searchNavBtn, matchIds.length === 0 && styles.searchNavBtnDisabled]}
                    hitSlop={8}
                    accessibilityLabel="Next match"
                  >
                    <ChevronDown size={18} color={matchIds.length === 0 ? Colors.textMuted : Colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.header}>
              <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
                <ChevronLeft size={24} color={Colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleOpenVendorInfo}
                style={styles.headerTapZone}
                activeOpacity={0.7}
                testID="chat-header-info"
                accessibilityLabel={`Open ${vendorName} chat info`}
              >
                <View style={styles.avatarCircleHeader}>
                  <Text style={styles.avatarTextHeader}>{getAvatarInitials(vendorName)}</Text>
                </View>
                <View style={styles.headerCenter}>
                  <Text style={styles.vendorName} numberOfLines={1}>{vendorName}</Text>
                  <Text style={styles.orderInfo} numberOfLines={1}>
                    {hasActiveOrders ? activeOrders[0]?.publicOrderId?.toUpperCase() : CHAT_HEADER_SUBTITLES.preOrderInquiry}
                  </Text>
                </View>
              </TouchableOpacity>
              {/* Reserved for future call/video actions. Intentionally empty. */}
              <View style={styles.headerActionsSlot} />
            </View>
          )}
        </SafeAreaView>

        {renderOrderSummaryCard()}

        {isBlocked && (
          <View style={styles.blockedBanner}>
            <Text style={styles.blockedText}>
              {blockedUser?.direction === 'other' ? CHAT_BANNERS.blockedOther : CHAT_BANNERS.blockedSelf}
            </Text>
          </View>
        )}

        {isVendorSuspended && (
          <View style={styles.suspendedBanner}>
            <Text style={styles.suspendedBannerText}>{CHAT_BANNERS.vendorSuspended}</Text>
          </View>
        )}

        {isChatLimited && !isBlocked && !isVendorSuspended && (
          <View style={styles.limitedChatBanner}>
            <Text style={styles.limitedChatText}>{CHAT_BANNERS.limitedClarifications}</Text>
          </View>
        )}

        <View style={styles.contentWrapper}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 ? (
              // Only show the greeting empty state when NOT in search mode.
              // In search mode, the search meta row already communicates
              // that there are no messages; avoid confusing "Say hello!" text.
              !searchActive ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <MessageCircle size={48} color={Colors.textMuted} strokeWidth={1.5} />
                  </View>
                  <Text style={styles.emptyTitle}>{CHAT_EMPTY_STATES.noMessages}</Text>
                  <Text style={styles.emptyDescription}>
                    {hasActiveOrders
                      ? CHAT_EMPTY_STATES.orderConversationDescription(vendorName)
                      : CHAT_EMPTY_STATES.askBeforeOrdering}
                  </Text>
                </View>
              ) : null
            ) : (
              messages.map((message) => (
                <View
                  key={message.id}
                  onLayout={(e) => {
                    messagePositionsRef.current[message.id] = e.nativeEvent.layout.y;
                  }}
                >
                  {renderMessage(message)}
                </View>
              ))
            )}
          </ScrollView>
          {searchActive && (
            <View pointerEvents="none" style={styles.searchScrim} />
          )}
        </View>

        <View style={styles.businessHoursBanner}>
          <Text style={styles.businessHoursText}>{CHAT_BANNERS.businessHoursHint}</Text>
        </View>

        <SafeAreaView edges={['bottom']} style={styles.inputSafeArea}>
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={styles.plusButton}
              onPress={handlePlusButtonPress}
              disabled={!canSendMessages}
              activeOpacity={0.7}
            >
              <Plus size={24} color={canSendMessages ? '#FFFFFF' : Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder={inputPlaceholder}
              placeholderTextColor={Colors.textMuted}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={500}
              editable={canSendMessages}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!canSendMessages || messageText.trim() === '' || isSendingMessage) && styles.sendButtonDisabled,
              ]}
              onPress={handleSendMessage}
              disabled={!canSendMessages || messageText.trim() === '' || isSendingMessage}
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
          visible={showActionsMenu}
          animationType="slide"
          transparent
          onRequestClose={() => setShowActionsMenu(false)}
        >
          <TouchableOpacity
            style={styles.actionsMenuOverlay}
            activeOpacity={1}
            onPress={() => setShowActionsMenu(false)}
          >
            <View style={styles.customerActionsMenuContainer}>
              <View style={styles.actionsMenuGrid}>
                <TouchableOpacity
                  style={styles.actionsMenuGridItem}
                  onPress={handleOpenContactCardPicker}
                  activeOpacity={0.7}
                >
                  <View style={styles.actionsMenuIconCircle}>
                    <User size={24} color={Colors.primary} strokeWidth={2} />
                  </View>
                  <Text style={styles.actionsMenuGridItemText}>Contact Card</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        <ContactCardPickerModal
          visible={showContactCardPicker}
          onClose={() => setShowContactCardPicker(false)}
          onSend={handleSendContactCard}
        />

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
  headerSpacer: {
    width: 40,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 8,
    minWidth: 0,
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
  avatarCircleHeader: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 8,
  },
  avatarTextHeader: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  stickyOrderSummaryContainer: {
    backgroundColor: Colors.surface,
    paddingTop: 2,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  orderCardsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  compactOrderSummary: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    minWidth: 280,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
  },
  compactOrderPressable: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  compactOrderSummaryHighlighted: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  compactOrderLine: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 3,
  },
  compactOrderViewDetails: {
    fontSize: 13,
    color: Colors.primary,
    marginTop: 8,
    fontWeight: '500' as const,
  },
  compactOrderTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    gap: 10,
  },
  compactOrderMeta: {
    flex: 1,
    gap: 3,
  },
  compactOrderPublicId: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
  compactPaymentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start' as const,
    flexShrink: 0,
  },
  compactPaymentBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
  },
  compactCardDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  compactIvePaidBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    gap: 6,
  },
  compactIvePaidBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  compactPaymentSubmittedRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 10,
    gap: 6,
  },
  compactPaymentSubmittedText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  compactPaymentConfirmedRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 10,
    gap: 6,
  },
  compactPaymentConfirmedText: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '600' as const,
  },
  identityRequiredBanner: {
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.warningBorder,
  },
  identityBannerContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  identityBannerTextContainer: {
    flex: 1,
  },
  identityBannerText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
    marginBottom: 6,
  },
  identityBannerButton: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600' as const,
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
  limitedChatBanner: {
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.warningBorder,
  },
  limitedChatText: {
    fontSize: 13,
    color: Colors.primary,
    textAlign: 'center' as const,
  },
  suspendedBanner: {
    backgroundColor: 'rgba(220,38,38,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(220,38,38,0.15)',
  },
  suspendedBannerText: {
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center' as const,
    fontWeight: '500' as const,
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  messagesContent: {
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 8,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyIconContainer: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  emptyDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  messageBubbleContainer: {
    marginVertical: 2,
    paddingHorizontal: 8,
  },
  bubbleWithTail: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
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
    backgroundColor: '#A78BCA',
  },
  incomingAvatarText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  bubbleTailOutgoing: {
    width: 0,
    height: 0,
    borderTopWidth: 9,
    borderTopColor: Colors.primary,
    borderRightWidth: 9,
    borderRightColor: 'transparent' as const,
    marginBottom: 2,
    marginLeft: -2,
  },
  bubbleTailIncoming: {
    width: 0,
    height: 0,
    borderTopWidth: 9,
    borderTopColor: '#E9E9EB',
    borderLeftWidth: 9,
    borderLeftColor: 'transparent' as const,
    marginBottom: 2,
    marginRight: -2,
  },
  outgoingMessageContainer: {
    alignItems: 'flex-end' as const,
    justifyContent: 'flex-end' as const,
  },
  incomingMessageContainer: {
    alignItems: 'flex-start' as const,
    justifyContent: 'flex-start' as const,
  },

  messageMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-end' as const,
    gap: 3,
    marginTop: 2,
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 18,
  },
  outgoingBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  incomingBubble: {
    backgroundColor: '#E9E9EB',
    borderBottomLeftRadius: 4,
  },

  messageText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 21,
  },
  outgoingMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 11,
    color: 'rgba(0, 0, 0, 0.4)',
  },
  outgoingMessageTime: {
    color: 'rgba(255, 255, 255, 0.72)',
  },
  systemMessageContainer: {
    alignItems: 'center' as const,
    marginBottom: 6,
    paddingHorizontal: 32,
  },
  systemMessageText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 16,
  },
  paymentRequestWrapper: {
    alignItems: 'center' as const,
    marginBottom: 8,
    width: '100%',
  },
  businessHoursBanner: {
    backgroundColor: 'rgba(255,140,66,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,140,66,0.14)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,140,66,0.14)',
  },
  businessHoursText: {
    fontSize: 12,
    color: '#B45309',
    textAlign: 'center' as const,
    fontStyle: 'italic' as const,
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
  },
  actionsMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end' as const,
  },
  actionsMenuContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center' as const,
  },
  actionsMenuItem: {
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  destructiveText: {
    color: Colors.error,
  },
  customerActionsMenuContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  actionsMenuGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'flex-start' as const,
    gap: 12,
  },
  actionsMenuGridItem: {
    width: '22%',
    alignItems: 'center' as const,
    paddingVertical: 8,
  },
  actionsMenuIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 8,
  },
  actionsMenuGridItemText: {
    fontSize: 11,
    color: Colors.text,
    textAlign: 'center' as const,
    fontWeight: '500' as const,
    lineHeight: 14,
  },
  plusButton: {
    padding: 8,
  },
  contactCardModalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contactCardSafeArea: {
    backgroundColor: Colors.background,
  },
  contactCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  cancelButton: {
    padding: 8,
  },
  cancelButtonText: {
    fontSize: 17,
    color: Colors.primary,
    fontWeight: '400' as const,
  },
  contactCardHeaderTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
    marginRight: 40,
  },
  contactCardContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contactCardSection: {
    marginTop: 16,
  },
  contactCardItem: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 12,
  },
  contactCardItemInner: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  contactCardItemLabel: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  contactCardItemDetail: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  contactCardItemNote: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
    fontStyle: 'italic' as const,
  },
  contactCardAddButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 16,
    gap: 8,
  },
  contactCardAddButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  contactCardBottomSpacer: {
    height: 40,
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
  searchHeader: {
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  searchHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 2,
  },
  searchMetaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 8,
    gap: 12,
  },
  searchMetaText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textMuted,
  },
  searchNavBtns: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  searchNavBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchNavBtnDisabled: {
    opacity: 0.5,
  },
  searchScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  highlightOnIncoming: {
    backgroundColor: 'rgba(255,200,0,0.55)',
    color: Colors.text,
  },
  highlightOnOutgoing: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    color: '#FFFFFF',
  },
  currentMatchUnderline: {
    height: 2,
    backgroundColor: Colors.primary,
    marginHorizontal: 24,
    marginTop: 4,
    borderRadius: 1,
  },
});
