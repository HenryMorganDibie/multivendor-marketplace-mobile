import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SEARCH_HISTORY_KEY = '@the platform_search_history';
const MAX_HISTORY = 10;

export interface SearchHistoryEntry {
  id: string;
  query: string;
  timestamp: string;
}

export const [SearchProvider, useSearch] = createContextHook(() => {
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(SEARCH_HISTORY_KEY)
      .then(data => {
        if (data) {
          const parsed = JSON.parse(data) as SearchHistoryEntry[];
          setHistory(parsed);
          console.log('[SEARCH] Loaded history:', parsed.length, 'entries');
        }
      })
      .catch(err => console.error('[SEARCH] Failed to load history:', err));
  }, []);

  const persist = useCallback((updated: SearchHistoryEntry[]) => {
    AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated)).catch(err =>
      console.error('[SEARCH] Failed to persist history:', err)
    );
  }, []);

  const addToHistory = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    console.log('[SEARCH] Adding to history:', trimmed);
    setHistory(prev => {
      const filtered = prev.filter(e => e.query.toLowerCase() !== trimmed.toLowerCase());
      const entry: SearchHistoryEntry = {
        id: `search_${Date.now()}`,
        query: trimmed,
        timestamp: new Date().toISOString(),
      };
      const updated = [entry, ...filtered].slice(0, MAX_HISTORY);
      persist(updated);
      return updated;
    });
  }, [persist]);

  const removeFromHistory = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.filter(e => e.id !== id);
      persist(updated);
      return updated;
    });
  }, [persist]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    AsyncStorage.removeItem(SEARCH_HISTORY_KEY).catch(err =>
      console.error('[SEARCH] Failed to clear history:', err)
    );
  }, []);

  return useMemo(() => ({
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
  }), [history, addToHistory, removeFromHistory, clearHistory]);
});
