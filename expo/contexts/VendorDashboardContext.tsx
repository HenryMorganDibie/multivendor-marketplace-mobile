import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { auth, callable } from '@/lib/firebase';

/**
 * Real vendor dashboard figures, from the backend's getVendorDashboard.
 *
 * The dashboard previously derived every KPI from a hardcoded mock order list,
 * which meant a brand-new vendor was shown someone else's business: four
 * orders, a best seller and ₦36.4K of revenue they had never made. Store views
 * were worse — a literal invented formula (orders * 12 + 47) that produced a
 * plausible-looking number with nothing behind it.
 *
 * getVendorDashboard already existed and was already paid for; it had simply
 * never been called. The "Live" figures (orders today, pending, today's
 * revenue, schedule, upcoming) are always returned. Best Seller and the
 * revenue card are plan-gated server-side and come back undefined when the
 * vendor's plan doesn't include them, so the UI must treat absence as "not
 * available on this plan", not as zero.
 */

export interface DashboardScheduleEntry {
  orderId: string;
  publicOrderId: string;
  status: string;
  fulfillmentType: string;
}

export interface VendorDashboardData {
  success: true;
  filterRange: 'today' | 'week' | 'month' | 'year';
  ordersToday: number;
  pendingOrders: number;
  todayRevenue: number;
  upcomingOrders: number;
  todaysSchedule: DashboardScheduleEntry[];
  revenueCard?: { total: number; orderCount: number; range: string };
  bestSeller?: { itemId: string; name: string; quantitySold: number } | null;
}

export const [VendorDashboardProvider, useVendorDashboard] = createContextHook(() => {
  const [data, setData] = useState<VendorDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (filterRange?: string) => {
    if (!auth.currentUser) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setError(null);
    try {
      const getDashboard = callable<{ filterRange?: string }, VendorDashboardData>('getVendorDashboard');
      const res = await getDashboard(filterRange ? { filterRange } : {});
      setData(res.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      // Immediately after signup the vendor role can lag the auth session by a
      // moment; the token listener re-runs this once the claim lands, so this
      // is not a real failure worth showing the vendor.
      if (/Vendors only|permission-denied/i.test(message)) {
        setData(null);
      } else {
        console.error('[VendorDashboard] Failed to load:', err);
        setError("Couldn't load your dashboard figures.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Token rather than auth state: the vendor role arrives as a custom claim
    // via a token refresh, which onAuthStateChanged does not fire for.
    const unsub = auth.onIdTokenChanged(() => {
      void refresh();
    });
    return () => unsub();
  }, [refresh]);

  return useMemo(
    () => ({
      data,
      // Real zeros for a new vendor, never invented numbers. Undefined stays
      // undefined for plan-gated figures so the UI can tell "you have none"
      // apart from "your plan doesn't include this".
      ordersToday: data?.ordersToday ?? 0,
      pendingOrders: data?.pendingOrders ?? 0,
      todayRevenue: data?.todayRevenue ?? 0,
      upcomingOrders: data?.upcomingOrders ?? 0,
      todaysSchedule: data?.todaysSchedule ?? [],
      revenueCard: data?.revenueCard,
      bestSeller: data?.bestSeller ?? null,
      isLoading,
      error,
      refresh,
    }),
    [data, isLoading, error, refresh],
  );
});
