import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENTLY_VIEWED_KEY = '@platform_recently_viewed';
const BROWSING_CATEGORIES_KEY = '@platform_browsing_categories';
const MAX_ENTRIES = 20;
const MAX_CATEGORIES = 30;

export interface BrowsingCategoryEntry {
  category: string;
  vendorId: string;
  viewedAt: string;
}

export interface RecentlyViewedEntry {
  id: string;
  type: 'vendor' | 'item';
  vendorId: string;
  vendorName: string;
  name: string;
  image?: string;
  lastViewedAt: string;
  category?: string;
  rating?: number;
  price?: number;
  username?: string;
}

const defaultRecentlyViewedValue = {
  entries: [] as RecentlyViewedEntry[],
  recentVendors: [] as RecentlyViewedEntry[],
  trackVendorView: (_vendor: {
    id: string;
    username: string;
    name: string;
    bannerImage?: string;
    category: string;
    rating: number;
  }) => {},
  clearRecentlyViewed: () => {},
  recentlyViewedVendorIds: new Set<string>(),
  recentCategoriesViewed: [] as string[],
  browsingCategories: [] as BrowsingCategoryEntry[],
};

export const [RecentlyViewedProviderInner, useRecentlyViewedInner] = createContextHook(() => {
  const [entries, setEntries] = useState<RecentlyViewedEntry[]>([]);
  const [browsingCategories, setBrowsingCategories] = useState<BrowsingCategoryEntry[]>([]);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(RECENTLY_VIEWED_KEY),
      AsyncStorage.getItem(BROWSING_CATEGORIES_KEY),
    ])
      .then(([viewedData, categoriesData]) => {
        if (viewedData) {
          const parsed = JSON.parse(viewedData) as RecentlyViewedEntry[];
          setEntries(parsed);
          console.log('[RECENTLY_VIEWED] Loaded:', parsed.length, 'entries');
        }
        if (categoriesData) {
          const parsed = JSON.parse(categoriesData) as BrowsingCategoryEntry[];
          setBrowsingCategories(parsed);
          console.log('[RECENTLY_VIEWED] Loaded browsing categories:', parsed.length);
        }
      })
      .catch((err) => console.error('[RECENTLY_VIEWED] Failed to load:', err));
  }, []);

  const persist = useCallback((updated: RecentlyViewedEntry[]) => {
    AsyncStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated)).catch((err) =>
      console.error('[RECENTLY_VIEWED] Failed to persist:', err)
    );
  }, []);

  const persistCategories = useCallback((updated: BrowsingCategoryEntry[]) => {
    AsyncStorage.setItem(BROWSING_CATEGORIES_KEY, JSON.stringify(updated)).catch((err) =>
      console.error('[RECENTLY_VIEWED] Failed to persist categories:', err)
    );
  }, []);

  const trackVendorView = useCallback(
    (vendor: {
      id: string;
      username: string;
      name: string;
      bannerImage?: string;
      category: string;
      rating: number;
    }) => {
      console.log('[RECENTLY_VIEWED] Tracking vendor view:', vendor.name, 'category:', vendor.category);
      setEntries((prev) => {
        const entryId = `vendor_${vendor.id}`;
        const filtered = prev.filter((e) => e.id !== entryId);
        const entry: RecentlyViewedEntry = {
          id: entryId,
          type: 'vendor',
          vendorId: vendor.id,
          vendorName: vendor.name,
          name: vendor.name,
          image: vendor.bannerImage,
          lastViewedAt: new Date().toISOString(),
          category: vendor.category,
          rating: vendor.rating,
          username: vendor.username,
        };
        const updated = [entry, ...filtered].slice(0, MAX_ENTRIES);
        persist(updated);
        return updated;
      });

      if (vendor.category) {
        setBrowsingCategories((prev) => {
          const newEntry: BrowsingCategoryEntry = {
            category: vendor.category,
            vendorId: vendor.id,
            viewedAt: new Date().toISOString(),
          };
          const filtered = prev.filter(
            (e) => !(e.vendorId === vendor.id && e.category === vendor.category)
          );
          const updated = [newEntry, ...filtered].slice(0, MAX_CATEGORIES);
          persistCategories(updated);
          return updated;
        });
      }
    },
    [persist, persistCategories]
  );

  const clearRecentlyViewed = useCallback(() => {
    setEntries([]);
    setBrowsingCategories([]);
    AsyncStorage.removeItem(RECENTLY_VIEWED_KEY).catch((err) =>
      console.error('[RECENTLY_VIEWED] Failed to clear:', err)
    );
    AsyncStorage.removeItem(BROWSING_CATEGORIES_KEY).catch((err) =>
      console.error('[RECENTLY_VIEWED] Failed to clear categories:', err)
    );
  }, []);

  const recentlyViewedVendorIds = useMemo(() => {
    return new Set(entries.filter((e) => e.type === 'vendor').map((e) => e.vendorId));
  }, [entries]);

  const recentCategoriesViewed = useMemo(() => {
    const categoryCount = new Map<string, number>();
    browsingCategories.forEach((entry) => {
      categoryCount.set(entry.category, (categoryCount.get(entry.category) || 0) + 1);
    });
    const sorted = Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category);
    console.log('[RECENTLY_VIEWED] Recent categories viewed:', sorted.join(', '));
    return sorted;
  }, [browsingCategories]);

  const sortedEntries = useMemo(() => 
    [...entries].sort(
      (a, b) => new Date(b.lastViewedAt).getTime() - new Date(a.lastViewedAt).getTime()
    ),
    [entries]
  );

  const recentVendors = useMemo(() => 
    sortedEntries.filter((e) => e.type === 'vendor'),
    [sortedEntries]
  );

  return useMemo(() => ({
    entries: sortedEntries,
    recentVendors,
    trackVendorView,
    clearRecentlyViewed,
    recentlyViewedVendorIds,
    recentCategoriesViewed,
    browsingCategories,
  }), [
    sortedEntries,
    recentVendors,
    trackVendorView,
    clearRecentlyViewed,
    recentlyViewedVendorIds,
    recentCategoriesViewed,
    browsingCategories,
  ]);
}, defaultRecentlyViewedValue);

export const RecentlyViewedProvider = RecentlyViewedProviderInner;

export function useRecentlyViewed(): typeof defaultRecentlyViewedValue {
  const value = useRecentlyViewedInner();
  return value ?? defaultRecentlyViewedValue;
}
