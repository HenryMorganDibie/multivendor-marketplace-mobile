import React, { useState, useEffect, useCallback, useRef } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, onSnapshot, orderBy, query, Timestamp } from 'firebase/firestore';
import { auth, callable, db } from '@/lib/firebase';

export interface SupportMessage {
  id: string;
  type: 'text' | 'system';
  content: string;
  sender: 'vendor' | 'support' | 'system';
  timestamp: string;
}

export interface VendorSupportChat {
  id: string;
  conversationType: 'support';
  createdAt: string;
  lastActivityAt: string;
  messages: SupportMessage[];
  isActive: boolean;
}

const LAST_READ_KEY = 'vendor_support_last_read';

interface CreateTicketResponse {
  success: true;
  ticketId: string;
  chatId: string;
  created: boolean;
}

interface RawMessage {
  messageId: string;
  senderRole: 'customer' | 'vendor' | 'admin' | 'system';
  type: string;
  content: string;
  systemSubtype?: string | null;
  createdAt?: Timestamp | null;
}

function mapMessage(raw: RawMessage): SupportMessage {
  const sender: SupportMessage['sender'] =
    raw.senderRole === 'admin' ? 'support' : raw.senderRole === 'system' ? 'system' : 'vendor';
  return {
    id: raw.messageId,
    type: raw.type === 'system' ? 'system' : 'text',
    content: raw.content,
    sender,
    timestamp: raw.createdAt ? raw.createdAt.toDate().toISOString() : new Date().toISOString(),
  };
}

export const [VendorSupportChatProvider, useVendorSupportChat] = createContextHook(() => {
  const [chatId, setChatId] = useState<string | null>(null);
  const [supportChat, setSupportChat] = useState<VendorSupportChat | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const creatingRef = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(LAST_READ_KEY).then((v) => v && setLastReadAt(v));
  }, []);

  useEffect(() => {
    if (!chatId) return;
    const q = query(collection(db, 'chatThreads', chatId, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const messages = snap.docs.map((d) => mapMessage(d.data() as RawMessage));
      setSupportChat((prev) => ({
        id: chatId,
        conversationType: 'support',
        createdAt: prev?.createdAt ?? new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        messages,
        isActive: true,
      }));
      setIsLoading(false);
    });
    return unsubscribe;
  }, [chatId]);

  const getOrCreateSupportChat = useCallback(async (): Promise<void> => {
    if (chatId || creatingRef.current || !auth.currentUser) return;
    creatingRef.current = true;
    try {
      const createTicket = callable<{ subject: string; initialMessage: string }, CreateTicketResponse>('createSupportTicket');
      const res = await createTicket({ subject: 'Support request', initialMessage: 'Hi, I need help.' });
      setChatId(res.data.chatId);
    } catch (error) {
      console.error('[VendorSupportChat] Failed to create/resume support ticket:', error);
      setIsLoading(false);
    } finally {
      creatingRef.current = false;
    }
  }, [chatId]);

  const hasSupportChat = useCallback((): boolean => {
    return supportChat !== null && supportChat.isActive;
  }, [supportChat]);

  const isSupportChatActive = useCallback((): boolean => {
    return supportChat?.isActive ?? false;
  }, [supportChat]);

  const endSupportChat = useCallback(() => {
    // Ticket resolution happens admin-side (resolveSupportTicket).
  }, []);

  const addMessage = useCallback(async (content: string, _sender: 'vendor' | 'support') => {
    if (!chatId) return;
    try {
      const send = callable<{ chatId: string; type: string; content: string }, unknown>('sendChatMessage');
      await send({ chatId, type: 'text', content });
    } catch (error) {
      console.error('[VendorSupportChat] Failed to send message:', error);
    }
  }, [chatId]);

  const getUnreadCount = useCallback((): number => {
    if (!supportChat) return 0;
    const supportMessages = supportChat.messages.filter((m) => m.sender === 'support');
    if (!lastReadAt) return supportMessages.length;
    return supportMessages.filter((m) => new Date(m.timestamp).getTime() > new Date(lastReadAt).getTime()).length;
  }, [supportChat, lastReadAt]);

  const markSupportAsRead = useCallback(() => {
    const now = new Date().toISOString();
    setLastReadAt(now);
    AsyncStorage.setItem(LAST_READ_KEY, now).catch((err) => console.error('Failed to save lastReadAt:', err));
    if (chatId) {
      const markRead = callable<{ chatId: string }, unknown>('markChatRead');
      markRead({ chatId }).catch((err) => console.error('[VendorSupportChat] markChatRead failed:', err));
    }
  }, [chatId]);

  return {
    supportChat,
    isLoading,
    getOrCreateSupportChat,
    hasSupportChat,
    addMessage,
    getUnreadCount,
    markSupportAsRead,
    endSupportChat,
    isSupportChatActive,
  };
});
