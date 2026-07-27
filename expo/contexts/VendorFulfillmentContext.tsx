import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

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

export const [VendorFulfillmentProvider, useVendorFulfillment] = createContextHook(() => {
  const [fulfillmentMethods, setFulfillmentMethodsState] = useState<FulfillmentMethods>({
    pickup: false,
    delivery: false,
    shipping: false,
  });
  const [isLoaded, setIsLoaded] = useState(false);

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

  const setFulfillmentMethods = async (
    methods: FulfillmentMethods,
    payload?: FulfillmentSavePayload,
  ) => {
    if (!methods.pickup && !methods.delivery && !methods.shipping) {
      throw new Error('At least one fulfillment method is required.');
    }

    const previousMethods = fulfillmentMethods;
    setFulfillmentMethodsState(methods);

    try {
      await AsyncStorage.setItem(FULFILLMENT_METHODS_KEY, JSON.stringify(methods));
      if (payload) {
        await AsyncStorage.setItem(FULFILLMENT_PROFILE_KEY, JSON.stringify(payload));
      }
      console.log('[FULFILLMENT] Methods saved:', payload ?? methods);
    } catch (error) {
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
