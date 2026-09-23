import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { verificationService } from '@/services/verificationService';
import type { MockVerificationProviderData } from '@/utils/vendorDiscovery';
import { auth, callable, db } from '@/lib/firebase';
import { DEV_LOCAL_AUTH_ENABLED } from '@/constants/devAuth';
import { uploadVerificationDocument } from '@/lib/verification/uploadVerificationDocument';

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

const VERIFICATION_KEY = '@platform_vendor_verification';

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

const VALID_VERIFICATION_STATUSES: VerificationStatus[] = [
  'not_started',
  'pending_review',
  'approved',
  'rejected',
  'retry_required',
  'suspended',
  'deactivated',
];

function normalizeVerificationStatus(status: unknown): VerificationStatus {
  if (status === 'in_progress') {
    return 'pending_review';
  }

  if (typeof status === 'string' && VALID_VERIFICATION_STATUSES.includes(status as VerificationStatus)) {
    return status as VerificationStatus;
  }

  return DEFAULT_VERIFICATION.status;
}

function normalizeVerificationData(raw: unknown): VerificationData {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_VERIFICATION, providerData: createDefaultProviderData() };
  }

  const parsed = raw as Partial<VerificationData> & { status?: unknown; providerData?: Partial<MockVerificationProviderData> };
  const providerDefaults = createDefaultProviderData();
  const status = normalizeVerificationStatus(parsed.status);
  const type: VerificationType = parsed.type === 'business' ? 'business' : 'individual';

  return {
    ...DEFAULT_VERIFICATION,
    ...parsed,
    status,
    type,
    retryAllowed: parsed.retryAllowed ?? DEFAULT_VERIFICATION.retryAllowed,
    requiresKYB: parsed.requiresKYB ?? DEFAULT_VERIFICATION.requiresKYB,
    kybCompleted: parsed.kybCompleted ?? DEFAULT_VERIFICATION.kybCompleted,
    providerData: {
      ...providerDefaults,
      ...(parsed.providerData ?? {}),
      verificationType: type,
      kycStatus: status === 'pending_review' ? 'pending_review' : providerDefaults.kycStatus,
    },
  };
}

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
      // Read-only verification status load now flows through the service stack:
      // verificationService.getVerification → verificationRepository.read → verificationMapper.fromRaw.
      // The context remains the live reactive source; writes below stay local for now.
      // TODO(Henry): repoint verificationService at the KYC/KYB provider + Firestore.
      const record = await verificationService.getVerification(user.id);
      if (record) {
        const normalized = normalizeVerificationData(record);
        setVerificationData(normalized);
      } else {
        setVerificationData({ ...DEFAULT_VERIFICATION, providerData: createDefaultProviderData() });
      }
    } catch (error) {
      console.error('[VERIFICATION] Failed to load data:', error);
      setVerificationData({ ...DEFAULT_VERIFICATION, providerData: createDefaultProviderData() });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadVerificationData();
  }, [loadVerificationData]);

  /**
   * The real admin decision, live.
   *
   * submitForReview's own comment already says the local pending_review
   * status "moves off that only when the backend says so" — but nothing
   * ever checked what the backend said. approveVendorVerification /
   * rejectVendorVerification (admin-only, vendorModeration.ts) write the
   * real decision to vendorVerification/{vendorId}, and this device never
   * read it: loadVerificationData above only ever reads the local
   * AsyncStorage record, so an admin's approval or rejection never reached
   * the vendor's own screens. Only overrides status once the backend has an
   * actual decision (approved/rejected) — pending_review/not_started stay
   * locally driven, since those are legitimately client-side states before
   * a decision exists.
   */
  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = auth.onIdTokenChanged(async (fbUser) => {
      unsubscribeDoc?.();
      unsubscribeDoc = null;
      if (!fbUser) return;

      const token = await fbUser.getIdTokenResult();
      const vendorId = token.claims.vendorId as string | undefined;
      if (!vendorId) return;

      unsubscribeDoc = onSnapshot(
        doc(db, 'vendorVerification', vendorId),
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();
          const backendStatus = data.verificationStatus as string | undefined;
          if (backendStatus !== 'approved' && backendStatus !== 'rejected') return;

          const reviewedAt = (data.reviewedAt as { toDate?: () => Date } | undefined)?.toDate?.().toISOString();
          setVerificationData((prev) => ({
            ...prev,
            status: backendStatus,
            reviewedAt: reviewedAt ?? prev.reviewedAt,
            rejectionReason: backendStatus === 'rejected' ? (data.rejectionReason as string | undefined) ?? prev.rejectionReason : undefined,
            retryAllowed: backendStatus === 'rejected',
          }));
        },
        (err) => console.error('[VERIFICATION] Live decision subscription failed:', err),
      );
    });

    return () => {
      unsubscribeDoc?.();
      unsubscribeAuth();
    };
  }, []);

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

  /**
   * Uploads the ID photo and records it on the server.
   *
   * This used to store the picked image's local file:// URI and nothing
   * else — the photo never left the device, so recordVerificationDocument
   * (deployed since P1-FB-005) never had anything to record, and
   * submitVendorVerification's required-document check could never see a
   * government_id document. Mapped to the backend's `identity_document`
   * type, the closest of its allowed types to a government ID.
   *
   * Local URI is still kept for the screen's own "uploaded ✓" preview; the
   * upload itself is what actually matters now.
   */
  const uploadIdDocument = async (uri: string) => {
    if (!DEV_LOCAL_AUTH_ENABLED || auth.currentUser) {
      await uploadVerificationDocument(uri, 'identity_document');
    }

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

  /**
   * Uploads the selfie and records it on the server.
   *
   * Same gap as uploadIdDocument: the photo previously never left the
   * device. The backend has no dedicated "selfie" document type (its
   * required categories are business_info / identity_document /
   * proof_of_address), so this is recorded as `other` — the closest honest
   * fit rather than mislabeling it as one of the specific categories.
   */
  const uploadSelfie = async (uri: string) => {
    if (!DEV_LOCAL_AUTH_ENABLED || auth.currentUser) {
      await uploadVerificationDocument(uri, 'other');
    }

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

  /**
   * Submitting for review, on the server.
   *
   * This wrote the submission locally and then decided the outcome itself:
   * mockVerificationResult ran `Math.random() > 0.3` after five seconds and
   * marked the vendor approved or rejected. Verification gates discoverability,
   * so a vendor could hold an approved status their own device invented while
   * the backend had never seen a submission — and an admin had nothing to
   * review, because nothing was ever submitted.
   *
   * submitVendorVerification has been deployed since Phase 2 and nothing called
   * it. Approval is an admin decision made through the console, which is the
   * only place it can be made: it is a judgement about documents, not something
   * a client can compute.
   *
   * The local status is set to pending_review to reflect what actually
   * happened. It moves off that only when the backend says so.
   */
  const submitForReview = async () => {
    const now = new Date().toISOString();

    if (!DEV_LOCAL_AUTH_ENABLED || auth.currentUser) {
      const submit = callable<
        Record<string, never>,
        { success: true; verificationStatus: string }
      >('submitVendorVerification');
      await submit({});
    }

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

    // The demo logins have no backend account and no admin to review them, so
    // they keep the simulated outcome. It is unreachable in a release build.
    if (DEV_LOCAL_AUTH_ENABLED && !auth.currentUser) {
      setTimeout(async () => {
        await mockVerificationResult();
      }, 5000);
    }
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
  // Platform admins and moderators, NOT by vendor-facing code.
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
