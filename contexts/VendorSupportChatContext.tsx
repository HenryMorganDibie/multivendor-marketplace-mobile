import React, { useState, useEffect, useCallback } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SupportMessage {
  id: string;
  type: 'text' | 'system';
  content: string;
  sender: 'vendor' | 'support' | 'system';
  timestamp: string;
}

export interface VendorSupportChat {
  id: string;
  createdAt: string;
  lastActivityAt: string;
  messages: SupportMessage[];
  isActive: boolean;
}

const STORAGE_KEY = 'vendor_support_chat';
const LAST_READ_KEY = 'vendor_support_last_read';

const INITIAL_SYSTEM_MESSAGES: SupportMessage[] = [
  {
    id: 'sys-1',
    type: 'system',
    content: 'This chat is with the official the platform Vendor Support team.',
    sender: 'system',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'sys-2',
    type: 'system',
    content: 'Responses may be assisted by AI and reviewed by a human agent.',
    sender: 'system',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'sys-3',
    type: 'system',
    content: 'Never share your password or verification codes.',
    sender: 'system',
    timestamp: new Date().toISOString(),
  },
];

const GREETING_MESSAGE: SupportMessage = {
  id: 'greeting-1',
  type: 'text',
  content: 'Hi! Thanks for contacting the platform Vendor Support. How can we help you today?',
  sender: 'support',
  timestamp: new Date().toISOString(),
};

export const [VendorSupportChatProvider, useVendorSupportChat] = createContextHook(() => {
  const [supportChat, setSupportChat] = useState<VendorSupportChat | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);

  useEffect(() => {
    loadSupportChat();
  }, []);

  const loadSupportChat = async () => {
    try {
      const [stored, storedLastRead] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(LAST_READ_KEY),
      ]);
      if (stored) {
        setSupportChat(JSON.parse(stored));
      }
      if (storedLastRead) {
        setLastReadAt(storedLastRead);
      }
    } catch (error) {
      console.error('Failed to load support chat:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSupportChat = async (chat: VendorSupportChat) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(chat));
    } catch (error) {
      console.error('Failed to save support chat:', error);
    }
  };

  const createSupportChat = useCallback((): VendorSupportChat => {
    const now = new Date().toISOString();
    const newChat: VendorSupportChat = {
      id: 'vendor-support-chat',
      createdAt: now,
      lastActivityAt: now,
      messages: [
        ...INITIAL_SYSTEM_MESSAGES.map((msg, index) => ({
          ...msg,
          timestamp: new Date(Date.now() + index * 100).toISOString(),
        })),
        {
          ...GREETING_MESSAGE,
          timestamp: new Date(Date.now() + 400).toISOString(),
        },
      ],
      isActive: true,
    };
    
    setSupportChat(newChat);
    saveSupportChat(newChat);
    console.log('Created new vendor support chat');
    return newChat;
  }, []);

  const getOrCreateSupportChat = useCallback((): VendorSupportChat => {
    if (supportChat) {
      if (!supportChat.isActive) {
        const reactivated: VendorSupportChat = {
          ...supportChat,
          isActive: true,
          lastActivityAt: new Date().toISOString(),
        };
        setSupportChat(reactivated);
        saveSupportChat(reactivated);
        console.log('Reactivated vendor support chat');
        return reactivated;
      }
      return supportChat;
    }
    return createSupportChat();
  }, [supportChat, createSupportChat]);

  const hasSupportChat = useCallback((): boolean => {
    return supportChat !== null && supportChat.isActive;
  }, [supportChat]);

  const endSupportChat = useCallback(() => {
    if (!supportChat) return;
    
    const endedChat: VendorSupportChat = {
      ...supportChat,
      isActive: false,
      lastActivityAt: new Date().toISOString(),
    };
    
    setSupportChat(endedChat);
    saveSupportChat(endedChat);
    console.log('Support chat ended (marked inactive)');
  }, [supportChat]);

  const isSupportChatActive = useCallback((): boolean => {
    return supportChat?.isActive ?? false;
  }, [supportChat]);

  const addMessage = useCallback((content: string, sender: 'vendor' | 'support') => {
    setSupportChat(prev => {
      if (!prev) return prev;
      
      const newMessage: SupportMessage = {
        id: `msg-${Date.now()}`,
        type: 'text',
        content,
        sender,
        timestamp: new Date().toISOString(),
      };
      
      const updated: VendorSupportChat = {
        ...prev,
        lastActivityAt: new Date().toISOString(),
        messages: [...prev.messages, newMessage],
      };
      
      saveSupportChat(updated);
      return updated;
    });
  }, []);

  const getUnreadCount = useCallback((): number => {
    if (!supportChat) return 0;

    const lastVendorMessageIndex = supportChat.messages
      .map((m, i) => ({ ...m, index: i }))
      .filter(m => m.sender === 'vendor')
      .pop()?.index ?? -1;

    const unreadAfterLastVendorMsg = supportChat.messages
      .slice(lastVendorMessageIndex + 1)
      .filter(m => m.sender === 'support');

    if (lastReadAt) {
      return unreadAfterLastVendorMsg.filter(
        m => new Date(m.timestamp).getTime() > new Date(lastReadAt).getTime()
      ).length;
    }

    return unreadAfterLastVendorMsg.length;
  }, [supportChat, lastReadAt]);

  const markSupportAsRead = useCallback(() => {
    const now = new Date().toISOString();
    setLastReadAt(now);
    AsyncStorage.setItem(LAST_READ_KEY, now).catch(err =>
      console.error('Failed to save lastReadAt:', err)
    );
    console.log('[VendorSupportChat] Marked support as read');
  }, []);

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
