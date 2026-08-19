import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Chat, ChatMessage, ChatType, OrderContextData, normalizeChatType, toPushChatType } from '@/mocks/chatData';
import { useBackendChats } from '@/lib/chat/useBackendChats';
import { chatService } from '@/services/chatService';
import { useAuth } from './AuthContext';
import { useVendor } from './VendorContext';
import { useVendorPushNotifications } from './VendorPushNotificationContext';
import { useBlockedUsers } from './BlockedUsersContext';
import { useVendorAwayMessage } from './VendorAwayMessageContext';

/**
 * ChatContext is a thin wrapper over `chatService`.
 *
 * - Reads come from `chatService.getAllSync()` (the shared `mockChats` store).
 * - Writers route through `chatService` (`sendMessage`, `getOrCreate`,
 *   `updateChat`) so persistence and in-session reactivity stay unified.
 * - A single `subscribeAll` tick keeps consumers re-rendering whenever any
 *   chat in the store changes, replacing the previous local `useState<Chat[]>`
 *   snapshot.
 *
 * Firebase migration: swap `chatService.subscribeAll` for a collection-level
 * `onSnapshot` listener; the public ChatContext API stays the same.
 */
export const [ChatProvider, useChats] = createContextHook(() => {
  // Fills chatService's store with the signed-in user's real threads. The
  // migration note above describes exactly this swap; the public API below is
  // unchanged, so no screen needed rewriting to get real conversations.
  useBackendChats();

  const [, setTick] = useState<number>(() => chatService.getGlobalVersion());
  useEffect(() => {
    const unsubscribe = chatService.subscribeAll(() => {
      setTick(v => v + 1);
    });
    return unsubscribe;
  }, []);

  const chats: Chat[] = chatService.getAllSync();

  const vendorPush = useVendorPushNotifications() ?? null;
  const { isUserBlocked } = useBlockedUsers();
  const awayMessage = useVendorAwayMessage() ?? null;

  // Real authenticated identity — every local lookup/scaffold below used to
  // key off a hardcoded mock customer/vendor id, which is how the storefront's
  // real "Message Vendor" button (useMessageVendor -> createCommerceConversation)
  // could create the correct thread server-side under the real customer's uid
  // while this file's own local fallback scaffolding for the same thread kept
  // using a different, fake id — two divergent local records for one real
  // conversation. currentCustomerId/currentCustomerName are now sourced from
  // the same useAuth() session every other real-data context in this app uses
  // (OrdersContext, InboxContext), and currentVendorId from the active
  // vendor's own account (useVendor()), never a shared constant.
  const { user } = useAuth();
  const { vendor } = useVendor();
  const currentCustomerId = user?.id ?? '';
  const currentCustomerName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || 'Customer';
  const currentVendorId = vendor?.id ?? '';

  const getConversationByPair = useCallback((vendorId: string, customerId: string): Chat | undefined => {
    return chatService.getAllSync().find(c => c.vendorId === vendorId && c.customerId === customerId);
  }, []);

  const getOrCreatePreOrderChat = useCallback((vendorId: string, vendorName: string, firstMessage: string): Chat | null => {
    if (isUserBlocked(vendorId)) {
      console.log('[ChatContext] Blocked vendor, cannot create chat:', vendorId);
      return null;
    }

    const all = chatService.getAllSync();
    const existing = all.find(
      c => c.vendorId === vendorId && c.customerId === currentCustomerId
    );

    let chatId: string;
    let chatTypeForPush: 'PREORDER_CHAT' | 'ORDER_CHAT';

    if (existing) {
      chatId = existing.id;
      chatTypeForPush = toPushChatType(existing.chatType);
      console.log('[ChatContext] Reusing existing conversation:', existing.id, 'type:', existing.chatType);
    } else {
      const newChat: Chat = {
        id: `chat-${vendorId}-${currentCustomerId}-${Date.now()}`,
        vendorId,
        vendorName,
        customerId: currentCustomerId,
        customerName: currentCustomerName,
        chatType: 'pre_order_inquiry',
        messages: [],
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        vendorCanReply: true,
      };
      chatService.getAllSync().push(newChat);
      chatId = newChat.id;
      chatTypeForPush = 'PREORDER_CHAT';
      console.log('[ChatContext] New inquiry chat created:', newChat.id);
    }

    void chatService.sendMessage({
      chatId,
      type: 'text',
      content: firstMessage,
      sender: 'customer',
    });

    void vendorPush?.sendChatMessagePush({
      vendorId,
      chatId,
      chatType: chatTypeForPush,
      senderRole: 'customer',
    });

    return chatService.getByIdSync(chatId) ?? null;
  }, [isUserBlocked, vendorPush, currentCustomerId, currentCustomerName]);

  const addMessageToChat = useCallback((chatId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const chatBefore = chatService.getByIdSync(chatId);
    if (!chatBefore) {
      console.log('[ChatContext] addMessageToChat: chat not found:', chatId);
      return;
    }

    void chatService.sendMessage({
      chatId,
      type: message.type,
      content: message.content,
      sender: message.sender,
      contactCardData: message.contactCardData,
      paymentRequestData: message.paymentRequestData,
      pickupDetailsData: message.pickupDetailsData,
      catalogItemData: message.catalogItemData,
      receiptData: message.receiptData,
      invoiceData: message.invoiceData,
      orderContextData: message.orderContextData,
      changeRequestData: message.changeRequestData,
      visible_to_user: message.visible_to_user,
    });

    if (message.sender === 'customer' && message.type !== 'system') {
      const lastVendorMessage = [...chatBefore.messages].reverse().find(m => m.sender === 'vendor');
      const lastVendorReplyAt = lastVendorMessage?.timestamp;

      if (awayMessage?.shouldSendAwayMessage(chatBefore.lastAwayMessageSentAt, lastVendorReplyAt)) {
        console.log('[ChatContext] Sending away message to chat:', chatId);
        void chatService.sendMessage({
          chatId,
          type: 'text',
          content: awayMessage.settings.message,
          sender: 'vendor',
          timestampOverride: new Date(Date.now() + 500).toISOString(),
        });
        chatService.updateChat(chatId, { lastAwayMessageSentAt: new Date().toISOString() });
      }

      const chatType = toPushChatType(chatBefore.chatType);
      console.log('[ChatContext] Customer message sent, triggering vendor push:', {
        chatId,
        chatType,
        vendorId: chatBefore.vendorId,
      });

      void vendorPush?.sendChatMessagePush({
        vendorId: chatBefore.vendorId,
        chatId,
        chatType,
        senderRole: 'customer',
      });
    }
  }, [vendorPush, awayMessage]);

  const getPreOrderChat = useCallback((vendorId: string): Chat | undefined => {
    return chatService.getAllSync().find(
      c => c.vendorId === vendorId && c.customerId === currentCustomerId
    );
  }, [currentCustomerId]);

  const getChatByPair = useCallback((vendorId: string, customerId: string): Chat | undefined => {
    return chatService.getAllSync().find(c => c.vendorId === vendorId && c.customerId === customerId);
  }, []);

  const getCustomerChats = useCallback((): Chat[] => {
    return chatService.getAllSync().filter(c => c.customerId === currentCustomerId || !c.customerId);
  }, [currentCustomerId]);

  const getVendorPreOrderChats = useCallback((): Chat[] => {
    return chatService.getAllSync().filter(
      c => normalizeChatType(c.chatType) === 'pre_order_inquiry' && c.vendorId === currentVendorId
    );
  }, [currentVendorId]);

  const getVendorPreOrderChatByCustomerId = useCallback((customerId: string): Chat | undefined => {
    return chatService.getAllSync().find(
      c => normalizeChatType(c.chatType) === 'pre_order_inquiry' && c.customerId === customerId && c.vendorId === currentVendorId
    );
  }, [currentVendorId]);

  const getOrCreateConversation = useCallback((vendorId: string, vendorName: string, chatType: ChatType = 'pre_order_inquiry'): Chat => {
    const all = chatService.getAllSync();
    const existing = all.find(
      c => c.vendorId === vendorId && c.customerId === currentCustomerId
    );

    if (existing) {
      console.log('[ChatContext] Found existing conversation for pair:', existing.id, 'vendorId:', vendorId);
      return existing;
    }

    const newChat: Chat = {
      id: `chat-${vendorId}-${currentCustomerId}-${Date.now()}`,
      vendorId,
      vendorName,
      customerId: currentCustomerId,
      customerName: currentCustomerName,
      chatType,
      messages: [],
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      vendorCanReply: true,
    };

    all.push(newChat);
    // Bump global version so subscribers re-render even though no message
    // write happened on the new chat yet.
    chatService.updateChat(newChat.id, {});
    console.log('[ChatContext] Created new conversation:', newChat.id, 'type:', chatType);
    return newChat;
  }, [currentCustomerId, currentCustomerName]);

  const startNewInquiry = useCallback((vendorId: string): Chat | null => {
    const existing = chatService.getAllSync().find(
      c => c.vendorId === vendorId && c.customerId === currentCustomerId
    );

    if (!existing) {
      console.log('[ChatContext] No existing conversation found for new inquiry, vendorId:', vendorId);
      return null;
    }

    void chatService.sendMessage({
      chatId: existing.id,
      type: 'new_inquiry',
      content: 'New Inquiry',
      sender: 'system',
      idOverride: `new-inquiry-${Date.now()}`,
    });
    chatService.updateChat(existing.id, {
      chatType: 'pre_order_inquiry',
      vendorCanReply: true,
      vendorDisabledReason: undefined,
    });

    console.log('[ChatContext] New inquiry started in existing conversation:', existing.id);
    return chatService.getByIdSync(existing.id) ?? null;
  }, [currentCustomerId]);

  const convertToOrderChat = useCallback((vendorId: string, customerId: string, orderContextData: OrderContextData): void => {
    const existing = chatService.getAllSync().find(
      c => c.vendorId === vendorId && c.customerId === customerId
    );

    if (!existing) {
      console.log('[ChatContext] No existing conversation found for pair:', vendorId, customerId);
      return;
    }

    const baseTs = Date.now();
    void chatService.sendMessage({
      chatId: existing.id,
      type: 'order_context',
      content: 'Order accepted',
      sender: 'system',
      orderContextData,
      idOverride: `order-ctx-${baseTs}`,
      timestampOverride: new Date(baseTs).toISOString(),
    });
    void chatService.sendMessage({
      chatId: existing.id,
      type: 'system',
      content: 'Order accepted',
      sender: 'system',
      idOverride: `sys-accept-${baseTs}`,
      timestampOverride: new Date(baseTs + 1).toISOString(),
    });
    chatService.updateChat(existing.id, { chatType: 'order_chat' });

    console.log('[ChatContext] Converted inquiry to order chat:', existing.id, 'orderId:', orderContextData.orderId);
  }, []);

  const getOrCreateOrderChat = useCallback((vendorId: string, vendorName: string, _orderId: string, _publicOrderId: string, _orderStatus: string): Chat => {
    const all = chatService.getAllSync();
    const existing = all.find(
      c => c.vendorId === vendorId && c.customerId === currentCustomerId
    );

    const systemContent = 'Your order request has been sent. The vendor will review and confirm availability.';

    if (existing) {
      void chatService.sendMessage({
        chatId: existing.id,
        type: 'system',
        content: systemContent,
        sender: 'system',
      });
      chatService.updateChat(existing.id, { chatType: 'order_chat' });
      console.log('[ChatContext] Reusing conversation for new order:', existing.id);
      return chatService.getByIdSync(existing.id) ?? existing;
    }

    const newChat: Chat = {
      id: `chat-${vendorId}-${currentCustomerId}-${Date.now()}`,
      vendorId,
      vendorName,
      customerId: currentCustomerId,
      customerName: currentCustomerName,
      chatType: 'order_chat',
      messages: [],
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      vendorCanReply: true,
    };
    all.push(newChat);

    void chatService.sendMessage({
      chatId: newChat.id,
      type: 'system',
      content: systemContent,
      sender: 'system',
    });

    console.log('[ChatContext] Created single conversation thread:', newChat.id);
    return chatService.getByIdSync(newChat.id) ?? newChat;
  }, [currentCustomerId, currentCustomerName]);

  return useMemo(() => ({
    chats,
    getOrCreatePreOrderChat,
    addMessageToChat,
    getPreOrderChat,
    getChatByPair,
    getConversationByPair,
    getCustomerChats,
    getVendorPreOrderChats,
    getVendorPreOrderChatByCustomerId,
    getOrCreateOrderChat,
    getOrCreateConversation,
    convertToOrderChat,
    startNewInquiry,
  }), [chats, getOrCreatePreOrderChat, addMessageToChat, getPreOrderChat, getChatByPair, getConversationByPair, getCustomerChats, getVendorPreOrderChats, getVendorPreOrderChatByCustomerId, getOrCreateOrderChat, getOrCreateConversation, convertToOrderChat, startNewInquiry]);
});
