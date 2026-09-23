import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { callable } from '@/lib/firebase';
import { useVendor } from '@/contexts/VendorContext';

export type FulfillmentMethodType = 'pickup' | 'delivery' | 'shipping';

export interface FulfillmentMethods {
  pickup: boolean;
  delivery: boolean;
  shipping: boolean;
}

export interface FulfillmentSavePayload {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  shippingEnabled: boolean;
  updatedAt: string;
  vendorId: string;
}

const FULFILLMENT_METHODS_KEY = 'vendor_fulfillment_methods';
const FULFILLMENT_PROFILE_KEY = 'vendor_fulfillment_profile';

function methodsToTypes(methods: FulfillmentMethods): FulfillmentMethodType[] {
  const all: FulfillmentMethodType[] = ['pickup', 'delivery', 'shipping'];
  return all.filter((m) => methods[m]);
}

function typesToMethods(types: string[]): FulfillmentMethods {
  return {
    pickup: types.includes('pickup'),
    delivery: types.includes('delivery'),
    shipping: types.includes('shipping'),
  };
}

export const [VendorFulfillmentProvider, useVendorFulfillment] = createContextHook(() => {
  const [fulfillmentMethods, setFulfillmentMethodsState] = useState<FulfillmentMethods>({
    pickup: false,
    delivery: false,
    shipping: false,
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const { vendor, identityStatus } = useVendor();
  const syncedVendorIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadFulfillmentMethods();
  }, []);

  const loadFulfillmentMethods = async () => {
    try {
      const stored = await AsyncStorage.getItem(FULFILLMENT_METHODS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as FulfillmentMethods;
        setFulfillmentMethodsState({
          pickup: Boolean(parsed.pickup),
          delivery: Boolean(parsed.delivery),
          shipping: Boolean(parsed.shipping),
        });
        console.log('[FULFILLMENT] Loaded methods:', parsed);
      } else {
        console.log('[FULFILLMENT] No methods saved, vendor must select at least one');
      }
      setIsLoaded(true);
    } catch (error) {
      console.error('[FULFILLMENT] Failed to load methods:', error);
      setIsLoaded(true);
    }
  };

  /**
   * AsyncStorage above is only the first-frame/offline cache. Once the real
   * vendor doc has actually resolved (identityStatus === 'resolved' -- a
   * confirmed real vendor, not a demo account and not still loading), its
   * vendors/{vendorId}.fulfillmentTypes is authoritative and overwrites
   * whatever the cache held, including correctly representing "never
   * configured" as empty rather than leaving a stale local value in charge.
   * Runs once per resolved vendor id (re-arms on logout/account switch to a
   * different vendor), not on every vendor object change, so it never fights
   * an in-flight optimistic update from setFulfillmentMethods.
   */
  useEffect(() => {
    if (identityStatus !== 'resolved') return;
    if (syncedVendorIdRef.current === vendor.id) return;
    syncedVendorIdRef.current = vendor.id;
    const authoritative = typesToMethods(vendor.fulfillmentTypes ?? []);
    setFulfillmentMethodsState(authoritative);
    AsyncStorage.setItem(FULFILLMENT_METHODS_KEY, JSON.stringify(authoritative)).catch(
      (err) => console.error('[FULFILLMENT] Failed to cache authoritative methods:', err)
    );
  }, [identityStatus, vendor.fulfillmentTypes]);

  const setFulfillmentMethods = async (
    methods: FulfillmentMethods,
    payload?: FulfillmentSavePayload,
  ) => {
    if (!methods.pickup && !methods.delivery && !methods.shipping) {
      throw new Error('At least one fulfillment method is required.');
    }

    const previousMethods = fulfillmentMethods;
    // Optimistic: shown immediately, reconciled back to the previous
    // authoritative value below if the real backend call rejects it.
    setFulfillmentMethodsState(methods);

    try {
      const update = callable<{ fulfillmentTypes: string[] }, { success: true }>('updateVendorSettings');
      await update({ fulfillmentTypes: methodsToTypes(methods) });

      // Cache only after the real save succeeds -- AsyncStorage is a
      // convenience for the next cold start, never the source of truth.
      await AsyncStorage.setItem(FULFILLMENT_METHODS_KEY, JSON.stringify(methods));
      if (payload) {
        await AsyncStorage.setItem(FULFILLMENT_PROFILE_KEY, JSON.stringify(payload));
      }
      console.log('[FULFILLMENT] Methods saved:', payload ?? methods);
    } catch (error) {
      // A rejected backend save must not leave the UI showing the vendor's
      // attempted change as if it had taken effect.
      setFulfillmentMethodsState(previousMethods);
      console.error('[FULFILLMENT] Failed to save methods:', error);
      throw error;
    }
  };

  const getFulfillmentLabel = (): string | null => {
    const enabled: string[] = [];
    if (fulfillmentMethods.pickup) enabled.push('Pickup');
    if (fulfillmentMethods.delivery) enabled.push('Delivery');
    if (fulfillmentMethods.shipping) enabled.push('Shipping');
    
    if (enabled.length === 0) return null;
    if (enabled.length === 1) return enabled[0];
    if (enabled.length === 2) return `${enabled[0]} & ${enabled[1]}`;
    return 'Pickup, Delivery & Shipping';
  };

  const hasFulfillmentMethod = (): boolean => {
    return fulfillmentMethods.pickup || fulfillmentMethods.delivery || fulfillmentMethods.shipping;
  };

  return {
    fulfillmentMethods,
    isLoaded,
    setFulfillmentMethods,
    getFulfillmentLabel,
    hasFulfillmentMethod,
  };
});
