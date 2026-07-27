/**
 * Vendor subscription tier — single source of truth.
 *
 * The app uses the internal label `'pro+'`; the backend stores `'pro_plus'`.
 * Both the internal `VendorPlan` type and the backend tier type, plus the
 * translation helpers, live in `contexts/VendorPlanContext` and are re-exported
 * here so `SubscriptionTier` reads naturally across the app.
 */
export type {
  VendorPlan,
  BackendPlanTier,
} from '@/contexts/VendorPlanContext';

export {
  toBackendPlanTier,
  fromBackendPlanTier,
} from '@/contexts/VendorPlanContext';

import type { VendorPlan } from '@/contexts/VendorPlanContext';

/** Canonical alias: a subscription tier is the same set as the internal plan. */
export type SubscriptionTier = VendorPlan;

export const SUBSCRIPTION_TIERS: readonly SubscriptionTier[] = [
  'basic',
  'standard',
  'pro',
  'pro+',
];
