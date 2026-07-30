import { useCallback, useEffect, useRef, useState } from 'react';
import { callable } from '@/lib/firebase';

/**
 * The location catalogue, fetched from the backend.
 *
 * Replaces the hardcoded lists the app shipped with: 17 countries in
 * constants/countries.ts and 134 areas in constants/areas.ts. The catalogue has
 * 196 countries, so a vendor in any of the other 179 could not register at all.
 *
 * Each level is fetched on demand rather than all at once. Countries load when
 * the picker opens; states only when a country is chosen; areas only when a
 * state is chosen. Loading every area for 196 countries up front would be tens
 * of thousands of records to show a list of, at most, a few dozen.
 *
 * Results are cached per key for the life of the screen. Reopening a picker, or
 * going back and forth between countries while filling a form, is common enough
 * that refetching each time would be visibly slow for data that cannot change
 * mid-session.
 */

export interface CountryOption {
  countryCode: string;
  name: string;
  dialCode: string | null;
  currencyCode: string | null;
  flagEmoji: string | null;
}

export interface StateOption {
  stateId: string;
  stateCode: string;
  name: string;
  type: string | null;
}

export interface AreaOption {
  locationId: string;
  name: string;
  locationType: string | null;
  timeZone: string | null;
}

/**
 * Four states, not three. "Loaded but empty" is deliberately distinct from
 * "loading" and from "failed": a country with no states on file is a real and
 * correct answer, and telling someone to retry would be wrong.
 */
export interface AsyncList<T> {
  items: T[];
  loading: boolean;
  /** Null when nothing went wrong. A string the user can actually read. */
  error: string | null;
  /** True once a fetch has completed, whatever it returned. */
  loaded: boolean;
}

const EMPTY: AsyncList<never> = { items: [], loading: false, error: null, loaded: false };

function friendlyError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  // Anything network-shaped gets the message that suggests the useful action.
  if (code.includes('unavailable') || code.includes('deadline')) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  if (code.includes('resource-exhausted')) {
    return 'Too many requests just now. Wait a moment and try again.';
  }
  return 'Could not load the list. Please try again.';
}

export function useLocationCatalogue() {
  const [countries, setCountries] = useState<AsyncList<CountryOption>>(EMPTY);
  const [statesByCountry, setStatesByCountry] = useState<Record<string, AsyncList<StateOption>>>({});
  const [areasByState, setAreasByState] = useState<Record<string, AsyncList<AreaOption>>>({});

  // Guards against setting state after unmount, and against a slow first
  // request overwriting a newer one for a different country.
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const loadCountries = useCallback(async () => {
    setCountries((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const fn = callable<Record<string, never>, { success: true; countries: CountryOption[] }>('listCountries');
      const res = await fn({});
      if (!mounted.current) return;
      setCountries({ items: res.data.countries ?? [], loading: false, error: null, loaded: true });
    } catch (err) {
      if (!mounted.current) return;
      setCountries({ items: [], loading: false, error: friendlyError(err), loaded: true });
    }
  }, []);

  const loadStates = useCallback(async (countryCode: string) => {
    if (!countryCode) return;
    setStatesByCountry((prev) => ({
      ...prev,
      [countryCode]: { ...(prev[countryCode] ?? EMPTY), loading: true, error: null },
    }));
    try {
      const fn = callable<{ countryCode: string }, { success: true; states: StateOption[] }>('listStates');
      const res = await fn({ countryCode });
      if (!mounted.current) return;
      setStatesByCountry((prev) => ({
        ...prev,
        [countryCode]: { items: res.data.states ?? [], loading: false, error: null, loaded: true },
      }));
    } catch (err) {
      if (!mounted.current) return;
      setStatesByCountry((prev) => ({
        ...prev,
        [countryCode]: { items: [], loading: false, error: friendlyError(err), loaded: true },
      }));
    }
  }, []);

  const loadAreas = useCallback(async (stateId: string) => {
    if (!stateId) return;
    setAreasByState((prev) => ({
      ...prev,
      [stateId]: { ...(prev[stateId] ?? EMPTY), loading: true, error: null },
    }));
    try {
      const fn = callable<{ stateId: string }, { success: true; areas: AreaOption[] }>('listAreas');
      const res = await fn({ stateId });
      if (!mounted.current) return;
      setAreasByState((prev) => ({
        ...prev,
        [stateId]: { items: res.data.areas ?? [], loading: false, error: null, loaded: true },
      }));
    } catch (err) {
      if (!mounted.current) return;
      setAreasByState((prev) => ({
        ...prev,
        [stateId]: { items: [], loading: false, error: friendlyError(err), loaded: true },
      }));
    }
  }, []);

  /** Fetches once per key. Safe to call on every render or focus. */
  const ensureCountries = useCallback(() => {
    if (!countries.loaded && !countries.loading) void loadCountries();
  }, [countries.loaded, countries.loading, loadCountries]);

  const ensureStates = useCallback((countryCode: string) => {
    const entry = statesByCountry[countryCode];
    if (!entry?.loaded && !entry?.loading) void loadStates(countryCode);
  }, [statesByCountry, loadStates]);

  const ensureAreas = useCallback((stateId: string) => {
    const entry = areasByState[stateId];
    if (!entry?.loaded && !entry?.loading) void loadAreas(stateId);
  }, [areasByState, loadAreas]);

  return {
    countries,
    statesFor: (countryCode: string): AsyncList<StateOption> => statesByCountry[countryCode] ?? EMPTY,
    areasFor: (stateId: string): AsyncList<AreaOption> => areasByState[stateId] ?? EMPTY,
    ensureCountries,
    ensureStates,
    ensureAreas,
    /** Retry handlers for the error states. */
    retryCountries: loadCountries,
    retryStates: loadStates,
    retryAreas: loadAreas,
  };
}
