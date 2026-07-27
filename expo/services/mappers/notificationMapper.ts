import type { AppNotification } from '@/services/notificationService';

/**
 * notificationMapper — converts raw notification records into the app's
 * notification shapes (customer or vendor).
 *
 * SCAFFOLD ONLY. Persisted feeds already match the context notification types,
 * so this is a defensive normalization layer that guarantees a boolean `read`.
 *
 * TODO(Henry): map Firestore `users/{uid}/notifications/{notificationId}`
 * documents into these shapes.
 */
export type RawNotification = Record<string, unknown>;

export const notificationMapper = {
  /** Raw notification record → domain notification. */
  fromRaw(raw: RawNotification): AppNotification {
    const notification = raw as unknown as AppNotification;
    return {
      ...notification,
      read: Boolean((notification as { read?: unknown }).read),
    } as AppNotification;
  },

  /** Domain notification → raw record for persistence. */
  toRaw(notification: AppNotification): RawNotification {
    return { ...notification };
  },

  /** Whether a notification is unread. */
  isUnread(notification: AppNotification): boolean {
    return !notification.read;
  },
};
