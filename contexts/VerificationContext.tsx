import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import type { MockVerificationProviderData } from '@/utils/vendorDiscovery';

/**
 * Normalized internal verification statuses for vendor accounts.
 *
 * pending_review is the primary stored status after verification begins.
 * It covers both "documents being collected" and "submitted, awaiting review"
 * phases. This avoids banner inconsistency across screens.
 *
 * in_progress is deliberately NOT a stored vendor status. It exists only
 * in the InternalVerificationStatus union for future provider mapping
 * (e.g. when a KYC provider returns "processing" for a job that hasn't
 * reached review yet). It must never be persisted to AsyncStorage or
 * shown in the dashboard/hub as a standalone state.
 *
 * Individual identity verification (KYC):
 * - not_started: No verification attempted yet
 * - pending_review: Verification started / submitted, awaiting review
 * - approved: Identity verified successfully
 * - rejected: Identity verification failed, can retry
 * - retry_required: Specific action required before retry
 *
 * Account-level statuses:
 * - suspended: Account blocked by admin/moderation. Storefront inaccessible.
 * - deactivated: Account closed by vendor or admin. Fully removed.
 */
export type VerificationStatus =
  | 'not_started'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'retry_required'
  | 'suspended'
  | 'deactivated';

export type VerificationType = 'individual' | 'business';

/** Maps to what would come from a real KYC/KYB provider */
export interface VerificationData {
  status: VerificationStatus;
  type: VerificationType;
  submittedAt?: string;
  reviewedAt?: string;
  referenceId?: string;
  rejectionReason?: string;
  retryAllowed: boolean;
  requiresKYB: boolean;
  kybCompleted: boolean;
  /** Provider-ready fields — structured for real integration */
  providerData: MockVerificationProviderData;
}

const VERIFICATION_KEY = '@the platform_vendor_verification';

function generateReferenceId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `LAE-VER-${ts}-${rand}`;
}

function createDefaultProviderData(): MockVerificationProviderData {
  return {
    // Provider identification (empty until wired to a real provider)
    providerName: 'mock',
    providerApplicantId: '',
    providerVerificationId: '',
    // Provider status tracking
    providerStatus: '',
    providerWebhookStatus: '',
    // Failure tracking
    providerFailureReason: '',
    // Manual review (not required while using mock provider)
    manualReviewStatus: 'not_required',
    // Verification type
    verificationType: 'individual',
    // Legacy reference
    providerReferenceId: '',
    // KYC/KYB statuses
    kycStatus: 'not_started',
    kybStatus: 'not_required',
    // Retry
    retryAllowed: true,
    requiredSteps: ['government_id', 'selfie_liveness'],
    // Business documents — empty until verificationType is 'business'
    businessDocumentUploads: {},
  };
}

const DEFAULT_VERIFICATION: VerificationData = {
  status: 'not_started',
  type: 'individual',
  requiresKYB: false,
  kybCompleted: false,
  retryAllowed: true,
  providerData: createDefaultProviderData(),
};

export const [VerificationProvider, useVerification] = createContextHook(() => {
  const { user } = useAuth();
  const [verificationData, setVerificationData] = useState<VerificationData>(DEFAULT_VERIFICATION);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadVerificationData = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const stored = await AsyncStorage.getItem(`${VERIFICATION_KEY}_${user.id}`);
      if (stored) {
        const parsed = JSON.parse(stored) as VerificationData;
        // Ensure providerData exists for backwards compatibility
        if (!parsed.providerData) {
          parsed.providerData = createDefaultProviderData();
        }
        setVerificationData(parsed);
      } else {
        setVerificationData(DEFAULT_VERIFICATION);
      }
    } catch (error) {
      console.error('[VERIFICATION] Failed to load data:', error);
      setVerificationData(DEFAULT_VERIFICATION);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadVerificationData();
  }, [loadVerificationData]);

  const saveVerificationData = async (data: VerificationData) => {
    if (!user?.id) return;

    try {
      await AsyncStorage.setItem(`${VERIFICATION_KEY}_${user.id}`, JSON.stringify(data));
      setVerificationData(data);
      console.log('[VERIFICATION] Data saved:', data.status);
    } catch (error) {
      console.error('[VERIFICATION] Failed to save data:', error);
    }
  };

  const startVerification = async (type: VerificationType) => {
    const referenceId = generateReferenceId();
    const now = new Date().toISOString();
    // pending_review is the primary stored status after verification begins.
    // There is no separate 'in_progress' status — the pending_review phase
    // covers both document collection and review-waiting. This ensures
    // consistent banners and hub states across all screens.
    const data: VerificationData = {
      ...verificationData,
      status: 'pending_review',
      type,
      submittedAt: now,
      referenceId,
      rejectionReason: undefined,
      retryAllowed: true,
      providerData: {
        ...verificationData.providerData,
        providerName: 'mock',
        // When wired to a real provider, these come from the provider's create-applicant / create-verification API calls
        providerApplicantId: '', // TODO: populated by provider API when wired
        providerVerificationId: '', // TODO: populated by provider API when wired
        providerStatus: 'pending',
        providerWebhookStatus: '',
        providerFailureReason: '',
        manualReviewStatus: 'not_required',
        providerReferenceId: referenceId,
        verificationType: type,
        kycStatus: 'pending_review',
        kybStatus: type === 'business' ? 'pending_review' : 'not_required',
        submittedAt: now,
        retryAllowed: true,
        requiredSteps: type === 'business'
          ? ['government_id', 'selfie_liveness', 'business_registration', 'tax_id']
          : ['government_id', 'selfie_liveness'],
      },
    };
    await saveVerificationData(data);
  };

  /** Store the uploaded ID URI in verification state */
  const uploadIdDocument = async (uri: string) => {
    const data: VerificationData = {
      ...verificationData,
      providerData: {
        ...verificationData.providerData,
        uploadedIdUri: uri,
        kycStatus: 'pending_review',
      },
    };
    await saveVerificationData(data);
    console.log('[VERIFICATION] ID document stored:', uri.substring(0, 50) + '...');
  };

  /** Store the uploaded selfie URI in verification state */
  const uploadSelfie = async (uri: string) => {
    const data: VerificationData = {
      ...verificationData,
      providerData: {
        ...verificationData.providerData,
        uploadedSelfieUri: uri,
        kycStatus: 'pending_review',
      },
    };
    await saveVerificationData(data);
    console.log('[VERIFICATION] Selfie stored:', uri.substring(0, 50) + '...');
  };

  const submitForReview = async () => {
    const now = new Date().toISOString();
    const data: VerificationData = {
      ...verificationData,
      status: 'pending_review',
      submittedAt: verificationData.submittedAt || now,
      providerData: {
        ...verificationData.providerData,
        kycStatus: 'pending_review',
        submittedAt: verificationData.providerData.submittedAt || now,
      },
    };
    await saveVerificationData(data);

    // Mock automated review after 5 seconds
    setTimeout(async () => {
      await mockVerificationResult();
    }, 5000);
  };

  const mockVerificationResult = async () => {
    // Simulates what a real provider's webhook or polling response would return.
    // When wired to a real provider, this function is replaced by the webhook handler
    // which reads providerStatus, providerWebhookStatus, etc. from the provider's payload.
    const shouldApprove = Math.random() > 0.3;
    const now = new Date().toISOString();

    if (shouldApprove) {
      const data: VerificationData = {
        ...verificationData,
        status: 'approved',
        reviewedAt: now,
        providerData: {
          ...verificationData.providerData,
          kycStatus: 'approved',
          reviewedAt: now,
          approvedAt: now,
          // In a real provider: providerStatus would be set to the provider's "verified" equivalent
          providerStatus: 'verified',
          providerWebhookStatus: 'check.completed',
        },
      };
      await saveVerificationData(data);
    } else {
      const data: VerificationData = {
        ...verificationData,
        status: 'rejected',
        reviewedAt: now,
        rejectionReason: 'ID photo does not match selfie',
        retryAllowed: true,
        providerData: {
          ...verificationData.providerData,
          kycStatus: 'rejected',
          reviewedAt: now,
          rejectedAt: now,
          rejectionReason: 'ID photo does not match selfie',
          retryAllowed: true,
          // In a real provider: these would map to the provider's failure fields
          providerStatus: 'failed',
          providerWebhookStatus: 'check.completed',
          providerFailureReason: 'ID photo does not match selfie',
        },
      };
      await saveVerificationData(data);
    }
  };

  const retryVerification = async () => {
    const data: VerificationData = {
      ...verificationData,
      status: 'not_started',
      rejectionReason: undefined,
      retryAllowed: true,
      providerData: {
        ...verificationData.providerData,
        kycStatus: 'not_started',
        rejectionReason: undefined,
        retryAllowed: true,
        uploadedIdUri: undefined,
        uploadedSelfieUri: undefined,
      },
    };
    await saveVerificationData(data);
  };

  const setBusinessVerificationRequired = async (required: boolean) => {
    const data: VerificationData = {
      ...verificationData,
      requiresKYB: required,
      type: required ? 'business' : 'individual',
      providerData: {
        ...verificationData.providerData,
        verificationType: required ? 'business' : 'individual',
        kybStatus: required ? 'in_progress' : 'not_required',
        requiredSteps: required
          ? ['government_id', 'selfie_liveness', 'business_registration', 'tax_id']
          : ['government_id', 'selfie_liveness'],
      },
    };
    await saveVerificationData(data);
  };

  const completeKYB = async () => {
    const data: VerificationData = {
      ...verificationData,
      kybCompleted: true,
      providerData: {
        ...verificationData.providerData,
        kybStatus: 'approved',
      },
    };
    await saveVerificationData(data);
  };

  /** Admin/moderator: suspend a vendor account */
  const suspendAccount = async (reason: string) => {
    const data: VerificationData = {
      ...verificationData,
      status: 'suspended',
      rejectionReason: reason,
      retryAllowed: false,
      providerData: {
        ...verificationData.providerData,
        retryAllowed: false,
        rejectionReason: reason,
      },
    };
    await saveVerificationData(data);
  };

  /** Admin/vendor: deactivate an account */
  const deactivateAccount = async () => {
    const data: VerificationData = {
      ...verificationData,
      status: 'deactivated',
      retryAllowed: false,
      providerData: {
        ...verificationData.providerData,
        retryAllowed: false,
      },
    };
    await saveVerificationData(data);
  };

  // ---------------------------------------------------------------------------
  // Admin-only override helpers
  //
  // These functions bypass the KYC/KYB provider entirely and directly set the
  // vendor's internal verification/account status. They are intended for use by
  // the platform admins and moderators, NOT by vendor-facing code.
  //
  // In a real backend, each function would:
  //   1. Accept a vendorId param and make an authenticated admin API call
  //   2. Write the new status to the vendor's record in Firestore/Supabase
  //   3. Trigger any downstream effects (email notification, audit log, etc.)
  //
  // The vendorId param is accepted now so callers are structured correctly
  // for the real backend — even though the mock ignores it and updates local state.
  // ---------------------------------------------------------------------------

  /**
   * Admin override: approve a vendor, bypassing KYC/KYB provider result.
   * Sets status to 'approved' with optional admin note.
   * Does NOT require a prior provider result.
   *
   * TODO: Wire to POST /api/admin/vendors/:vendorId/approve
   */
  const adminApproveVendor = async (_vendorId: string, note?: string) => {
    const now = new Date().toISOString();
    const data: VerificationData = {
      ...verificationData,
      status: 'approved',
      reviewedAt: now,
      rejectionReason: undefined,
      retryAllowed: false,
      providerData: {
        ...verificationData.providerData,
        kycStatus: 'approved',
        reviewedAt: now,
        approvedAt: now,
        // Admin override — not a provider result
        providerStatus: 'admin_approved',
        providerWebhookStatus: '',
        manualReviewStatus: 'completed',
        rejectionReason: note,
        retryAllowed: false,
      },
    };
    await saveVerificationData(data);
    console.log('[ADMIN] Vendor approved manually', note ? `— note: ${note}` : '');
  };

  /**
   * Admin override: reject a vendor with a mandatory reason.
   * Sets status to 'rejected' and marks retryAllowed based on admin decision.
   * Independent of provider webhook status.
   *
   * TODO: Wire to POST /api/admin/vendors/:vendorId/reject
   */
  const adminRejectVendor = async (_vendorId: string, reason: string, allowRetry = true) => {
    const now = new Date().toISOString();
    const data: VerificationData = {
      ...verificationData,
      status: 'rejected',
      reviewedAt: now,
      rejectionReason: reason,
      retryAllowed: allowRetry,
      providerData: {
        ...verificationData.providerData,
        kycStatus: 'rejected',
        reviewedAt: now,
        rejectedAt: now,
        rejectionReason: reason,
        retryAllowed: allowRetry,
        // Admin override — not a provider result
        providerStatus: 'admin_rejected',
        providerWebhookStatus: '',
        providerFailureReason: reason,
        manualReviewStatus: 'completed',
      },
    };
    await saveVerificationData(data);
    console.log('[ADMIN] Vendor rejected manually — reason:', reason);
  };

  /**
   * Admin override: mark a vendor as retry_required with a reason.
   * Used when admin needs the vendor to fix something before resubmitting.
   * Different from 'rejected' — this is a guided resubmission prompt.
   *
   * TODO: Wire to POST /api/admin/vendors/:vendorId/set-retry-required
   */
  const adminSetRetryRequired = async (_vendorId: string, reason: string) => {
    const now = new Date().toISOString();
    const data: VerificationData = {
      ...verificationData,
      status: 'retry_required',
      reviewedAt: now,
      rejectionReason: reason,
      retryAllowed: true,
      providerData: {
        ...verificationData.providerData,
        kycStatus: 'retry_required',
        reviewedAt: now,
        rejectedAt: now,
        rejectionReason: reason,
        retryAllowed: true,
        // Admin override — not a provider result
        providerStatus: 'admin_retry_required',
        providerWebhookStatus: '',
        providerFailureReason: reason,
        manualReviewStatus: 'completed',
      },
    };
    await saveVerificationData(data);
    console.log('[ADMIN] Vendor set to retry_required — reason:', reason);
  };

  /**
   * Admin override: suspend a vendor account.
   * Suspended vendors are fully blocked — direct storefront links are inaccessible.
   * Independent of KYC/KYB provider status.
   *
   * TODO: Wire to POST /api/admin/vendors/:vendorId/suspend
   */
  const adminSuspendVendor = async (_vendorId: string, reason: string) => {
    const now = new Date().toISOString();
    const data: VerificationData = {
      ...verificationData,
      status: 'suspended',
      reviewedAt: now,
      rejectionReason: reason,
      retryAllowed: false,
      providerData: {
        ...verificationData.providerData,
        retryAllowed: false,
        rejectionReason: reason,
        manualReviewStatus: 'completed',
        providerStatus: 'admin_suspended',
        providerWebhookStatus: '',
      },
    };
    await saveVerificationData(data);
    console.log('[ADMIN] Vendor suspended — reason:', reason);
  };

  /**
   * Admin override: deactivate a vendor account.
   * Deactivated vendors are fully removed from all surfaces.
   * This is irreversible without an explicit admin reactivation.
   *
   * TODO: Wire to POST /api/admin/vendors/:vendorId/deactivate
   */
  const adminDeactivateVendor = async (_vendorId: string) => {
    const now = new Date().toISOString();
    const data: VerificationData = {
      ...verificationData,
      status: 'deactivated',
      reviewedAt: now,
      retryAllowed: false,
      providerData: {
        ...verificationData.providerData,
        retryAllowed: false,
        manualReviewStatus: 'completed',
        providerStatus: 'admin_deactivated',
        providerWebhookStatus: '',
      },
    };
    await saveVerificationData(data);
    console.log('[ADMIN] Vendor deactivated');
  };

  return {
    verificationData,
    isLoading,
    startVerification,
    uploadIdDocument,
    uploadSelfie,
    submitForReview,
    retryVerification,
    setBusinessVerificationRequired,
    completeKYB,
    suspendAccount,
    deactivateAccount,
    mockVerificationResult,
    // Admin-only overrides — bypass KYC/KYB provider, operate directly on internal status
    adminApproveVendor,
    adminRejectVendor,
    adminSetRetryRequired,
    adminSuspendVendor,
    adminDeactivateVendor,
  };
});
