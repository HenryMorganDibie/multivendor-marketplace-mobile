import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Chat, ChatMessage, ChatType, OrderContextData, normalizeChatType } from '@/mocks/chatData';
import { useBackendChats } from '@/lib/chat/useBackendChats';
import { chatService } from '@/services/chatService';
import { auth, callable } from '@/lib/firebase';
import { DEV_LOCAL_AUTH_ENABLED } from '@/constants/devAuth';
import { useAuth } from './AuthContext';
import { useVendor } from './VendorContext';
import { useBlockedUsers } from './BlockedUsersContext';
import { useVendorAwayMessage } from './VendorAwayMessageContext';
import { isDemoInboxAccount } from './InboxContext';
import { MOCK_CUSTOMER_ID } from '@/mocks/inboxData';

// The seeded demo chat fixtures (mocks/chatData.ts) were all written against
// this exact name for MOCK_CUSTOMER_ID. The demo account record itself
// carries no firstName/lastName (see AuthContext's default accounts), so
// deriving a name from useAuth().user the normal way would fall through to
// the generic "Customer" placeholder for a demo login, diverging from the
// name every seeded demo conversation already displays.
const DEMO_CUSTOMER_NAME = 'Jane Smith';

/**
 * auth.currentUser is synchronous and can read null for a real, signed-in
 * user right after a fresh page load or a navigation that re-initializes
 * the Firebase SDK - Auth's persisted-session restore is asynchronous, so
 * checking auth.currentUser directly at that instant can send
 * createCommerceConversation out unauthenticated (rejected server-side),
 * silently falling through to a local-only scaffold with no real thread
 * behind it. Waiting up to 3s for Auth's own readiness signal closes that
 * window without changing the already-hydrated case, which resolves
 * immediately. Same fix useMessageVendor.ts already applies to the
 * storefront's Message Vendor button; ensureCommerceThread below applies
 * it to the other entry points that create a thread from nothing.
 */
function waitForAuthReady(timeoutMs = 3000): Promise<boolean> {
  if (auth.currentUser) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      resolve(!!auth.currentUser);
    }, timeoutMs);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      clearTimeout(timeout);
      unsubscribe();
      resolve(!!user);
    });
  });
}

export type EnsureCommerceThreadResult =
  | { success: true; chat: Chat; chatId: string }
  | { success: false; error: string };

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
  //
  // Demo status is read from the same explicit mechanism InboxContext already
  // uses (isDemoInboxAccount / DEMO_INBOX_ACCOUNTS), not inferred from missing
  // claims or any other heuristic. A recognized demo login's raw account id
  // ('1', or the demo ids themselves) is translated to MOCK_CUSTOMER_ID, which
  // is what every seeded demo chat/inbox fixture is keyed on — matching it
  // directly with useAuth().user.id would silently show empty demo data.
  const { user } = useAuth();
  const { vendor } = useVendor();
  const isDemoCustomer = isDemoInboxAccount(user?.id);
  const currentCustomerId = isDemoCustomer ? MOCK_CUSTOMER_ID : (user?.id ?? '');
  const currentCustomerName = isDemoCustomer
    ? DEMO_CUSTOMER_NAME
    : [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || 'Customer';
  const currentVendorId = vendor?.id ?? '';

  // Demo fixture restoration ------------------------------------------------
  //
  // useBackendChats.ts's own auth-transition handling calls
  // chatService.resetBackendHydration() on every Firebase auth-state
  // callback -- including the very first one at app boot, before any login
  // at all, since a demo login never touches Firebase Auth
  // (DEV_LOCAL_AUTH_ENABLED bypasses it). That call does `chats.length = 0`
  // on the exact same array `mocks/chatData.ts` exports as `mockChats`, with
  // nothing to refill it. Without this effect, every seeded demo chat's
  // message history would be gone the instant the app starts, regardless of
  // whether a demo session ever begins.
  //
  // Gated on isDemoCustomer (isDemoInboxAccount(user?.id), which recognizes
  // both the demo customer and the demo vendor login ids off the same
  // DEMO_INBOX_ACCOUNTS table) so a real account is never affected --
  // resetBackendHydration's wipe on a real sign-in/sign-out is left
  // completely alone, exactly as before this effect existed.
  useEffect(() => {
    if (!isDemoCustomer) return;

    // Entering this demo session -- cold boot straight into demo, or
    // switching from a real account or a different demo account into this
    // one -- always starts from a clean pristine set, so a prior session's
    // locally-added messages never survive into this one.
    chatService.restoreDemoFixtures(true);

    // While already in this demo session: `chats` is empty only right after
    // some resetBackendHydration call wiped it (app boot's own initial auth
    // callback fires regardless of what the session turns out to be, and
    // nothing rules out a later one). restoreDemoFixtures(false) is a no-op
    // whenever the store is already populated, so this can never duplicate
    // a fixture already present.
    const unsubscribe = chatService.subscribeAll(() => {
      if (chatService.getAllSync().length === 0) {
        chatService.restoreDemoFixtures(false);
      }
    });
    return unsubscribe;
  }, [isDemoCustomer, user?.id]);

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

    if (existing) {
      chatId = existing.id;
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
      console.log('[ChatContext] New inquiry chat created:', newChat.id);
    }

    // Push and the in-app notification both fire server-side, from
    // sendChatMessage's own createNotificationInternal call — nothing
    // client-side needs to trigger a push here. A client-scheduled "push"
    // would fire as a local notification on whichever device runs this
    // code, not the recipient's device.
    void chatService.sendMessage({
      chatId,
      type: 'text',
      content: firstMessage,
      sender: 'customer',
    });

    return chatService.getByIdSync(chatId) ?? null;
  }, [isUserBlocked, currentCustomerId, currentCustomerName]);

  const addMessageToChat = useCallback(async (chatId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage | null> => {
    const chatBefore = chatService.getByIdSync(chatId);
    if (!chatBefore) {
      console.log('[ChatContext] addMessageToChat: chat not found:', chatId);
      return null;
    }

    const sent = await chatService.sendMessage({
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

      // Push and the in-app notification both fire server-side from
      // sendChatMessage's own createNotificationInternal call (see the
      // comment in startPreOrderChat above) — nothing to trigger here.
    }

    return sent;
  }, [awayMessage]);

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

  const getOrCreateConversation = useCallback((vendorId: string, vendorName: string, chatType: ChatType = 'pre_order_inquiry', realChatId?: string): Chat => {
    const all = chatService.getAllSync();
    const existing = all.find(
      c => c.vendorId === vendorId && c.customerId === currentCustomerId
    );

    if (existing) {
      console.log('[ChatContext] Found existing conversation for pair:', existing.id, 'vendorId:', vendorId);
      return existing;
    }

    // realChatId is the canonical id createCommerceConversation already
    // created server-side (commerce_{customerId}_{vendorId}). Without it,
    // this fabricated a different, throwaway id that sendChatMessage would
    // then reject with "Chat thread not found" the moment a message was
    // actually sent -- the backend thread and the local scaffold pointed at
    // two different documents. The Date.now() fallback stays only for a
    // caller that has no server thread to attach to yet (demo/local-auth).
    const newChat: Chat = {
      id: realChatId ?? `chat-${vendorId}-${currentCustomerId}-${Date.now()}`,
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

  /**
   * Authoritative thread creation for a customer/vendor pair with no
   * existing conversation yet — the one place that decides how a brand-new
   * commerce thread comes into existence, so every entry point that can
   * land a customer on an empty chat (the storefront's Message Vendor
   * button, a deep link, a notification tap, an item-forward) creates the
   * same real thread the same way instead of each screen reimplementing it.
   *
   * For a real signed-in account, success requires the backend's own
   * createCommerceConversation to succeed — its returned chatId is the only
   * id ever used for the local scaffold, since sendChatMessage rejects any
   * other id outright. A real account gets no local-only fallback on
   * failure: the caller must treat this as "conversation not started," not
   * paper over it with a chat that has nothing behind it server-side.
   * Demo/local-auth accounts keep the pre-existing local-only scaffold,
   * since there is no backend thread to create for those accounts.
   */
  const ensureCommerceThread = useCallback(async (
    vendorId: string,
    vendorName: string,
  ): Promise<EnsureCommerceThreadResult> => {
    const existing = chatService.getAllSync().find(
      c => c.vendorId === vendorId && c.customerId === currentCustomerId
    );
    if (existing) {
      return { success: true, chat: existing, chatId: existing.id };
    }

    const authReady = await waitForAuthReady();
    if (!DEV_LOCAL_AUTH_ENABLED || authReady) {
      try {
        const create = callable<{ vendorId: string }, { success: true; chatId: string; created: boolean }>(
          'createCommerceConversation',
        );
        const res = await create({ vendorId });
        const realChatId = res.data.chatId;
        const chat = getOrCreateConversation(vendorId, vendorName, 'pre_order_inquiry', realChatId);
        return { success: true, chat, chatId: realChatId };
      } catch (err) {
        console.error('[ChatContext] createCommerceConversation failed:', err);
        const message = err instanceof Error ? err.message : 'Could not start conversation. Please try again.';
        return { success: false, error: message };
      }
    }

    const chat = getOrCreateConversation(vendorId, vendorName, 'pre_order_inquiry', undefined);
    return { success: true, chat, chatId: chat.id };
  }, [currentCustomerId, getOrCreateConversation]);

  // Despite the name, this only ever restarts an inquiry inside a
  // conversation that already exists (chatType/vendorCanReply reset +
  // a "New Inquiry" system message) -- it cannot create one from nothing,
  // because doing that correctly means calling createCommerceConversation
  // first and using ITS returned chatId (see getOrCreateConversation's
  // realChatId param / useMessageVendor.ts), which this function has no way
  // to do synchronously. Its one caller (useMessageVendor.ts) only ever
  // invokes this from inside an `if (existing)` branch, so the !existing
  // case below is not reachable today -- kept as a loud failure rather than
  // a silent null so a future caller that skips that guarantee finds out
  // immediately instead of quietly no-opping.
  const startNewInquiry = useCallback((vendorId: string): Chat | null => {
    const existing = chatService.getAllSync().find(
      c => c.vendorId === vendorId && c.customerId === currentCustomerId
    );

    if (!existing) {
      console.error('[ChatContext] startNewInquiry called with no existing conversation for vendorId:', vendorId, '-- this function cannot create one; the caller must already hold a conversation to restart.');
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
    ensureCommerceThread,
    convertToOrderChat,
    startNewInquiry,
  }), [chats, getOrCreatePreOrderChat, addMessageToChat, getPreOrderChat, getChatByPair, getConversationByPair, getCustomerChats, getVendorPreOrderChats, getVendorPreOrderChatByCustomerId, getOrCreateOrderChat, getOrCreateConversation, ensureCommerceThread, convertToOrderChat, startNewInquiry]);
});
