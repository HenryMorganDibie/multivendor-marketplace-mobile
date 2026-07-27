import { authRepository } from './authRepository';

/**
 * userRepository — data-access boundary for user profile records.
 *
 * SCAFFOLD ONLY. Reuses authRepository's storage (session user + accounts db),
 * since profiles live in the same `users/{uid}`-shaped records today. Returns
 * raw records; userService maps them to `UserProfile` via userMapper.
 *
 * TODO(Henry): replace with Firestore `users/{uid}` document reads/writes.
 */
export const userRepository = {
  /** Raw active-session profile record, or null. */
  async getCurrentRaw(): Promise<unknown | null> {
    return authRepository.getSession();
  },

  /** Raw profile record for a given id from the accounts db, or null. */
  async getByIdRaw(userId: string): Promise<unknown | null> {
    const accounts = await authRepository.getAccounts();
    return accounts.find((acc) => acc.id === userId) ?? null;
  },

  /**
   * Applies a partial update to the active-session profile and the matching
   * accounts-db record. Returns the merged raw record, or null if no match.
   */
  async updateRaw(userId: string, updates: Record<string, unknown>): Promise<unknown | null> {
    const current = (await authRepository.getSession()) as Record<string, unknown> | null;
    if (!current || current.id !== userId) {
      console.error('[userRepository] No matching session user to update:', userId);
      return null;
    }
    const merged = { ...current, ...updates };
    await authRepository.setSession(merged);

    const accounts = await authRepository.getAccounts();
    const index = accounts.findIndex((acc) => acc.id === userId);
    if (index !== -1) {
      accounts[index] = { ...accounts[index], ...updates };
      await authRepository.setAccounts(accounts);
    }
    return merged;
  },
};
