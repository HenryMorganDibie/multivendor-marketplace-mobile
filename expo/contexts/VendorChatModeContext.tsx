import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

export type CustomerChatMode = 'disabled' | 'limited' | 'enabled';

const STORAGE_KEY = 'vendor_customer_chat_mode';

export const [VendorChatModeProvider, useVendorChatMode] = createContextHook(() => {
  const [chatMode, setChatModeState] = useState<CustomerChatMode>('enabled');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadChatMode = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored && ['disabled', 'limited', 'enabled'].includes(stored)) {
          setChatModeState(stored as CustomerChatMode);
        }
      } catch (error) {
        console.log('Error loading chat mode:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadChatMode();
  }, []);

  const setChatMode = useCallback(async (mode: CustomerChatMode) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
      setChatModeState(mode);
      console.log('Chat mode updated to:', mode);
    } catch (error) {
      console.log('Error saving chat mode:', error);
    }
  }, []);

  const getChatModeLabel = useCallback(() => {
    switch (chatMode) {
      case 'disabled':
        return 'Disabled — Orders Only';
      case 'limited':
        return 'Limited — Clarifications Only';
      case 'enabled':
        return 'Enabled — Full Chat';
      default:
        return 'Enabled — Full Chat';
    }
  }, [chatMode]);

  const isChatEnabled = chatMode === 'enabled';
  const isChatLimited = chatMode === 'limited';
  const isChatDisabled = chatMode === 'disabled';

  return {
    chatMode,
    setChatMode,
    getChatModeLabel,
    isChatEnabled,
    isChatLimited,
    isChatDisabled,
    isLoading,
  };
});
