import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'favorite_vendors';

export const [FavoritesProvider, useFavorites] = createContextHook(() => {
  const [favoriteVendorIds, setFavoriteVendorIds] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const ids: string[] = JSON.parse(stored);
          setFavoriteVendorIds(new Set(ids));
          console.log('[Favorites] Loaded', ids.length, 'favorite vendors');
        }
      } catch (err) {
        console.error('[Favorites] Failed to load favorites:', err);
      } finally {
        setIsLoaded(true);
      }
    };
    load();
  }, []);

  const persist = useCallback(async (ids: Set<string>) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
    } catch (err) {
      console.error('[Favorites] Failed to persist favorites:', err);
    }
  }, []);

  const isFavorite = useCallback(
    (vendorId: string) => favoriteVendorIds.has(vendorId),
    [favoriteVendorIds]
  );

  const toggleFavorite = useCallback(
    (vendorId: string) => {
      setFavoriteVendorIds((prev) => {
        const next = new Set(prev);
        if (next.has(vendorId)) {
          next.delete(vendorId);
          console.log('[Favorites] Removed vendor:', vendorId);
        } else {
          next.add(vendorId);
          console.log('[Favorites] Added vendor:', vendorId);
        }
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const addFavorite = useCallback(
    (vendorId: string) => {
      setFavoriteVendorIds((prev) => {
        if (prev.has(vendorId)) return prev;
        const next = new Set(prev);
        next.add(vendorId);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const removeFavorite = useCallback(
    (vendorId: string) => {
      setFavoriteVendorIds((prev) => {
        if (!prev.has(vendorId)) return prev;
        const next = new Set(prev);
        next.delete(vendorId);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return {
    favoriteVendorIds,
    isFavorite,
    toggleFavorite,
    addFavorite,
    removeFavorite,
    isLoaded,
  };
});
