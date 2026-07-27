import type { VerificationStatus, VerificationType } from '@/types/domain';
import type { VerificationRecord } from '@/services/verificationService';

/**
 * verificationMapper — converts raw verification records into the domain
 * `VerificationRecord` shape.
 *
 * SCAFFOLD ONLY. Persisted verification records already match the shape, so
 * this is a defensive normalization layer that preserves the provider-ready
 * `providerData` block untouched.
 *
 * TODO(Henry): map the KYC/KYB provider payload + Firestore
 * `vendors/{vendorId}.verification` into this shape.
 */
export type RawVerification = Record<string, unknown>;

export const verificationMapper = {
  /** Raw verification record → domain `VerificationRecord`. */
  fromRaw(raw: RawVerification): VerificationRecord {
    return {
      status: (raw.status as VerificationStatus) ?? 'not_started',
      type: (raw.type as VerificationType) ?? 'individual',
      submittedAt: raw.submittedAt as string | undefined,
      reviewedAt: raw.reviewedAt as string | undefined,
      referenceId: raw.referenceId as string | undefined,
      rejectionReason: raw.rejectionReason as string | undefined,
      // Default matches VerificationContext's DEFAULT_VERIFICATION.retryAllowed (true)
      // so routing the read through this mapper preserves banner behavior exactly.
      retryAllowed: raw.retryAllowed === undefined ? true : Boolean(raw.retryAllowed),
      requiresKYB: Boolean(raw.requiresKYB),
      kybCompleted: Boolean(raw.kybCompleted),
      providerData: raw.providerData,
    };
  },

  /** Domain `VerificationRecord` → raw record for persistence. */
  toRaw(record: VerificationRecord): RawVerification {
    return { ...record };
  },
};
