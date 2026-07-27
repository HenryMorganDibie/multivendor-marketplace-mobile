import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { shouldBypassQuietHours } from '@/utils/vendorNotificationHelper';

const QUIET_HOURS_KEY = 'vendor_quiet_hours_settings';

export interface QuietHoursSettings {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

const DEFAULT_SETTINGS: QuietHoursSettings = {
  enabled: true,
  startTime: '22:00',
  endTime: '07:00',
};

export const [VendorQuietHoursProvider, useVendorQuietHours] = createContextHook(() => {
  const [settings, setSettings] = useState<QuietHoursSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(QUIET_HOURS_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
      setIsLoaded(true);
    } catch (error) {
      console.error('Failed to load quiet hours settings:', error);
      setIsLoaded(true);
    }
  };

  const updateSettings = async (newSettings: Partial<QuietHoursSettings>) => {
    try {
      const updated = { ...settings, ...newSettings };
      await AsyncStorage.setItem(QUIET_HOURS_KEY, JSON.stringify(updated));
      setSettings(updated);
      console.log('Quiet hours settings updated:', updated);
    } catch (error) {
      console.error('Failed to save quiet hours settings:', error);
      throw error;
    }
  };

  const shouldSuppressNotification = (notificationType: string): boolean => {
    if (!settings.enabled) {
      return false;
    }

    if (shouldBypassQuietHours(notificationType as any)) {
      return false;
    }

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const [startHour, startMin] = settings.startTime.split(':').map(Number);
    const [endHour, endMin] = settings.endTime.split(':').map(Number);
    const [currentHour, currentMin] = currentTime.split(':').map(Number);

    const currentMinutes = currentHour * 60 + currentMin;
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (startMinutes < endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  };

  return {
    settings,
    isLoaded,
    updateSettings,
    shouldSuppressNotification,
  };
});
