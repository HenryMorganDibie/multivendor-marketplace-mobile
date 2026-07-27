import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VerificationRecord } from '@/services/verificationService';
import { verificationMapper } from '@/services/mappers/verificationMapper';

/**
 * verificationRepository — data-access boundary for vendor verification records.
 *
 * SCAFFOLD ONLY. Reads/writes the same per-vendor
 * `@the platform_vendor_verification_{uid}` AsyncStorage record VerificationContext
 * owns. verificationService delegates here.
 *
 * TODO(Henry): replace with a KYC/KYB provider webhook + Firestore
 * `vendors/{vendorId}.verification`.
 */
const VERIFICATION_KEY = '@the platform_vendor_verification';
const AUTH_STORAGE_KEY = '@the platform_auth_user';

export const verificationRepository = {
  /** Resolves the vendor id (explicit, else current session user). */
  async resolveVendorId(explicitId?: string): Promise<string | null> {
    if (explicitId) return explicitId;
    try {
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored)?.id ?? null;
    } catch {
      return null;
    }
  },

  /** Raw verification record for a vendor, or null. */
  async read(vendorId?: string): Promise<VerificationRecord | null> {
    const id = await this.resolveVendorId(vendorId);
    if (!id) return null;
    try {
      const stored = await AsyncStorage.getItem(`${VERIFICATION_KEY}_${id}`);
      if (!stored) return null;
      // Normalize the raw record through the mapper so display reads a
      // consistent, backend-aligned shape (TODO(Henry): provider/Firestore payload).
      return verificationMapper.fromRaw(JSON.parse(stored));
    } catch (error) {
      console.error('[verificationRepository] Failed to read verification:', error);
      return null;
    }
  },

  /** Persists a verification record for a vendor. Returns false if no id. */
  async write(record: VerificationRecord, vendorId?: string): Promise<boolean> {
    const id = await this.resolveVendorId(vendorId);
    if (!id) {
      console.error('[verificationRepository] No vendor id to save verification');
      return false;
    }
    try {
      await AsyncStorage.setItem(`${VERIFICATION_KEY}_${id}`, JSON.stringify(record));
      return true;
    } catch (error) {
      console.error('[verificationRepository] Failed to save verification:', error);
      return false;
    }
  },
};
