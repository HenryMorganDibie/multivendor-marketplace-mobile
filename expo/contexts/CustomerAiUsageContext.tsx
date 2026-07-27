import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { CUSTOMER_AI_MONTHLY_LIMIT } from '@/utils/the platformAiLimits';

/**
 * Customer-side the platform AI reply usage tracking — counts AI replies per
 * customer per vendor per calendar month. The backend will own this as a
 * `customerAiUsage/{customerId}/{vendorId}` document with a monthly counter
 * (Henry's Firestore doc). This context is the local stand-in and is shaped
 * to be a drop-in: `getUsage(vendorId)` returns the current month's count,
 * `recordReply(vendorId)` increments it after a successful AI assistant
 * turn, and `resetIfStale` rolls over the month.
 *
 * Key format: `{customerId}:{YYYY-MM}:{vendorId}` → count.
 * We store the whole map under one AsyncStorage key for simplicity. When
 * the backend lands, the queryFn/mutationFn below are the only things that
 * need to change.
 */

const STORAGE_KEY = 'customer_ai_usage_v1';
const MOCK_CUSTOMER_ID = 'customer-001';

interface UsageRecord {
  /** ISO month key `YYYY-MM` this record belongs to. */
  month: string;
  /** Number of AI replies the customer has received from this vendor this month. */
  count: number;
}

interface UsageMap {
  // key: `${vendorId}` → UsageRecord (scoped to current customer/month at write time)
  [vendorId: string]: UsageRecord;
}

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const [CustomerAiUsageProvider, useCustomerAiUsage] = createContextHook(() => {
  const queryClient = useQueryClient();

  const usageQuery = useQuery({
    queryKey: ['customer-ai-usage', MOCK_CUSTOMER_ID],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (!stored) return {} as UsageMap;
      const parsed = JSON.parse(stored) as UsageMap;
      // Roll over stale month entries on read so expired counters reset.
      const thisMonth = currentMonthKey();
      const rolled: UsageMap = {};
      let needsPersist = false;
      for (const [vendorId, rec] of Object.entries(parsed)) {
        if (rec && rec.month === thisMonth) {
          rolled[vendorId] = rec;
        } else {
          needsPersist = true;
        }
      }
      if (needsPersist) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rolled));
      }
      return rolled;
    },
    staleTime: 0,
  });

  const saveMutation = useMutation({
    mutationFn: async (next: UsageMap) => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-ai-usage', MOCK_CUSTOMER_ID] });
    },
  });

  const map: UsageMap = usageQuery.data ?? {};

  /** Number of AI replies the customer has used for this vendor this month. */
  const getUsage = useCallback(
    (vendorId: string): number => {
      const rec = map[vendorId];
      if (!rec || rec.month !== currentMonthKey()) return 0;
      return rec.count;
    },
    [map]
  );

  /** Remaining AI replies for this vendor this month (never negative). */
  const getRemaining = useCallback(
    (vendorId: string): number => {
      return Math.max(0, CUSTOMER_AI_MONTHLY_LIMIT - getUsage(vendorId));
    },
    [getUsage]
  );

  /** Whether the customer has hit their per-vendor monthly AI limit. */
  const isExhausted = useCallback(
    (vendorId: string): boolean => {
      return getUsage(vendorId) >= CUSTOMER_AI_MONTHLY_LIMIT;
    },
    [getUsage]
  );

  /**
   * Increment the customer's AI reply counter for a vendor. Called after a
   * successful AI assistant turn (i.e. an assistant message was delivered
   * in response to the customer's question). Silent no-op if already at
   * the limit — callers should gate on `isExhausted` before sending.
   */
  const recordReply = useCallback(
    (vendorId: string) => {
      const thisMonth = currentMonthKey();
      const current = map[vendorId];
      const next: UsageMap = {
        ...map,
        [vendorId]: {
          month: thisMonth,
          count: (current && current.month === thisMonth ? current.count : 0) + 1,
        },
      };
      void saveMutation.mutateAsync(next);
    },
    [map, saveMutation]
  );

  return {
    getUsage,
    getRemaining,
    isExhausted,
    recordReply,
    monthlyLimit: CUSTOMER_AI_MONTHLY_LIMIT,
    isLoading: usageQuery.isLoading,
  };
});
