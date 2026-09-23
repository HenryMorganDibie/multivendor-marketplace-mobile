import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, onSnapshot } from "firebase/firestore";
import { Vendor, mockVendor } from "@/mocks/vendorData";
import { auth, db } from "@/lib/firebase";
import { mapVendorDoc, toIso } from "@/services/repositories/mapVendorDoc";

const VENDOR_PROFILE_STORAGE_KEY = '@platform_vendor_profile';
const vendorProfileStorageKey = (uid: string) => `${VENDOR_PROFILE_STORAGE_KEY}:${uid}`;

/**
 * Real-vendor identity resolution status, independent of `vendor`'s content.
 *
 * This exists because `vendor` alone cannot tell a legitimate demo/local
 * session apart from a real, signed-in vendor whose identity hasn't resolved
 * yet — both leave `vendor` at the `mockVendor` default. Screens that gate a
 * real action (sending a chat message, sharing a storefront link) must check
 * this, not just `isRealVendor`:
 *
 * 'no-session' — no real Firebase uid observed at all (signed out, or an
 *   explicit demo/local account). Not this context's concern; screens should
 *   treat this the same as before this state existed.
 * 'loading'    — a real uid is signed in and identity resolution is in
 *   flight (token refresh, or waiting on the Firestore vendor doc).
 * 'resolved'   — the real vendor document was actually read; `vendor` is
 *   trustworthy.
 * 'unavailable' — a real uid is signed in but no vendor identity could be
 *   confirmed (missing/stale vendorId claim, or the vendor doc itself is
 *   missing). `vendor` must NOT be treated as this account's real business.
 */
export type VendorIdentityStatus = 'no-session' | 'loading' | 'resolved' | 'unavailable';

type VendorContextType = {
  vendor: Vendor;
  updateVendor: (updates: Partial<Vendor>) => void;
  isLoading: boolean;
  /**
   * Whether `vendor` is this vendor's real record rather than the mockVendor
   * placeholder it starts as.
   *
   * `vendor` defaults to the full mock business ("Spicy Restaurant",
   * @spicyrest, Lekki) — realistic-looking data, not an obvious blank — so
   * before the Firestore listener resolves, every screen reading it shows
   * someone else's business as if it were the signed-in vendor's. Harmless
   * for cosmetic fields, but not for identity: a storefront share link built
   * from the mock username points customers at a different vendor's store
   * entirely, which is exactly what happened on the storefront screen.
   *
   * Screens that show or act on vendor identity should gate on this. The
   * default itself is left as-is deliberately: 83 screens read this context
   * and assume the fields are populated, so swapping the default for an
   * empty object is its own (larger) change.
   */
  isRealVendor: boolean;
  /** See VendorIdentityStatus. Use this (not isRealVendor alone) to gate a
   * real-identity-dependent action for a signed-in Firebase vendor without
   * also blocking a legitimate demo/local vendor session. */
  identityStatus: VendorIdentityStatus;
};

const VendorContext = createContext<VendorContextType | undefined>(undefined);

export const VendorProvider = ({ children }: { children: React.ReactNode }) => {
  const [vendor, setVendor] = useState<Vendor>(mockVendor);
  const [isLoading, setIsLoading] = useState(true);
  const [identityStatus, setIdentityStatus] = useState<VendorIdentityStatus>('no-session');
  // Which uid `vendor`/the uid-scoped cache below belong to. Lets the
  // identity effect tell "still the same vendor, token just refreshed" apart
  // from "a different vendor just signed in on this device", so a shared
  // device never briefly renders the previous vendor's cached business as
  // the newly signed-in one's.
  const currentUidRef = useRef<string | null>(null);

  /**
   * The signed-in vendor's own record, live.
   *
   * Eighty-three screens read this context: profile, settings, hours, policies,
   * storefront details. All of it was the mock vendor with local overrides, so
   * a real vendor saw somebody else's business name and opening hours until
   * they happened to edit each field.
   *
   * The stored copy below stays as what shows during the first frame, before
   * the listener resolves. It is a cache, not the source — and it is now
   * uid-scoped: the old global `@platform_vendor_profile` key meant Vendor B
   * logging in right after Vendor A logged out on the same device briefly
   * rendered A's cached business profile as if it were B's own, and any edit
   * B made before the real Firestore snapshot arrived overwrote that same
   * shared key. logout() doesn't need to clear anything here anymore: each
   * vendor's cache lives under its own key and simply isn't read for anyone
   * else's uid.
   */
  useEffect(() => {
    let unsubscribeVendor: (() => void) | null = null;
    let unsubscribePaymentSettings: (() => void) | null = null;

    const unsubscribeAuth = auth.onIdTokenChanged(async (fbUser) => {
      unsubscribeVendor?.();
      unsubscribeVendor = null;
      unsubscribePaymentSettings?.();
      unsubscribePaymentSettings = null;

      const uid = fbUser?.uid ?? null;
      const identityChanged = uid !== currentUidRef.current;
      currentUidRef.current = uid;

      if (!uid) {
        if (identityChanged) {
          // Signed out, or a demo/local account with no real Firebase
          // session. Not this context's concern — leave `vendor` as
          // whichever fixture/cache was already showing, but be explicit
          // that there is no real identity to resolve, so a real-vendor
          // gate never mistakes this for "still resolving".
          setVendor(mockVendor);
          setIsLoading(false);
          setIdentityStatus('no-session');
        }
        return;
      }

      if (identityChanged) {
        // Never carry the previous vendor's in-memory state forward onto a
        // newly signed-in uid — show the signed-out default until this
        // uid's own cache (if any) loads below.
        setVendor(mockVendor);
        setIsLoading(true);
        setIdentityStatus('loading');
        try {
          const stored = await AsyncStorage.getItem(vendorProfileStorageKey(uid));
          if (stored && currentUidRef.current === uid) {
            const storedProfile = JSON.parse(stored) as Partial<Vendor>;
            setVendor(prev => ({ ...prev, ...storedProfile }));
          }
        } catch (error) {
          console.error('[VendorContext] Failed to load vendor profile:', error);
        }
      }

      /**
       * Forced refresh, not the cached token.
       *
       * getIdTokenResult() without `true` returns Firebase's cached ID token if
       * it has not yet expired — up to an hour old. If that cached token was
       * issued before the vendorId claim existed on the account (a stale
       * session from before registration finished, or from an earlier broken
       * attempt), `vendorId` reads as missing here.
       *
       * A missing vendorId claim is now surfaced via `identityStatus` rather
       * than silently bailing: the default `vendor` state is the full mock
       * vendor object — a realistic-looking business, not an empty
       * placeholder — so silently returning here used to leave a real vendor's
       * screen quietly showing "Spicy Restaurant" in Lekki as if it were their
       * own account, with no error and no way to tell it was wrong.
       */
      const token = await fbUser!.getIdTokenResult(true);
      const vendorId = token.claims.vendorId as string | undefined;
      if (!vendorId) {
        setIsLoading(false);
        setIdentityStatus('unavailable');
        return;
      }

      unsubscribeVendor = onSnapshot(
        doc(db, 'vendors', vendorId),
        (snap) => {
          if (!snap.exists()) {
            // Claim says vendorId, but the record itself is gone — fail
            // closed rather than leaving isLoading/identityStatus stuck.
            setIsLoading(false);
            setIdentityStatus('unavailable');
            return;
          }
          setVendor(mapVendorDoc(snap.id, snap.data()));
          setIsLoading(false);
          setIdentityStatus('resolved');
        },
        (err) => {
          // The cached profile stands rather than being cleared: showing a
          // vendor an empty business is worse than showing them a slightly
          // stale one while the connection recovers. identityStatus is left
          // as-is too — a transient listener error after a real resolve
          // should not suddenly fail-close an already-working session.
          console.error('[VendorContext] Live vendor subscription failed:', err);
          setIsLoading(false);
        },
      );

      // Payment instructions live in a private subdoc, not on the
      // vendors/{vendorId} document itself — that document is publicly
      // readable by any discoverable/published vendor's storefront, and
      // Firestore rules cannot filter individual fields on a doc read.
      // See firestore.rules' vendors/{vendorId}/settings/payment rule.
      unsubscribePaymentSettings = onSnapshot(
        doc(db, 'vendors', vendorId, 'settings', 'payment'),
        (snap) => {
          const data = snap.exists() ? snap.data() : {};
          setVendor((prev) => ({
            ...prev,
            paymentInstructions: (data.paymentInstructions as string) ?? undefined,
            paymentInstructionsEnabled: data.paymentInstructionsEnabled === true,
            ownershipConfirmed: data.ownershipConfirmed === true,
            ownershipConfirmedAt: toIso(data.ownershipConfirmedAt),
            ownershipConfirmedBy: (data.ownershipConfirmedBy as string) ?? undefined,
            paymentInstructionsUpdatedAt: toIso(data.paymentInstructionsUpdatedAt),
            paymentInstructionsUpdatedBy: (data.paymentInstructionsUpdatedBy as string) ?? undefined,
          }));
        },
        (err) => console.error('[VendorContext] Payment settings subscription failed:', err),
      );
    });

    return () => { unsubscribeVendor?.(); unsubscribePaymentSettings?.(); unsubscribeAuth(); };
  }, []);

  const updateVendor = useCallback((updates: Partial<Vendor>) => {
    console.log('[VendorContext] updateVendor called with:', updates);
    const uid = currentUidRef.current;
    setVendor(prev => {
      const updated = { ...prev, ...updates };
      // A real signed-in vendor persists under its own uid-scoped key, never
      // the flat one — that flat key is only ever read once, at mount,
      // as the pre-listener first-frame cache. A demo/local session (no uid)
      // keeps using the flat key, matching its existing behavior.
      const key = uid ? vendorProfileStorageKey(uid) : VENDOR_PROFILE_STORAGE_KEY;
      AsyncStorage.setItem(key, JSON.stringify(updated)).catch(
        (err) => console.error('[VendorContext] Failed to save vendor profile:', err)
      );
      return updated;
    });
  }, []);

  const isRealVendor = vendor.id !== mockVendor.id && Boolean(vendor.username);

  const value = useMemo(
    () => ({ vendor, updateVendor, isLoading, isRealVendor, identityStatus }),
    [vendor, updateVendor, isLoading, isRealVendor, identityStatus],
  );

  return (
    <VendorContext.Provider value={value}>
      {children}
    </VendorContext.Provider>
  );
};

export const useVendor = (): VendorContextType => {
  const context = useContext(VendorContext);
  if (!context) {
    throw new Error('[useVendor] Must be used within VendorProvider');
  }
  return context;
};

export { VENDOR_PROFILE_STORAGE_KEY, vendorProfileStorageKey };
