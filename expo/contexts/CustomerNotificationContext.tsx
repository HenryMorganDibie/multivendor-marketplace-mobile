import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationService } from '@/services/notificationService';

export type CustomerNotificationType = 
  | 'order_sent'
  | 'order_accepted'
  | 'order_rejected'
  | 'order_ready'
  | 'partial_payment_confirmed'
  | 'payment_confirmed'
  | 'pickup_instructions'
  | 'new_vendor_message'
  | 'new_support_message';

export type NotificationDomain = 'order' | 'vendor_chat' | 'support';

export interface CustomerNotification {
  id: string;
  type: CustomerNotificationType;
  domain: NotificationDomain;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  orderId?: string;
  fullOrderId?: string;
  vendorId?: string;
  actorName: string;
  trackingLink?: string;
}

const AUTH_STORAGE_KEY = '@the platform_auth_user';
const NOTIFICATIONS_STORAGE_KEY = '@the platform_customer_notifications';

/**
 * Notifications are owned per-user, mirroring the backend's
 * `users/{uid}/notifications/{notificationId}` structure. The on-device list is
 * namespaced by the signed-in user id so two accounts on one device never share
 * a feed. Falls back to the legacy global key when no user id is available.
 */
async function getCustomerNotificationsKey(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const user = JSON.parse(stored);
      if (user?.id) return `${NOTIFICATIONS_STORAGE_KEY}:${user.id}`;
    }
  } catch (error) {
    console.error('[CustomerNotifications] Failed to resolve per-user key:', error);
  }
  return NOTIFICATIONS_STORAGE_KEY;
}

export const [CustomerNotificationProvider, useCustomerNotifications] = createContextHook(() => {
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      // Read path: notificationService -> notificationRepository -> notificationMapper.
      const feed = await notificationService.getForCurrentUser('customer');
      setNotifications(feed as CustomerNotification[]);
    } catch (error) {
      console.error('[CustomerNotifications] Failed to load:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveNotifications = useCallback(async (updatedNotifications: CustomerNotification[]) => {
    try {
      const key = await getCustomerNotificationsKey();
      await AsyncStorage.setItem(key, JSON.stringify(updatedNotifications));
    } catch (error) {
      console.error('[CustomerNotifications] Failed to save:', error);
    }
  }, []);

  const addNotification = useCallback((notification: Omit<CustomerNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: CustomerNotification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };

    console.log('[CustomerNotifications] Adding notification:', newNotification.type, newNotification.message);

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      saveNotifications(updated);
      return updated;
    });
  }, [saveNotifications]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => {
      const updated = prev.map(notif =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      );
      saveNotifications(updated);
      return updated;
    });
  }, [saveNotifications]);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(notif => ({ ...notif, read: true }));
      saveNotifications(updated);
      return updated;
    });
  }, [saveNotifications]);

  const clearNotifications = useCallback(async () => {
    setNotifications([]);
    const key = await getCustomerNotificationsKey();
    await AsyncStorage.removeItem(key);
  }, []);

  const getUnreadCount = useCallback(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  const notifyOrderSent = useCallback((fullOrderId: string, vendorId: string, vendorName: string) => {
    addNotification({
      type: 'order_sent',
      domain: 'order',
      title: 'Order sent',
      message: `Your order has been sent to ${vendorName}.`,
      fullOrderId,
      vendorId,
      actorName: vendorName,
    });
  }, [addNotification]);

  const notifyOrderAccepted = useCallback((fullOrderId: string, vendorId: string, vendorName: string) => {
    addNotification({
      type: 'order_accepted',
      domain: 'order',
      title: 'Order accepted',
      message: `${vendorName} has accepted your order.`,
      fullOrderId,
      vendorId,
      actorName: vendorName,
    });
  }, [addNotification]);

  const notifyOrderRejected = useCallback((fullOrderId: string, vendorId: string, vendorName: string) => {
    addNotification({
      type: 'order_rejected',
      domain: 'order',
      title: 'Order rejected',
      message: `${vendorName} has declined your order.`,
      fullOrderId,
      vendorId,
      actorName: vendorName,
    });
  }, [addNotification]);

  const notifyOrderReady = useCallback((fullOrderId: string, vendorId: string, vendorName: string) => {
    addNotification({
      type: 'order_ready',
      domain: 'order',
      title: 'Order ready',
      message: `${vendorName} has prepared your order. It's ready!`,
      fullOrderId,
      vendorId,
      actorName: vendorName,
    });
  }, [addNotification]);

  const notifyPartialPaymentConfirmed = useCallback((fullOrderId: string, vendorId: string, vendorName: string, amount: string) => {
    addNotification({
      type: 'partial_payment_confirmed',
      domain: 'order',
      title: 'Partial payment confirmed',
      message: `${vendorName} has confirmed your partial payment of ${amount}.`,
      fullOrderId,
      vendorId,
      actorName: vendorName,
    });
  }, [addNotification]);

  const notifyPaymentConfirmed = useCallback((fullOrderId: string, vendorId: string, vendorName: string, amount: string) => {
    addNotification({
      type: 'payment_confirmed',
      domain: 'order',
      title: 'Payment confirmed',
      message: `${vendorName} has confirmed your payment of ${amount}.`,
      fullOrderId,
      vendorId,
      actorName: vendorName,
    });
  }, [addNotification]);

  const notifyPickupInstructions = useCallback((fullOrderId: string, vendorId: string, vendorName: string, instructions: string) => {
    addNotification({
      type: 'pickup_instructions',
      domain: 'order',
      title: 'Pickup instructions',
      message: `${vendorName} has sent pickup instructions: ${instructions}`,
      fullOrderId,
      vendorId,
      actorName: vendorName,
    });
  }, [addNotification]);

  const notifyNewVendorMessage = useCallback((vendorId: string, vendorName: string, fullOrderId?: string) => {
    addNotification({
      type: 'new_vendor_message',
      domain: 'vendor_chat',
      title: 'New message',
      message: `${vendorName} has sent you a message.`,
      fullOrderId,
      vendorId,
      actorName: vendorName,
    });
  }, [addNotification]);

  const notifyNewSupportMessage = useCallback(() => {
    addNotification({
      type: 'new_support_message',
      domain: 'support',
      title: 'New message',
      message: 'the platform Support has sent you a message.',
      actorName: 'the platform Support',
    });
  }, [addNotification]);

  return {
    notifications,
    isLoading,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    getUnreadCount,
    notifyOrderSent,
    notifyOrderAccepted,
    notifyOrderRejected,
    notifyOrderReady,
    notifyPartialPaymentConfirmed,
    notifyPaymentConfirmed,
    notifyPickupInstructions,
    notifyNewVendorMessage,
    notifyNewSupportMessage,
  };
});
