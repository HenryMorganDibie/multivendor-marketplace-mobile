import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * subscriptionRepository — data-access boundary for the vendor plan record.
 *
 * SCAFFOLD ONLY. Reads/writes the same `@platform_vendor_plan` AsyncStorage
 * record VendorPlanContext owns. subscriptionService delegates here; the context
 * remains the live, reactive source for plan-gated UI.
 *
 * Keyed per uid: this used to be one device-global key, so Vendor B signing
 * in after Vendor A logged out briefly rendered A's cached plan/username/
 * branding state until getSubscriptionStatus resolved for B. The real
 * backend record (`vendorSubscriptions/{vendorId}`, read via
 * getSubscriptionStatus) was never actually wrong — this only affected the
 * local pre-refresh cache.
 *
 * TODO(Henry): replace with Firestore `vendorSubscriptions/{vendorId}`.
 */
export const VENDOR_PLAN_STORAGE_KEY_PREFIX = '@platform_vendor_plan';
export const vendorPlanStorageKey = (uid: string) => `${VENDOR_PLAN_STORAGE_KEY_PREFIX}:${uid}`;

export const subscriptionRepository = {
  /** Raw persisted plan record for this uid, or null. */
  async read(uid: string): Promise<Record<string, unknown> | null> {
    try {
      const stored = await AsyncStorage.getItem(vendorPlanStorageKey(uid));
      return stored ? (JSON.parse(stored) as Record<string, unknown>) : null;
    } catch (error) {
      console.error('[subscriptionRepository] Failed to read plan:', error);
      return null;
    }
  },

  /** Persists the raw plan record for this uid. */
  async write(data: object, uid: string): Promise<void> {
    try {
      await AsyncStorage.setItem(vendorPlanStorageKey(uid), JSON.stringify(data));
    } catch (error) {
      console.error('[subscriptionRepository] Failed to write plan:', error);
    }
  },
};
