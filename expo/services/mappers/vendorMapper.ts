import type { Vendor, MenuItem, Category } from '@/types/domain';

/**
 * vendorMapper — converts raw vendor/menu/category records into domain types.
 *
 * SCAFFOLD ONLY. Mock records already match the domain `Vendor`/`MenuItem`/
 * `Category` shapes, so these are pass-through with light normalization. They
 * exist so all vendor shape conversion lives in ONE place.
 *
 * TODO(Henry): map Firestore `vendors/{vendorId}` (+ menu/category
 * subcollections) into these shapes.
 */
export type RawVendor = Record<string, unknown>;
export type RawMenuItem = Record<string, unknown>;
export type RawCategory = Record<string, unknown>;

export const vendorMapper = {
  /** Raw vendor record → domain `Vendor`. */
  fromRaw(raw: RawVendor): Vendor {
    return raw as unknown as Vendor;
  },

  /** Domain `Vendor` → raw record for persistence. */
  toRaw(vendor: Vendor): RawVendor {
    return { ...vendor };
  },

  /** Raw menu item record → domain `MenuItem`. */
  menuItemFromRaw(raw: RawMenuItem): MenuItem {
    return raw as unknown as MenuItem;
  },

  /** Raw category record → domain `Category`. */
  categoryFromRaw(raw: RawCategory): Category {
    return raw as unknown as Category;
  },

  /**
   * Whether a vendor should appear in public discovery (Home / Explore /
   * Search). Backend-aligned rule:
   *
   * - ACTIVE (approved + active account + discoverable flag) → appears publicly.
   * - UNVERIFIED → hidden from discovery (direct-link access only).
   * - WAITLISTED → hidden from discovery.
   * - SUSPENDED / DEACTIVATED / frozen → hidden everywhere.
   *
   * Prefers explicit `verificationStatus` / `accountState` fields and falls back
   * to the legacy `vendorStatus` string so mock data keeps working. This mirrors
   * `getVendorVerificationStatus` + `getVendorAccountState` so the set of visible
   * vendors is unchanged today.
   *
   * TODO(Henry): once vendors carry native `verificationStatus`/`accountState`
   * fields from Firestore, the legacy `vendorStatus` fallback can be removed.
   */
  isDiscoverable(vendor: Vendor): boolean {
    const verification =
      vendor.verificationStatus ?? (vendor.vendorStatus === 'ACTIVE' ? 'approved' : undefined);
    const isApproved = verification === 'approved';

    const account =
      vendor.accountState ??
      (vendor.vendorStatus === 'SUSPENDED'
        ? 'suspended'
        : vendor.vendorStatus === 'DEACTIVATED'
          ? 'deactivated'
          : 'active');
    const isActive = account === 'active';

    const isDiscoverableFlag = vendor.isDiscoverable !== false;

    return isApproved && isActive && isDiscoverableFlag;
  },
};
