import { useCallback, useEffect, useState } from 'react';
import { auth, callable } from '@/lib/firebase';

/**
 * Business Insights, from the backend.
 *
 * getBusinessAnalytics has been deployed since Phase 5 and nothing called it.
 * The screen computed everything itself from whatever orders and invoices the
 * device happened to be holding, which is why it was able to invent storefront
 * visits as `orders * 12 + 47` — a client with no visit data will always be
 * one step away from making one up.
 *
 * The server is the honest source for a second reason: it can see every order,
 * where the device sees only what it has loaded. A repeat-customer rate
 * computed from a partial list is wrong in a way nobody would notice.
 *
 * Anything the platform genuinely cannot measure comes back as
 * `{ dataPending: true }` rather than a number. Conversion and storefront
 * performance are both pending because nothing records a storefront being
 * opened without an order, and a conversion rate is exactly the figure a vendor
 * would change their prices over.
 */

export type Pending = { dataPending: true };

export function isPending<T>(value: T | Pending): value is Pending {
  return Boolean(value) && (value as Pending).dataPending === true;
}

export interface BusinessAnalytics {
  success: true;
  filterRange: string;
  revenueTrend: { label: string; amountMinorUnits: number }[];
  topCustomers: { customerId: string; name: string; orderCount: number }[];
  ordersBySource: { internal: number; external: number };
  platformVsExternalAnalytics: { internal: number; external: number };
  conversionFunnel: Pending;
  storefrontPerformance: Pending;
  customerGrowth: Pending | { newThisPeriod: number; returning: number };
  repeatCustomerAnalytics:
    | Pending
    | { distinctCustomers: number; repeatCustomers: number; repeatRatePercent: number };
  customerSourceBreakdown: Pending;
}

export interface BusinessAnalyticsState {
  data: BusinessAnalytics | null;
  isLoading: boolean;
  /** The backend's message. A plan refusal names the plan needed. */
  error: string | null;
  refresh: () => Promise<void>;
}

export function useBusinessAnalytics(filterRange?: string): BusinessAnalyticsState {
  const [data, setData] = useState<BusinessAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!auth.currentUser) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setError(null);
    try {
      const get = callable<{ filterRange?: string }, BusinessAnalytics>('getBusinessAnalytics');
      const res = await get(filterRange ? { filterRange } : {});
      setData(res.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      /**
       * Right after signup the account is authenticated a moment before the
       * vendor role reaches the token, so this legitimately rejects once.
       * Treating that as a failure would leave a permanent error on the screen
       * of a vendor whose account is fine.
       *
       * A genuine plan refusal is kept, because its message names the plan
       * required and that is worth showing.
       */
      if (/Vendors only|permission-denied/i.test(message) && !/plan/i.test(message)) {
        setData(null);
      } else {
        setError(message || 'Could not load your insights.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [filterRange]);

  useEffect(() => {
    void refresh();
    // The vendor role arrives as a custom claim after registration, which
    // onAuthStateChanged does not fire for. Listening to the token means the
    // insights appear as soon as the role is real.
    const unsub = auth.onIdTokenChanged(() => { void refresh(); });
    return () => unsub();
  }, [refresh]);

  return { data, isLoading, error, refresh };
}
