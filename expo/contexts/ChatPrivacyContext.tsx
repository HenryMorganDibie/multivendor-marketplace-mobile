import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@platform_chat_privacy_read_receipts';

export const [ChatPrivacyProvider, useChatPrivacy] = createContextHook(() => {
  const [readReceiptsEnabled, setReadReceiptsEnabledState] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(value => {
        if (value !== null) {
          setReadReceiptsEnabledState(value === 'true');
        }
        setSettingsLoaded(true);
        console.log('[ChatPrivacy] Loaded read receipts setting:', value ?? 'default(true)');
      })
      .catch(err => {
        console.error('[ChatPrivacy] Failed to load setting:', err);
        setSettingsLoaded(true);
      });
  }, []);

  const setReadReceiptsEnabled = useCallback(async (enabled: boolean) => {
    setReadReceiptsEnabledState(enabled);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, String(enabled));
      console.log('[ChatPrivacy] Saved read receipts setting:', enabled);
    } catch (err) {
      console.error('[ChatPrivacy] Failed to save read receipts setting:', err);
    }
  }, []);

  return {
    readReceiptsEnabled,
    setReadReceiptsEnabled,
    settingsLoaded,
  };
});
