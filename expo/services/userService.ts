import type { UserRole } from '@/types/domain';

/**
 * userService — single boundary for user profile reads/writes.
 *
 * SCAFFOLD ONLY. Wraps the same `users/{uid}`-shaped data that AuthContext
 * persists to AsyncStorage today (the accounts db + the active session user).
 * Screens will eventually read/update profile data through here instead of
 * reaching into AuthContext directly.
 *
 * TODO(Henry): back these with Firestore `users/{uid}` documents.
 */
import { userRepository } from '@/services/repositories/userRepository';
import { userMapper } from '@/services/mappers/userMapper';

export interface UserProfile {
  id: string;
  identifier: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  lastInitial?: string;
  email?: string;
  phone?: string;
  countryCode?: string;
  countryName?: string;
  stateCode?: string;
  stateName?: string;
  areaId?: string;
  areaName?: string;
  onboardingCompleted?: boolean;
  createdAt?: string;
}

/** Fields a user may edit on their own profile. */
export type UserProfileUpdate = Partial<
  Pick<
    UserProfile,
    | 'firstName'
    | 'lastName'
    | 'lastInitial'
    | 'email'
    | 'countryCode'
    | 'countryName'
    | 'stateCode'
    | 'stateName'
    | 'areaId'
    | 'areaName'
    | 'onboardingCompleted'
  >
>;

export const userService = {
  /** Returns the active session user's profile, or null. */
  async getCurrentProfile(): Promise<UserProfile | null> {
    const raw = await userRepository.getCurrentRaw();
    return raw ? userMapper.fromRaw(raw as Record<string, unknown>) : null;
  },

  /** Looks up a profile by id from the local accounts db. */
  async getById(userId: string): Promise<UserProfile | null> {
    const raw = await userRepository.getByIdRaw(userId);
    return raw ? userMapper.fromRaw(raw as Record<string, unknown>) : null;
  },

  /**
   * Updates the active user's profile. Mirrors AuthContext.updateUserProfile —
   * writes both the session user and the matching accounts-db record.
   * TODO(Henry): replace with a Firestore `users/{uid}` update.
   */
  async updateProfile(userId: string, updates: UserProfileUpdate): Promise<UserProfile | null> {
    const merged = await userRepository.updateRaw(userId, updates as Record<string, unknown>);
    if (!merged) return null;
    console.log('[userService] Updated profile:', userId);
    return userMapper.fromRaw(merged as Record<string, unknown>);
  },
};
