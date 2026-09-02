import type { SubscriptionTier, BackendPlanTier } from '@/types/domain';
import { toBackendPlanTier, fromBackendPlanTier } from '@/types/domain';

/**
 * subscriptionService — single boundary for the vendor's subscription/plan.
 *
 * SCAFFOLD ONLY. Reads the same `@platform_vendor_plan` AsyncStorage record that
 * `contexts/VendorPlanContext` owns. The context stays the live, reactive source
 * for plan-gated UI; this service is the stable async API Henry will repoint at
 * Firestore (`vendorSubscriptions/{vendorId}`).
 *
 * The app uses the internal label `'pro+'`; the backend stores `'pro_plus'`.
 * Helpers below translate at the boundary via the shared domain helpers.
 *
 * TODO(Henry): back these with Firestore `vendorSubscriptions/{vendorId}`.
 */
import { subscriptionRepository } from '@/services/repositories/subscriptionRepository';
import { subscriptionMapper } from '@/services/mappers/subscriptionMapper';

export interface Subscription {
  tier: SubscriptionTier;
  brandingEnabled: boolean;
  cancellationScheduled: boolean;
  cancellationDate: string | null;
  founderPricingEligible: boolean;
}

export const subscriptionService = {
  /** The active subscription for the current vendor, or null if unset. */
  async getSubscription(): Promise<Subscription | null> {
    const data = await subscriptionRepository.read();
    if (!data) return null;
    return subscriptionMapper.fromRaw(data);
  },

  /** The current tier, defaulting to 'basic'. */
  async getTier(): Promise<SubscriptionTier> {
    const data = await subscriptionRepository.read();
    return (data?.plan as SubscriptionTier) ?? 'basic';
  },

  /** The current tier in backend-canonical form ('pro+' → 'pro_plus'). */
  async getBackendTier(): Promise<BackendPlanTier> {
    const tier = await this.getTier();
    return toBackendPlanTier(tier);
  },

  // setTier()/setBackendTier() were removed: they wrote a plan tier straight
  // to local storage with no backend involved at all — a vendor's own device
  // could grant itself Pro+ for free. Plan can only change as a side effect
  // of VendorPlanContext.refreshSubscriptionStatus() reading a real
  // vendorSubscriptions/{vendorId} document (createSubscriptionCheckout +
  // webhook). Nothing in the app called these two methods.
};
