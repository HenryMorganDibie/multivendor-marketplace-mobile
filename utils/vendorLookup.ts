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

export function getVendorStatus(vendorId: string): VendorStatus {
  const vendor = mockVendors.find(v => v.id === vendorId);
  return vendor?.vendorStatus ?? 'registered';
}

export function getVendorBannerImage(vendorId: string): string | undefined {
  const vendor = mockVendors.find(v => v.id === vendorId);
  return vendor?.bannerImage;
}

export function canAccessStorefront(
  vendorId: string, 
  hasExistingRelationship: boolean = false
): { allowed: boolean; readOnly: boolean; message?: string } {
  const status = getVendorStatus(vendorId);
  
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
