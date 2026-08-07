import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { generateSystemUsername } from '@/utils/usernameValidation';
import { subscriptionRepository } from '@/services/repositories/subscriptionRepository';
import { callable } from '@/lib/firebase';

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
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPlan();
  }, []);

  const loadPlan = async () => {
    try {
      // Read path flows through the service/repository stack so Henry can repoint
      // it at Firestore `vendorSubscriptions/{vendorId}` later. The context stays
      // the live, reactive source and owns all write/upgrade logic.
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
      setIsLoading(false);
    }
  };

  const updatePlan = async (newPlan: VendorPlan) => {
    try {
      const wasBasic = planData.plan === 'basic';
      const isUpgrading = wasBasic && (newPlan === 'standard' || newPlan === 'pro' || newPlan === 'pro+');
      
      const updated = { 
        ...planData, 
        plan: newPlan,
        usernameSelectionPending: isUpgrading ? true : planData.usernameSelectionPending,
      };
      await AsyncStorage.setItem(VENDOR_PLAN_STORAGE_KEY, JSON.stringify(updated));
      setPlanData(updated);
    } catch (error) {
      console.error('Failed to update plan:', error);
      throw error;
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
      const cancellationDate = new Date();
      cancellationDate.setDate(cancellationDate.getDate() + 30);
      const updated = { 
        ...planData, 
        cancellationScheduled: true,
        cancellationDate: cancellationDate.toISOString(),
      };
      await AsyncStorage.setItem(VENDOR_PLAN_STORAGE_KEY, JSON.stringify(updated));
      setPlanData(updated);
    } catch (error) {
      console.error('Failed to schedule cancellation:', error);
      throw error;
    }
  };

  const cancelScheduledCancellation = async () => {
    try {
      const updated = { 
        ...planData, 
        cancellationScheduled: false,
        cancellationDate: null,
      };
      await AsyncStorage.setItem(VENDOR_PLAN_STORAGE_KEY, JSON.stringify(updated));
      setPlanData(updated);
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
    isLoading,
    updatePlan,
    toggleBranding,
    scheduleCancellation,
    cancelScheduledCancellation,
    setUsername,
    markUsernameSelectionComplete,
    getUsernameChangeEligibility,
  };
});

export type { UsernameChangeRecord };
