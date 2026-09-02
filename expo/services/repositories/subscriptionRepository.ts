import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * subscriptionRepository — data-access boundary for the vendor plan record.
 *
 * SCAFFOLD ONLY. Reads/writes the same `@platform_vendor_plan` AsyncStorage
 * record VendorPlanContext owns. subscriptionService delegates here; the context
 * remains the live, reactive source for plan-gated UI.
 *
 * TODO(Henry): replace with Firestore `vendorSubscriptions/{vendorId}`.
 */
export const VENDOR_PLAN_STORAGE_KEY = '@platform_vendor_plan';

export const subscriptionRepository = {
  /** Raw persisted plan record, or null. */
  async read(): Promise<Record<string, unknown> | null> {
    try {
      const stored = await AsyncStorage.getItem(VENDOR_PLAN_STORAGE_KEY);
      return stored ? (JSON.parse(stored) as Record<string, unknown>) : null;
    } catch (error) {
      console.error('[subscriptionRepository] Failed to read plan:', error);
      return null;
    }
  },

  /** Persists the raw plan record. */
  async write(data: Record<string, unknown>): Promise<void> {
    try {
      await AsyncStorage.setItem(VENDOR_PLAN_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[subscriptionRepository] Failed to write plan:', error);
    }
  },
};
