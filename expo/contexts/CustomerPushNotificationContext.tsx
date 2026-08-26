import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceId } from '@/utils/deviceId';
import { auth, callable } from '@/lib/firebase';

const CUSTOMER_PUSH_TOKEN_KEY = '@the platform_customer_push_token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface CustomerAppState {
  isInApp: boolean;
  currentOrderId?: string;
  currentChatId?: string;
}

export const [CustomerPushNotificationProvider, useCustomerPushNotifications] = createContextHook(() => {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const appState = useRef<CustomerAppState>({ isInApp: false });

  useEffect(() => {
    registerForPushNotifications();

    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('[CustomerPush] Notification received:', notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[CustomerPush] Notification tapped:', response);
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  const registerForPushNotifications = async () => {
    try {
      if (__DEV__) {
        console.log('[CustomerPush] Skipped push registration in development');
        return;
      }

      if (Platform.OS === 'web') {
        console.log('[CustomerPush] Push notifications not supported on web');
        return;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[CustomerPush] Permission not granted');
        setPermissionGranted(false);
        return;
      }

      setPermissionGranted(true);

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'v9dqvin75vxtde3pvf9lz',
      });

      const token = tokenData.data;
      console.log('[CustomerPush] Token obtained:', token);
      setExpoPushToken(token);

      await AsyncStorage.setItem(CUSTOMER_PUSH_TOKEN_KEY, token);

      /**
       * registerPushToken has been deployed since notifications shipped and
       * nothing called it. The token above was obtained from Expo and kept
       * on-device only — the backend's `dispatchPush` reads
       * `users/{uid}/pushTokens`, which stayed empty, so a real push (order
       * accepted, new message) had no token to send to. The in-app "push"
       * seen elsewhere in this file is a local notification the device
       * schedules for itself and is unrelated to this.
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
          console.error('[CustomerPush] registerPushToken failed:', err);
        }
      }

    } catch (error) {
      console.error('[CustomerPush] Registration failed:', error);
    }
  };

  const updateAppState = (updates: Partial<CustomerAppState>) => {
    appState.current = { ...appState.current, ...updates };
    console.log('[CustomerPush] App state updated:', appState.current);
  };

  return {
    expoPushToken,
    permissionGranted,
    registerForPushNotifications,
    updateAppState,
  };
});
