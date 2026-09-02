import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, onSnapshot } from 'firebase/firestore';
import { auth, callable, db } from '@/lib/firebase';

const STORAGE_KEY = '@vendor_chat_drafts';
/** How long to wait after the last keystroke before syncing a draft to the
 * backend. Saving on every keystroke would mean a network call per
 * character; the local AsyncStorage copy (below) already covers the
 * "don't lose it if the app closes right now" case. */
const REMOTE_SAVE_DEBOUNCE_MS = 800;

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
  const remoteSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    loadDrafts();
    return () => {
      Object.values(remoteSaveTimers.current).forEach(clearTimeout);
    };
  }, []);

  /**
   * saveDraft/clearDraft above write to users/{uid}/chatDrafts/{chatId}, but
   * nothing ever read that collection back — a draft restored via
   * loadDrafts() only ever came from this device's own AsyncStorage, so the
   * "follow the vendor across devices" comment on syncDraftToBackend wasn't
   * actually true: a draft typed on device A never appeared on device B.
   * Per the Phase 3 spec (chatDrafts rules), direct client reads are the
   * intended path here (no dedicated getDrafts callable exists) — a plain
   * owner-scoped Firestore query. Merges rather than replaces so an in-flight
   * local edit is never clobbered by an older remote snapshot.
   */
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsubscribe = onSnapshot(
      collection(db, 'users', uid, 'chatDrafts'),
      (snap) => {
        const remote: DraftMap = {};
        snap.forEach((docSnap) => {
          const content = docSnap.data().content as string | undefined;
          if (content) remote[docSnap.id] = content;
        });
        setDrafts((prev) => ({ ...remote, ...prev }));
      },
      (error) => console.error('[VendorDrafts] chatDrafts listener failed:', error)
    );
    return unsubscribe;
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

  /**
   * Drafts only lived in this device's AsyncStorage, so switching devices —
   * or reinstalling — silently lost every message a vendor had half-typed.
   * saveChatDraft/clearChatDraft have been deployed since this context
   * existed; nothing ever called them. The local copy stays as the
   * instant, offline-safe write; the backend call (debounced, so it fires
   * once typing pauses rather than per keystroke) is what makes the draft
   * follow the vendor across devices.
   */
  const syncDraftToBackend = useCallback((chatId: string, text: string) => {
    if (!auth.currentUser) return;
    clearTimeout(remoteSaveTimers.current[chatId]);
    remoteSaveTimers.current[chatId] = setTimeout(() => {
      delete remoteSaveTimers.current[chatId];
      const save = callable<{ chatId: string; content: string }, { success: true; cleared: boolean }>('saveChatDraft');
      save({ chatId, content: text }).catch((err) => {
        console.error('[VendorDrafts] saveChatDraft failed:', err);
      });
    }, REMOTE_SAVE_DEBOUNCE_MS);
  }, []);

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

    syncDraftToBackend(chatId, text);
  }, [syncDraftToBackend]);

  const clearDraft = useCallback(async (chatId: string) => {
    setDrafts(prev => {
      const updated = { ...prev };
      delete updated[chatId];
      persistDrafts(updated);
      return updated;
    });

    clearTimeout(remoteSaveTimers.current[chatId]);
    delete remoteSaveTimers.current[chatId];
    if (auth.currentUser) {
      const clear = callable<{ chatId: string }, { success: true }>('clearChatDraft');
      clear({ chatId }).catch((err) => {
        console.error('[VendorDrafts] clearChatDraft failed:', err);
      });
    }
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
