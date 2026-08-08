import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, onSnapshot } from "firebase/firestore";
import { Vendor, mockVendor } from "@/mocks/vendorData";
import { auth, db } from "@/lib/firebase";
import { mapVendorDoc } from "@/services/repositories/mapVendorDoc";

const VENDOR_PROFILE_STORAGE_KEY = '@the platform_vendor_profile';

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
};

const VendorContext = createContext<VendorContextType | undefined>(undefined);

export const VendorProvider = ({ children }: { children: React.ReactNode }) => {
  const [vendor, setVendor] = useState<Vendor>(mockVendor);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * The signed-in vendor's own record, live.
   *
   * Eighty-three screens read this context: profile, settings, hours, policies,
   * storefront details. All of it was the mock vendor with local overrides, so
   * a real vendor saw somebody else's business name and opening hours until
   * they happened to edit each field.
   *
   * The stored copy below stays as what shows during the first frame, before
   * the listener resolves. It is a cache, not the source.
   */
  useEffect(() => {
    let unsubscribeVendor: (() => void) | null = null;

    const unsubscribeAuth = auth.onIdTokenChanged(async (fbUser) => {
      unsubscribeVendor?.();
      unsubscribeVendor = null;
      if (!fbUser) return;

      /**
       * Forced refresh, not the cached token.
       *
       * getIdTokenResult() without `true` returns Firebase's cached ID token if
       * it has not yet expired — up to an hour old. If that cached token was
       * issued before the vendorId claim existed on the account (a stale
       * session from before registration finished, or from an earlier broken
       * attempt), `vendorId` reads as missing here and the effect below bails
       * out at the next line, permanently: no listener ever attaches, `vendor`
       * never leaves its default, and nothing on screen indicates that.
       *
       * The default `vendor` state is the full mock vendor object — a
       * realistic-looking business, not an empty placeholder — so the visible
       * result was someone's real screen quietly showing "Spicy Restaurant" in
       * Lekki as if it were their own account, with no error and no way to
       * tell it was wrong.
       */
      const token = await fbUser.getIdTokenResult(true);
      const vendorId = token.claims.vendorId as string | undefined;
      if (!vendorId) return;

      unsubscribeVendor = onSnapshot(
        doc(db, 'vendors', vendorId),
        (snap) => {
          if (!snap.exists()) return;
          setVendor(mapVendorDoc(snap.id, snap.data()));
          setIsLoading(false);
        },
        (err) => {
          // The cached profile stands rather than being cleared: showing a
          // vendor an empty business is worse than showing them a slightly
          // stale one while the connection recovers.
          console.error('[VendorContext] Live vendor subscription failed:', err);
          setIsLoading(false);
        },
      );
    });

    return () => { unsubscribeVendor?.(); unsubscribeAuth(); };
  }, []);

  useEffect(() => {
    const loadVendorProfile = async () => {
      try {
        const stored = await AsyncStorage.getItem(VENDOR_PROFILE_STORAGE_KEY);
        if (stored) {
          const storedProfile = JSON.parse(stored) as Partial<Vendor>;
          console.log('[VendorContext] Loaded vendor profile from storage:', storedProfile.name);
          setVendor(prev => ({ ...prev, ...storedProfile }));
        }
      } catch (error) {
        console.error('[VendorContext] Failed to load vendor profile:', error);
      } finally {
        setIsLoading(false);
      }
    };
    void loadVendorProfile();
  }, []);

  const updateVendor = useCallback((updates: Partial<Vendor>) => {
    console.log('[VendorContext] updateVendor called with:', updates);
    setVendor(prev => {
      const updated = { ...prev, ...updates };
      AsyncStorage.setItem(VENDOR_PROFILE_STORAGE_KEY, JSON.stringify(updated)).catch(
        (err) => console.error('[VendorContext] Failed to save vendor profile:', err)
      );
      return updated;
    });
  }, []);

  const isRealVendor = vendor.id !== mockVendor.id && Boolean(vendor.username);

  const value = useMemo(
    () => ({ vendor, updateVendor, isLoading, isRealVendor }),
    [vendor, updateVendor, isLoading, isRealVendor],
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

export { VENDOR_PROFILE_STORAGE_KEY };
