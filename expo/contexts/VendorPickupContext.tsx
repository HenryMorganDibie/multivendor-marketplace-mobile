import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, callable, db } from '@/lib/firebase';
import { DEV_LOCAL_AUTH_ENABLED } from '@/constants/devAuth';

/**
 * Canonical vendor business-area shape (matches backend PickupAddress /
 * vendor location fields exactly: areaId/areaName/stateCode/stateName/
 * countryCode/countryName). This is the same model captured once at vendor
 * registration and used throughout the backend -- read-only here, since a
 * vendor's area is set during onboarding/verification, not from this screen.
 */
interface VendorArea {
  areaId: string;
  areaName: string;
  stateCode: string;
  stateName: string;
  countryCode: string;
  countryName: string;
}

const EMPTY_AREA: VendorArea = {
  areaId: '',
  areaName: '',
  stateCode: '',
  stateName: '',
  countryCode: '',
  countryName: '',
};

// The built-in demo vendor (mocks/vendorData.ts mockVendor, id 'v1') is
// registered in Lekki, Lagos, Nigeria -- not a real registered address, so
// this is used only on the DEV_LOCAL_AUTH demo path, never as a fallback for
// a real signed-in vendor. Previously this context defaulted every vendor,
// demo or real, to a hardcoded "Toronto, Ontario, Canada" that matched
// neither a real vendor's registration nor even the demo vendor's own mock
// location.
const DEMO_AREA: VendorArea = {
  areaId: 'demo-lekki',
  areaName: 'Lekki',
  stateCode: 'LA',
  stateName: 'Lagos',
  countryCode: 'NG',
  countryName: 'Nigeria',
};

interface PickupDetails {
  streetAddress: string;
  unitSuite: string;
  instructions: string;
  contactPhone: string;
  verificationCode: string;
  area: VendorArea;
}

const PICKUP_DETAILS_KEY = 'vendor_pickup_details';
const AUTO_SEND_KEY = 'vendor_auto_send_pickup';

export const [VendorPickupProvider, useVendorPickup] = createContextHook(() => {
  const [pickupDetails, setPickupDetails] = useState<PickupDetails>({
    streetAddress: '',
    unitSuite: '',
    instructions: '',
    contactPhone: '',
    verificationCode: '',
    area: EMPTY_AREA,
  });
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setVendorId(null);
        // Demo/local-auth only -- a real signed-out state must not show any
        // area, real or demo.
        if (DEV_LOCAL_AUTH_ENABLED) {
          setPickupDetails((prev) => ({ ...prev, area: DEMO_AREA }));
        }
        return;
      }
      const tokenResult = await user.getIdTokenResult();
      setVendorId((tokenResult.claims.vendorId as string | undefined) ?? null);
    });
    return unsubscribeAuth;
  }, []);

  // Real-time read-back from vendors/{vendorId}/settings/pickup - the same
  // doc updateVendorPickupSettings writes to. Previously this only read from
  // AsyncStorage, so pickup details set on another device (or restored after
  // a reinstall) never showed here even though the save itself was already
  // real and server-side.
  useEffect(() => {
    if (!vendorId) return;
    const ref = doc(db, 'vendors', vendorId, 'settings', 'pickup');
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as {
        pickupAddress?: { streetAddress: string; unitSuite?: string | null };
        pickupInstructions?: string;
        pickupContactPhone?: string;
        pickupVerificationCode?: string;
        autoSendPickupDetailsEnabled?: boolean;
      };
      setPickupDetails((prev) => ({
        ...prev,
        streetAddress: data.pickupAddress?.streetAddress ?? prev.streetAddress,
        unitSuite: data.pickupAddress?.unitSuite ?? prev.unitSuite,
        instructions: data.pickupInstructions ?? prev.instructions,
        contactPhone: data.pickupContactPhone ?? prev.contactPhone,
        verificationCode: data.pickupVerificationCode ?? prev.verificationCode,
        // area is never read from this doc -- it comes from the vendor's own
        // registration record (see the effect below), not from pickup settings.
      }));
      if (data.autoSendPickupDetailsEnabled !== undefined) {
        setAutoSendEnabled(data.autoSendPickupDetailsEnabled);
      }
    }, (error) => console.error('[VendorPickup] settings listener failed:', error));
    return unsubscribe;
  }, [vendorId]);

  // The vendor's real, onboarding-verified business area, read directly from
  // vendors/{vendorId}. Independent of pickup settings: a vendor's area is
  // not vendor-editable from this screen. This replaces the previous
  // hardcoded "Toronto, Ontario, Canada" placeholder, which showed for every
  // vendor regardless of where they actually registered.
  //
  // Precedence matches mapVendorDoc.ts exactly (services/repositories/
  // mapVendorDoc.ts) rather than inventing a competing rule: businessLocation
  // is the newer nested field, location is what older vendors have, and both
  // win over the flat top-level fields for area/state name -- EXCEPT
  // country, where mapVendorDoc deliberately reads the flat field first.
  // completeRegistration.ts and updateVendorLocation.ts -- the two real,
  // current write paths -- only ever write flat fields (state/region/area/
  // city/stateId/areaId/countryCode/country) and never a nested location/
  // businessLocation object at all, so for every vendor registered under the
  // current system `nested` below is always `{}` and every field falls
  // through to its flat source. state/region and area/city are read
  // interchangeably since updateVendorLocation always writes each pair to
  // the same value together.
  useEffect(() => {
    if (!vendorId) return;
    // Reset synchronously before subscribing, not after the first snapshot
    // arrives, so switching from one real vendor to another never leaves the
    // previous vendor's area on screen while the new vendor's document loads.
    setPickupDetails((prev) => ({ ...prev, area: EMPTY_AREA }));
    const ref = doc(db, 'vendors', vendorId);
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as Record<string, unknown>;
      const nested = (data.businessLocation ?? data.location ?? {}) as Record<string, string>;
      const flatState = (data.state as string) ?? (data.region as string);
      const flatArea = (data.area as string) ?? (data.city as string);
      setPickupDetails((prev) => ({
        ...prev,
        area: {
          areaId: (data.areaId as string) ?? nested.areaId ?? prev.area.areaId,
          areaName: nested.areaName ?? flatArea ?? prev.area.areaName,
          stateCode: (data.stateId as string) ?? nested.stateCode ?? prev.area.stateCode,
          stateName: nested.stateName ?? flatState ?? prev.area.stateName,
          countryCode: (data.countryCode as string) ?? nested.countryCode ?? prev.area.countryCode,
          countryName: (data.country as string) ?? nested.countryName ?? prev.area.countryName,
        },
      }));
    }, (error) => console.error('[VendorPickup] vendor area listener failed:', error));
    return unsubscribe;
  }, [vendorId]);

  const loadData = async () => {
    try {
      const [detailsJson, autoSendValue] = await Promise.all([
        AsyncStorage.getItem(PICKUP_DETAILS_KEY),
        AsyncStorage.getItem(AUTO_SEND_KEY),
      ]);

      // area is deliberately never restored from this cache -- it is always
      // sourced live from the vendor's own document (see above), never
      // cached locally, so a stale or wrong area can never be shown.
      // unitSuite falls back to the pre-existing cache's `unit` key so an
      // install upgrading from the old shape does not lose a saved value.
      if (detailsJson) {
        const parsed = JSON.parse(detailsJson) as Record<string, unknown>;
        setPickupDetails((prev) => ({
          ...prev,
          streetAddress: (parsed.streetAddress as string) ?? prev.streetAddress,
          unitSuite: (parsed.unitSuite as string) ?? (parsed.unit as string) ?? prev.unitSuite,
          instructions: (parsed.instructions as string) ?? prev.instructions,
          contactPhone: (parsed.contactPhone as string) ?? prev.contactPhone,
          verificationCode: (parsed.verificationCode as string) ?? prev.verificationCode,
        }));
      }

      if (autoSendValue !== null) {
        setAutoSendEnabled(autoSendValue === 'true');
      }

      setIsLoaded(true);
    } catch (error) {
      console.error('Failed to load pickup details:', error);
      setIsLoaded(true);
    }
  };

  /**
   * updateVendorPickupSettings has been deployed since pickup instructions
   * shipped and nothing called it — this saved to AsyncStorage only, so
   * pickup details never reached the server, and the away/auto-send message
   * flows that read pickup settings server-side (sendPickupDetails,
   * createCommerceConversation's greeting path) never saw what a vendor
   * actually typed.
   *
   * The server call happens before the local write: the backend's own
   * validation (instructions length, auto-send enable-guard) is what should
   * decide whether this save is allowed, not the client's mirror of that
   * logic — so a rejection here must not have already been written locally.
   */
  type EditablePickupFields = Pick<
    PickupDetails,
    'streetAddress' | 'unitSuite' | 'instructions' | 'contactPhone' | 'verificationCode'
  >;

  // area is not a parameter here -- it is not vendor-editable from this
  // screen, so every save sends the vendor's current, live-read area back
  // alongside the street-level fields, matching the canonical PickupAddress
  // shape the backend expects as one object.
  const savePickupDetails = async (details: EditablePickupFields) => {
    const nextDetails: PickupDetails = { ...details, area: pickupDetails.area };
    try {
      if (!DEV_LOCAL_AUTH_ENABLED || auth.currentUser) {
        const update = callable<
          {
            pickupAddress: {
              streetAddress: string;
              unitSuite: string;
              areaId: string;
              areaName: string;
              stateCode: string;
              stateName: string;
              countryCode: string;
              countryName: string;
            };
            pickupInstructions: string;
            pickupContactPhone: string;
            pickupVerificationCode: string;
          },
          { success: true }
        >('updateVendorPickupSettings');
        await update({
          pickupAddress: {
            streetAddress: details.streetAddress,
            unitSuite: details.unitSuite,
            areaId: pickupDetails.area.areaId,
            areaName: pickupDetails.area.areaName,
            stateCode: pickupDetails.area.stateCode,
            stateName: pickupDetails.area.stateName,
            countryCode: pickupDetails.area.countryCode,
            countryName: pickupDetails.area.countryName,
          },
          pickupInstructions: details.instructions,
          pickupContactPhone: details.contactPhone,
          pickupVerificationCode: details.verificationCode,
        });
      }
      // area is excluded from the cached blob -- it must always come from
      // the live vendor-document read, never from a local cache that could
      // go stale or (before this fix) never matched a real vendor at all.
      await AsyncStorage.setItem(PICKUP_DETAILS_KEY, JSON.stringify(details));
      setPickupDetails(nextDetails);
      console.log('Pickup details saved:', nextDetails);
    } catch (error) {
      console.error('Failed to save pickup details:', error);
      throw error;
    }
  };

  const setAutoSend = async (enabled: boolean) => {
    try {
      if (!DEV_LOCAL_AUTH_ENABLED || auth.currentUser) {
        const update = callable<{ autoSendPickupDetailsEnabled: boolean }, { success: true }>(
          'updateVendorPickupSettings',
        );
        await update({ autoSendPickupDetailsEnabled: enabled });
      }
      await AsyncStorage.setItem(AUTO_SEND_KEY, enabled.toString());
      setAutoSendEnabled(enabled);
      console.log('Auto-send pickup enabled:', enabled);
    } catch (error) {
      console.error('Failed to save auto-send setting:', error);
      throw error;
    }
  };

  const hasPickupDetails = () => {
    return pickupDetails.streetAddress.trim().length > 0 && pickupDetails.instructions.trim().length > 0;
  };

  const validateAddressInBusinessArea = (address: string, city: string): boolean => {
    const lowerAddress = address.toLowerCase();
    const lowerCity = city.toLowerCase();
    return lowerAddress.includes(lowerCity);
  };

  return {
    pickupDetails,
    autoSendEnabled,
    isLoaded,
    savePickupDetails,
    setAutoSend,
    hasPickupDetails,
    validateAddressInBusinessArea,
  };
});
