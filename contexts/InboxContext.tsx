import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  InboxSnapshot,
  ConversationType,
  OrderStatusType,
  mockCustomerInbox,
  mockVendorInbox,
} from '@/mocks/inboxData';
import { chatService } from '@/services/chatService';
import type { Chat, ChatMessage } from '@/mocks/chatData';

const PAGE_SIZE = 20;

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
  if (m.type === 'catalog_item') return `📦 ${m.catalogItemData?.name ?? 'Catalog item'}`;
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
  const [customerInbox, setCustomerInbox] = useState<InboxSnapshot[]>(mockCustomerInbox);
  const [vendorInbox, setVendorInbox] = useState<InboxSnapshot[]>(mockVendorInbox);
  const [customerPage, setCustomerPage] = useState(1);
  const [vendorPage, setVendorPage] = useState(1);

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

      const apply = (prev: InboxSnapshot[]): InboxSnapshot[] => {
        let changed = false;
        const next = prev.map((item) => {
          if (item.chatId !== chatId) return item;
          if (
            item.lastMessageText === previewText &&
            item.lastMessageAt === ts &&
            item.lastSenderId === senderId
          ) {
            return item;
          }
          changed = true;
          return {
            ...item,
            lastMessageText: previewText,
            lastMessageAt: ts,
            lastSenderId: senderId,
          };
        });
        return changed ? next : prev;
      };

      setCustomerInbox(apply);
      setVendorInbox(apply);
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
  }), [pagedCustomerInbox, pagedVendorInbox, hasMoreCustomer, hasMoreVendor, loadMoreCustomer, loadMoreVendor, markConversationRead, getCustomerUnreadCount, customerUnreadCount, getVendorUnreadCount, vendorUnreadCount, getFilteredCustomerInbox, getFilteredVendorInbox, getOrCreateConversation, updateInboxAfterMessage, convertInboxToOrder, removeFromInbox]);
});
