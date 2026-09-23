import type { DayHoursConfig } from '@/mocks/vendorData';

type DayName = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

interface StoredPendingDayEdit {
  vendorId: string;
  sessionId: string;
  day: DayName;
  config: DayHoursConfig;
}

/**
 * A one-shot relay for a single day's edited draft, from edit-day-hours.tsx
 * back to business-hours.tsx. expo-router has no built-in way to return a
 * value to the screen being navigated back to; business-hours.tsx picks
 * this up in a useFocusEffect, which fires exactly when it regains focus
 * after the vendor taps Done on a day. Not a persistence layer -- nothing
 * here ever touches Firestore or AsyncStorage.
 *
 * This is module-global mutable state, so it is explicitly scoped by both
 * vendorId and sessionId (a random id business-hours.tsx generates once per
 * mount) rather than trusted blindly:
 *  - vendorId: a value set while one vendor was signed in must never be
 *    applied to a different vendor's screen after a logout/account switch
 *    on the same device (the JS module state survives that transition).
 *  - sessionId: a value set by one mounted instance of business-hours.tsx
 *    must never be applied by a different (e.g. abandoned-and-reopened)
 *    instance, even for the same vendor.
 * takePendingDayEdit always clears the slot, whether or not the ids match --
 * a mismatched value is stale by definition and is discarded, never left
 * sitting around for some later, unrelated screen to pick up.
 */
let pendingDayEdit: StoredPendingDayEdit | null = null;

export function setPendingDayEdit(vendorId: string, sessionId: string, day: DayName, config: DayHoursConfig): void {
  pendingDayEdit = { vendorId, sessionId, day, config };
}

export function takePendingDayEdit(vendorId: string, sessionId: string): { day: DayName; config: DayHoursConfig } | null {
  const value = pendingDayEdit;
  pendingDayEdit = null;
  if (!value) return null;
  if (value.vendorId !== vendorId || value.sessionId !== sessionId) return null;
  return { day: value.day, config: value.config };
}
