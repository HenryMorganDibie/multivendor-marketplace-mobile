import type { UserRole } from '@/types/domain';
import type { CustomerNotification } from '@/contexts/CustomerNotificationContext';
import type { VendorNotification } from '@/contexts/VendorNotificationContext';

/**
 * notificationService — single boundary for per-user notification feeds.
 *
 * SCAFFOLD ONLY. Reads the same per-user AsyncStorage feeds that
 * `CustomerNotificationContext` / `VendorNotificationContext` own today. Those
 * contexts remain the live, reactive source for the UI; this service is the
 * stable async API Henry will repoint at Firestore
 * (`users/{uid}/notifications/{notificationId}`).
 *
 * TODO(Henry): back these with Firestore per-user notification subcollections.
 */
import { notificationRepository } from '@/services/repositories/notificationRepository';

export type AppNotification = CustomerNotification | VendorNotification;

export const notificationService = {
  /** Returns the signed-in user's notification feed for the given role. */
  async getForCurrentUser(role: UserRole): Promise<AppNotification[]> {
    return notificationRepository.read(role);
  },

  /** Count of unread notifications for the signed-in user. */
  async getUnreadCount(role: UserRole): Promise<number> {
    const notifications = await this.getForCurrentUser(role);
    return notifications.filter((n) => !n.read).length;
  },

  /** Marks a single notification as read. */
  async markAsRead(role: UserRole, notificationId: string): Promise<void> {
    const list = await notificationRepository.read(role);
    const next = list.map((n) => (n.id === notificationId ? { ...n, read: true } : n));
    await notificationRepository.write(role, next);
  },

  /** Marks every notification in the feed as read. */
  async markAllAsRead(role: UserRole): Promise<void> {
    const list = await notificationRepository.read(role);
    const next = list.map((n) => ({ ...n, read: true }));
    await notificationRepository.write(role, next);
  },

  /** Clears the signed-in user's feed. */
  async clear(role: UserRole): Promise<void> {
    await notificationRepository.clear(role);
  },
};
