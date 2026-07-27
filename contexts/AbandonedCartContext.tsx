import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useMemo, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useCart } from './CartContext';
import { mockVendors } from '@/mocks/vendorData';
import type { VendorCart } from './CartContext';

const ABANDONED_CART_DELAY_MS = 20 * 60 * 1000;
const ABANDONED_CART_NOTIFICATION_TYPE = 'abandoned_cart';

export interface AbandonedCartNotificationData {
  type: typeof ABANDONED_CART_NOTIFICATION_TYPE;
  vendorId: string;
  vendorName: string;
}

export function isAbandonedCartNotification(data: unknown): data is AbandonedCartNotificationData {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>).type === ABANDONED_CART_NOTIFICATION_TYPE
  );
}

export const [AbandonedCartProvider, useAbandonedCart] = createContextHook(() => {
  const { allVendorCarts } = useCart();
  const scheduledIds = useRef<Record<string, string>>({});
  const prevCartsRef = useRef<VendorCart[]>([]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      console.log('[AbandonedCart] Skipping on web');
      return;
    }

    const prevCarts = prevCartsRef.current;
    const currentCarts = allVendorCarts;
    prevCartsRef.current = currentCarts;

    const processCart = async (cart: VendorCart) => {
      const { vendorId, vendorName, items, lastUpdated, status } = cart;

      const existingId = scheduledIds.current[vendorId];
      if (existingId) {
        try {
          await Notifications.cancelScheduledNotificationAsync(existingId);
          console.log('[AbandonedCart] Cancelled previous notification for vendor:', vendorId);
        } catch {
          // Already fired or invalid
        }
        delete scheduledIds.current[vendorId];
      }

      if (items.length === 0 || status === 'submitted' || status === 'abandoned') {
        console.log('[AbandonedCart] Skipping vendor (empty/submitted/abandoned):', vendorId);
        return;
      }

      const vendor = mockVendors.find((v) => v.id === vendorId);
      if (vendor?.storeStatus === 'closed') {
        console.log('[AbandonedCart] Skipping: vendor store is manually closed:', vendorId);
        return;
      }

      const now = Date.now();
      const triggerTime = lastUpdated + ABANDONED_CART_DELAY_MS;
      const delayMs = triggerTime - now;

      if (delayMs <= 0) {
        console.log('[AbandonedCart] Cart already past abandonment window, skipping:', vendorId);
        return;
      }

      const delaySeconds = Math.floor(delayMs / 1000);
      console.log(`[AbandonedCart] Scheduling notification for "${vendorName}" in ${Math.floor(delaySeconds / 60)}m ${delaySeconds % 60}s`);

      try {
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: `Still craving something from ${vendorName}?`,
            body: 'Finish your order before items sell out.',
            data: {
              type: ABANDONED_CART_NOTIFICATION_TYPE,
              vendorId,
              vendorName,
            } as Record<string, unknown>,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.DEFAULT,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delaySeconds, repeats: false },
        });

        scheduledIds.current[vendorId] = notificationId;
        console.log('[AbandonedCart] Notification scheduled:', notificationId, 'for vendor:', vendorId);
      } catch (error) {
        console.error('[AbandonedCart] Failed to schedule notification for vendor:', vendorId, error);
      }
    };

    currentCarts.forEach((cart) => {
      const prev = prevCarts.find((c) => c.vendorId === cart.vendorId);
      const hasChanged =
        !prev ||
        prev.lastUpdated !== cart.lastUpdated ||
        prev.status !== cart.status ||
        prev.items.length !== cart.items.length;

      if (hasChanged) {
        void processCart(cart);
      }
    });

    const removedVendorIds = prevCarts
      .map((c) => c.vendorId)
      .filter((id) => !currentCarts.find((c) => c.vendorId === id));

    removedVendorIds.forEach(async (vendorId) => {
      const existingId = scheduledIds.current[vendorId];
      if (existingId) {
        try {
          await Notifications.cancelScheduledNotificationAsync(existingId);
          console.log('[AbandonedCart] Cancelled notification for removed vendor cart:', vendorId);
        } catch {
          // Already fired or invalid
        }
        delete scheduledIds.current[vendorId];
      }
    });
  }, [allVendorCarts]);

  return useMemo(() => ({
    scheduledNotificationIds: scheduledIds.current,
  }), []);
});
