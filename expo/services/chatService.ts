import { Chat, ChatMessage, ChatType, LegacyChatType, mockChats, normalizeChatType } from '@/mocks/chatData';

export interface CreateChatParams {
  vendorId: string;
  vendorName: string;
  customerId: string;
  customerName: string;
  chatType: ChatType | LegacyChatType;
}

export interface SendMessageParams {
  chatId: string;
  type: ChatMessage['type'];
  content: string;
  sender: ChatMessage['sender'];
  contactCardData?: ChatMessage['contactCardData'];
  paymentRequestData?: ChatMessage['paymentRequestData'];
  pickupDetailsData?: ChatMessage['pickupDetailsData'];
  catalogItemData?: ChatMessage['catalogItemData'];
  receiptData?: ChatMessage['receiptData'];
  invoiceData?: ChatMessage['invoiceData'];
  orderContextData?: ChatMessage['orderContextData'];
  changeRequestData?: ChatMessage['changeRequestData'];
  visible_to_user?: boolean;
  /** Optional override for the generated message id (used for stable inquiry markers). */
  idOverride?: string;
  /** Optional override for the timestamp (used to enforce ordering of paired system messages). */
  timestampOverride?: string;
}

/**
 * chatService is the single source of truth for chat persistence.
 * It mutates the shared `mockChats` array in place so that all lookup
 * helpers in mocks/chatData.ts (getChatByOrderId, getChatByVendorId, ...)
 * see the latest data after writes — including across navigation remounts.
 *
 * Read-side unification (Step 4): screens read from chatService /
 * mockChats lookups. Writes via chatService.sendMessage push directly into
 * the same chat object's `messages` array, so subsequent reads on remount
 * see the persisted message without dual-store divergence.
 */
const chats: Chat[] = mockChats;

/**
 * In-session reactivity: lightweight pub/sub keyed by chatId.
 *
 * Why: chatService.sendMessage mutates the shared mockChats array in place.
 * That keeps reads-by-lookup consistent across remounts, but mutation alone
 * cannot drive React re-renders for screens that already mounted with a
 * resolved chat reference. The subscribe API below lets those screens be
 * notified the moment any chatService write touches their active chatId.
 *
 * Firebase migration note: this surface is intentionally tiny so it can be
 * replaced with a Firestore `onSnapshot(chatRef, listener)` subscription
 * without changing screen-level code. `getVersion` doubles as a cheap
 * dependency key for `useMemo` / `useState`-based hooks.
 */
type ChatListener = (chat: Chat) => void;
type AllListener = (chatId: string) => void;
const listenersByChat = new Map<string, Set<ChatListener>>();
const versionsByChat = new Map<string, number>();
const allListeners = new Set<AllListener>();
let globalVersion = 0;

function notifyChat(chatId: string): void {
  const next = (versionsByChat.get(chatId) ?? 0) + 1;
  versionsByChat.set(chatId, next);
  globalVersion += 1;
  const chat = chats.find(c => c.id === chatId);
  if (chat) {
    const set = listenersByChat.get(chatId);
    if (set && set.size > 0) {
      set.forEach(l => {
        try {
          l(chat);
        } catch (err) {
          console.log('[ChatService] listener error:', err);
        }
      });
    }
  }
  if (allListeners.size > 0) {
    allListeners.forEach(l => {
      try {
        l(chatId);
      } catch (err) {
        console.log('[ChatService] all-listener error:', err);
      }
    });
  }
}

export const chatService = {
  /**
   * Subscribe to in-session writes for a specific chatId.
   * Returns an unsubscribe function. Safe to call with an empty chatId
   * (no-op).
   */
  subscribe(chatId: string, listener: ChatListener): () => void {
    if (!chatId) return () => {};
    let set = listenersByChat.get(chatId);
    if (!set) {
      set = new Set();
      listenersByChat.set(chatId, set);
    }
    set.add(listener);
    return () => {
      const s = listenersByChat.get(chatId);
      if (!s) return;
      s.delete(listener);
      if (s.size === 0) listenersByChat.delete(chatId);
    };
  },

  /**
   * Synchronous lookup. Used by hook reads so React effects can
   * read the latest snapshot without awaiting a Promise.
   */
  getByIdSync(chatId: string): Chat | undefined {
    return chats.find(c => c.id === chatId);
  },

  /** Synchronous full-store accessor — shared `mockChats` reference. */
  getAllSync(): Chat[] {
    return chats;
  },

  /**
   * Subscribe to ANY chat-store write. Used by ChatContext to drive a
   * single tick-based re-render across the app without holding a separate
   * useState<Chat[]> copy.
   *
   * Firebase migration: replace with a parent-level snapshot listener
   * (e.g. onSnapshot on the chats collection scoped by user).
   */
  subscribeAll(listener: AllListener): () => void {
    allListeners.add(listener);
    return () => {
      allListeners.delete(listener);
    };
  },

  /** Monotonic global version counter. Bumped on every chat write. */
  getGlobalVersion(): number {
    return globalVersion;
  },

  /**
   * Apply a shallow patch to a chat's metadata (chatType, vendorCanReply,
   * vendorDisabledReason, lastAwayMessageSentAt). Does not touch messages.
   * Always notifies subscribers.
   */
  updateChat(
    chatId: string,
    patch: Partial<Pick<Chat, 'chatType' | 'vendorCanReply' | 'vendorDisabledReason' | 'lastAwayMessageSentAt' | 'lastActivityAt'>>,
  ): Chat | null {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
      console.log('[ChatService] updateChat: chat not found:', chatId);
      return null;
    }
    Object.assign(chat, patch);
    if (!patch.lastActivityAt) {
      chat.lastActivityAt = new Date().toISOString();
    }
    notifyChat(chatId);
    return chat;
  },

  /**
   * Monotonic version counter per chatId. Bumped on every write.
   * Useful as a memo dependency for derived data.
   */
  getVersion(chatId: string): number {
    return versionsByChat.get(chatId) ?? 0;
  },

  async getAll(): Promise<Chat[]> {
    return chats;
  },

  async getById(chatId: string): Promise<Chat | undefined> {
    return chats.find(c => c.id === chatId);
  },

  async getByVendorId(vendorId: string, chatType?: ChatType | LegacyChatType): Promise<Chat[]> {
    const target = chatType ? normalizeChatType(chatType) : undefined;
    return chats.filter(c =>
      c.vendorId === vendorId && (!target || normalizeChatType(c.chatType) === target)
    );
  },

  async getByCustomerId(customerId: string): Promise<Chat[]> {
    return chats.filter(c => c.customerId === customerId);
  },

  async getByCustomerAndVendor(customerId: string, vendorId: string): Promise<Chat | undefined> {
    return chats.find(c => c.customerId === customerId && c.vendorId === vendorId);
  },

  async getPreOrderChat(vendorId: string, customerId: string): Promise<Chat | undefined> {
    return chats.find(c =>
      c.vendorId === vendorId &&
      c.customerId === customerId &&
      normalizeChatType(c.chatType) === 'pre_order_inquiry'
    );
  },

  async create(params: CreateChatParams): Promise<Chat> {
    const newChat: Chat = {
      id: `chat-${params.vendorId}-${params.customerId}-${Date.now()}`,
      vendorId: params.vendorId,
      vendorName: params.vendorName,
      customerId: params.customerId,
      customerName: params.customerName,
      chatType: normalizeChatType(params.chatType),
      messages: [],
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      vendorCanReply: true,
    };

    chats.push(newChat);
    console.log('[ChatService] Created single chat thread:', newChat.id);
    return newChat;
  },

  async getOrCreateByPair(vendorId: string, customerId: string): Promise<Chat | undefined> {
    return chats.find(c =>
      c.vendorId === vendorId && c.customerId === customerId
    );
  },

  async getOrCreate(params: CreateChatParams): Promise<Chat> {
    const existing = await this.getOrCreateByPair(params.vendorId, params.customerId);
    if (existing) {
      console.log('[ChatService] Reusing existing chat thread:', existing.id);
      return existing;
    }

    return this.create(params);
  },

  async sendMessage(params: SendMessageParams): Promise<ChatMessage> {
    const chat = chats.find(c => c.id === params.chatId);
    if (!chat) {
      throw new Error(`Chat not found: ${params.chatId}`);
    }

    const newMessage: ChatMessage = {
      id: params.idOverride ?? `m${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: params.type,
      content: params.content,
      sender: params.sender,
      timestamp: params.timestampOverride ?? new Date().toISOString(),
      contactCardData: params.contactCardData,
      paymentRequestData: params.paymentRequestData,
      pickupDetailsData: params.pickupDetailsData,
      catalogItemData: params.catalogItemData,
      receiptData: params.receiptData,
      invoiceData: params.invoiceData,
      orderContextData: params.orderContextData,
      changeRequestData: params.changeRequestData,
      visible_to_user: params.visible_to_user,
    };

    chat.messages.push(newMessage);
    chat.lastActivityAt = new Date().toISOString();

    console.log('[ChatService] Message sent:', newMessage.id, 'to chat:', params.chatId);
    notifyChat(params.chatId);
    return newMessage;
  },

  async updateChatOrder(chatId: string, _orderId: string, _publicOrderId: string, _orderStatus: string): Promise<Chat | null> {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
      console.error('[ChatService] Chat not found:', chatId);
      return null;
    }
    chat.chatType = 'order_chat';
    chat.lastActivityAt = new Date().toISOString();
    console.log('[ChatService] Updated chat order:', chatId);
    notifyChat(chatId);
    return chat;
  },

  async updateOrderStatus(chatId: string, _orderStatus: string): Promise<Chat | null> {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
      console.error('[ChatService] Chat not found:', chatId);
      return null;
    }
    console.log('[ChatService] Updated order status in chat:', chatId);
    notifyChat(chatId);
    return chat;
  },

  /**
   * Customer-side local clear of chat history.
   *
   * Removes conversational messages (text, contact-card, catalog_item) from the
   * customer's view while preserving system events, payment requests, receipts,
   * invoices and any other order/transaction artifacts. In a real backend this
   * would be implemented as a per-user `hidden_until` timestamp; for the mock
   * we filter in place so reads-by-lookup see the cleared state.
   */
  clearLocalMessages(chatId: string): Chat | null {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
      console.log('[ChatService] clearLocalMessages: chat not found:', chatId);
      return null;
    }
    const preservedTypes: ChatMessage['type'][] = [
      'system',
      'payment-request',
      'receipt',
      'invoice',
      'order_context',
      'change_request',
      'new_inquiry',
    ];
    chat.messages = chat.messages.filter(m => preservedTypes.includes(m.type));
    chat.lastActivityAt = new Date().toISOString();
    console.log('[ChatService] Cleared local messages for chat:', chatId);
    notifyChat(chatId);
    return chat;
  },

  async disableVendorReply(chatId: string, reason: string): Promise<Chat | null> {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
      console.error('[ChatService] Chat not found:', chatId);
      return null;
    }
    chat.vendorCanReply = false;
    chat.vendorDisabledReason = reason;
    console.log('[ChatService] Disabled vendor reply:', chatId);
    notifyChat(chatId);
    return chat;
  },
};
