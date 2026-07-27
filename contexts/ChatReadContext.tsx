import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useEffect } from 'react';
import { mockChats } from '@/mocks/chatData';
import { chatService } from '@/services/chatService';

/**
 * Role of the current viewer for unread scoping.
 *
 * Temporary: until real auth/session is wired, callers pass their role
 * explicitly (customer screens pass 'customer', vendor screens pass 'vendor').
 * When `viewer` is omitted on read APIs we fall back to "either side unread",
 * preserving backward-compat with existing call sites.
 */
export type ChatViewerRole = 'customer' | 'vendor';

interface RoleReadState {
  isRead: boolean;
  readAt?: string;
}

export interface ChatReadStatus {
  chatId: string;
  customer: RoleReadState;
  vendor: RoleReadState;
  lastMessageTimestamp: string;
}

/**
 * Seed read-status entries from the real chat store. Every chat starts as
 * "read" for both roles so badges only light up when a new message lands
 * in-session via `chatService.subscribeAll`.
 *
 * Firebase migration: replace this seed with a server-side per-user
 * `chatReadStates` collection scoped to the current user.
 */
function buildInitialReadStatuses(): ChatReadStatus[] {
  return mockChats.map(c => ({
    chatId: c.id,
    customer: { isRead: true, readAt: c.lastActivityAt },
    vendor: { isRead: true, readAt: c.lastActivityAt },
    lastMessageTimestamp: c.lastActivityAt,
  }));
}

/**
 * Map a message `sender` to which viewer role(s) should be marked unread.
 * - customer message → vendor side gets unread
 * - vendor message   → customer side gets unread
 * - system / ai      → mark the recipient role. Best-effort: system messages
 *   are typically informational for both sides, so we mark BOTH unread.
 */
function recipientRolesForSender(sender: 'customer' | 'vendor' | 'system' | 'ai'): ChatViewerRole[] {
  if (sender === 'customer') return ['vendor'];
  if (sender === 'vendor') return ['customer'];
  return ['customer', 'vendor'];
}

export const [ChatReadProvider, useChatRead] = createContextHook(() => {
  const [chatReadStatuses, setChatReadStatuses] = useState<ChatReadStatus[]>(() => buildInitialReadStatuses());

  /**
   * In-session reactivity: when chatService writes to any chat, bump the
   * chat's `lastMessageTimestamp` and mark the *recipient* side(s) unread
   * based on the latest message sender. The sender's own side stays read.
   */
  useEffect(() => {
    const unsub = chatService.subscribeAll((chatId) => {
      const chat = chatService.getByIdSync(chatId);
      if (!chat) return;
      const lastMsg = chat.messages[chat.messages.length - 1];
      const ts = lastMsg?.timestamp ?? chat.lastActivityAt ?? new Date().toISOString();
      const recipients = lastMsg
        ? recipientRolesForSender(lastMsg.sender)
        : (['customer', 'vendor'] as ChatViewerRole[]);

      setChatReadStatuses(prev => {
        const existing = prev.find(s => s.chatId === chatId);
        const applyRecipients = (state: ChatReadStatus): ChatReadStatus => {
          const next: ChatReadStatus = { ...state, lastMessageTimestamp: ts };
          recipients.forEach(role => {
            next[role] = { isRead: false, readAt: undefined };
          });
          return next;
        };
        if (existing) {
          return prev.map(s => (s.chatId === chatId ? applyRecipients(s) : s));
        }
        const seed: ChatReadStatus = {
          chatId,
          customer: { isRead: true },
          vendor: { isRead: true },
          lastMessageTimestamp: ts,
        };
        return [...prev, applyRecipients(seed)];
      });
    });
    return unsub;
  }, []);

  const isChatUnread = useCallback((chatId: string, viewer?: ChatViewerRole): boolean => {
    const status = chatReadStatuses.find(s => s.chatId === chatId);
    if (!status) return false;
    if (viewer) return !status[viewer].isRead;
    return !status.customer.isRead || !status.vendor.isRead;
  }, [chatReadStatuses]);

  const markChatAsRead = useCallback((chatId: string, viewer?: ChatViewerRole) => {
    const now = new Date().toISOString();
    setChatReadStatuses(prev => {
      const existing = prev.find(s => s.chatId === chatId);
      const applyRead = (state: ChatReadStatus): ChatReadStatus => {
        if (viewer) {
          if (state[viewer].isRead) return state;
          return { ...state, [viewer]: { isRead: true, readAt: now } };
        }
        if (state.customer.isRead && state.vendor.isRead) return state;
        return {
          ...state,
          customer: { isRead: true, readAt: now },
          vendor: { isRead: true, readAt: now },
        };
      };
      if (existing) {
        return prev.map(s => (s.chatId === chatId ? applyRead(s) : s));
      }
      return [
        ...prev,
        applyRead({
          chatId,
          customer: { isRead: true, readAt: now },
          vendor: { isRead: true, readAt: now },
          lastMessageTimestamp: now,
        }),
      ];
    });
  }, []);

  const markChatAsUnread = useCallback((chatId: string, lastMessageTimestamp: string, viewer?: ChatViewerRole) => {
    setChatReadStatuses(prev => {
      const existing = prev.find(s => s.chatId === chatId);
      const applyUnread = (state: ChatReadStatus): ChatReadStatus => {
        const next: ChatReadStatus = { ...state, lastMessageTimestamp };
        if (viewer) {
          next[viewer] = { isRead: false, readAt: undefined };
        } else {
          next.customer = { isRead: false, readAt: undefined };
          next.vendor = { isRead: false, readAt: undefined };
        }
        return next;
      };
      if (existing) {
        return prev.map(s => (s.chatId === chatId ? applyUnread(s) : s));
      }
      return [
        ...prev,
        applyUnread({
          chatId,
          customer: { isRead: true },
          vendor: { isRead: true },
          lastMessageTimestamp,
        }),
      ];
    });
  }, []);

  const getUnreadChatCount = useCallback((chatIds: string[], viewer?: ChatViewerRole): number => {
    return chatIds.filter(chatId => isChatUnread(chatId, viewer)).length;
  }, [isChatUnread]);

  const getTotalUnreadCount = useCallback((viewer?: ChatViewerRole): number => {
    if (viewer) return chatReadStatuses.filter(s => !s[viewer].isRead).length;
    return chatReadStatuses.filter(s => !s.customer.isRead || !s.vendor.isRead).length;
  }, [chatReadStatuses]);

  return {
    isChatUnread,
    markChatAsRead,
    markChatAsUnread,
    getUnreadChatCount,
    getTotalUnreadCount,
  };
});
