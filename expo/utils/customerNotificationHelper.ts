export type CustomerNotificationType =
  | 'order_accepted'
  | 'order_preparing'
  | 'order_completed'
  | 'order_cancelled'
  | 'vendor_chat_reply_preorder'
  | 'vendor_chat_reply_order'
  | 'vendor_requires_action'
  | 'payment_alert'
  | 'fulfillment_issue';

export const BYPASS_QUIET_HOURS_TYPES: CustomerNotificationType[] = [
  'order_cancelled',
  'payment_alert',
  'fulfillment_issue',
  'vendor_requires_action',
];

export const shouldBypassCustomerQuietHours = (notificationType: CustomerNotificationType): boolean => {
  return BYPASS_QUIET_HOURS_TYPES.includes(notificationType);
};

export const isWithinQuietHours = (customerTimezone: string = 'America/New_York'): boolean => {
  try {
    const customerTime = new Date().toLocaleString('en-US', {
      timeZone: customerTimezone,
      hour12: false,
    });
    const hour = parseInt(customerTime.split(',')[1].trim().split(':')[0]);
    
    return hour >= 22 || hour < 7;
  } catch (error) {
    console.error('[CustomerQuietHours] Failed to check quiet hours:', error);
    return false;
  }
};
