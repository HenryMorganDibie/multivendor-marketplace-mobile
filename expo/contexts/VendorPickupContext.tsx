import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

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

  const savePickupDetails = async (details: PickupDetails) => {
    try {
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
