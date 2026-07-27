/**
 * Central vendor discovery visibility rules for the platform.
 *
 * These functions are the single source of truth for which vendors appear in
 * public discovery (Home, Explore, Search) and which can be accessed via
 * direct storefront link. They are used by the API layer, VendorFilterContext,
 * and the storefront route guard.
 *
 * Also contains the normalized internal verification status mapping layer —
 * the bridge between raw provider statuses and the platform's internal status model.
 */

import type { Vendor } from '@/mocks/vendorData';

// =============================================================================
// NORMALIZED INTERNAL VERIFICATION STATUS MAPPING LAYER
// =============================================================================
//
// the platform uses a fixed set of internal verification statuses that are
// independent of any specific KYC/KYB provider's vocabulary. Raw provider
// status strings (providerStatus, providerWebhookStatus) live inside
// MockVerificationProviderData and are NEVER used directly for business logic.
//
// All business logic (discovery visibility, direct link access, blocking)
// consumes ONLY the normalized internal status.
//
// When a real provider is wired, the mapping function below is extended
// with that provider's status vocabulary. The rest of the codebase does
// not change — it only ever sees the normalized internal status.
// =============================================================================

/**
 * Normalized internal verification statuses used by all the platform business logic.
 *
 * These are SEPARATE from raw provider status strings (providerStatus,
 * providerWebhookStatus). The mapping function below converts provider-specific
 * statuses into these normalized values.
 *
 * Lifecycle:
 *   not_started → in_progress → pending_review → approved
 *                                               → rejected → retry_required → (back to not_started)
 *
 * Account-level (admin/moderator actions):
 *   approved → suspended (blocked, irreversible without admin action)
 *   approved → deactivated (account closed)
 */
export type InternalVerificationStatus =
  | 'not_started'
  | 'in_progress'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'retry_required'
  | 'suspended'
  | 'deactivated';

// ---------------------------------------------------------------------------
// Per-provider status mapping reference tables
// ---------------------------------------------------------------------------
// These tables document how each provider's raw status values map to
// the platform's internal statuses. When wiring a provider, extend
// mapProviderStatusToInternalStatus() with the relevant mapping.
//
// TODO: Smile Identity webhook payload → internal status mapping
// ─────────────────────────────────────────────────────────────
// Smile Identity sends webhooks with Job.result.ResultText and
// Job.result.Actions.* fields.
//
//   Smile Identity ResultText          → Internal status
//   ─────────────────────────────────────────────────────
//   "Approved"                          → 'approved'
//   "Rejected"                          → 'rejected'
//   "Pending" / "Provisionally Approved" → 'pending_review'
//   "Resubmission Required"             → 'retry_required'
//   (Job in progress, no result yet)    → 'in_progress'
//
//   Webhook endpoint: POST /api/webhooks/smile-identity
//   Payload shape: { job_id, result: { ResultText, Actions }, ... }
//   Reference: https://docs.smileidentity.com/webhooks
//
// TODO: ComplyCube webhook payload → internal status mapping
// ──────────────────────────────────────────────────────────
// ComplyCube sends webhooks with event type and check.status.
//
//   ComplyCube check.status             → Internal status
//   ─────────────────────────────────────────────────────
//   "complete"                           → 'approved'
//   "failed"                             → 'rejected'
//   "pending"                            → 'in_progress'
//   "needs_review"                       → 'pending_review'
//   "expired"                            → 'retry_required'
//
//   Webhook endpoint: POST /api/webhooks/complycube
//   Payload shape: { event, payload: { check: { status }, ... } }
//   Reference: https://docs.complycube.com/api/webhooks
//
// TODO: Persona webhook payload → internal status mapping
// ────────────────────────────────────────────────────────
// Persona sends webhooks with inquiry.status and
// inquiry.checks[].status.
//
//   Persona inquiry.status               → Internal status
//   ─────────────────────────────────────────────────────
//   "completed" (all checks passed)       → 'approved'
//   "failed" (any check failed)           → 'rejected'
//   "processing" / "created" / "pending"  → 'in_progress'
//   "review" / "needs_review"             → 'pending_review'
//   "requires_retry"                      → 'retry_required'
//   "expired"                             → 'retry_required'
//
//   Webhook endpoint: POST /api/webhooks/persona
//   Payload shape: { data: { attributes: { status, checks }, ... } }
//   Reference: https://docs.withpersona.com/docs/webhooks

/**
 * Maps a raw provider status to the platform's normalized internal status.
 *
 * This is the SINGLE place where provider-specific status strings are
 * translated into the platform's internal model. All business logic downstream
 * consumes only InternalVerificationStatus — never raw providerStatus.
 *
 * Currently only handles the 'mock' provider. When a real provider is wired:
 * 1. Add the provider's status vocabulary to the mapping tables above
 * 2. Extend the switch/case below with the new providerName
 * 3. Wire the provider's webhook handler to call this function
 * 4. Store the result as the vendor's canonical internal status
 *
 * @param providerName - Identifier for the KYC/KYB provider ('mock', 'smile_identity', etc.)
 * @param providerStatus - Raw status string from the provider's API or webhook
 * @param providerWebhookStatus - Optional webhook event type for disambiguation
 * @returns The normalized internal verification status
 */
export function mapProviderStatusToInternalStatus(
  providerName: string,
  providerStatus: string,
  providerWebhookStatus?: string,
): InternalVerificationStatus {
  // TODO: When wiring a real provider, replace this single branch with
  // per-provider mapping logic. Example structure:
  //
  //   switch (providerName) {
  //     case 'smile_identity':
  //       return mapSmileIdentityStatus(providerStatus, providerWebhookStatus);
  //     case 'complycube':
  //       return mapComplyCubeStatus(providerStatus, providerWebhookStatus);
  //     case 'persona':
  //       return mapPersonaStatus(providerStatus, providerWebhookStatus);
  //     default:
  //       return 'not_started';
  //   }

  switch (providerName) {
    case 'mock': {
      // Mock provider mapping: mirrors what a real provider would return.
      // The mockVerificationResult() function in VerificationContext sets
      // providerStatus to 'verified' or 'failed'. We normalize those here.
      const normalized = providerStatus.toLowerCase();

      if (normalized === 'verified' || normalized === 'approved' || normalized === 'complete') {
        return 'approved';
      }
      if (normalized === 'failed' || normalized === 'rejected') {
        // Check webhook status for retry eligibility
        if (providerWebhookStatus === 'check.requires_retry') {
          return 'retry_required';
        }
        return 'rejected';
      }
      if (normalized === 'pending' || normalized === 'processing') {
        // Distinguish between in_progress and pending_review via webhook event
        if (providerWebhookStatus === 'check.under_review') {
          return 'pending_review';
        }
        return 'in_progress';
      }
      if (normalized === 'suspended') {
        return 'suspended';
      }
      if (normalized === 'deactivated') {
        return 'deactivated';
      }
      // Fallback: treat unknown provider statuses conservatively
      return 'not_started';
    }

    // TODO: Smile Identity mapping (when wired)
    // case 'smile_identity': {
    //   switch (providerStatus) {
    //     case 'Approved':
    //       return 'approved';
    //     case 'Rejected':
    //       return 'rejected';
    //     case 'Provisionally Approved':
    //       return 'pending_review';
    //     case 'Resubmission Required':
    //       return 'retry_required';
    //     default:
    //       return 'in_progress';
    //   }
    // }

    // TODO: ComplyCube mapping (when wired)
    // case 'complycube': {
    //   switch (providerStatus) {
    //     case 'complete':
    //       return 'approved';
    //     case 'failed':
    //       return 'rejected';
    //     case 'needs_review':
    //       return 'pending_review';
    //     case 'expired':
    //       return 'retry_required';
    //     default:
    //       return 'in_progress';
    //   }
    // }

    // TODO: Persona mapping (when wired)
    // case 'persona': {
    //   switch (providerStatus) {
    //     case 'completed':
    //       return 'approved';
    //     case 'failed':
    //       return 'rejected';
    //     case 'needs_review':
    //     case 'review':
    //       return 'pending_review';
    //     case 'requires_retry':
    //     case 'expired':
    //       return 'retry_required';
    //     default:
    //       return 'in_progress';
    //   }
    // }

    default:
      // Unknown provider: treat conservatively as not_started.
      // In production, this should trigger an alert/monitoring event.
      console.warn(
        `[vendorDiscovery] Unknown provider '${providerName}' with status '${providerStatus}'. ` +
        `Defaulting to 'not_started'. Extend mapProviderStatusToInternalStatus() to support this provider.`,
      );
      return 'not_started';
  }
}

/**
 * Type guard: returns true if the given string is a valid InternalVerificationStatus.
 */
export function isInternalVerificationStatus(value: string): value is InternalVerificationStatus {
  const validStatuses: Set<string> = new Set([
    'not_started',
    'in_progress',
    'pending_review',
    'approved',
    'rejected',
    'retry_required',
    'suspended',
    'deactivated',
  ]);
  return validStatuses.has(value);
}

// =============================================================================
// VENDOR STATUS → INTERNAL STATUS CONVERSION
// =============================================================================
//
// Before any visibility decision is made, the vendor's raw status (whether it
// comes from the legacy vendorStatus field or from a third-party provider's
// providerStatus) MUST be converted to InternalVerificationStatus.
//
// The visibility helpers (canAppearInPublicDiscovery, canAccessViaDirectLink,
// isVendorAccountBlocked) consume ONLY InternalVerificationStatus. They never read
// raw vendorStatus or providerStatus directly.
//
// When a real KYC/KYB provider is wired:
//   1. The provider's webhook handler receives a raw providerStatus string
//   2. mapProviderStatusToInternalStatus() converts it to InternalVerificationStatus
//   3. That normalized value is stored on the vendor record
//   4. getVendorInternalStatus() reads that stored value
//   5. Visibility helpers consume only the normalized value
//
// This ensures public visibility never depends directly on raw provider strings.
// =============================================================================

/**
 * Converts a Vendor's status into the normalized InternalVerificationStatus.
 *
 * This is the boundary between raw status data (legacy vendorStatus field,
 * provider data) and the platform's internal status model. All downstream visibility
 * logic consumes only the return value of this function.
 *
 * TODO: When real provider data is stored on the vendor record (e.g. a
 * `verificationStatus: InternalVerificationStatus` field), this function
 * should read that field directly instead of mapping from the legacy
 * vendorStatus string.
 */
export function getVendorInternalStatus(vendor: Vendor): InternalVerificationStatus {
  const raw = vendor.vendorStatus;

  // Legacy vendorStatus → InternalVerificationStatus mapping.
  // This exists because mock vendor data still uses the old status strings.
  // Once vendors carry a native InternalVerificationStatus field, this
  // mapping is replaced by a direct field read.
  switch (raw) {
    case 'ACTIVE':
    case 'active':
    case 'verified':
      return 'approved';

    case 'SUSPENDED':
    case 'suspended':
      return 'suspended';

    case 'DEACTIVATED':
    case 'deactivated':
      return 'deactivated';

    case 'UNVERIFIED':
    case 'unverified':
    case 'WAITLISTED':
    case 'waitlisted':
    case 'registered':
    case undefined:
    default:
      return 'not_started';
  }
}

// =============================================================================
// VENDOR DISCOVERY VISIBILITY RULES
// =============================================================================
//
// IMPORTANT: These functions consume ONLY InternalVerificationStatus.
// Raw providerStatus / providerWebhookStatus values are NEVER referenced here.
// The mapping from raw provider data to InternalVerificationStatus happens
// upstream — in mapProviderStatusToInternalStatus() and getVendorInternalStatus().
// =============================================================================

/**
 * Returns true if a vendor should appear in public discovery surfaces:
 * Home, Explore, and Search.
 *
 * ONLY vendors with InternalVerificationStatus === 'approved' are eligible.
 *
 * Vendors with any other status (not_started, pending_review, rejected,
 * retry_required, suspended, deactivated) are hidden from public
 * discovery. They may still be accessible via direct storefront link if
 * not suspended/deactivated (see canAccessViaDirectLink).
 */
export function canAppearInPublicDiscovery(vendor: Vendor): boolean {
  const status = getVendorInternalStatus(vendor);
  return status === 'approved';
}

/**
 * Returns true if a vendor's storefront can be accessed via a direct link.
 *
 * Direct links work for all vendors EXCEPT those that are suspended or
 * deactivated. This means:
 * - Approved vendors: full access
 * - Not started / pending review / rejected / retry required:
 *   accessible via direct link but hidden from public discovery
 * - Suspended / deactivated: fully blocked, direct links also blocked
 *
 * NOTE: This function is about verification/account status only.
 * Customer-to-vendor user blocking (mute, block, report) is handled separately
 * and must NOT be mixed with this function.
 */
export function canAccessViaDirectLink(vendor: Vendor): boolean {
  return !isVendorAccountBlocked(vendor);
}

/**
 * Returns true if the vendor's account is fully blocked from ALL access —
 * neither public discovery nor direct storefront links are allowed.
 *
 * Only suspended and deactivated vendors are account-blocked.
 *
 * IMPORTANT: This checks verification/account status only.
 * It is NOT the same as customer/vendor user-level blocking (mute/block/report).
 * Those are handled by separate user relationship logic.
 *
 * Use this ONLY for storefront route guards and discovery filtering.
 */
export function isVendorAccountBlocked(vendor: Vendor): boolean {
  const status = getVendorInternalStatus(vendor);
  return status === 'suspended' || status === 'deactivated';
}

/**
 * @deprecated Use isVendorAccountBlocked() instead.
 * Kept as an alias to avoid breaking existing call sites during migration.
 * isVendorAccountBlocked is more explicit: it only covers suspended/deactivated
 * account-level blocking, not customer/vendor user blocking.
 */
export function isVendorBlocked(vendor: Vendor): boolean {
  return isVendorAccountBlocked(vendor);
}

/**
 * Returns true if the vendor is approved and can appear in public discovery.
 * Delegates to canAppearInPublicDiscovery for consistency.
 */
export function isApprovedForDiscovery(vendor: Vendor): boolean {
  return canAppearInPublicDiscovery(vendor);
}

/**
 * Filters an array of vendors to only those eligible for public discovery.
 */
export function filterForPublicDiscovery(vendors: Vendor[]): Vendor[] {
  return vendors.filter(canAppearInPublicDiscovery);
}

// =============================================================================
// PROVIDER INTEGRATION DATA TYPES
// =============================================================================

/**
 * Backend-ready mock structure for a future KYC/KYB provider integration.
 *
 * Designed to be swapped with a real provider (Smile Identity, ComplyCube, Persona, etc.)
 * without changing the shape. When a real provider is wired:
 * - providerName changes from 'mock' to the provider's identifier
 * - providerApplicantId and providerVerificationId come from the provider API
 * - providerStatus reflects the provider's native status enum
 * - providerWebhookStatus tracks async webhook updates
 * - manualReviewStatus gates the manual review pipeline
 * - businessDocumentUploads holds KYB doc URIs
 * - Timestamps (submittedAt, reviewedAt, approvedAt, rejectedAt) are populated by
 *   provider API responses and webhook events, not mock setTimeout
 */
export interface MockVerificationProviderData {
  // ---- Provider identification (maps to real provider's applicant/verification IDs) ----
  /** Identifier for the KYC/KYB provider (e.g. 'mock', 'smile_identity', 'complycube', 'persona') */
  providerName: string;
  /** The applicant or entity ID on the provider's side — links this verification to a provider record */
  providerApplicantId: string;
  /** The specific verification run/check ID returned by the provider's create-verification endpoint */
  providerVerificationId: string;

  // ---- Provider status tracking ----
  /** Raw status string from the provider's API (e.g. 'pending', 'verified', 'failed', 'needs_review') */
  providerStatus: string;
  /** Last webhook event status received from the provider's async callback */
  providerWebhookStatus: string;

  // ---- Failure tracking ----
  /** Raw failure reason returned by the provider (e.g. 'document_not_legible', 'face_mismatch') */
  providerFailureReason: string;

  // ---- Manual review pipeline ----
  /**
   * Manual review status for cases where the provider returns ambiguous results.
   * - 'not_required': Provider result is conclusive; no manual review needed
   * - 'pending': Awaiting assignment to a reviewer
   * - 'in_review': Reviewer is examining the case
   * - 'completed': Manual review finished (result applied to the vendor's status)
   */
  manualReviewStatus: 'not_required' | 'pending' | 'in_review' | 'completed';

  // ---- Verification type ----
  /** Whether this is an individual (KYC-only) or business (KYC + KYB) verification */
  verificationType: 'individual' | 'business';

  // ---- Legacy reference (kept for backwards compatibility) ----
  providerReferenceId: string;

  // ---- KYC/KYB sub-statuses ----
  kycStatus: 'not_started' | 'in_progress' | 'pending_review' | 'approved' | 'rejected' | 'retry_required';
  kybStatus: 'not_started' | 'in_progress' | 'pending_review' | 'approved' | 'rejected' | 'retry_required' | 'not_required';

  // ---- Timestamps (populated from provider API responses / webhooks) ----
  /** When the verification was first submitted to the provider */
  submittedAt?: string;
  /** When the provider completed its automated check */
  reviewedAt?: string;
  /** When the verification was approved (by provider or manual review) */
  approvedAt?: string;
  /** When the verification was rejected (by provider or manual review) */
  rejectedAt?: string;

  // ---- Rejection / retry ----
  rejectionReason?: string;
  retryAllowed: boolean;
  requiredSteps: string[];

  // ---- Uploaded files (individual KYC) ----
  uploadedIdUri?: string;
  uploadedSelfieUri?: string;

  // ---- Business document uploads (KYB) ----
  /**
   * Documents required for business verification.
   * Populated when verificationType is 'business'.
   * Each URI references a file uploaded to the provider's storage or the app's backend.
   */
  businessDocumentUploads?: {
    /** Business registration certificate */
    registrationUri?: string;
    /** Tax identification document */
    taxIdUri?: string;
    /** Proof of business address (utility bill, lease, etc.) */
    proofOfAddressUri?: string;
    /** Certificate of incorporation */
    certificateOfIncorporationUri?: string;
    /** ID document of a company director */
    directorIdUri?: string;
  };
}
