import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

const AUTO_ACCEPT_KEY = 'vendor_auto_accept_orders';

export const [VendorAutoAcceptProvider, useVendorAutoAccept] = createContextHook(() => {
  const [autoAcceptEnabled, setAutoAcceptEnabled] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const value = await AsyncStorage.getItem(AUTO_ACCEPT_KEY);
      if (value !== null) {
        setAutoAcceptEnabled(value === 'true');
      }
      setIsLoaded(true);
    } catch (error) {
      console.error('Failed to load auto-accept setting:', error);
      setIsLoaded(true);
    }
  };

  const setAutoAccept = async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(AUTO_ACCEPT_KEY, enabled.toString());
      setAutoAcceptEnabled(enabled);
      console.log('Auto-accept orders enabled:', enabled);
    } catch (error) {
      console.error('Failed to save auto-accept setting:', error);
      throw error;
    }
  };

  return {
    autoAcceptEnabled,
    isLoaded,
    setAutoAccept,
  };
});
