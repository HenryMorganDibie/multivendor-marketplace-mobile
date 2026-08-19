import createContextHook from '@nkzw/create-context-hook';
import { useMemo } from 'react';
import { useCustomerNotifications } from './CustomerNotificationContext';
import { useVendorNotifications } from './VendorNotificationContext';

export const [NotificationsProvider, useNotifications] = createContextHook(() => {
  const customerNotifications = useCustomerNotifications();
  const vendorNotifications = useVendorNotifications();

  const totalCustomerUnread = useMemo(() => {
    return customerNotifications.notifications.filter(n => !n.read).length;
  }, [customerNotifications.notifications]);

  const totalVendorUnread = useMemo(() => {
    return vendorNotifications.notifications.filter(n => !n.read).length;
  }, [vendorNotifications.notifications]);

  return useMemo(() => ({
    customer: {
      notifications: customerNotifications.notifications,
      isLoading: customerNotifications.isLoading,
      markAsRead: customerNotifications.markAsRead,
      markAllAsRead: customerNotifications.markAllAsRead,
      getUnreadCount: customerNotifications.getUnreadCount,
    },
    vendor: {
      notifications: vendorNotifications.notifications,
      isLoading: vendorNotifications.isLoading,
      markAsRead: vendorNotifications.markAsRead,
      markAllAsRead: vendorNotifications.markAllAsRead,
      getUnreadCount: vendorNotifications.getUnreadCount,
      unreadHighPriorityCount: vendorNotifications.unreadHighPriorityCount,
      hasUnreadMediumPriority: vendorNotifications.hasUnreadMediumPriority,
      clearOrderBadges: vendorNotifications.clearOrderBadges,
    },
    totalCustomerUnread,
    totalVendorUnread,
  }), [customerNotifications, vendorNotifications, totalCustomerUnread, totalVendorUnread]);
});
