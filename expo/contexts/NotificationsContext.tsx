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
      addNotification: customerNotifications.addNotification,
      markAsRead: customerNotifications.markAsRead,
      markAllAsRead: customerNotifications.markAllAsRead,
      clearNotifications: customerNotifications.clearNotifications,
      getUnreadCount: customerNotifications.getUnreadCount,
      notifyOrderSent: customerNotifications.notifyOrderSent,
      notifyOrderAccepted: customerNotifications.notifyOrderAccepted,
      notifyOrderRejected: customerNotifications.notifyOrderRejected,
      notifyOrderReady: customerNotifications.notifyOrderReady,
      notifyPartialPaymentConfirmed: customerNotifications.notifyPartialPaymentConfirmed,
      notifyPaymentConfirmed: customerNotifications.notifyPaymentConfirmed,
      notifyPickupInstructions: customerNotifications.notifyPickupInstructions,
      notifyNewVendorMessage: customerNotifications.notifyNewVendorMessage,
      notifyNewSupportMessage: customerNotifications.notifyNewSupportMessage,
    },
    vendor: {
      notifications: vendorNotifications.notifications,
      isLoading: vendorNotifications.isLoading,
      addNotification: vendorNotifications.addNotification,
      markAsRead: vendorNotifications.markAsRead,
      markAllAsRead: vendorNotifications.markAllAsRead,
      clearNotifications: vendorNotifications.clearNotifications,
      getUnreadCount: vendorNotifications.getUnreadCount,
      unreadHighPriorityCount: vendorNotifications.unreadHighPriorityCount,
      hasUnreadMediumPriority: vendorNotifications.hasUnreadMediumPriority,
      clearOrderBadges: vendorNotifications.clearOrderBadges,
      notifyNewOrder: vendorNotifications.notifyNewOrder,
      notifyCustomerCancelledOrder: vendorNotifications.notifyCustomerCancelledOrder,
      notifyOrderExpired: vendorNotifications.notifyOrderExpired,
      notifyNewCustomerMessage: vendorNotifications.notifyNewCustomerMessage,
      notifyNewSupportMessage: vendorNotifications.notifyNewSupportMessage,
      notifyVerificationRequested: vendorNotifications.notifyVerificationRequested,
      notifyVerificationApproved: vendorNotifications.notifyVerificationApproved,
      notifyVerificationRejected: vendorNotifications.notifyVerificationRejected,
      notifyAccountWarning: vendorNotifications.notifyAccountWarning,
      notifyAccountRestriction: vendorNotifications.notifyAccountRestriction,
    },
    totalCustomerUnread,
    totalVendorUnread,
  }), [customerNotifications, vendorNotifications, totalCustomerUnread, totalVendorUnread]);
});
