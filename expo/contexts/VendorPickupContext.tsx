import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { auth, callable } from '@/lib/firebase';
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

  useEffect(() => {
    loadData();
  }, []);

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
