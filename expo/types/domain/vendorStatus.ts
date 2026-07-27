/**
 * Vendor status — single source of truth.
 *
 * Historically three different `VendorStatus` shapes existed in the codebase
 * and meant different things. They are unified here:
 *
 * 1. {@link VendorStatus} — the canonical, backend-aligned status stored on
 *    `Vendor.vendorStatus`. UPPERCASE. This is what `VendorStatusGate` gates on
 *    and what discovery/permissions read.
 *
 * 2. {@link VendorAccountState} — the separate account lifecycle state stored on
 *    `Vendor.accountState` (active / suspended / deactivated / frozen). It is a
 *    distinct concept from verification and from the gate status.
 *
 * 3. {@link VendorDisplayStatus} — the lowercase, display-oriented variant
 *    derived by `utils/vendorLookup#getVendorStatus`. Kept as a documented
 *    alias so existing call sites keep compiling; use {@link VendorStatus} for
 *    anything new.
 *
 * 4. {@link UserVendorStatus} — the coarse approval flag on the auth `User`
 *    record (`pending` | `approved`) used only during onboarding gating.
 */
export type VendorStatus =
  | 'ACTIVE'
  | 'UNVERIFIED'
  | 'WAITLISTED'
  | 'SUSPENDED'
  | 'DEACTIVATED';

export const VENDOR_STATUSES: readonly VendorStatus[] = [
  'ACTIVE',
  'UNVERIFIED',
  'WAITLISTED',
  'SUSPENDED',
  'DEACTIVATED',
];

/** Backend-aligned account lifecycle state, separate from verification. */
export type VendorAccountState = 'active' | 'suspended' | 'deactivated' | 'frozen';

/** Legacy lowercase display variant produced by `vendorLookup#getVendorStatus`. */
export type VendorDisplayStatus =
  | 'active'
  | 'verified'
  | 'waitlisted'
  | 'registered'
  | 'suspended'
  | 'deactivated';

/** Coarse approval flag stored on the auth `User` record. */
export type UserVendorStatus = 'pending' | 'approved';

/** Normalize any loosely-typed value to the canonical {@link VendorStatus}. */
export function normalizeVendorStatusValue(raw?: string): VendorStatus {
  switch (raw) {
    case 'ACTIVE':
    case 'active':
    case 'verified':
      return 'ACTIVE';
    case 'UNVERIFIED':
    case 'registered':
    case 'unverified':
      return 'UNVERIFIED';
    case 'WAITLISTED':
    case 'waitlisted':
      return 'WAITLISTED';
    case 'SUSPENDED':
    case 'suspended':
      return 'SUSPENDED';
    case 'DEACTIVATED':
    case 'deactivated':
      return 'DEACTIVATED';
    default:
      return 'UNVERIFIED';
  }
}
