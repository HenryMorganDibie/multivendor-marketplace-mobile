import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * authRepository — data-access boundary for authentication records.
 *
 * SCAFFOLD ONLY. Owns the raw reads/writes against the same AsyncStorage keys
 * AuthContext uses (`@the platform_auth_user`, `@the platform_accounts_db`). Services call
 * this; no screen/context imports it yet.
 *
 * TODO(Henry): replace these AsyncStorage operations with Firebase Auth +
 * Firestore `users/{uid}` reads/writes. Keep the method names stable.
 */
export const AUTH_STORAGE_KEY = '@the platform_auth_user';
export const ACCOUNTS_DB_KEY = '@the platform_accounts_db';

export const authRepository = {
  /** Raw persisted session record, or null. */
  async getSession(): Promise<unknown | null> {
    try {
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('[authRepository] Failed to read session:', error);
      return null;
    }
  },

  /** Persists the raw session record. TODO(Henry): Firebase Auth state. */
  async setSession(user: unknown): Promise<void> {
    try {
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('[authRepository] Failed to write session:', error);
    }
  },

  /** Clears the persisted session. TODO(Henry): Firebase signOut. */
  async clearSession(): Promise<void> {
    try {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (error) {
      console.error('[authRepository] Failed to clear session:', error);
    }
  },

  /** All raw account records from the local accounts db. */
  async getAccounts(): Promise<any[]> {
    try {
      const stored = await AsyncStorage.getItem(ACCOUNTS_DB_KEY);
      return stored ? (JSON.parse(stored) as any[]) : [];
    } catch (error) {
      console.error('[authRepository] Failed to read accounts db:', error);
      return [];
    }
  },

  /** Persists the raw accounts db. */
  async setAccounts(accounts: any[]): Promise<void> {
    try {
      await AsyncStorage.setItem(ACCOUNTS_DB_KEY, JSON.stringify(accounts));
    } catch (error) {
      console.error('[authRepository] Failed to write accounts db:', error);
    }
  },
};
