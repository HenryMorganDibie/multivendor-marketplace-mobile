import { mockVendors, Vendor } from '@/mocks/vendorData';

export function getVendorUsernameById(vendorId: string): string | null {
  const vendor = mockVendors.find(v => v.id === vendorId);
  return vendor?.username?.toLowerCase() ?? null;
}

export function getVendorStorefrontPath(vendorId: string): string {
  const username = getVendorUsernameById(vendorId);
  if (username) {
    return `/store/${username}`;
  }
  console.warn('[vendorLookup] No username found for vendorId:', vendorId);
  return '/';
}

export function getVendorStorefrontPathByUsername(username: string): string {
  const normalized = username.trim().toLowerCase().replace(/^@/, '');
  return `/store/${normalized}`;
}

export type VendorStatus = 'active' | 'verified' | 'waitlisted' | 'registered' | 'suspended' | 'deactivated';

export function getVendorById(vendorId: string): Vendor | undefined {
  return mockVendors.find(v => v.id === vendorId);
}

/**
 * Pure mapping from a vendor doc's own vendorStatus field to this util's
 * narrower status union. Extracted out of getVendorStatus so callers that
 * have already resolved a real (live, non-demo) vendor — e.g. via
 * vendorRepository.getById — can classify it the same way this file already
 * classifies the ten mock vendors, instead of re-deriving the switch.
 */
export function vendorStatusFromRaw(raw?: Vendor['vendorStatus']): VendorStatus {
  switch (raw) {
    case 'ACTIVE': return 'active';
    case 'UNVERIFIED': return 'registered';
    case 'WAITLISTED': return 'waitlisted';
    case 'SUSPENDED': return 'suspended';
    case 'DEACTIVATED': return 'deactivated';
    default: return 'registered';
  }
}

export function getVendorStatus(vendorId: string): VendorStatus {
  const vendor = mockVendors.find(v => v.id === vendorId);
  return vendorStatusFromRaw(vendor?.vendorStatus);
}

export function getVendorBannerImage(vendorId: string): string | undefined {
  const vendor = mockVendors.find(v => v.id === vendorId);
  return vendor?.bannerImage;
}

export interface StorefrontAccess { allowed: boolean; readOnly: boolean; message?: string }

/** Pure decision from an already-resolved status, same reasoning callers with a live vendor can reuse. */
export function accessForVendorStatus(status: VendorStatus, hasExistingRelationship: boolean = false): StorefrontAccess {
  switch (status) {
    case 'active':
    case 'verified':
      return { allowed: true, readOnly: false };
    case 'waitlisted':
    case 'registered':
      if (hasExistingRelationship) {
        return { allowed: true, readOnly: false };
      }
      return { allowed: false, readOnly: false, message: 'This store is not yet active on Platform.' };
    case 'suspended':
      return { allowed: false, readOnly: false, message: 'This store is temporarily unavailable.' };
    case 'deactivated':
      return { allowed: false, readOnly: false, message: 'This store is no longer available on Platform.' };
    default:
      return { allowed: false, readOnly: false, message: 'This store is not available.' };
  }
}

export function canAccessStorefront(
  vendorId: string,
  hasExistingRelationship: boolean = false
): StorefrontAccess {
  return accessForVendorStatus(getVendorStatus(vendorId), hasExistingRelationship);
}
