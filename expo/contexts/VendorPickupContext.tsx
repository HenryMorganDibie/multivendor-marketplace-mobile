import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, callable, db } from '@/lib/firebase';
import { DEV_LOCAL_AUTH_ENABLED } from '@/constants/devAuth';

interface BusinessArea {
  city: string;
  state: string;
  country: string;
}

interface PickupDetails {
  streetAddress: string;
  unit: string;
  instructions: string;
  contactPhone: string;
  verificationCode: string;
  businessArea: BusinessArea;
}

const PICKUP_DETAILS_KEY = 'vendor_pickup_details';
const AUTO_SEND_KEY = 'vendor_auto_send_pickup';

export const [VendorPickupProvider, useVendorPickup] = createContextHook(() => {
  const [pickupDetails, setPickupDetails] = useState<PickupDetails>({
    streetAddress: '',
    unit: '',
    instructions: '',
    contactPhone: '',
    verificationCode: '',
    businessArea: {
      city: 'Toronto',
      state: 'Ontario',
      country: 'Canada',
    },
  });
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setVendorId(null);
        return;
      }
      const tokenResult = await user.getIdTokenResult();
      setVendorId((tokenResult.claims.vendorId as string | undefined) ?? null);
    });
    return unsubscribeAuth;
  }, []);

  // Real-time read-back from vendors/{vendorId}/settings/pickup - the same
  // doc updateVendorPickupSettings writes to. Previously this only read from
  // AsyncStorage, so pickup details set on another device (or restored after
  // a reinstall) never showed here even though the save itself was already
  // real and server-side.
  useEffect(() => {
    if (!vendorId) return;
    const ref = doc(db, 'vendors', vendorId, 'settings', 'pickup');
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as {
        pickupAddress?: { streetAddress: string; unit: string; businessArea: BusinessArea };
        pickupInstructions?: string;
        pickupContactPhone?: string;
        pickupVerificationCode?: string;
        autoSendPickupDetailsEnabled?: boolean;
      };
      setPickupDetails((prev) => ({
        streetAddress: data.pickupAddress?.streetAddress ?? prev.streetAddress,
        unit: data.pickupAddress?.unit ?? prev.unit,
        businessArea: data.pickupAddress?.businessArea ?? prev.businessArea,
        instructions: data.pickupInstructions ?? prev.instructions,
        contactPhone: data.pickupContactPhone ?? prev.contactPhone,
        verificationCode: data.pickupVerificationCode ?? prev.verificationCode,
      }));
      if (data.autoSendPickupDetailsEnabled !== undefined) {
        setAutoSendEnabled(data.autoSendPickupDetailsEnabled);
      }
    }, (error) => console.error('[VendorPickup] settings listener failed:', error));
    return unsubscribe;
  }, [vendorId]);

  const loadData = async () => {
    try {
      const [detailsJson, autoSendValue] = await Promise.all([
        AsyncStorage.getItem(PICKUP_DETAILS_KEY),
        AsyncStorage.getItem(AUTO_SEND_KEY),
      ]);

      if (detailsJson) {
        setPickupDetails(JSON.parse(detailsJson));
      }

      if (autoSendValue !== null) {
        setAutoSendEnabled(autoSendValue === 'true');
      }

      setIsLoaded(true);
    } catch (error) {
      console.error('Failed to load pickup details:', error);
      setIsLoaded(true);
    }
  };

  /**
   * updateVendorPickupSettings has been deployed since pickup instructions
   * shipped and nothing called it — this saved to AsyncStorage only, so
   * pickup details never reached the server, and the away/auto-send message
   * flows that read pickup settings server-side (sendPickupDetails,
   * createCommerceConversation's greeting path) never saw what a vendor
   * actually typed.
   *
   * The server call happens before the local write: the backend's own
   * validation (instructions length, auto-send enable-guard) is what should
   * decide whether this save is allowed, not the client's mirror of that
   * logic — so a rejection here must not have already been written locally.
   */
  const savePickupDetails = async (details: PickupDetails) => {
    try {
      if (!DEV_LOCAL_AUTH_ENABLED || auth.currentUser) {
        const update = callable<
          {
            pickupAddress: { streetAddress: string; unit: string; businessArea: BusinessArea };
            pickupInstructions: string;
            pickupContactPhone: string;
            pickupVerificationCode: string;
          },
          { success: true }
        >('updateVendorPickupSettings');
        await update({
          pickupAddress: {
            streetAddress: details.streetAddress,
            unit: details.unit,
            businessArea: details.businessArea,
          },
          pickupInstructions: details.instructions,
          pickupContactPhone: details.contactPhone,
          pickupVerificationCode: details.verificationCode,
        });
      }
      await AsyncStorage.setItem(PICKUP_DETAILS_KEY, JSON.stringify(details));
      setPickupDetails(details);
      console.log('Pickup details saved:', details);
    } catch (error) {
      console.error('Failed to save pickup details:', error);
      throw error;
    }
  };

  const setAutoSend = async (enabled: boolean) => {
    try {
      if (!DEV_LOCAL_AUTH_ENABLED || auth.currentUser) {
        const update = callable<{ autoSendPickupDetailsEnabled: boolean }, { success: true }>(
          'updateVendorPickupSettings',
        );
        await update({ autoSendPickupDetailsEnabled: enabled });
      }
      await AsyncStorage.setItem(AUTO_SEND_KEY, enabled.toString());
      setAutoSendEnabled(enabled);
      console.log('Auto-send pickup enabled:', enabled);
    } catch (error) {
      console.error('Failed to save auto-send setting:', error);
      throw error;
    }
  };

  const hasPickupDetails = () => {
    return pickupDetails.streetAddress.trim().length > 0 && pickupDetails.instructions.trim().length > 0;
  };

  const validateAddressInBusinessArea = (address: string, city: string): boolean => {
    const lowerAddress = address.toLowerCase();
    const lowerCity = city.toLowerCase();
    return lowerAddress.includes(lowerCity);
  };

  return {
    pickupDetails,
    autoSendEnabled,
    isLoaded,
    savePickupDetails,
    setAutoSend,
    hasPickupDetails,
    validateAddressInBusinessArea,
  };
});
