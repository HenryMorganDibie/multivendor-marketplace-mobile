import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/lib/firebase';

function getStorageKey(vendorId: string): string {
  return `todaysNote:${vendorId}`;
}

export const [TodaysNoteProvider, useTodaysNote] = createContextHook(() => {
  const [note, setNote] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const vendorIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onIdTokenChanged(async (user) => {
      if (!user) {
        vendorIdRef.current = null;
        setNote('');
        setIsLoading(false);
        return;
      }

      const token = await user.getIdTokenResult();
      const vendorId = token.claims.vendorId as string | undefined;
      if (!vendorId) {
        vendorIdRef.current = null;
        setNote('');
        setIsLoading(false);
        return;
      }

      vendorIdRef.current = vendorId;
      setIsLoading(true);
      try {
        const stored = await AsyncStorage.getItem(getStorageKey(vendorId));
        setNote(stored ?? '');
      } catch (error) {
        console.error('[TodaysNote] Failed to load note:', error);
      } finally {
        setIsLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const saveNote = useCallback(async (text: string) => {
    const vendorId = vendorIdRef.current;
    if (!vendorId) return;
    try {
      setNote(text);
      await AsyncStorage.setItem(getStorageKey(vendorId), text);
      console.log('[TodaysNote] Note saved:', text.length, 'chars');
    } catch (error) {
      console.error('[TodaysNote] Failed to save note:', error);
    }
  }, []);

  const clearNote = useCallback(async () => {
    const vendorId = vendorIdRef.current;
    if (!vendorId) return;
    try {
      setNote('');
      await AsyncStorage.removeItem(getStorageKey(vendorId));
      console.log('[TodaysNote] Note cleared');
    } catch (error) {
      console.error('[TodaysNote] Failed to clear note:', error);
    }
  }, []);

  return useMemo(() => ({
    note,
    saveNote,
    clearNote,
    isLoading,
  }), [note, saveNote, clearNote, isLoading]);
});
