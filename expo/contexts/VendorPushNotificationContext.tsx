import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceId } from '@/utils/deviceId';
import { auth, callable } from '@/lib/firebase';

const VENDOR_PUSH_TOKEN_KEY = '@platform_vendor_push_token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface VendorAppState {
  isInApp: boolean;
  currentChatId?: string;
  currentOrderId?: string;
}

export const [VendorPushNotificationProvider, useVendorPushNotifications] = createContextHook(() => {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const appState = useRef<VendorAppState>({ isInApp: false });

  useEffect(() => {
    registerForPushNotifications();

    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('[VendorPush] Notification received:', notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[VendorPush] Notification tapped:', response);
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  const registerForPushNotifications = async () => {
    try {
      if (__DEV__) {
        console.log('[VendorPush] Skipped push registration in development');
        return;
      }

      if (Platform.OS === 'web') {
        console.log('[VendorPush] Push notifications not supported on web');
        return;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[VendorPush] Permission not granted');
        setPermissionGranted(false);
        return;
      }

      setPermissionGranted(true);

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'v9dqvin75vxtde3pvf9lz',
      });

      const token = tokenData.data;
      console.log('[VendorPush] Token obtained:', token);
      setExpoPushToken(token);

      await AsyncStorage.setItem(VENDOR_PUSH_TOKEN_KEY, token);

      /**
       * registerPushToken has been deployed since notifications shipped and
       * nothing called it. The token above was obtained from Expo and kept
       * on-device only — the backend's `dispatchPush` reads
       * `users/{uid}/pushTokens`, which stayed empty, so a real push (order
       * accepted, new message) had no token to send to. The in-app chat
       * "push" seen elsewhere in this file is a local notification the
       * device schedules for itself and is unrelated to this.
       */
      if (auth.currentUser) {
        try {
          const deviceId = await getDeviceId();
          const register = callable<
            { token: string; platform: 'ios' | 'android' | 'web'; deviceId: string; appVersion?: string },
            { success: true; tokenId: string }
          >('registerPushToken');
          await register({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android', deviceId });
        } catch (err) {
          console.error('[VendorPush] registerPushToken failed:', err);
        }
      }

    } catch (error) {
      console.error('[VendorPush] Registration failed:', error);
    }
  };

  const updateAppState = (updates: Partial<VendorAppState>) => {
    appState.current = { ...appState.current, ...updates };
    console.log('[VendorPush] App state updated:', appState.current);
  };

  return {
    expoPushToken,
    permissionGranted,
    registerForPushNotifications,
    updateAppState,
  };
});
