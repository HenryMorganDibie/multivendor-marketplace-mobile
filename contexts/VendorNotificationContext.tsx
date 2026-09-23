import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type VendorNotificationType =
  | 'new_order'
  | 'customer_cancelled_order'
  | 'order_expired'
  | 'new_customer_message'
  | 'new_support_message'
  | 'verification_requested'
  | 'verification_approved'
  | 'verification_rejected'
  | 'account_warning'
  | 'account_restriction';

export type NotificationDomain = 'order' | 'vendor_chat' | 'support';

export interface VendorNotification {
  id: string;
  type: VendorNotificationType;
  domain: NotificationDomain;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  fullOrderId?: string;
  orderId?: string;
  actorName: string;
}

const VENDOR_NOTIFICATIONS_STORAGE_KEY = '@platform_vendor_notifications';

export const [VendorNotificationProvider, useVendorNotifications] = createContextHook(() => {
  const [notifications, setNotifications] = useState<VendorNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const stored = await AsyncStorage.getItem(VENDOR_NOTIFICATIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setNotifications(parsed);
      }
    } catch (error) {
      console.error('[VendorNotifications] Failed to load:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;

  const saveNotifications = useCallback(async (updatedNotifications: VendorNotification[]) => {
    try {
      await AsyncStorage.setItem(VENDOR_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updatedNotifications));
    } catch (error) {
      console.error('[VendorNotifications] Failed to save:', error);
    }
  }, []);

  const addNotification = useCallback((notification: Omit<VendorNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: VendorNotification = {
      ...notification,
      id: `vendor_notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };

    console.log('[VendorNotifications] Adding notification:', newNotification.type, newNotification.message);

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
    await AsyncStorage.removeItem(VENDOR_NOTIFICATIONS_STORAGE_KEY);
  }, []);

  const getUnreadCount = useCallback(() => {
    return notificationsRef.current.filter(n => !n.read).length;
  }, []);

  const unreadHighPriorityCount = notifications.filter(
    n => !n.read && (n.type === 'new_order' || n.type === 'customer_cancelled_order')
  ).length;

  const hasUnreadMediumPriority = notifications.some(
    n => !n.read && (n.type === 'new_customer_message' || n.type === 'verification_requested')
  );

  const clearOrderBadges = useCallback(() => {
    setNotifications(prev => {
      const hasUnread = prev.some(n => 
        !n.read && (n.type === 'new_order' || n.type === 'customer_cancelled_order')
      );
      if (!hasUnread) return prev;
      const updated = prev.map(notif => 
        (notif.type === 'new_order' || notif.type === 'customer_cancelled_order') 
          ? { ...notif, read: true } 
          : notif
      );
      saveNotifications(updated);
      return updated;
    });
  }, [saveNotifications]);

  const notifyNewOrder = useCallback((fullOrderId: string, customerName: string) => {
    addNotification({
      type: 'new_order',
      domain: 'order',
      title: 'New order received',
      message: `${customerName} has placed an order.`,
      fullOrderId,
      actorName: customerName,
    });
  }, [addNotification]);

  const notifyCustomerCancelledOrder = useCallback((fullOrderId: string, customerName: string) => {
    addNotification({
      type: 'customer_cancelled_order',
      domain: 'order',
      title: 'Order cancelled',
      message: `${customerName} has cancelled their order.`,
      fullOrderId,
      actorName: customerName,
    });
  }, [addNotification]);

  const notifyOrderExpired = useCallback((fullOrderId: string) => {
    addNotification({
      type: 'order_expired',
      domain: 'order',
      title: 'Order expired',
      message: `Order ${fullOrderId} has expired.`,
      fullOrderId,
      actorName: 'Platform',
    });
  }, [addNotification]);

  const notifyNewCustomerMessage = useCallback((customerName: string, fullOrderId?: string) => {
    addNotification({
      type: 'new_customer_message',
      domain: 'vendor_chat',
      title: 'New message',
      message: `${customerName} has sent you a message.`,
      fullOrderId,
      actorName: customerName,
    });
  }, [addNotification]);

  const notifyNewSupportMessage = useCallback(() => {
    addNotification({
      type: 'new_support_message',
      domain: 'support',
      title: 'New message',
      message: 'Platform Support has sent you a message.',
      actorName: 'Platform Support',
    });
  }, [addNotification]);

  const notifyVerificationRequested = useCallback(() => {
    addNotification({
      type: 'verification_requested',
      domain: 'support',
      title: 'Verification requested',
      message: 'Platform has requested additional verification.',
      actorName: 'Platform',
    });
  }, [addNotification]);

  const notifyVerificationApproved = useCallback(() => {
    addNotification({
      type: 'verification_approved',
      domain: 'support',
      title: 'Verification approved',
      message: 'Platform has approved your verification.',
      actorName: 'Platform',
    });
  }, [addNotification]);

  const notifyVerificationRejected = useCallback((reason: string) => {
    addNotification({
      type: 'verification_rejected',
      domain: 'support',
      title: 'Verification rejected',
      message: `Platform has rejected your verification: ${reason}`,
      actorName: 'Platform',
    });
  }, [addNotification]);

  const notifyAccountWarning = useCallback((warningMessage: string) => {
    addNotification({
      type: 'account_warning',
      domain: 'support',
      title: 'Account warning',
      message: `Platform has issued a warning: ${warningMessage}`,
      actorName: 'Platform',
    });
  }, [addNotification]);

  const notifyAccountRestriction = useCallback((restrictionMessage: string) => {
    addNotification({
      type: 'account_restriction',
      domain: 'support',
      title: 'Account restriction',
      message: `Platform has applied restrictions: ${restrictionMessage}`,
      actorName: 'Platform',
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
    unreadHighPriorityCount,
    hasUnreadMediumPriority,
    clearOrderBadges,
    notifyNewOrder,
    notifyCustomerCancelledOrder,
    notifyOrderExpired,
    notifyNewCustomerMessage,
    notifyNewSupportMessage,
    notifyVerificationRequested,
    notifyVerificationApproved,
    notifyVerificationRejected,
    notifyAccountWarning,
    notifyAccountRestriction,
  };
});
