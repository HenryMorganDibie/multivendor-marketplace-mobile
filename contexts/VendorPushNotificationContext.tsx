import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationThrottleService } from '@/utils/notificationThrottle';

const VENDOR_PUSH_TOKEN_KEY = '@the platform_vendor_push_token';

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

    } catch (error) {
      console.error('[VendorPush] Registration failed:', error);
    }
  };

  const updateAppState = (updates: Partial<VendorAppState>) => {
    appState.current = { ...appState.current, ...updates };
    console.log('[VendorPush] App state updated:', appState.current);
  };

  const shouldSuppressPush = (chatId: string): boolean => {
    if (!appState.current.isInApp) {
      return false;
    }

    if (appState.current.currentChatId === chatId) {
      console.log('[VendorPush] Suppressing: vendor viewing this chat');
      return true;
    }

    return false;
  };

  const sendChatMessagePush = async (params: {
    vendorId: string;
    chatId: string;
    chatType: 'PREORDER_CHAT' | 'ORDER_CHAT';
    senderRole: 'customer' | 'vendor';
    notificationType?: string;
    shouldSuppressQuietHours?: (notificationType: string) => boolean;
  }) => {
    console.log('[VendorPush] sendChatMessagePush called:', params);

    if (params.senderRole !== 'customer') {
      console.log('[VendorPush] Skipped: sender is not customer');
      return;
    }

    if (shouldSuppressPush(params.chatId)) {
      console.log('[VendorPush] Suppressed: vendor viewing chat');
      return;
    }

    const throttleCheck = notificationThrottleService.shouldSendPush(
      params.chatId,
      params.vendorId
    );

    if (!throttleCheck.allowed) {
      console.log('[VendorPush] Throttled:', throttleCheck.reason);
      return;
    }

    if (params.shouldSuppressQuietHours && params.notificationType) {
      const shouldSuppress = params.shouldSuppressQuietHours(params.notificationType);
      if (shouldSuppress) {
        console.log('[VendorPush] Quiet hours active, message suppressed');
        return;
      }
    }

    const title =
      params.chatType === 'PREORDER_CHAT'
        ? 'New customer inquiry'
        : 'Customer message';

    const body =
      params.chatType === 'PREORDER_CHAT'
        ? 'You received a new preorder message.'
        : 'Regarding an active order.';

    console.log('[VendorPush] Sending notification:', { title, body });

    if (Platform.OS !== 'web' && expoPushToken) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data: {
              chatId: params.chatId,
              chatType: params.chatType,
              vendorId: params.vendorId,
            },
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null,
        });

        notificationThrottleService.recordPush(params.chatId, params.vendorId);

        console.log('[VendorPush] Push sent successfully');
      } catch (error) {
        console.error('[VendorPush] Failed to send:', error);
      }
    } else {
      console.log('[VendorPush] Simulated (web or no token)');
      notificationThrottleService.recordPush(params.chatId, params.vendorId);
    }
  };

  return {
    expoPushToken,
    permissionGranted,
    registerForPushNotifications,
    sendChatMessagePush,
    updateAppState,
  };
});
