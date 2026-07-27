import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserRole } from '@/types/domain';
import type { AppNotification } from '@/services/notificationService';
import { notificationMapper, type RawNotification } from '@/services/mappers/notificationMapper';

/**
 * notificationRepository — data-access boundary for per-user notification feeds.
 *
 * SCAFFOLD ONLY. Reads/writes the same per-user namespaced AsyncStorage keys the
 * notification contexts own (`${KEY}:${uid}`). notificationService delegates
 * here; the contexts remain the live, reactive source for the UI.
 *
 * TODO(Henry): replace with Firestore `users/{uid}/notifications/{id}`.
 */
const AUTH_STORAGE_KEY = '@the platform_auth_user';
const CUSTOMER_KEY = '@the platform_customer_notifications';
const VENDOR_KEY = '@the platform_vendor_notifications';

async function currentUserId(): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored)?.id ?? null;
  } catch {
    return null;
  }
}

export const notificationRepository = {
  /** Resolves the per-user namespaced storage key for a role. */
  async resolveKey(role: UserRole): Promise<string> {
    const base = role === 'vendor' ? VENDOR_KEY : CUSTOMER_KEY;
    const uid = await currentUserId();
    return uid ? `${base}:${uid}` : base;
  },

  /** Normalized notification feed for a role (mapped to domain shapes). */
  async read(role: UserRole): Promise<AppNotification[]> {
    try {
      const key = await this.resolveKey(role);
      const stored = await AsyncStorage.getItem(key);
      if (!stored) return [];
      const raw = JSON.parse(stored) as RawNotification[];
      if (!Array.isArray(raw)) return [];
      return raw.map((record) => notificationMapper.fromRaw(record));
    } catch (error) {
      console.error('[notificationRepository] Failed to read feed:', error);
      return [];
    }
  },

  /** Persists the notification feed for a role. */
  async write(role: UserRole, list: AppNotification[]): Promise<void> {
    try {
      const key = await this.resolveKey(role);
      await AsyncStorage.setItem(key, JSON.stringify(list));
    } catch (error) {
      console.error('[notificationRepository] Failed to write feed:', error);
    }
  },

  /** Clears the notification feed for a role. */
  async clear(role: UserRole): Promise<void> {
    try {
      const key = await this.resolveKey(role);
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('[notificationRepository] Failed to clear feed:', error);
    }
  },
};
