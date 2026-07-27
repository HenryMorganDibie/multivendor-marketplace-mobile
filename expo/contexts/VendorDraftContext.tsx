import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@vendor_chat_drafts';

interface DraftMap {
  [chatId: string]: string;
}

interface VendorDraftContextType {
  getDraft: (chatId: string) => string;
  saveDraft: (chatId: string, text: string) => Promise<void>;
  clearDraft: (chatId: string) => Promise<void>;
  isLoaded: boolean;
}

const VendorDraftContext = createContext<VendorDraftContextType | undefined>(undefined);

export function VendorDraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setDrafts(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load vendor drafts:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const persistDrafts = async (newDrafts: DraftMap) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newDrafts));
    } catch (error) {
      console.error('Failed to persist vendor drafts:', error);
    }
  };

  const getDraft = useCallback((chatId: string): string => {
    return drafts[chatId] || '';
  }, [drafts]);

  const saveDraft = useCallback(async (chatId: string, text: string) => {
    const trimmedText = text.trim();
    
    setDrafts(prev => {
      const updated = { ...prev };
      
      if (trimmedText === '') {
        delete updated[chatId];
      } else {
        updated[chatId] = trimmedText;
      }
      
      persistDrafts(updated);
      return updated;
    });
  }, []);

  const clearDraft = useCallback(async (chatId: string) => {
    setDrafts(prev => {
      const updated = { ...prev };
      delete updated[chatId];
      persistDrafts(updated);
      return updated;
    });
  }, []);

  return (
    <VendorDraftContext.Provider value={{ getDraft, saveDraft, clearDraft, isLoaded }}>
      {children}
    </VendorDraftContext.Provider>
  );
}

export function useVendorDrafts() {
  const context = useContext(VendorDraftContext);
  if (!context) {
    throw new Error('useVendorDrafts must be used within VendorDraftProvider');
  }
  return context;
}
