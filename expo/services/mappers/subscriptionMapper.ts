import type { SubscriptionTier, BackendPlanTier } from '@/types/domain';
import { toBackendPlanTier, fromBackendPlanTier } from '@/types/domain';
import type { Subscription } from '@/services/subscriptionService';

/**
 * subscriptionMapper — converts raw plan records into the domain `Subscription`
 * shape and translates the plan tier at the boundary.
 *
 * SCAFFOLD ONLY. The app uses the internal label `'pro+'`; the backend stores
 * `'pro_plus'`. The tier helpers reuse the shared domain translation.
 *
 * TODO(Henry): map Firestore `vendorSubscriptions/{vendorId}` documents into
 * this shape.
 */
export type RawSubscription = Record<string, unknown>;

export const subscriptionMapper = {
  /** Raw plan record → domain `Subscription`. */
  fromRaw(raw: RawSubscription): Subscription {
    return {
      tier: (raw.plan as SubscriptionTier) ?? 'basic',
      brandingEnabled: Boolean(raw.brandingEnabled),
      cancellationScheduled: Boolean(raw.cancellationScheduled),
      cancellationDate: (raw.cancellationDate as string | null) ?? null,
      founderPricingEligible:
        typeof raw.founderPricingEligible === 'boolean' ? raw.founderPricingEligible : true,
    };
  },

  /** Domain `Subscription` → raw record for persistence (stores internal label). */
  toRaw(subscription: Subscription): RawSubscription {
    return {
      plan: subscription.tier,
      brandingEnabled: subscription.brandingEnabled,
      cancellationScheduled: subscription.cancellationScheduled,
      cancellationDate: subscription.cancellationDate,
      founderPricingEligible: subscription.founderPricingEligible,
    };
  },

  /** Internal tier → backend-canonical tier ('pro+' → 'pro_plus'). */
  toBackendTier(tier: SubscriptionTier): BackendPlanTier {
    return toBackendPlanTier(tier);
  },

  /** Backend-canonical tier → internal tier ('pro_plus' → 'pro+'). */
  fromBackendTier(tier: BackendPlanTier): SubscriptionTier {
    return fromBackendPlanTier(tier);
  },
};
