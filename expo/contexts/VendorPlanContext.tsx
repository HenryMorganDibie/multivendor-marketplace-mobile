import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { generateSystemUsername } from '@/utils/usernameValidation';
import { subscriptionRepository } from '@/services/repositories/subscriptionRepository';
import { callable, auth } from '@/lib/firebase';

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

const VENDOR_PLAN_STORAGE_KEY = '@the platform_vendor_plan';

export const [VendorPlanContext, useVendorPlan] = createContextHook(() => {
  const [planData, setPlanData] = useState<VendorPlanData>({
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
  });
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    loadPlan();
  }, []);

  // loadPlan's initial refreshSubscriptionStatus() call fires at app boot,
  // before a signed-out visitor has authenticated — it fails harmlessly
  // ("Sign in required") and never runs again, since the effect above has an
  // empty dependency array. Without this, a fresh sign-in on an already-
  // mounted app (the common case: the provider tree mounts once on the
  // /login screen itself) would leave plan-gated UI stuck on whatever it
  // resolved to pre-auth — 'basic' — until something else happened to
  // refetch it. This is what actually re-fetches on the real sign-in.
  useEffect(() => {
    const unsubscribe = auth.onIdTokenChanged((user) => {
      if (user) void refreshSubscriptionStatus();
    });
    return unsubscribe;
  }, []);

  const loadPlan = async () => {
    try {
      // Local fields only (username, businessCountry, branding) — plan itself
      // is overwritten immediately after by refreshSubscriptionStatus below.
      // Kept as a cache so username/country render instantly on launch rather
      // than waiting on a network round trip.
      const data = (await subscriptionRepository.read()) as VendorPlanData | null;
      if (data) {
        if (data.plan === 'basic' && !data.systemGeneratedUsername && !data.username) {
          const generatedUsername = generateSystemUsername();
          console.log('[VENDOR_PLAN] Generated system username for Basic vendor:', generatedUsername);
          data.systemGeneratedUsername = generatedUsername;
          data.username = generatedUsername;
          await AsyncStorage.setItem(VENDOR_PLAN_STORAGE_KEY, JSON.stringify(data));
        }

        setPlanData(data);
      } else {
        const generatedUsername = generateSystemUsername();
        console.log('[VENDOR_PLAN] New vendor, generating system username:', generatedUsername);
        const initialData = {
          ...planData,
          systemGeneratedUsername: generatedUsername,
          username: generatedUsername,
        };
        await AsyncStorage.setItem(VENDOR_PLAN_STORAGE_KEY, JSON.stringify(initialData));
        setPlanData(initialData);
      }
    } catch (error) {
      console.error('Failed to load vendor plan:', error);
    } finally {
      await refreshSubscriptionStatus();
      setIsLoading(false);
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
        }
      >('getSubscriptionStatus');
      const res = await getStatus({});
      const newPlan = fromBackendPlanTier(res.data.effectivePlan);

      setPlanData((prev) => {
        const wasBasic = prev.plan === 'basic';
        const isUpgrading = wasBasic && newPlan !== 'basic';
        const cancellationScheduled = res.data.reason === 'cancelled_before_period_end';
        const periodEnd = res.data.subscription?.currentPeriodEnd?.toDate?.();
        const updated: VendorPlanData = {
          ...prev,
          plan: newPlan,
          subscriptionReason: res.data.reason,
          cancellationScheduled,
          cancellationDate: cancellationScheduled && periodEnd ? periodEnd.toISOString() : null,
          usernameSelectionPending: isUpgrading ? true : prev.usernameSelectionPending,
        };
        void AsyncStorage.setItem(VENDOR_PLAN_STORAGE_KEY, JSON.stringify(updated));
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
      await AsyncStorage.setItem(VENDOR_PLAN_STORAGE_KEY, JSON.stringify(updated));
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
      await AsyncStorage.setItem(VENDOR_PLAN_STORAGE_KEY, JSON.stringify(updated));
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
      await AsyncStorage.setItem(VENDOR_PLAN_STORAGE_KEY, JSON.stringify(updated));
      setPlanData(updated);
    } catch (error) {
      console.error('Failed to mark username selection complete:', error);
      throw error;
    }
  };

  const getUsernameChangeEligibility = () => {
    if (planData.plan === 'basic') {
      return {
        canChange: false,
        reason: 'upgrade_required' as const,
        daysUntilNext: null,
        changesThisYear: 0,
      };
    }
    
    const history = planData.usernameChangeHistory || [];
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
