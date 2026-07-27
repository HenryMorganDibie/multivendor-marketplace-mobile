import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

const AWAY_MESSAGE_KEY = 'vendor_away_message_settings';
export const AWAY_COOLDOWN_MS = 12 * 60 * 60 * 1000;
export const VENDOR_REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

export type AwayScheduleType = 'always' | 'outside_business_hours' | 'custom';

export interface AwayMessageSettings {
  enabled: boolean;
  schedule: AwayScheduleType;
  message: string;
  customScheduleStart: string;
  customScheduleEnd: string;
  cooldownHours: number;
  updatedAt?: string;
  updatedBy?: string;
}

const DEFAULT_SETTINGS: AwayMessageSettings = {
  enabled: false,
  schedule: 'always',
  message: '',
  customScheduleStart: '18:00',
  customScheduleEnd: '09:00',
  cooldownHours: 12,
};

export const [VendorAwayMessageProvider, useVendorAwayMessage] = createContextHook(() => {
  const [settings, setSettings] = useState<AwayMessageSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(AWAY_MESSAGE_KEY);
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      }
      setIsLoaded(true);
      console.log('[AwayMessage] Settings loaded');
    } catch (error) {
      console.error('[AwayMessage] Failed to load settings:', error);
      setIsLoaded(true);
    }
  };

  const updateSettings = useCallback(async (partial: Partial<AwayMessageSettings>) => {
    try {
      const updated = { ...settings, ...partial, updatedAt: new Date().toISOString() };
      await AsyncStorage.setItem(AWAY_MESSAGE_KEY, JSON.stringify(updated));
      setSettings(updated);
      console.log('[AwayMessage] Settings updated:', updated);
    } catch (error) {
      console.error('[AwayMessage] Failed to save settings:', error);
      throw error;
    }
  }, [settings]);

  const isScheduleActive = useCallback((): boolean => {
    const { schedule, customScheduleStart, customScheduleEnd } = settings;

    if (schedule === 'always') return true;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (schedule === 'outside_business_hours') {
      const inBusinessHours = currentMinutes >= 9 * 60 && currentMinutes < 18 * 60;
      return !inBusinessHours;
    }

    if (schedule === 'custom') {
      const [sh, sm] = customScheduleStart.split(':').map(Number);
      const [eh, em] = customScheduleEnd.split(':').map(Number);
      const startMinutes = sh * 60 + sm;
      const endMinutes = eh * 60 + em;

      if (startMinutes <= endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }
    }

    return false;
  }, [settings]);

  const shouldSendAwayMessage = useCallback((
    lastAwayMessageSentAt: string | undefined,
    lastVendorReplyAt: string | undefined
  ): boolean => {
    if (!settings.enabled) {
      console.log('[AwayMessage] Feature disabled, skipping');
      return false;
    }

    if (!settings.message.trim()) {
      console.log('[AwayMessage] No message set, skipping');
      return false;
    }

    if (!isScheduleActive()) {
      console.log('[AwayMessage] Schedule not active, skipping');
      return false;
    }

    if (lastAwayMessageSentAt) {
      const elapsed = Date.now() - new Date(lastAwayMessageSentAt).getTime();
      if (elapsed < AWAY_COOLDOWN_MS) {
        const remainingHours = Math.ceil((AWAY_COOLDOWN_MS - elapsed) / 3600000);
        console.log(`[AwayMessage] Cooldown active, ${remainingHours}h remaining`);
        return false;
      }
    }

    if (lastVendorReplyAt) {
      const elapsed = Date.now() - new Date(lastVendorReplyAt).getTime();
      if (elapsed < VENDOR_REPLY_WINDOW_MS) {
        console.log('[AwayMessage] Vendor replied recently, skipping away message');
        return false;
      }
    }

    console.log('[AwayMessage] All conditions passed, will send');
    return true;
  }, [settings, isScheduleActive]);

  const getScheduleLabel = useCallback((): string => {
    switch (settings.schedule) {
      case 'always':
        return 'Always send';
      case 'outside_business_hours':
        return 'Outside business hours';
      case 'custom':
        return `${formatTime(settings.customScheduleStart)} – ${formatTime(settings.customScheduleEnd)}`;
      default:
        return 'Always send';
    }
  }, [settings]);

  return useMemo(() => ({
    settings,
    isLoaded,
    updateSettings,
    isScheduleActive,
    shouldSendAwayMessage,
    getScheduleLabel,
  }), [settings, isLoaded, updateSettings, isScheduleActive, shouldSendAwayMessage, getScheduleLabel]);
});

export const formatTime = (time: string): string => {
  const [hourStr, minStr] = time.split(':');
  const hour = parseInt(hourStr, 10);
  const min = parseInt(minStr, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(min).padStart(2, '0')} ${period}`;
};
