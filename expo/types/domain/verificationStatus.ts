/**
 * Vendor verification status — single source of truth.
 *
 * The canonical union is re-exported from `contexts/VerificationContext`, which
 * owns the detailed JSDoc and runtime logic. Importing it here gives every
 * screen one import surface (`@/types/domain`) without creating a second copy.
 *
 * Note the distinction:
 * - Verification statuses describe identity/KYC progress.
 * - `suspended` / `deactivated` are account-level states that also appear in the
 *   union for historical reasons; prefer {@link VendorAccountState} from
 *   `./vendorStatus` for pure account-lifecycle checks.
 */
export type { VerificationStatus, VerificationType } from '@/contexts/VerificationContext';

/** The verification-only subset stored on `Vendor.verificationStatus`. */
export type VendorVerificationStatus =
  | 'not_started'
  | 'pending_review'
  | 'retry_required'
  | 'approved'
  | 'rejected';

export const VENDOR_VERIFICATION_STATUSES: readonly VendorVerificationStatus[] = [
  'not_started',
  'pending_review',
  'retry_required',
  'approved',
  'rejected',
];
