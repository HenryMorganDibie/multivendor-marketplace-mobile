import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUserLocation } from '@/contexts/UserLocationContext';

export interface CountryStatusInfo {
  countryName: string;
  isActive: boolean;
  isComingSoon: boolean;
  isWaitlistOnly: boolean;
  discoveryVisible: boolean;
  launchTimeline: string;
  isLoading: boolean;
}

type RawStatus = 'ACTIVE' | 'DISABLED' | 'WAITLIST';

/**
 * This used to read a hardcoded, 15-country COUNTRY_STATUS_MAP with invented
 * launch quarters ("Q4 2026", "Q1 2027") and a DISCOVERY_THRESHOLD constant
 * that was computed and exposed but never actually compared against anything
 * — discoveryVisible for an "ACTIVE" entry was unconditionally true, for
 * every other status unconditionally false, regardless of real vendor count.
 * Every country not explicitly listed defaulted to "coming soon", so 181 of
 * the 196 real, seeded, mostly-ACTIVE countries in countryAvailability
 * (confirmed directly: only Cuba, Iran and North Korea are INACTIVE) showed
 * as unlaunched to a real customer regardless of what the backend actually
 * said.
 *
 * Now reads the real per-country record. The backend's actual status is a
 * three-way enum (ACTIVE / DISABLED / WAITLIST — see
 * CountryAvailabilityDoc in multivendor-marketplace-platform/functions/src/types3.ts), not
 * the two-way ACTIVE/INACTIVE this file originally assumed when it was
 * rewritten off the hardcoded map: WAITLIST is a real, distinct state
 * (soft-gated, vendor already in the app) from DISABLED ("coming soon",
 * hard-redirected out of onboarding), and treating them the same made every
 * WAITLIST country register as fully isActive. discoveryVisible follows
 * isActive alone, not vendor count — an active country with zero vendors
 * yet falls through to the ordinary "no vendors available here yet" empty
 * state elsewhere on the home screen, which is the correct message ("we're
 * onboarding businesses"), not "coming soon" ("this country isn't
 * launched"). Those are different facts and were being shown with the same
 * copy. launchTimeline has no real backend equivalent (the old hardcoded
 * map invented per-country launch quarters) — always empty, and every
 * consumer already renders nothing when it's falsy.
 */
export const [CountryStatusProvider, useCountryStatus] = createContextHook(() => {
  const { countryCode, countryName } = useUserLocation();
  const [status, setStatus] = useState<RawStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!countryCode) {
      setStatus(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsubscribe = onSnapshot(
      doc(db, 'countryAvailability', countryCode),
      (snap) => {
        // No record for this code yet: fail open rather than blocking a
        // real customer behind "coming soon" for a data gap that isn't
        // theirs. countries/{code}.status already gates registration
        // itself; this only controls what the home screen shows.
        setStatus(snap.exists() ? (snap.data().status as RawStatus) : 'ACTIVE');
        setIsLoading(false);
      },
      (err) => {
        console.error('[CountryStatus] Live subscription failed:', err);
        setStatus('ACTIVE');
        setIsLoading(false);
      },
    );
    return unsubscribe;
  }, [countryCode]);

  return useMemo<CountryStatusInfo>(() => {
    const isActive = status === 'ACTIVE';
    const isWaitlistOnly = status === 'WAITLIST';
    return {
      countryName: countryName || 'your region',
      isActive,
      isComingSoon: status === 'DISABLED',
      isWaitlistOnly,
      discoveryVisible: isActive,
      launchTimeline: '',
      isLoading,
    };
  }, [status, countryName, isLoading]);
});
