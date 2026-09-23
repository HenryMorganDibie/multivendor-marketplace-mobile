import { useState, useEffect, useRef } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { generateSystemUsername } from '@/utils/usernameValidation';
import { subscriptionRepository } from '@/services/repositories/subscriptionRepository';
import { callable, auth } from '@/lib/firebase';
import { fetchRealPlanLimits, type PlanId, type RealPlanLimits } from '@/constants/planCatalog';

export type VendorPlan = 'basic' | 'standard' | 'pro' | 'pro+';

/**
 * Backend-canonical subscription tier names. Each vendor has exactly one
 * subscription (`vendorSubscriptions/{vendorId}`) whose tier is one of these.
 * The app keeps its internal `'pro+'` label for display but translates to/from
 * the backend's `'pro_plus'` at the data boundary via the helpers below.
 */
export type BackendPlanTier = 'basic' | 'standard' | 'pro' | 'pro_plus';

/** Internal plan label → backend-canonical tier. */
export function toBackendPlanTier(plan: VendorPlan): BackendPlanTier {
  return plan === 'pro+' ? 'pro_plus' : plan;
}

/** Backend-canonical tier → internal plan label. */
export function fromBackendPlanTier(tier: BackendPlanTier): VendorPlan {
  return tier === 'pro_plus' ? 'pro+' : tier;
}
export type BusinessCountry = 
  | 'Nigeria' | 'Ghana' | 'Kenya' | 'Egypt'
  | 'South Africa' | 'Morocco' | 'Turkey'
  | 'United Kingdom' | 'Canada' | 'Australia'
  | 'United States';

interface UsernameChangeRecord {
  date: string;
  oldUsername: string;
  newUsername: string;
}

/**
 * Mirrors the backend's PlanLimits object (functions/src/types4.ts,
 * resolveEffectivePlan) exactly — this is the ONE canonical entitlement
 * shape getSubscriptionStatus already returns and the frontend previously
 * discarded (only effectivePlan/reason/currentPeriodEnd were read). Booleans
 * and dashboardFilterRange were instead re-derived client-side from the
 * plan string in several places (documentBranding.ts's hardcoded tables,
 * the dashboard screen's own canAccessTimeRange), which is exactly the
 * "recreate backend business rules in the client" pattern that drifts.
 */
export interface PlanLimits {
  planLimitsVersion: string;
  catalogItemLimit: number;
  photosPerItemLimit: number;
  canAccessExternalOrders: boolean;
  canSetMinimumOrderAmount: boolean;
  canSetBusinessPolicies: boolean;
  canAutoSendPickupDetails: boolean;
  canAutoAcceptOrders: boolean;
  canShowAIButton: boolean;
  aiRepliesPerMonth: number;
  aiInsightsLimit: number;
  activePromotionsLimit: number;
  dashboardFilterRange: 'today' | 'week' | 'month' | 'year';
  canViewBestSellerWidget: boolean;
  canViewRevenueCard: boolean;
  canViewAdvancedAnalytics: boolean;
  invoicesPerMonth: number;
  invoiceHistoryDays: number;
  canDownloadInvoicePdf: boolean;
  canDuplicateInvoice: boolean;
  canUploadLogo: boolean;
  canSetBrandColor: boolean;
  canSetThankYouMessage: boolean;
  canSetFooterText: boolean;
  canUsePremiumTemplates: boolean;
  canUseSeasonalThemes: boolean;
  canAddQrCode: boolean;
  canUsePrintLayout: boolean;
}

/** Mirrors resolveEffectivePlan's `reason` union on the backend. */
export type SubscriptionReason =
  | 'vendor_suspended'
  | 'admin_override'
  | 'active'
  | 'trialing'
  | 'grace_period'
  | 'cancelled_before_period_end'
  | 'no_subscription'
  | 'expired_or_other';

interface VendorPlanData {
  plan: VendorPlan;
  businessCountry: BusinessCountry;
  brandingEnabled: boolean;
  cancellationScheduled: boolean;
  cancellationDate: string | null;
  username: string | null;
  systemGeneratedUsername: string | null;
  usernameSelectionPending: boolean;
  founderPricingEligible: boolean;
  usernameChangeHistory: UsernameChangeRecord[];
  subscriptionReason: SubscriptionReason;
}

const defaultPlanData: VendorPlanData = {
  plan: 'basic',
  businessCountry: 'Nigeria',
  brandingEnabled: false,
  cancellationScheduled: false,
  cancellationDate: null,
  username: null,
  systemGeneratedUsername: null,
  usernameSelectionPending: false,
  founderPricingEligible: true,
  usernameChangeHistory: [],
  subscriptionReason: 'no_subscription',
};

export const [VendorPlanContext, useVendorPlan] = createContextHook(() => {
  const [planData, setPlanData] = useState<VendorPlanData>(defaultPlanData);
  const [isLoading, setIsLoading] = useState(true);
  // Which uid the loaded/persisted plan cache belongs to. The cache used to
  // live under one device-global `@platform_vendor_plan` key: Vendor B signing
  // in right after Vendor A logged out briefly saw A's cached plan/username/
  // branding state until refreshSubscriptionStatus() resolved for B. Now
  // scoped per uid; every write below reads the uid from here rather than a
  // fixed key.
  const currentUidRef = useRef<string | null>(null);
  // True until the first real getSubscriptionStatus response lands (success
  // or failure). Separate from isLoading, which only covers the local-cache
  // read: a screen that gates a paid-plan-only action (e.g.
  // change-username.tsx's "Upgrade Required" check) needs to know the
  // *plan* is confirmed, not just that local storage finished loading —
  // isLoading can already be false while a sign-in-triggered
  // refreshSubscriptionStatus() is still in flight, which was exactly the
  // gap that let that screen fire its upgrade-required alert against the
  // stale 'basic' default before the real 'pro' plan arrived a moment later.
  const [isPlanConfirmed, setIsPlanConfirmed] = useState(false);

  // subscriptionPlans is public and the same for every vendor, so this is
  // fetched once per app session rather than per-screen. Every subscription
  // screen was reading numeric limits (catalog items, photos per item, ...)
  // straight from the hardcoded mock catalog, which drifted out of sync with
  // the real, already-live plan config the moment that config changed on the
  // backend — this is what actually keeps them in step.
  const [realPlanLimits, setRealPlanLimits] = useState<Record<PlanId, RealPlanLimits> | null>(null);

  // The current vendor's own full PlanLimits, from getSubscriptionStatus —
  // distinct from realPlanLimits above (numeric limits for ALL four plans,
  // used by upgrade-comparison screens). This is the one object other
  // screens should read for "what can I, right now, actually do."
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);

  useEffect(() => {
    fetchRealPlanLimits().then(setRealPlanLimits);
  }, []);

  // Single identity-driven effect, replacing the old split of a bare-mount
  // loadPlan() plus a separate onIdTokenChanged → refreshSubscriptionStatus()
  // effect: that split only knew about pre-auth vs post-auth, not about
  // switching between two different vendors signed in on the same device.
  // Vendor B signing in right after Vendor A logged out used to briefly run
  // with A's still-loaded planData (and A's cached plan/username on the very
  // first paint) until refreshSubscriptionStatus() happened to resolve for B.
  useEffect(() => {
    const unsubscribe = auth.onIdTokenChanged((user) => {
      const uid = user?.uid ?? null;
      if (uid === currentUidRef.current) return; // same identity, e.g. a token refresh
      currentUidRef.current = uid;

      if (!uid) {
        setPlanData(defaultPlanData);
        setPlanLimits(null);
        setIsPlanConfirmed(false);
        setIsLoading(false);
        return;
      }

      setPlanData(defaultPlanData);
      setIsPlanConfirmed(false);
      setIsLoading(true);
      void loadPlan(uid);
    });
    return unsubscribe;
  }, []);

  const loadPlan = async (uid: string) => {
    try {
      // Local fields only (username, businessCountry, branding) — plan itself
      // is overwritten immediately after by refreshSubscriptionStatus below.
      // Kept as a cache so username/country render instantly on launch rather
      // than waiting on a network round trip.
      const data = (await subscriptionRepository.read(uid)) as VendorPlanData | null;
      if (data) {
        if (data.plan === 'basic' && !data.systemGeneratedUsername && !data.username) {
          const generatedUsername = generateSystemUsername();
          console.log('[VENDOR_PLAN] Generated system username for Basic vendor:', generatedUsername);
          data.systemGeneratedUsername = generatedUsername;
          data.username = generatedUsername;
          await subscriptionRepository.write(data, uid);
        }

        if (currentUidRef.current === uid) setPlanData(data);
      } else {
        const generatedUsername = generateSystemUsername();
        console.log('[VENDOR_PLAN] New vendor, generating system username:', generatedUsername);
        const initialData = {
          ...defaultPlanData,
          systemGeneratedUsername: generatedUsername,
          username: generatedUsername,
        };
        await subscriptionRepository.write(initialData, uid);
        if (currentUidRef.current === uid) setPlanData(initialData);
      }
    } catch (error) {
      console.error('Failed to load vendor plan:', error);
    } finally {
      if (currentUidRef.current === uid) {
        await refreshSubscriptionStatus();
        setIsLoading(false);
      }
    }
  };

  /**
   * The actual fix for the AsyncStorage-only plan bug described in
   * frontend-subscription-alignment-scope.md Section 8: `plan` was locally
   * mutable and defaulted to 'basic' with no connection to
   * vendorSubscriptions/{vendorId}, the document every backend-gated Cloud
   * Function actually reads (resolveEffectivePlan). A vendor could "upgrade"
   * for free on their own device while the backend still enforced Basic —
   * or a vendor who genuinely paid would still see Basic-gated UI forever.
   *
   * This is the read-side fix only. Full checkout/cancellation UI states
   * (awaiting-webhook, grace period, pending downgrade banners, etc. — see
   * the design doc Section 8) are a separately-scoped follow-up; this closes
   * the billing-bypass and stale-plan-display bugs, which is the part that
   * actually matters for correctness tonight.
   */
  const refreshSubscriptionStatus = async () => {
    try {
      const getStatus = callable<
        Record<string, never>,
        {
          effectivePlan: BackendPlanTier;
          reason: SubscriptionReason;
          subscription: { currentPeriodEnd?: { toDate?: () => Date } } | null;
          planLimits: PlanLimits;
        }
      >('getSubscriptionStatus');
      const res = await getStatus({});
      const newPlan = fromBackendPlanTier(res.data.effectivePlan);
      setPlanLimits(res.data.planLimits ?? null);

      setPlanData((prev) => {
        const cancellationScheduled = res.data.reason === 'cancelled_before_period_end';
        const periodEnd = res.data.subscription?.currentPeriodEnd?.toDate?.();
        /**
         * Deliberately does NOT touch usernameSelectionPending.
         *
         * The old local updatePlan() set it whenever the plan went from
         * basic to paid, which was sound there — that transition only
         * happened because the vendor had just tapped Upgrade. Carrying the
         * same inference into a status *refresh* is not: "local cache says
         * basic, server says pro" is the normal cold-cache state for any
         * paying vendor on a new device or after clearing storage, not a
         * fresh upgrade. It set the flag on every such sign-in, and the
         * dashboard redirects to /select-username whenever it's true — so a
         * Pro vendor who already had a username was force-marched back to
         * "Choose Your Username" on every fresh login, with no way past it.
         */
        const updated: VendorPlanData = {
          ...prev,
          plan: newPlan,
          subscriptionReason: res.data.reason,
          cancellationScheduled,
          cancellationDate: cancellationScheduled && periodEnd ? periodEnd.toISOString() : null,
        };
        if (currentUidRef.current) {
          void subscriptionRepository.write(updated, currentUidRef.current);
        }
        return updated;
      });
    } catch (error) {
      // No vendorSubscriptions doc yet ("no_subscription") is the normal
      // state for a Basic vendor, not an error worth surfacing — the local
      // 'basic' default already matches. Only genuine failures get logged.
      console.error('[VENDOR_PLAN] Failed to refresh subscription status:', error);
    } finally {
      setIsPlanConfirmed(true);
    }
  };

  const toggleBranding = async () => {
    try {
      const updated = { ...planData, brandingEnabled: !planData.brandingEnabled };
      if (currentUidRef.current) {
        await subscriptionRepository.write(updated, currentUidRef.current);
      }
      setPlanData(updated);
    } catch (error) {
      console.error('Failed to toggle branding:', error);
      throw error;
    }
  };

  const scheduleCancellation = async () => {
    try {
      const cancel = callable<Record<string, never>, { success: true }>('cancelSubscription');
      await cancel({});
      await refreshSubscriptionStatus();
    } catch (error) {
      console.error('Failed to schedule cancellation:', error);
      throw error;
    }
  };

  const cancelScheduledCancellation = async () => {
    try {
      const reactivate = callable<Record<string, never>, { success: true }>('reactivateSubscription');
      await reactivate({});
      await refreshSubscriptionStatus();
    } catch (error) {
      console.error('Failed to cancel scheduled cancellation:', error);
      throw error;
    }
  };

  /**
   * Persists a chosen username.
   *
   * A vendor-initiated change (isSystemGenerated=false) is the actual
   * reservation change — it has to happen on the server, which owns
   * uniqueness across every vendor. This used to only update AsyncStorage,
   * so a vendor could "change" their username on their own device to one
   * someone else already held, with nothing anywhere reserving it for them.
   *
   * isSystemGenerated=true is not sent to the backend: that path mirrors a
   * username the backend already assigned and reserved itself (at
   * registration), so there is nothing left to change server-side.
   */
  const setUsername = async (username: string, isSystemGenerated: boolean = false) => {
    try {
      if (!isSystemGenerated) {
        const change = callable<{ username: string }, { success: true; username: string }>('changeUsername');
        const res = await change({ username });
        username = res.data.username;
      }

      const oldUsername = planData.username;
      const changeHistory = [...planData.usernameChangeHistory];

      if (oldUsername && oldUsername !== username && !isSystemGenerated) {
        changeHistory.push({
          date: new Date().toISOString(),
          oldUsername,
          newUsername: username,
        });
      }

      const updated = {
        ...planData,
        username,
        systemGeneratedUsername: isSystemGenerated ? username : (planData.systemGeneratedUsername || planData.username),
        usernameSelectionPending: false,
        usernameChangeHistory: changeHistory,
      };
      if (currentUidRef.current) {
        await subscriptionRepository.write(updated, currentUidRef.current);
      }
      setPlanData(updated);
    } catch (error) {
      console.error('Failed to set username:', error);
      throw error;
    }
  };

  const markUsernameSelectionComplete = async () => {
    try {
      const updated = {
        ...planData,
        usernameSelectionPending: false,
      };
      if (currentUidRef.current) {
        await subscriptionRepository.write(updated, currentUidRef.current);
      }
      setPlanData(updated);
    } catch (error) {
      console.error('Failed to mark username selection complete:', error);
      throw error;
    }
  };

  /**
   * realHistory, when passed, is the vendor document's own
   * usernameChangeHistory (written by changeUsername) rather than this
   * device's local copy - a real vendor's cooldown should hold across a
   * reinstall or a second device, not reset because this AsyncStorage entry
   * did.
   */
  const getUsernameChangeEligibility = (realHistory?: UsernameChangeRecord[]) => {
    if (planData.plan === 'basic') {
      return {
        canChange: false,
        reason: 'upgrade_required' as const,
        daysUntilNext: null,
        changesThisYear: 0,
      };
    }

    const history = realHistory ?? planData.usernameChangeHistory ?? [];
    const now = new Date();
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const changesThisYear = history.filter(change => new Date(change.date) > yearAgo).length;
    
    if (changesThisYear >= 2) {
      const oldestChangeThisYear = history
        .filter(change => new Date(change.date) > yearAgo)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
      
      const nextAvailableDate = new Date(oldestChangeThisYear.date);
      nextAvailableDate.setFullYear(nextAvailableDate.getFullYear() + 1);
      const daysUntil = Math.ceil((nextAvailableDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        canChange: false,
        reason: 'yearly_limit_reached' as const,
        daysUntilNext: daysUntil,
        changesThisYear,
      };
    }
    
    if (history.length > 0) {
      const lastChange = history[history.length - 1];
      const lastChangeDate = new Date(lastChange.date);
      const daysSinceLastChange = Math.floor((now.getTime() - lastChangeDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceLastChange < 90) {
        return {
          canChange: false,
          reason: 'cooldown_active' as const,
          daysUntilNext: 90 - daysSinceLastChange,
          changesThisYear,
        };
      }
    }
    
    return {
      canChange: true,
      reason: 'eligible' as const,
      daysUntilNext: null,
      changesThisYear,
    };
  };

  return {
    plan: planData.plan,
    businessCountry: planData.businessCountry,
    brandingEnabled: planData.brandingEnabled,
    cancellationScheduled: planData.cancellationScheduled,
    cancellationDate: planData.cancellationDate,
    username: planData.username,
    systemGeneratedUsername: planData.systemGeneratedUsername,
    usernameSelectionPending: planData.usernameSelectionPending,
    founderPricingEligible: planData.founderPricingEligible,
    usernameChangeHistory: planData.usernameChangeHistory,
    subscriptionReason: planData.subscriptionReason,
    isLoading,
    isPlanConfirmed,
    realPlanLimits,
    planLimits,
    refreshSubscriptionStatus,
    toggleBranding,
    scheduleCancellation,
    cancelScheduledCancellation,
    setUsername,
    markUsernameSelectionComplete,
    getUsernameChangeEligibility,
  };
});

export type { UsernameChangeRecord };
