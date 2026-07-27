import type { OrderStatus } from '@/constants/orderStatus';

export interface OrderNotificationPayload {
  orderId: string;
  vendorId: string;
  vendorName: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  trackingLink?: string;
}

// Backend Enforced Rule — UI Display Only
export function shouldTriggerCustomerNotification(
  fromStatus: OrderStatus | null,
  toStatus: OrderStatus
): boolean {
  const notifiableTransitions: { from: OrderStatus | null; to: OrderStatus }[] = [
    { from: 'requested', to: 'accepted' },
    { from: 'accepted', to: 'confirmed' },
    { from: 'confirmed', to: 'in_progress' },
    { from: 'in_progress', to: 'completed' },
    { from: 'requested', to: 'rejected' },
    { from: null, to: 'cancelled' },
    { from: 'requested', to: 'cancelled' },
    { from: 'accepted', to: 'cancelled' },
    { from: 'confirmed', to: 'cancelled' },
    { from: 'in_progress', to: 'cancelled' },
  ];

  return notifiableTransitions.some(
    (t) => t.from === fromStatus && t.to === toStatus
  );
}

export function shouldTriggerVendorNotification(
  fromStatus: OrderStatus | null,
  toStatus: OrderStatus
): boolean {
  return toStatus === 'requested' && fromStatus === null;
}

export function getNotificationActionKey(
  fromStatus: OrderStatus | null,
  toStatus: OrderStatus
): string {
  if (toStatus === 'accepted') return 'order_accepted';
  if (toStatus === 'confirmed') return 'order_confirmed';
  if (toStatus === 'in_progress') return 'order_in_progress';
  if (toStatus === 'completed') return 'order_completed';
  if (toStatus === 'rejected') return 'order_rejected';
  if (toStatus === 'cancelled') return 'order_cancelled';
  if (toStatus === 'requested') return 'new_order';
  return 'order_update';
}
