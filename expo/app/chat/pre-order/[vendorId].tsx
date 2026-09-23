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
  Platform } from 'react-native';
import { Alert } from '@/utils/alert';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ChevronLeft, Send, Package, Truck, ChevronRight, Info } from 'lucide-react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { type Vendor } from '@/mocks/vendorData';
import { useChats } from '@/contexts/ChatContext';
import { ChatMessage } from '@/mocks/chatData';
import { useInbox, isDemoInboxAccount } from '@/contexts/InboxContext';
import { useAuth } from '@/contexts/AuthContext';
import { useChatRead } from '@/contexts/ChatReadContext';
import { chatService } from '@/services/chatService';
import { useVendorIdentity } from '@/lib/vendor/useVendorIdentity';
import { MOCK_CUSTOMER_ID } from '@/mocks/inboxData';

import { useVendorChatMode } from '@/contexts/VendorChatModeContext';
import { validateChatMessage } from '@/utils/chatValidation';
import VendorStatusGate, { normalizeVendorStatus, useVendorStatusPermissions } from '@/components/VendorStatusGate';
import { useSafeBack } from '@/utils/useSafeBack';
import { formatPriceWithCommas, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';
import {
  CHAT_INPUT_PLACEHOLDERS,
  CHAT_BANNERS,
  CHAT_HEADER_SUBTITLES,
  CHAT_DIVIDERS,
} from '@/constants/chatStrings';

const PRE_ORDER_CHAT_EXPIRY_MS = 72 * 60 * 60 * 1000;

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ').filter(p => p.length > 0);
  if (parts.length === 0) return 'V';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const getStableColor = (name: string): string => {
  const colors = ['#E8845C', '#22C55E', '#5B9BD5', '#E89B6C', '#7BC8B8', '#F0C75E', '#A78BCA', '#6AADDB'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

function PreOrderChatContent({ vendorId, vendor }: { vendorId: string; vendor: Vendor | undefined }) {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const { getPreOrderChat, addMessageToChat, ensureCommerceThread } = useChats();
  const { user } = useAuth();
  const { chatMode } = useVendorChatMode();
  const { customerInbox, updateInboxAfterMessage } = useInbox();
  const { canChat } = useVendorStatusPermissions();

  const preOrderChat = getPreOrderChat(vendorId);
  // Real vendor doc, fetched once by the wrapper below and passed down —
  // backs vendor identity here and vendor currency further down. Previously
  // read from mockVendors, which only contains a handful of demo vendors and
  // silently fell back to a hardcoded mock vendor for everyone else.
  const vendorName = vendor?.name || 'Vendor';

  const isChatBlocked = !canChat;
  const headerSubtitle = preOrderChat?.chatType === 'order_chat' ? CHAT_HEADER_SUBTITLES.orderConversation : CHAT_HEADER_SUBTITLES.preOrderInquiry;
  console.log('[CHAT] canChat:', canChat, '| vendorId:', vendorId, '| chatType:', preOrderChat?.chatType);

  const [messages, setMessages] = useState<ChatMessage[]>(preOrderChat?.messages || []);

  useEffect(() => {
    if (preOrderChat) {
      setMessages(preOrderChat.messages);
    }
  }, [preOrderChat]);

  const { markChatAsRead } = useChatRead();
  const preOrderChatId = preOrderChat?.id ?? '';

  /**
   * Clear unread for the customer when this chat opens, and write the real
   * read receipt. This screen had no read-tracking at all — neither the
   * local unread badge nor the real chatThreads/{chatId}/readReceipts write
   * that the order-chat screens already perform.
   */
  useEffect(() => {
    if (!preOrderChatId) return;
    markChatAsRead(preOrderChatId, 'customer');
    void chatService.markRead(preOrderChatId);
  }, [preOrderChatId, markChatAsRead]);

  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  // isSendingMessage (React state) is not a reliable mutex on its own: two
  // event-handler invocations from a fast double-tap can both read the
  // stale pre-update value before either one triggers a re-render, so both
  // still pass the check. sendLockRef is checked and set synchronously,
  // before any await, closing that gap; isSendingMessage stays purely for
  // disabling the button visually.
  const sendLockRef = useRef(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const hasVendorEngaged = messages.some(msg => msg.sender === 'vendor');

  const hasNewInquiry = useMemo(() => {
    return messages.some(m => m.type === 'new_inquiry');
  }, [messages]);

  const lastNewInquiryIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === 'new_inquiry') return i;
    }
    return -1;
  }, [messages]);

  const isConversationExpired = useMemo(() => {
    if (messages.length === 0) return false;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.type === 'new_inquiry') return false;
    const relevantMessages = lastNewInquiryIndex >= 0
      ? messages.slice(lastNewInquiryIndex)
      : messages;
    const lastRelevant = relevantMessages[relevantMessages.length - 1];
    const lastActivityTime = new Date(lastRelevant.timestamp).getTime();
    const elapsed = Date.now() - lastActivityTime;
    const expired = elapsed > PRE_ORDER_CHAT_EXPIRY_MS;
    console.log('[PRE-ORDER CHAT] Last activity:', lastRelevant.timestamp, '| Elapsed ms:', elapsed, '| Expired:', expired, '| Has new inquiry:', hasNewInquiry);
    return expired;
  }, [messages, lastNewInquiryIndex, hasNewInquiry]);

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

  const handleSendMessage = async () => {
    // isSendingMessage guard now also covers thread creation below: a
    // brand-new deep link with no prior conversation must not fire two
    // createCommerceConversation calls or send the same message twice —
    // sendChatMessage has no client-side idempotency key, so a second real
    // call mints a genuinely separate, duplicate message document.
    if (messageText.trim() === '' || sendLockRef.current) return;
    sendLockRef.current = true;

    const messageContent = messageText.trim();

    const validation = validateChatMessage(messageContent);
    if (!validation.isValid) {
      setValidationError(validation.errorMessage || 'Invalid message');
      setTimeout(() => setValidationError(null), 4000);
      sendLockRef.current = false;
      return;
    }

    setIsSendingMessage(true);
    try {
      // A brand-new deep link with no prior conversation for this vendor:
      // preOrderChat is undefined because getPreOrderChat is a pure lookup
      // with no creation fallback, so this used to just silently no-op —
      // nothing sent, nothing shown, no error. Reuses the same authoritative
      // creation path the storefront's Message Vendor button already uses.
      let chat = preOrderChat;
      if (!chat) {
        const result = await ensureCommerceThread(vendorId, vendorName);
        if (!result.success) {
          setValidationError(result.error);
          setTimeout(() => setValidationError(null), 4000);
          return;
        }
        chat = result.chat;
      }

      // addMessageToChat already calls chatService.sendMessage itself (and
      // handles the away-message auto-reply) - a second, separate
      // chatService.sendMessage call here used to run alongside it, sending
      // every message twice with no way to tell the two apart afterward.
      await addMessageToChat(chat.id, {
        type: 'text',
        content: messageContent,
        sender: 'customer',
      });

      setMessageText('');
      console.log('[PRE-ORDER CHAT] Customer message sent:', messageContent);

      const conv = customerInbox.find(item => item.vendorId === vendorId && item.conversationType === 'inquiry');
      if (conv) {
        updateInboxAfterMessage({
          conversationId: conv.conversationId,
          lastMessageText: messageContent,
          // A demo login's raw account id ('1') is not what any seeded demo
          // inbox row is keyed on -- MOCK_CUSTOMER_ID is, same as ChatContext.
          lastSenderId: isDemoInboxAccount(user?.id) ? MOCK_CUSTOMER_ID : (user?.id ?? ''),
          senderRole: 'customer',
        });
        console.log('[PRE-ORDER CHAT] Inbox snapshot updated:', conv.conversationId);
      }
    } catch (err) {
      console.log('[PRE-ORDER CHAT] sendMessage failed:', err);
      const message = err instanceof Error ? err.message : 'Could not send your message.';
      setValidationError(message);
      setTimeout(() => setValidationError(null), 4000);
    } finally {
      setIsSendingMessage(false);
      sendLockRef.current = false;
    }
  };





  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderMessage = (message: ChatMessage, groupInfo: { isFirstInGroup: boolean; isLastInGroup: boolean } = { isFirstInGroup: true, isLastInGroup: true }) => {
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
              <Text style={styles.contactCardHeaderText}>📇 Contact details shared</Text>
            </View>
            <View style={styles.contactCardContent}>
              {/* Backend (sendChatMessage.ts) writes fullName/phoneNumber onto
                  the message, not name/phone - those only exist on a
                  local-only optimistic echo, so a real contact-card share
                  rendered with a blank name and phone without this fallback. */}
              {(message.contactCardData.fullName ?? message.contactCardData.name) && (
                <>
                  <Text style={styles.contactCardLabel}>Name</Text>
                  <Text style={styles.contactCardValue}>{message.contactCardData.fullName ?? message.contactCardData.name}</Text>
                </>
              )}
              {(message.contactCardData.phoneNumber ?? message.contactCardData.phone) && (
                <>
                  <Text style={styles.contactCardLabel}>Phone</Text>
                  <Text style={styles.contactCardValue}>{message.contactCardData.phoneNumber ?? message.contactCardData.phone}</Text>
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
                <Text style={styles.menuItemPrice}>{formatPriceWithCommas(Number(displayPrice) || 0, (vendor?.currency as Currency) || getCurrencyFromCountryCode(vendor?.countryCode || 'NG'))}</Text>
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

    const { isFirstInGroup, isLastInGroup } = groupInfo;
    const isOutgoing = message.sender === 'customer';

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
              <Text style={[styles.messageTime, isOutgoing && styles.outgoingMessageTime]}>
                {formatTime(message.timestamp)}
              </Text>
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
              params: { vendorId, chatId: preOrderChat?.id ?? '' },
            })}
            activeOpacity={0.7}
            testID="chat-header-info"
            accessibilityLabel={`Open ${vendorName} chat info`}
          >
            {vendor?.logoImage ? (
              <Image
                source={{ uri: vendor.logoImage }}
                style={styles.avatarCircleHeader}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.avatarCircleHeader, { backgroundColor: getStableColor(vendorName) }]}>
                <Text style={styles.avatarTextHeader}>{getInitials(vendorName)}</Text>
              </View>
            )}
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>{vendorName}</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {vendor?.username || vendor?.slug
                  ? `@${(vendor?.username || vendor?.slug || '').toLowerCase()}`
                  : headerSubtitle}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={styles.headerActionsSlot} />
        </View>
      </SafeAreaView>

      <View style={styles.contentWrapper}>
        {isChatBlocked && (
          <View style={styles.suspendedBanner}>
            <Text style={styles.suspendedBannerText}>{CHAT_BANNERS.vendorUnavailable}</Text>
          </View>
        )}

        {chatMode === 'limited' && !isChatBlocked && !isConversationExpired && (
          <View style={styles.clarificationBanner}>
            <Text style={styles.clarificationText}>
              {CHAT_BANNERS.limitedClarifications}
            </Text>
          </View>
        )}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.preOrderInfoBanner}>
            <Info size={16} color={Colors.textSecondary} strokeWidth={2} />
            <View style={styles.preOrderInfoTextWrap}>
              <Text style={styles.preOrderInfoTitle}>This is a pre-order inquiry</Text>
              <Text style={styles.preOrderInfoSubtitle}>No order has been placed yet.</Text>
            </View>
          </View>
          {messages.length === 0 ? (
            <View style={styles.emptyConversationState} testID="pre-order-empty-state">
              <Text style={styles.emptyConversationTitle}>Start your conversation</Text>
              <Text style={styles.emptyConversationText}>Start your conversation with this vendor.</Text>
            </View>
          ) : (
            renderMessageList(messages)
          )}
          {isConversationExpired && (
            <View style={styles.expiredNoticeContainer}>
              <View style={styles.expiredNoticeDivider} />
              <Text style={styles.expiredNoticeText}>{CHAT_DIVIDERS.conversationEnded}</Text>
              <View style={styles.expiredNoticeDivider} />
            </View>
          )}
        </ScrollView>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.inputSafeArea}>
        {isConversationExpired && !isChatBlocked && (
          <View style={styles.expiredBanner}>
            <Text style={styles.expiredBannerText}>
              {CHAT_BANNERS.conversationExpired}
            </Text>
          </View>
        )}
        {validationError && !isConversationExpired && (
          <View style={styles.validationErrorContainer}>
            <Text style={styles.validationErrorText}>{validationError}</Text>
          </View>
        )}
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, (isConversationExpired || isChatBlocked) && styles.inputDisabled]}
            placeholder={
              isChatBlocked ? CHAT_INPUT_PLACEHOLDERS.messagingUnavailable :
              isConversationExpired ? CHAT_INPUT_PLACEHOLDERS.conversationExpired :
              CHAT_INPUT_PLACEHOLDERS.default
            }
            placeholderTextColor={Colors.textSecondary}
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={500}
            editable={!isChatBlocked && !isConversationExpired}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (messageText.trim() === '' || isChatBlocked || isConversationExpired || isSendingMessage) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={messageText.trim() === '' || isChatBlocked || isConversationExpired || isSendingMessage}
            activeOpacity={0.7}
          >
            <Send
              size={20}
              color='#FFFFFF'
            />
          </TouchableOpacity>
        </View>
        </SafeAreaView>


      </KeyboardAvoidingView>

    </>
  );
}

/**
 * Shown while the vendor lookup is still in flight -- never renders the
 * composer or falls through to VendorStatusGate (which defaults an unread
 * status to 'ACTIVE') before the read has actually finished one way or the
 * other.
 */
function VendorIdentityLoading() {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={unavailableStyles.centered} />
      </SafeAreaView>
    </View>
  );
}

/**
 * Shown when the vendor could not be confirmed at all -- a genuinely
 * nonexistent vendorId, a permission-denied read (very likely, but not
 * provably, a suspended/deactivated vendor -- Firestore rules deny an
 * ordinary customer's read of a non-active vendor's document outright, see
 * firestore.rules vendors/{vendorId}), or a transient network failure.
 * Deliberately never claims a confirmed suspension the client cannot
 * actually confirm; VendorStatusGate's own SUSPENDED/DEACTIVATED copy stays
 * reserved for the case where the vendor's real status WAS read successfully
 * (a demo vendorId, or a vendor owner/admin viewing their own thread).
 */
function VendorIdentityUnavailable({ reason }: { reason: 'not-found' | 'permission-denied' | 'transient' | null }) {
  const safeBack = useSafeBack();
  const message =
    reason === 'transient'
      ? CHAT_BANNERS.vendorStatusUnknown
      : CHAT_BANNERS.vendorUnavailable;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={unavailableStyles.header}>
          <TouchableOpacity onPress={() => safeBack()} style={unavailableStyles.headerButton} activeOpacity={0.7}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      <View style={unavailableStyles.content}>
        <Text style={unavailableStyles.message}>{message}</Text>
        <TouchableOpacity style={unavailableStyles.button} onPress={() => safeBack()} activeOpacity={0.8}>
          <Text style={unavailableStyles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const unavailableStyles = StyleSheet.create({
  centered: { flex: 1 },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 8 },
  headerButton: { padding: 8 },
  content: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 40 },
  message: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' as const, marginBottom: 24 },
  button: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  buttonText: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
});

export default function PreOrderChatScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();

  // Real vendor doc, fetched once here and passed down to PreOrderChatContent
  // so the status gate and the content below it read the same vendor.
  // Previously read from mockVendors, which only contains a handful of demo
  // vendors: any real vendor not in that array fell through to `undefined`,
  // normalized to 'UNVERIFIED' rather than reflecting the vendor's real status.
  const { vendor, availability, unavailableReason } = useVendorIdentity(vendorId as string | undefined);

  const normalizedStatus = useMemo(() => {
    return normalizeVendorStatus(vendor?.vendorStatus);
  }, [vendor]);

  console.log('[PRE-ORDER CHAT] Gate status for vendorId:', vendorId, '-> availability:', availability, 'status:', normalizedStatus, 'unavailableReason:', unavailableReason);

  // Fail-closed ahead of VendorStatusGate: normalizeVendorStatus(undefined)
  // defaults to 'ACTIVE', so reaching VendorStatusGate before the vendor
  // doc's read has actually succeeded would render the full composer for a
  // vendor whose status was never confirmed -- including the exact case
  // (permission-denied on a suspended/deactivated vendor's now-unreadable
  // document) this correction exists to close.
  if (availability === 'loading') {
    return <VendorIdentityLoading />;
  }
  if (availability === 'unavailable') {
    return <VendorIdentityUnavailable reason={unavailableReason} />;
  }

  return (
    <VendorStatusGate vendorStatus={normalizedStatus}>
      <PreOrderChatContent vendorId={vendorId as string} vendor={vendor} />
    </VendorStatusGate>
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
  headerButton: {
    padding: 8,
    flexShrink: 0,
  },
  avatarCircleHeader: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 8,
    overflow: 'hidden' as const,
  },
  avatarTextHeader: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  headerCenter: {
    flex: 1,
    marginLeft: 0,
    minWidth: 0,
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: '#F7F3EF',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#F7F3EF',
  },
  messagesContent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
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
    marginBottom: 6,
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
    overflow: 'hidden' as const,
  },
  incomingAvatarText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  preOrderInfoBanner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 10,
  },
  preOrderInfoTextWrap: {
    flex: 1,
  },
  preOrderInfoTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  preOrderInfoSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  emptyConversationState: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyConversationTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 6,
    textAlign: 'center' as const,
  },
  emptyConversationText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  messageBubbleCompact: {
    marginBottom: 2,
  },
  outgoingMessageContainer: {
    alignItems: 'flex-end' as const,
  },
  incomingMessageContainer: {
    alignItems: 'flex-start' as const,
  },
  messageBubble: {
    // Cap moved to bubbleWithTail below - resolving a percentage against
    // this shrink-wrapped parent collapsed short messages to a fixed width.
    flexShrink: 1,
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
    maxWidth: '75%',
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
    color: 'rgba(0,0,0,0.45)',
    alignSelf: 'flex-end' as const,
  },
  outgoingMessageTime: {
    color: 'rgba(255,255,255,0.75)',
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
    opacity: 1,
  },


  systemMessageContainer: {
    alignItems: 'center' as const,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  systemMessageText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 16,
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
  contactCardTime: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'right' as const,
  },
  clarificationBanner: {
    backgroundColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  clarificationText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 18,
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
  expiredBanner: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  expiredBannerText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  expiredNoticeContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  expiredNoticeDivider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  expiredNoticeText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  inputDisabled: {
    backgroundColor: '#EBEBEB',
    color: Colors.textMuted,
  },
  validationErrorContainer: {
    backgroundColor: Colors.border,
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
});
