import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { customerNotificationThrottleService } from '@/utils/customerNotificationThrottle';
import { auth, callable } from '@/lib/firebase';
import type { OrderStatus } from '@/constants/orderStatus';
import { shouldBypassCustomerQuietHours, isWithinQuietHours, CustomerNotificationType } from '@/utils/customerNotificationHelper';

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
          const register = callable<
            { token: string; platform: 'ios' | 'android' | 'web'; appVersion?: string },
            { success: true; tokenId: string }
          >('registerPushToken');
          await register({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android' });
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

  const shouldSuppressPush = (orderId?: string, chatId?: string): boolean => {
    if (!appState.current.isInApp) {
      return false;
    }

    if (orderId && appState.current.currentOrderId === orderId) {
      console.log('[CustomerPush] Suppressing: customer viewing this order');
      return true;
    }

    if (chatId && appState.current.currentChatId === chatId) {
      console.log('[CustomerPush] Suppressing: customer viewing this chat');
      return true;
    }

    return false;
  };

  const sendOrderStatePush = async (params: {
    customerId: string;
    orderId: string;
    vendorName: string;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    customerTimezone?: string;
  }) => {
    console.log('[CustomerPush] sendOrderStatePush called:', params);

    if (shouldSuppressPush(params.orderId)) {
      console.log('[CustomerPush] Suppressed: customer viewing order');
      return;
    }

    const throttleCheck = customerNotificationThrottleService.shouldSendOrderPush(
      params.orderId,
      params.customerId
    );

    if (!throttleCheck.allowed) {
      console.log('[CustomerPush] Throttled:', throttleCheck.reason);
      return;
    }

    let notificationType: CustomerNotificationType;
    let title: string;
    let body: string;

    if (params.fromStatus === 'requested' && params.toStatus === 'accepted') {
      notificationType = 'order_accepted';
      title = 'Order accepted';
      body = `${params.vendorName} accepted your order.`;
    } else if (params.fromStatus === 'accepted' && params.toStatus === 'confirmed') {
      notificationType = 'order_accepted';
      title = 'Payment confirmed';
      body = `${params.vendorName} confirmed your payment.`;
    } else if (params.fromStatus === 'confirmed' && params.toStatus === 'in_progress') {
      notificationType = 'order_preparing';
      title = 'Order in progress';
      body = `${params.vendorName} is fulfilling your order.`;
    } else if (params.toStatus === 'completed') {
      notificationType = 'order_completed';
      title = 'Order completed';
      body = `${params.vendorName} marked your order as completed.`;
    } else if (params.toStatus === 'rejected') {
      notificationType = 'order_cancelled';
      title = 'Order declined';
      body = `${params.vendorName} declined your order request.`;
    } else if (params.toStatus === 'cancelled') {
      notificationType = 'order_cancelled';
      title = 'Order cancelled';
      body = `Your order from ${params.vendorName} was cancelled.`;
    } else {
      console.log('[CustomerPush] No push for this order transition');
      return;
    }

    const inQuietHours = isWithinQuietHours(params.customerTimezone);
    const bypass = shouldBypassCustomerQuietHours(notificationType);

    if (inQuietHours && !bypass) {
      console.log('[CustomerPush] Quiet hours active, push suppressed');
      return;
    }

    console.log('[CustomerPush] Sending notification:', { title, body });

    if (Platform.OS !== 'web' && expoPushToken) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data: {
              orderId: params.orderId,
              vendorName: params.vendorName,
              notificationType,
            },
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null,
        });

        customerNotificationThrottleService.recordOrderPush(params.orderId, params.customerId);

        console.log('[CustomerPush] Order push sent successfully');
      } catch (error) {
        console.error('[CustomerPush] Failed to send:', error);
      }
    } else {
      console.log('[CustomerPush] Simulated (web or no token)');
      customerNotificationThrottleService.recordOrderPush(params.orderId, params.customerId);
    }
  };

  const sendChatMessagePush = async (params: {
    customerId: string;
    chatId: string;
    chatType: 'PREORDER_CHAT' | 'ORDER_CHAT';
    vendorName: string;
    senderRole: 'customer' | 'vendor';
    requiresAction?: boolean;
    customerTimezone?: string;
  }) => {
    console.log('[CustomerPush] sendChatMessagePush called:', params);

    if (params.senderRole !== 'vendor') {
      console.log('[CustomerPush] Skipped: sender is not vendor');
      return;
    }

    if (shouldSuppressPush(undefined, params.chatId)) {
      console.log('[CustomerPush] Suppressed: customer viewing chat');
      return;
    }

    const throttleCheck = customerNotificationThrottleService.shouldSendChatPush(
      params.chatId,
      params.customerId
    );

    if (!throttleCheck.allowed) {
      console.log('[CustomerPush] Throttled:', throttleCheck.reason);
      return;
    }

    let notificationType: CustomerNotificationType;
    let title: string;
    let body: string;

    if (params.requiresAction) {
      notificationType = 'vendor_requires_action';
      title = 'Action needed';
      body = `${params.vendorName} needs your confirmation.`;
    } else if (params.chatType === 'PREORDER_CHAT') {
      notificationType = 'vendor_chat_reply_preorder';
      title = `Message from ${params.vendorName}`;
      body = 'About your inquiry.';
    } else {
      notificationType = 'vendor_chat_reply_order';
      title = `Message from ${params.vendorName}`;
      body = 'About your order.';
    }

    const inQuietHours = isWithinQuietHours(params.customerTimezone);
    const bypass = shouldBypassCustomerQuietHours(notificationType);

    if (inQuietHours && !bypass) {
      console.log('[CustomerPush] Quiet hours active, chat push suppressed');
      return;
    }

    console.log('[CustomerPush] Sending notification:', { title, body });

    if (Platform.OS !== 'web' && expoPushToken) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data: {
              chatId: params.chatId,
              chatType: params.chatType,
              vendorName: params.vendorName,
              notificationType,
            },
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null,
        });

        customerNotificationThrottleService.recordChatPush(params.chatId, params.customerId);

        console.log('[CustomerPush] Chat push sent successfully');
      } catch (error) {
        console.error('[CustomerPush] Failed to send:', error);
      }
    } else {
      console.log('[CustomerPush] Simulated (web or no token)');
      customerNotificationThrottleService.recordChatPush(params.chatId, params.customerId);
    }
  };

  return {
    expoPushToken,
    permissionGranted,
    registerForPushNotifications,
    sendOrderStatePush,
    sendChatMessagePush,
    updateAppState,
  };
});
