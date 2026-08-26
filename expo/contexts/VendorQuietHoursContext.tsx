import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { shouldBypassQuietHours } from '@/utils/vendorNotificationHelper';
import { auth, callable } from '@/lib/firebase';

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

      // This was AsyncStorage-only — dispatchPush (notificationFunctions.ts)
      // genuinely reads and honors a server-side quietHours field, but
      // nothing here ever wrote one, and the shape it expects
      // ({startHour, endHour} as integers) never matched this screen's
      // ({startTime, endTime} as "HH:MM" strings) anyway. Both are fixed by
      // translating and persisting on every change.
      if (auth.currentUser) {
        const [startHour] = updated.startTime.split(':').map(Number);
        const [endHour] = updated.endTime.split(':').map(Number);
        const update = callable<
          { quietHours: { enabled: boolean; startHour: number; endHour: number } },
          { success: true }
        >('updateVendorNotificationPreferences');
        await update({ quietHours: { enabled: updated.enabled, startHour, endHour } }).catch((err) =>
          console.error('[VendorQuietHours] Failed to sync quiet hours to backend:', err)
        );
      }
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
