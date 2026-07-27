export type NotificationType =
  | 'preorder_chat_message'
  | 'order_chat_message'
  | 'new_order'
  | 'order_created_from_preorder'
  | 'payment_alert'
  | 'compliance_alert';

export const BYPASS_QUIET_HOURS_TYPES: NotificationType[] = [
  'new_order',
  'order_created_from_preorder',
  'payment_alert',
  'compliance_alert',
];

export const shouldBypassQuietHours = (notificationType: NotificationType): boolean => {
  return BYPASS_QUIET_HOURS_TYPES.includes(notificationType);
};
