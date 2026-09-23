import { useEffect, useState } from 'react';
import { vendorRepository, type VendorFetchError } from '@/services/repositories/vendorRepository';
import type { Vendor } from '@/mocks/vendorData';
import { getVendorStatusPermissions, normalizeVendorStatus, type VendorStatusPermissions } from '@/components/VendorStatusGate';

export type VendorIdentityAvailability = 'loading' | 'resolved' | 'unavailable';

export interface VendorIdentity {
  vendor: Vendor | undefined;
  isLoading: boolean;
  /** True once resolution has finished and no vendor was resolved (any reason -- see unavailableReason). */
  notFound: boolean;
  /**
   * Fail-closed status classification, kept separate from `vendor`/`notFound`
   * so a caller can never mistake "we don't know" for "confirmed active".
   *
   * 'resolved' — the vendor document (or, for a demo vendorId, the mock
   *   fixture) was actually read; `permissions` reflects its real status.
   * 'unavailable' — no vendor could be confirmed, for any reason (see
   *   `unavailableReason`). This is NOT a confirmed-inactive vendor and must
   *   never be treated as active — Firestore rules (vendors/{vendorId}) deny
   *   an ordinary customer's read of a suspended/deactivated vendor's
   *   document entirely, so "the read failed" and "the vendor is inactive"
   *   are frequently the same real-world event without the client being
   *   able to tell them apart.
   * 'loading' — resolution has not finished yet.
   */
  availability: VendorIdentityAvailability;
  /**
   * Only meaningful when `availability === 'resolved'`. Computed via
   * VendorStatusGate's own `normalizeVendorStatus`/`getVendorStatusPermissions`
   * so every caller makes the identical active/suspended/deactivated
   * decision rather than re-deriving its own.
   */
  permissions: VendorStatusPermissions | null;
  /**
   * Only meaningful when `availability === 'unavailable'`. Preserved so
   * callers can pick honest, non-alarming copy -- a permission-denied read
   * (very likely, but not provably, an inactive vendor) must not be worded
   * the same as a confirmed inactive status, and neither should be worded
   * the same as a transient network failure the customer could just retry.
   */
  unavailableReason: VendorFetchError | null;
}

const LOADING_STATE: VendorIdentity = {
  vendor: undefined,
  isLoading: true,
  notFound: false,
  availability: 'loading',
  permissions: null,
  unavailableReason: null,
};

function unavailableState(reason: VendorFetchError): VendorIdentity {
  return {
    vendor: undefined,
    isLoading: false,
    notFound: true,
    availability: 'unavailable',
    permissions: null,
    unavailableReason: reason,
  };
}

function resolvedState(vendor: Vendor): VendorIdentity {
  return {
    vendor,
    isLoading: false,
    notFound: false,
    availability: 'resolved',
    permissions: getVendorStatusPermissions(normalizeVendorStatus(vendor.vendorStatus)),
    unavailableReason: null,
  };
}

/**
 * One-time authoritative vendor lookup, keyed by vendorId.
 *
 * A single getDoc (via vendorRepository.getByIdClassified, which already
 * runs the result through mapVendorDoc) is sufficient for MVP: the backend
 * re-validates vendor status on every sendChatMessage, so nothing here needs
 * a live listener to stay correct for safety, only for the proactive "this
 * vendor isn't currently active" UX -- which a fresh fetch on mount already
 * gives, without stacking a listener per open chat screen.
 *
 * Never falls back to mockVendor/mockVendors for a real vendorId (that
 * fallback lives in vendorRepository, keyed on the vendorId itself being one
 * of the built-in demo ids, not on who's asking) -- a real account whose
 * vendorId matches nothing resolves to `unavailable`, not a substituted demo
 * vendor. Correctness does not depend on a previous screen passing vendor
 * name/avatar through route params — a cold reload or direct route with
 * only vendorId still resolves the same way.
 *
 * Fail-closed by construction: `availability` only ever reaches 'resolved'
 * after an actual successful read, so a caller gating composer/send
 * permission on `availability === 'resolved' && permissions.canChat` can
 * never have a permission-denied or network error silently treated as an
 * active vendor.
 */
export function useVendorIdentity(vendorId: string | undefined): VendorIdentity {
  const [state, setState] = useState<VendorIdentity>(LOADING_STATE);

  useEffect(() => {
    if (!vendorId) {
      // No vendorId to resolve is not "still loading" -- there is nothing
      // in flight that will ever resolve it. Fail closed the same as any
      // other unresolvable case, never leave a caller reading a stale
      // 'resolved' state from a previous vendorId.
      setState(unavailableState('not-found'));
      return;
    }

    let cancelled = false;
    setState(LOADING_STATE);

    vendorRepository
      .getByIdClassified(vendorId)
      .then(({ vendor, error }) => {
        if (cancelled) return;
        setState(vendor ? resolvedState(vendor) : unavailableState(error ?? 'transient'));
      })
      .catch((err) => {
        console.error('[useVendorIdentity] vendor lookup failed:', err);
        if (cancelled) return;
        setState(unavailableState('transient'));
      });

    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  return state;
}
