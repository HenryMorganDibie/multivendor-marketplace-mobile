import type { UserRole } from '@/types/domain';
import type { UserProfile } from '@/services/userService';

/**
 * userMapper — converts raw user records (AsyncStorage today, Firestore
 * `users/{uid}` later) into the app's `UserProfile` shape.
 *
 * SCAFFOLD ONLY. Mock records are already profile-shaped, so this is mostly a
 * defensive normalization layer. It exists so the conversion lives in ONE place
 * Henry can repoint at Firestore document shapes.
 *
 * TODO(Henry): map Firestore `users/{uid}` fields (and FieldValue timestamps)
 * into this shape; keep the output type stable.
 */
export type RawUser = Record<string, unknown> & { id?: string };

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export const userMapper = {
  /** Raw record → domain `UserProfile`. */
  fromRaw(raw: RawUser): UserProfile {
    return {
      id: asString(raw.id) ?? '',
      identifier: asString(raw.identifier) ?? '',
      role: (asString(raw.role) as UserRole) ?? 'customer',
      firstName: asString(raw.firstName),
      lastName: asString(raw.lastName),
      lastInitial: asString(raw.lastInitial),
      email: asString(raw.email),
      phone: asString(raw.phone),
      countryCode: asString(raw.countryCode),
      countryName: asString(raw.countryName),
      stateCode: asString(raw.stateCode),
      stateName: asString(raw.stateName),
      areaId: asString(raw.areaId),
      areaName: asString(raw.areaName),
      onboardingCompleted:
        typeof raw.onboardingCompleted === 'boolean' ? raw.onboardingCompleted : undefined,
      createdAt: asString(raw.createdAt),
    };
  },

  /** Domain `UserProfile` → raw record for persistence. */
  toRaw(profile: UserProfile): RawUser {
    return { ...profile };
  },
};
