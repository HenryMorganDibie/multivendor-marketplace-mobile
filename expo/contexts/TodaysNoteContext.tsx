import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

function getStorageKey(vendorId: string): string {
  return `todaysNote:${vendorId}`;
}

const VENDOR_ID = 'current_vendor';

export const [TodaysNoteProvider, useTodaysNote] = createContextHook(() => {
  const [note, setNote] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadNote = async () => {
      try {
        const key = getStorageKey(VENDOR_ID);
        const stored = await AsyncStorage.getItem(key);
        if (stored !== null) {
          setNote(stored);
        }
      } catch (error) {
        console.error('[TodaysNote] Failed to load note:', error);
      } finally {
        setIsLoading(false);
      }
    };
    void loadNote();
  }, []);

  const saveNote = useCallback(async (text: string) => {
    try {
      const key = getStorageKey(VENDOR_ID);
      setNote(text);
      await AsyncStorage.setItem(key, text);
      console.log('[TodaysNote] Note saved:', text.length, 'chars');
    } catch (error) {
      console.error('[TodaysNote] Failed to save note:', error);
    }
  }, []);

  const clearNote = useCallback(async () => {
    try {
      const key = getStorageKey(VENDOR_ID);
      setNote('');
      await AsyncStorage.removeItem(key);
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
