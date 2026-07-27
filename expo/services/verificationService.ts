import type { VerificationStatus, VerificationType } from '@/types/domain';

/**
 * verificationService — single boundary for vendor KYC/KYB verification state.
 *
 * SCAFFOLD ONLY. Reads the same per-vendor `@the platform_vendor_verification_{uid}`
 * AsyncStorage record that `contexts/VerificationContext` owns, including the
 * provider-ready `providerData` block. The context stays the live, reactive
 * source for verification banners/gates; this service is the stable async API
 * Henry will repoint at a real KYC/KYB provider + Firestore.
 *
 * TODO(Henry): back these with a KYC provider webhook + Firestore
 * `vendors/{vendorId}.verification`.
 */
import { verificationRepository } from '@/services/repositories/verificationRepository';

export interface VerificationRecord {
  status: VerificationStatus;
  type: VerificationType;
  submittedAt?: string;
  reviewedAt?: string;
  referenceId?: string;
  rejectionReason?: string;
  retryAllowed: boolean;
  requiresKYB: boolean;
  kybCompleted: boolean;
  providerData?: unknown;
}

export const verificationService = {
  /** Returns the verification record for a vendor (defaults to current user). */
  async getVerification(vendorId?: string): Promise<VerificationRecord | null> {
    return verificationRepository.read(vendorId);
  },

  /** Convenience: the current verification status, or 'not_started'. */
  async getStatus(vendorId?: string): Promise<VerificationStatus> {
    const record = await this.getVerification(vendorId);
    return record?.status ?? 'not_started';
  },

  /** Whether the vendor is fully approved. */
  async isApproved(vendorId?: string): Promise<boolean> {
    return (await this.getStatus(vendorId)) === 'approved';
  },

  /**
   * Persists a verification record. TODO(Henry): submission should call the
   * KYC provider; status transitions arrive via the provider webhook, not here.
   */
  async saveVerification(record: VerificationRecord, vendorId?: string): Promise<void> {
    await verificationRepository.write(record, vendorId);
  },
};
