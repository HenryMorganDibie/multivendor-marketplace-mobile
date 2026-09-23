import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  InboxSnapshot,
  ConversationType,
  OrderStatusType,
  mockCustomerInbox,
  mockVendorInbox,
  MOCK_VENDOR_ID,
  MOCK_CUSTOMER_ID,
} from '@/mocks/inboxData';
import { chatService } from '@/services/chatService';
import type { Chat, ChatMessage } from '@/mocks/chatData';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 20;

/**
 * Chat is still backed by seeded demo threads rather than Firestore. Those
 * threads all belong to the built-in demo accounts, so anyone signing in with
 * a real account must not inherit them: a vendor who registered a minute ago
 * would otherwise open Chat to thirteen conversations with customers they have
 * never had, and a tab badge counting unread messages that were never sent to
 * them.
 *
 * The seed is therefore scoped to the accounts it was written for. Nothing ever
 * signs in *as* `v1` / `customer-001` (those ids only exist inside the mock
 * data), so the local test logins are mapped onto them, otherwise the seed
 * would be unreachable for everyone and the chat screens could not be shown
 * populated at all. Real Firebase uids match nothing and start empty, which is
 * also what the Firestore listener will produce once chat is wired.
 */
const DEMO_INBOX_ACCOUNTS: Record<string, string> = {
  '1': MOCK_CUSTOMER_ID, // customer@test.com
  '2': MOCK_VENDOR_ID, // vendor@test.com
  [MOCK_CUSTOMER_ID]: MOCK_CUSTOMER_ID,
  [MOCK_VENDOR_ID]: MOCK_VENDOR_ID,
};

function seedFor(accountId: string | undefined, demoId: string, seed: InboxSnapshot[]): InboxSnapshot[] {
  if (!accountId) return [];
  return DEMO_INBOX_ACCOUNTS[accountId] === demoId ? seed : [];
}

/** Whether accountId is one of the built-in demo/local-test logins. */
export function isDemoInboxAccount(accountId: string | undefined): boolean {
  return !!accountId && accountId in DEMO_INBOX_ACCOUNTS;
}

/**
 * Derive a list-friendly preview text from the most recent visible message
 * in a chat. Mirrors the logic used by the chat list rows so previews stay
 * consistent across surfaces.
 */
function previewFromMessage(m: ChatMessage | undefined): string {
  if (!m) return '';
  if (m.type === 'system') return m.content;
  if (m.type === 'payment-request') return '💳 Payment request';
  if (m.type === 'contact-card') return '📇 Contact details shared';
  if (m.type === 'catalog_item') return m.catalogItemData?.name ?? 'Catalog item';
  return m.content;
}

function lastVisibleMessage(chat: Chat): ChatMessage | undefined {
  for (let i = chat.messages.length - 1; i >= 0; i -= 1) {
    const m = chat.messages[i];
    if (m.visible_to_user === false) continue;
    return m;
  }
  return undefined;
}

export const [InboxProvider, useInbox] = createContextHook(() => {
  const { user } = useAuth();
  const accountId = user?.id;

  const [customerInbox, setCustomerInbox] = useState<InboxSnapshot[]>(() =>
    seedFor(accountId, MOCK_CUSTOMER_ID, mockCustomerInbox));
  const [vendorInbox, setVendorInbox] = useState<InboxSnapshot[]>(() =>
    seedFor(accountId, MOCK_VENDOR_ID, mockVendorInbox));
  const [customerPage, setCustomerPage] = useState(1);
  const [vendorPage, setVendorPage] = useState(1);
  // Demo accounts are seeded synchronously above, so they're always
  // "hydrated." A real account starts un-hydrated until chatService reports
  // its first backend snapshot (or a cold-start failure) for this identity.
  const [isInboxHydrated, setIsInboxHydrated] = useState<boolean>(() =>
    isDemoInboxAccount(accountId) ? true : chatService.isBackendHydrated());
  const [hasInboxHydrationError, setHasInboxHydrationError] = useState<boolean>(false);

  // The subscribeAll effect below registers once (empty deps) so it never
  // resubscribes, but `user` resolves asynchronously after mount (auth state
  // loads, then role comes off custom claims). A plain closure over `user`
  // would freeze on whatever it was during that first, pre-auth render -
  // null for every real account - so the vendor-side role check inside the
  // callback would compare against null forever and silently discard every
  // new-conversation insert for real vendors. A ref sidesteps that: the
  // callback reads the current value on each call instead of a snapshot
  // from when the effect was created.
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  /**
   * Readiness/error tracking for a real account, sourced from chatService's
   * module-level hydration flags rather than a Context — ChatProvider (the
   * descendant that actually runs the Firestore listener via
   * useBackendChats) can't be consumed by InboxProvider, its ancestor.
   * Re-registers on every identity change so this never reads a stale
   * accountId in its closure; the returned cleanup unsubscribes the old
   * listener before a new one is created, so switching accounts can never
   * leave two of these subscribed at once.
   */
  useEffect(() => {
    if (isDemoInboxAccount(accountId)) {
      setIsInboxHydrated(true);
      setHasInboxHydrationError(false);
      return;
    }

    // Redundant with useBackendChats.ts's own resetBackendHydration call on
    // the same auth transition, deliberately — resetBackendHydration is
    // idempotent, and calling it here too guarantees this effect never
    // reads a stale snapshot left over from the previous identity,
    // regardless of which of the two auth-change effects happens to fire
    // first.
    chatService.resetBackendHydration();

    const recompute = () => {
      setIsInboxHydrated(chatService.isBackendHydrated());
      setHasInboxHydrationError(chatService.isBackendHydrationError());
    };

    recompute();
    const unsub = chatService.subscribeAll(recompute);
    return unsub;
  }, [accountId]);

  // Auth resolves after first render, and the signed-in account can change
  // without the provider unmounting (log out, register, log back in), so the
  // seed is re-evaluated on every identity change rather than only at init.
  useEffect(() => {
    setCustomerInbox(seedFor(accountId, MOCK_CUSTOMER_ID, mockCustomerInbox));
    setVendorInbox(seedFor(accountId, MOCK_VENDOR_ID, mockVendorInbox));
    setCustomerPage(1);
    setVendorPage(1);
  }, [accountId]);

  /**
   * Subscribe to chatService writes. When a chat is written to, find inbox
   * rows whose `chatId` matches and refresh their lastMessageText /
   * lastMessageAt / lastSenderId from the actual chat messages.
   *
   * Unread bump is the recipient-side responsibility and is still driven by
   * `updateInboxAfterMessage` so we do not double-count.
   *
   * Firebase migration: replace this with a parent-level
   * `onSnapshot(chatsCollection)` listener that maps the same chat → inbox
   * projection.
   */
  // Real chatType -> InboxSnapshot.conversationType, matching how the seeded
  // mock data itself classifies conversations (see mockVendorInbox above).
  const conversationTypeFor = (chatType: Chat['chatType']): ConversationType => {
    if (chatType === 'order_chat') return 'order';
    if (chatType === 'ai_help') return 'ai';
    if (chatType === 'support') return 'support';
    return 'inquiry';
  };

  useEffect(() => {
    const unsub = chatService.subscribeAll((chatId) => {
      const chat = chatService.getByIdSync(chatId);
      if (!chat) return;
      const m = lastVisibleMessage(chat);
      if (!m) return;
      const previewText = previewFromMessage(m);
      const ts = m.timestamp ?? chat.lastActivityAt;
      const senderId =
        m.sender === 'customer'
          ? (chat.customerId ?? '')
          : m.sender === 'vendor'
          ? chat.vendorId
          : m.sender;

      // Only a well-formed commerce conversation can be reconciled by
      // (vendorId, customerId) pair — a malformed chat missing either id
      // must never be pair-matched against anything, including another
      // malformed chat, so it falls through to the plain chatId-only path
      // below unchanged.
      const canReconcileByPair =
        (chat.chatType === 'pre_order_inquiry' || chat.chatType === 'order_chat') &&
        !!chat.vendorId && !!chat.customerId;

      // Captured once here, alongside `chat` itself, rather than read live
      // from inside the updater below. A functional state updater's result
      // must depend only on its arguments — reading chatService's mutable
      // backendChatIds Set from inside the updater would make the result
      // depend on whatever the Set holds whenever React actually calls the
      // updater, which isn't guaranteed to be this exact moment (React can
      // defer or batch it, or invoke it twice in development Strict Mode).
      // Freezing the snapshot here removes that dependency.
      const authoritativeIds = chatService.getBackendChatIdsSnapshot();

      const apply = (isVendorSide: boolean) => (prev: InboxSnapshot[]): InboxSnapshot[] => {
        if (canReconcileByPair) {
          const isSamePair = (item: InboxSnapshot) =>
            item.vendorId === chat.vendorId && item.customerId === chat.customerId;
          // Every existing row for this pair, not just the first — an
          // inbox that already picked up a duplicate before this
          // reconciliation existed needs to fully converge in one pass,
          // not merely stop new duplicates from here on.
          const samePairRows = prev.filter(isSamePair);
          const existingAuthoritative = samePairRows.find((r) => authoritativeIds.has(r.chatId ?? ''));
          const incomingIsAuthoritative = authoritativeIds.has(chat.id);

          if (existingAuthoritative && !incomingIsAuthoritative && existingAuthoritative.chatId !== chat.id) {
            // A non-authoritative notification (a local scaffold updating
            // itself) can never override a pair's already-authoritative
            // row — but any stray extra rows for the same pair still
            // collapse down to that one winner.
            if (samePairRows.length === 1) return prev;
            return [...prev.filter((item) => !isSamePair(item)), existingAuthoritative];
          }

          if (samePairRows.length === 0 && isVendorSide !== (userRef.current?.role === 'vendor')) {
            return prev;
          }

          const carryFrom = samePairRows.find((r) => r.chatId === chat.id) ?? existingAuthoritative ?? samePairRows[0];
          if (
            samePairRows.length === 1 &&
            carryFrom?.chatId === chat.id &&
            carryFrom.chatType === chat.chatType &&
            carryFrom.lastMessageText === previewText &&
            carryFrom.lastMessageAt === ts &&
            carryFrom.lastSenderId === senderId
          ) {
            return prev;
          }

          // The incoming chat becomes the one surviving row for this pair,
          // carrying over unreadCount from whichever row already tracked
          // it rather than resetting it just because the winning chatId
          // changed underneath it.
          const winner: InboxSnapshot = {
            conversationId: chat.id,
            chatId: chat.id,
            chatType: chat.chatType,
            conversationType: conversationTypeFor(chat.chatType),
            vendorId: chat.vendorId,
            customerId: chat.customerId ?? '',
            orderId: chat.orderId,
            title: isVendorSide ? (chat.customerName ?? 'Customer') : chat.vendorName,
            lastMessageText: previewText,
            lastMessageType: m.type,
            lastMessageAt: ts,
            lastSenderId: senderId,
            unreadCount: carryFrom?.unreadCount ?? 0,
          };
          return [...prev.filter((item) => !isSamePair(item)), winner];
        }

        // Fallback: the original chatId-only behavior, for malformed
        // commerce chats missing vendorId/customerId and for any
        // non-commerce chatType reaching this point.
        let found = false;
        let changed = false;
        const next = prev.map((item) => {
          if (item.chatId !== chatId) return item;
          found = true;
          if (
            item.lastMessageText === previewText &&
            item.lastMessageType === m.type &&
            item.lastMessageAt === ts &&
            item.lastSenderId === senderId
          ) {
            return item;
          }
          changed = true;
          return {
            ...item,
            lastMessageText: previewText,
            lastMessageType: m.type,
            lastMessageAt: ts,
            lastSenderId: senderId,
          };
        });
        if (found) return changed ? next : prev;

        // Only insert into the side matching the signed-in user's actual
        // role - this callback fires once per chat update regardless of
        // who's signed in, and a chat legitimately absent from, say, the
        // vendor inbox (because this account is a customer) should stay
        // absent there, not gain a row nothing will ever read correctly.
        if (isVendorSide !== (userRef.current?.role === 'vendor')) return prev;

        // A real thread this chatService.subscribeAll notification is about
        // has no row yet - previously this function only patched existing
        // rows, so a real account's inbox (empty seed, per DEMO_INBOX_ACCOUNTS
        // above) never gained a row for any new conversation at all, no
        // matter how many real messages arrived. Insert one from the real
        // Chat data useBackendChats already hydrated into chatService.
        const newRow: InboxSnapshot = {
          conversationId: chat.id,
          chatId: chat.id,
          chatType: chat.chatType,
          conversationType: conversationTypeFor(chat.chatType),
          vendorId: chat.vendorId,
          customerId: chat.customerId ?? '',
          orderId: chat.orderId,
          title: isVendorSide ? (chat.customerName ?? 'Customer') : chat.vendorName,
          lastMessageText: previewText,
          lastMessageType: m.type,
          lastMessageAt: ts,
          lastSenderId: senderId,
          unreadCount: 0,
        };
        return [...prev, newRow];
      };

      setCustomerInbox(apply(false));
      setVendorInbox(apply(true));
    });
    return unsub;
  }, []);

  const sortedCustomerInbox = useMemo(() =>
    [...customerInbox].sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    ),
    [customerInbox]
  );

  const getConversationPriority = useCallback((item: InboxSnapshot): number => {
    if (item.conversationType === 'order' && item.orderStatus === 'requested') {
      return item.unreadCount > 0 ? 6 : 5;
    }
    const activeOrderStatuses: OrderStatusType[] = ['accepted', 'confirmed', 'in_progress'];
    if (item.conversationType === 'order' && item.orderStatus && activeOrderStatuses.includes(item.orderStatus)) {
      return item.unreadCount > 0 ? 4 : 3;
    }
    if (item.conversationType === 'inquiry' && item.unreadCount > 0) {
      return 2;
    }
    if (item.conversationType === 'inquiry') {
      return 1;
    }
    if (item.conversationType === 'order' && item.unreadCount > 0) {
      return 2;
    }
    return 0;
  }, []);

  const sortedVendorInbox = useMemo(() =>
    [...vendorInbox].sort((a, b) => {
      const priorityA = getConversationPriority(a);
      const priorityB = getConversationPriority(b);
      if (priorityB !== priorityA) return priorityB - priorityA;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    }),
    [vendorInbox, getConversationPriority]
  );

  const pagedCustomerInbox = useMemo(
    () => sortedCustomerInbox.slice(0, customerPage * PAGE_SIZE),
    [sortedCustomerInbox, customerPage]
  );

  const pagedVendorInbox = useMemo(
    () => sortedVendorInbox.slice(0, vendorPage * PAGE_SIZE),
    [sortedVendorInbox, vendorPage]
  );

  const hasMoreCustomer = sortedCustomerInbox.length > customerPage * PAGE_SIZE;
  const hasMoreVendor = sortedVendorInbox.length > vendorPage * PAGE_SIZE;

  const loadMoreCustomer = useCallback(() => {
    if (hasMoreCustomer) {
      setCustomerPage(p => p + 1);
    }
  }, [hasMoreCustomer]);

  const loadMoreVendor = useCallback(() => {
    if (hasMoreVendor) {
      setVendorPage(p => p + 1);
    }
  }, [hasMoreVendor]);

  const markConversationRead = useCallback((conversationId: string, role: 'customer' | 'vendor' = 'customer') => {
    if (role === 'customer') {
      setCustomerInbox(prev =>
        prev.map(item =>
          item.conversationId === conversationId ? { ...item, unreadCount: 0 } : item
        )
      );
    } else {
      setVendorInbox(prev =>
        prev.map(item =>
          item.conversationId === conversationId ? { ...item, unreadCount: 0 } : item
        )
      );
    }
  }, []);

  /** Memoized unread counts — not duplicated as callbacks to avoid double computation */
  const customerUnreadCount = useMemo((): number =>
    sortedCustomerInbox.reduce((sum, item) => sum + item.unreadCount, 0),
    [sortedCustomerInbox]
  );

  const vendorUnreadCount = useMemo((): number =>
    sortedVendorInbox.reduce((sum, item) => sum + item.unreadCount, 0),
    [sortedVendorInbox]
  );

  /** @deprecated Use customerUnreadCount value directly */
  const getCustomerUnreadCount = useCallback((): number => customerUnreadCount, [customerUnreadCount]);
  /** @deprecated Use vendorUnreadCount value directly */
  const getVendorUnreadCount = useCallback((): number => vendorUnreadCount, [vendorUnreadCount]);

  const getFilteredCustomerInbox = useCallback(
    (filter: 'all' | 'orders' | 'inquiries'): InboxSnapshot[] => {
      if (filter === 'all') return pagedCustomerInbox;
      if (filter === 'orders') return pagedCustomerInbox.filter(item => item.conversationType === 'order' || item.conversationType === 'custom_order');
      if (filter === 'inquiries') return pagedCustomerInbox.filter(item => item.conversationType === 'inquiry');
      return pagedCustomerInbox;
    },
    [pagedCustomerInbox]
  );

  const getFilteredVendorInbox = useCallback(
    (filter: 'all' | 'orders' | 'inquiries'): InboxSnapshot[] => {
      if (filter === 'all') return pagedVendorInbox;
      if (filter === 'orders') return pagedVendorInbox.filter(item => item.conversationType === 'order' || item.conversationType === 'custom_order');
      if (filter === 'inquiries') return pagedVendorInbox.filter(item => item.conversationType === 'inquiry');
      return pagedVendorInbox;
    },
    [pagedVendorInbox]
  );

  const getOrCreateConversation = useCallback(
    (params: {
      conversationType: ConversationType;
      vendorId: string;
      customerId: string;
      orderId?: string;
      title: string;
      role: 'customer' | 'vendor';
      chatId?: string;
    }): InboxSnapshot => {
      const inbox = params.role === 'customer' ? customerInbox : vendorInbox;

      const existing = inbox.find(item => {
        return (
          item.vendorId === params.vendorId &&
          item.customerId === params.customerId
        );
      });

      if (existing) {
        return existing;
      }

      const newConversation: InboxSnapshot = {
        conversationId: params.chatId ?? `conv-${Date.now()}`,
        chatId: params.chatId,
        chatType: params.conversationType === 'inquiry' ? 'pre_order_inquiry' : 'order_chat',
        conversationType: params.conversationType,
        vendorId: params.vendorId,
        customerId: params.customerId,
        orderId: params.orderId,
        title: params.title,
        lastMessageText: '',
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
        lastSenderId: params.customerId,
      };

      if (params.role === 'customer') {
        setCustomerInbox(prev => [newConversation, ...prev]);
      } else {
        setVendorInbox(prev => [newConversation, ...prev]);
      }

      return newConversation;
    },
    [customerInbox, vendorInbox]
  );

  /**
   * Fan-out-on-write: when a message is sent, update BOTH participants' inbox snapshots.
   * - Sender's inbox: update lastMessageText + lastMessageAt, unreadCount unchanged
   * - Recipient's inbox: update lastMessageText + lastMessageAt, unreadCount incremented
   *
   * senderRole: 'customer' means the customer sent the message (vendor inbox gets unread++)
   *             'vendor'   means the vendor sent the message (customer inbox gets unread++)
   *
   * Note: lastMessageText/lastMessageAt are also kept in sync passively via the
   * chatService.subscribeAll listener above. This explicit call still drives
   * the unread bump and ensures fan-out happens even for inbox rows that do
   * not yet have a `chatId` link.
   */
  const updateInboxAfterMessage = useCallback(
    (params: {
      conversationId: string;
      lastMessageText: string;
      lastSenderId: string;
      senderRole: 'customer' | 'vendor';
    }) => {
      const now = new Date().toISOString();

      const makeSenderUpdater = (item: InboxSnapshot): InboxSnapshot => {
        if (item.conversationId !== params.conversationId) return item;
        return {
          ...item,
          lastMessageText: params.lastMessageText,
          lastMessageAt: now,
          lastSenderId: params.lastSenderId,
        };
      };

      const makeRecipientUpdater = (item: InboxSnapshot): InboxSnapshot => {
        if (item.conversationId !== params.conversationId) return item;
        return {
          ...item,
          lastMessageText: params.lastMessageText,
          lastMessageAt: now,
          lastSenderId: params.lastSenderId,
          unreadCount: item.unreadCount + 1,
        };
      };

      if (params.senderRole === 'customer') {
        setCustomerInbox(prev => prev.map(makeSenderUpdater));
        setVendorInbox(prev => prev.map(makeRecipientUpdater));
      } else {
        setVendorInbox(prev => prev.map(makeSenderUpdater));
        setCustomerInbox(prev => prev.map(makeRecipientUpdater));
      }
    },
    []
  );

  const convertInboxToOrder = useCallback((vendorId: string, customerId: string, orderId: string) => {

    const updateFn = (item: InboxSnapshot): InboxSnapshot => {
      if (item.vendorId === vendorId && item.customerId === customerId) {
        return {
          ...item,
          conversationType: 'order' as ConversationType,
          chatType: 'order_chat',
          orderId,
          lastMessageText: 'Order accepted',
          lastMessageAt: new Date().toISOString(),
        };
      }
      return item;
    };

    setCustomerInbox(prev => prev.map(updateFn));
    setVendorInbox(prev => prev.map(updateFn));
  }, []);

  const removeFromInbox = useCallback((conversationId: string, role: 'customer' | 'vendor' = 'customer') => {
    if (role === 'customer') {
      setCustomerInbox(prev => prev.filter(item => item.conversationId !== conversationId));
    } else {
      setVendorInbox(prev => prev.filter(item => item.conversationId !== conversationId));
    }
  }, []);

  return useMemo(() => ({
    customerInbox: pagedCustomerInbox,
    vendorInbox: pagedVendorInbox,
    // Full, unpaged, already-sorted snapshots -- the same arrays the paged
    // views above slice from. For a surface (Archived Chats) that needs to
    // find a conversation regardless of where it falls in the live tabs'
    // recency page, without touching customerPage/vendorPage or the live
    // tabs' own pagination at all.
    allCustomerInbox: sortedCustomerInbox,
    allVendorInbox: sortedVendorInbox,
    isInboxHydrated,
    hasInboxHydrationError,
    hasMoreCustomer,
    hasMoreVendor,
    loadMoreCustomer,
    loadMoreVendor,
    markConversationRead,
    getCustomerUnreadCount,
    customerUnreadCount,
    getVendorUnreadCount,
    vendorUnreadCount,
    getFilteredCustomerInbox,
    getFilteredVendorInbox,
    getOrCreateConversation,
    updateInboxAfterMessage,
    convertInboxToOrder,
    removeFromInbox,
  }), [pagedCustomerInbox, pagedVendorInbox, sortedCustomerInbox, sortedVendorInbox, isInboxHydrated, hasInboxHydrationError, hasMoreCustomer, hasMoreVendor, loadMoreCustomer, loadMoreVendor, markConversationRead, getCustomerUnreadCount, customerUnreadCount, getVendorUnreadCount, vendorUnreadCount, getFilteredCustomerInbox, getFilteredVendorInbox, getOrCreateConversation, updateInboxAfterMessage, convertInboxToOrder, removeFromInbox]);
});
