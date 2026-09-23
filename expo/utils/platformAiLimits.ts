import type { Vendor } from '@/mocks/vendorData';

/**
 * Customer-facing Platform AI gating.
 *
 * Two layers of access control:
 * 1. Plan gate — Basic vendors cannot offer Platform AI to customers at all.
 *    The "Ask Platform AI" button is hidden on their storefront and the AI
 *    chat route is unreachable.
 * 2. Quota gate — even when the plan allows AI, either the vendor's monthly
 *    reply quota OR the customer's per-vendor monthly reply quota (5/month)
 *    can be exhausted. The AI input is disabled with a friendly message and
 *    the customer is offered "Message Vendor" (and "View Storefront" for the
 *    customer-limit case) as fallbacks.
 *
 * The backend will own both counters (`vendorSubscriptions/{vendorId}` for
 * the vendor quota, `customerAiUsage/{customerId}/{vendorId}` for the
 * customer-per-vendor quota). The mock values on `Vendor.plan`,
 * `Vendor.aiMonthlyRepliesUsed`, and `Vendor.aiMonthlyReplyLimit` are the
 * temporary stand-ins — Henry can swap them for Firestore reads without
 * touching screen code.
 */

/** Customer per-vendor monthly AI reply limit. */
export const CUSTOMER_AI_MONTHLY_LIMIT = 5;

/**
 * MVP hide-only flag: the customer-facing "Ask Platform AI" storefront CTA
 * is not part of the MVP. This does not disable the AI Help route, the
 * component, or any backend function -- it only gates whether the
 * storefront computes canUsePlatformAi as reachable. Flip to true to
 * re-enable without touching any other file.
 */
export const PLATFORM_AI_CUSTOMER_ENABLED = false;

/** Default vendor AI reply quota per plan tier (mock stand-in). */
const DEFAULT_VENDOR_LIMIT_BY_PLAN: Record<NonNullable<Vendor['plan']>, number> = {
  basic: 0,
  standard: 100,
  pro: 500,
  'pro+': 2000,
};

/**
 * Whether a vendor's plan permits customer-facing Platform AI at all.
 * Basic → false. Defaults to false when the plan is unknown so the
 * customer-side stays conservative until the backend confirms the tier.
 */
export function vendorPlanAllowsAi(vendor: Vendor): boolean {
  const plan = vendor.plan ?? 'basic';
  return plan !== 'basic';
}

/**
 * Vendor's monthly AI reply quota. Falls back to the per-plan default when
 * the vendor record doesn't carry an explicit limit.
 */
export function getVendorAiMonthlyLimit(vendor: Vendor): number {
  if (vendor.aiMonthlyReplyLimit != null) return vendor.aiMonthlyReplyLimit;
  const plan = vendor.plan ?? 'basic';
  return DEFAULT_VENDOR_LIMIT_BY_PLAN[plan] ?? 0;
}

/** Whether the vendor has exhausted their monthly AI reply quota. */
export function isVendorAiQuotaExhausted(vendor: Vendor): boolean {
  if (!vendorPlanAllowsAi(vendor)) return false;
  const used = vendor.aiMonthlyRepliesUsed ?? 0;
  const limit = getVendorAiMonthlyLimit(vendor);
  return used >= limit;
}

/** Remaining vendor AI replies this month (never negative). */
export function getVendorAiRemaining(vendor: Vendor): number {
  const used = vendor.aiMonthlyRepliesUsed ?? 0;
  const limit = getVendorAiMonthlyLimit(vendor);
  return Math.max(0, limit - used);
}

export type AiQuotaState =
  | { kind: 'available' }
  | { kind: 'vendor_exhausted' }
  | { kind: 'customer_exhausted' };

/**
 * Resolve the combined quota state for a customer talking to a vendor.
 * Precedence: plan gate (handled by callers — they should not even reach
 * this screen) → vendor exhausted → customer exhausted → available.
 */
export function resolveAiQuotaState(
  vendor: Vendor,
  customerRepliesUsedThisMonth: number
): AiQuotaState {
  if (isVendorAiQuotaExhausted(vendor)) {
    return { kind: 'vendor_exhausted' };
  }
  if (customerRepliesUsedThisMonth >= CUSTOMER_AI_MONTHLY_LIMIT) {
    return { kind: 'customer_exhausted' };
  }
  return { kind: 'available' };
}
