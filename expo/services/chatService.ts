import { Chat, ChatMessage, ChatType, LegacyChatType, mockChats, normalizeChatType } from '@/mocks/chatData';
import { auth, callable } from '@/lib/firebase';
import { DEV_LOCAL_AUTH_ENABLED } from '@/constants/devAuth';

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
 * Pristine snapshot of the original demo fixtures.
 *
 * Captured once here, at module load, from `mockChats` before this module
 * (or anything else) has had a chance to mutate it. Each entry is cloned — a
 * fresh `Chat` object plus a fresh `messages` array — so every entry here is
 * a distinct object from anything in `chats`/`mockChats`. `restoreDemoFixtures`
 * below clones AGAIN from these on every restore and replaces `chats`
 * wholesale with the new clones; the objects captured here are never
 * themselves inserted into the mutable runtime store, so nothing a demo
 * session does (sendMessage's `messages.push`, updateChat's `Object.assign`,
 * clearLocalMessages's filter) can ever reach them. Shallow-plus-one is
 * sufficient (not a deep/JSON clone): no code in this module mutates a
 * `ChatMessage`'s fields in place after creation, only whether it's present
 * in a chat's `messages` array.
 */
function cloneChatForDemoRestore(chat: Chat): Chat {
  return { ...chat, messages: [...chat.messages] };
}
const pristineDemoChats: Chat[] = mockChats.map(cloneChatForDemoRestore);

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

/**
 * Whether hydrateFromBackend has landed at least one real snapshot for the
 * currently signed-in identity. A consumer needs this to tell "nothing
 * fetched from the backend yet" apart from "fetched, and genuinely empty" —
 * without it, a cold app load and a real account with zero conversations
 * both look identical (an empty chats array), so the Chats tab has no way
 * to show a loading state instead of "No conversations yet".
 */
let backendHydrated = false;

/**
 * Set only when the real-time listener fails before any successful
 * hydration for the current identity — a cold-start failure. A later,
 * transient failure after real data has already loaded must not set this:
 * the conversations already on screen stay authoritative and visible, and
 * only a first-load failure counts as a user-facing error state.
 */
let backendHydrationError = false;

/**
 * chatIds present in the most recent hydrateFromBackend snapshot — i.e.
 * real, backend-authoritative commerce threads, as opposed to a client-side
 * scaffold id (getOrCreateConversation's fallback for a pair with no
 * backend thread yet). Kept in lockstep with `chats` so a chatId is never
 * queryable as authoritative outside the snapshot that actually contained
 * it. Used by InboxContext to pick a winner when two inbox rows exist for
 * the same vendor/customer pair with different chatIds.
 */
const backendChatIds = new Set<string>();

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
   * Replace the store with threads from the backend.
   *
   * The migration note above describes swapping this store for a Firestore
   * listener. This is that swap, done by hydrating the existing array rather
   * than replacing the module's binding: every screen and lookup holds a
   * reference to this same array, so reassigning it would leave them all
   * pointing at the old contents.
   *
   * Called only when a real session has resolved. The demo logins keep the
   * fixture threads, which is the whole reason they exist.
   */
  hydrateFromBackend(next: Chat[]): void {
    chats.length = 0;
    chats.push(...next);
    globalVersion += 1;
    backendHydrated = true;
    backendHydrationError = false;
    // Rebuilt before the per-chat notify loop below, so any listener a
    // notification reaches in that loop (InboxContext's reconciliation
    // included) already sees every id in `next` as authoritative — no
    // window where a real backend chat is momentarily unrecognized.
    backendChatIds.clear();
    for (const c of next) backendChatIds.add(c.id);
    // One notification per thread, so a screen already mounted on a specific
    // chat re-renders rather than only list-level consumers.
    //
    // allListeners used to get a single call with the literal string '*'
    // instead of a real chat id. ChatContext ignores the argument (tick-based
    // re-render), so that was invisible there, but InboxContext and
    // ChatReadContext both do chatService.getByIdSync(chatId) with whatever
    // this passes them -- getByIdSync('*') is always undefined, so both
    // silently no-op on every single backend sync. A vendor's real inbox
    // never gained a row for a new conversation and unread/read-receipt
    // tracking never updated for a real chat, no matter how many messages
    // arrived; only a manually-triggered per-chat write (updateChat,
    // sendMessage, etc., which already call notifyChat with a real id) ever
    // reached them. Real ids fix both without either file needing to change.
    for (const c of next) {
      versionsByChat.set(c.id, (versionsByChat.get(c.id) ?? 0) + 1);
      listenersByChat.get(c.id)?.forEach(fn => fn(c));
      allListeners.forEach(fn => fn(c.id));
    }
    // The loop above never runs for a genuinely empty snapshot, so a
    // consumer that only cares about hydration state (not any specific
    // chat, e.g. a "has the first sync landed yet" check) would never hear
    // about a real, successful, zero-result snapshot. Fires unconditionally
    // using the same '*' sentinel already handled everywhere allListeners
    // is consumed.
    allListeners.forEach(fn => fn('*'));
  },

  /** True once hydrateFromBackend has landed a snapshot for the current identity. */
  isBackendHydrated(): boolean {
    return backendHydrated;
  },

  /** True only for a cold-start hydration failure — see backendHydrationError above. */
  isBackendHydrationError(): boolean {
    return backendHydrationError;
  },

  /**
   * Clears the store and its hydration state for a clean slate on every
   * auth identity change (sign-out, sign-in, switching accounts). Safe to
   * call more than once in a row.
   */
  resetBackendHydration(): void {
    chats.length = 0;
    backendHydrated = false;
    backendHydrationError = false;
    backendChatIds.clear();
    globalVersion += 1;
    allListeners.forEach(fn => fn('*'));
  },

  /**
   * Repopulate the store with a fresh clone of the pristine demo fixtures
   * (see `pristineDemoChats` above). Callers are expected to gate this on a
   * recognized demo account — this method has no notion of who is signed
   * in. Never touches backendHydrated/backendHydrationError/backendChatIds:
   * a demo session is never "backend hydrated", exactly as before this
   * method existed.
   *
   * Exists because `resetBackendHydration` above wipes this same store
   * (`chats.length = 0`, `chats` and `mocks/chatData.ts`'s exported
   * `mockChats` are the same array object) on every Firebase auth-state
   * callback — including the very first one at app boot, before any login
   * at all, since a demo login never touches Firebase Auth. With nothing to
   * refill it, every seeded demo chat's message history would be gone the
   * instant the app starts, regardless of whether a demo session ever
   * begins.
   *
   * `force: true` — use exactly once, when a session freshly becomes a
   * recognized demo account (cold launch into demo, or switching from a
   * real account or a different demo account into this one): always
   * replaces whatever is currently in `chats`, so a prior session's
   * locally-added messages never survive into this one.
   *
   * `force: false` (default) — use on an ordinary store-change notification
   * while already in a demo session: only restores when the store is empty,
   * i.e. right after some `resetBackendHydration` call wiped it. A
   * non-empty store is left completely alone, so this can never duplicate a
   * fixture or clobber a message the demo session already sent locally.
   */
  restoreDemoFixtures(force = false): void {
    if (!force && chats.length > 0) return;
    chats.length = 0;
    chats.push(...pristineDemoChats.map(cloneChatForDemoRestore));
    globalVersion += 1;
    allListeners.forEach(fn => fn('*'));
  },

  /**
   * Whether `chatId` was present in the most recent `hydrateFromBackend`
   * snapshot for the current identity -- see `backendChatIds` above.
   */
  isBackendChatId(chatId: string): boolean {
    return backendChatIds.has(chatId);
  },

  /**
   * A defensive copy of `backendChatIds` at the moment of the call -- not
   * the live backing Set. Callers that need to make an authority decision
   * inside a React functional state updater must capture this once, at the
   * same event boundary where the triggering chat itself is captured, and
   * consult that frozen copy from inside the updater instead of querying
   * `isBackendChatId` there directly. `backendChatIds` can be mutated by a
   * later `hydrateFromBackend`/`resetBackendHydration` call at any point
   * before React actually invokes a previously-scheduled updater (no
   * synchronous-execution guarantee exists for that), so reading the live
   * Set from inside an updater makes it depend on mutable state outside its
   * arguments -- this snapshot removes that dependency instead of relying
   * on scheduler timing.
   */
  getBackendChatIdsSnapshot(): ReadonlySet<string> {
    return new Set(backendChatIds);
  },

  /**
   * Records a cold-start hydration failure -- only when no successful
   * hydration has happened yet for the current identity. A later, transient
   * failure after real data has already loaded must not flip this (and
   * therefore must not replace already-visible conversations with an error
   * screen), so this is a deliberate no-op once `backendHydrated` is true.
   */
  markBackendHydrationError(): void {
    if (backendHydrated) return;
    backendHydrationError = true;
    allListeners.forEach(fn => fn('*'));
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

    /**
     * A real session sends through the backend, which is the only path that
     * puts the message in the other person's conversation. Pushing into the
     * local array alone meant the vendor saw their own reply and the customer
     * never received it.
     *
     * Nothing is written locally on that path: the message listener brings the
     * server's copy back, with the id and timestamp the server assigned.
     * Appending here as well would show the message twice until the snapshot
     * arrived and replaced it.
     *
     * Only the three client-creatable kinds go through here. Invoices,
     * receipts, order context and change requests are assembled server-side by
     * the functions that own them — sendInvoiceInChat posts an invoice card —
     * because a client that could write those could fabricate a demand for
     * money.
     */
    if (!DEV_LOCAL_AUTH_ENABLED || auth.currentUser) {
      const send = callable<Record<string, unknown>, { success: true; messageId: string }>(
        'sendChatMessage',
      );
      const res = await send({
        chatId: params.chatId,
        type: params.type,
        content: params.content,
        contactCardData: params.contactCardData ?? null,
        // sendChatMessage (backend) requires catalogItemData.itemId and looks
        // the real item up server-side itself — it never trusts a
        // client-supplied name/price. The app's own CatalogItemData shape
        // calls that same field `id` (it also doubles as the shape rendered
        // messages carry, post-mapChatDoc translation), so it's renamed here
        // rather than sent as-is, which the backend would reject with
        // "catalogItemData.itemId is required."
        catalogItemData: params.catalogItemData?.id
          ? { itemId: params.catalogItemData.id }
          : null,
      });

      return {
        id: res.data.messageId,
        type: params.type,
        content: params.content,
        sender: params.sender,
        timestamp: new Date().toISOString(),
        status: 'sent',
      };
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

  /**
   * markChatRead exists correctly server-side (writes the read receipt and
   * flips unread messages to status: "read") but nothing ever called it —
   * every chat screen hardcoded message status locally instead, so read
   * state never actually reached the server or crossed devices/users.
   */
  async markRead(chatId: string, lastReadMessageId?: string): Promise<void> {
    if (DEV_LOCAL_AUTH_ENABLED && !auth.currentUser) return;
    try {
      const mark = callable<{ chatId: string; lastReadMessageId?: string }, { success: true }>('markChatRead');
      await mark({ chatId, lastReadMessageId });
    } catch (err) {
      console.error('[ChatService] markChatRead failed:', err);
    }
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
