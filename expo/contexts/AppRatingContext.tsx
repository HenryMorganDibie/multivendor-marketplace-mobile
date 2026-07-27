import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type AppRatingTriggerSource =
  | 'order_submitted'
  | 'order_completed'
  | 'vendor_first_order'
  | 'vendor_order_completed'
  | 'vendor_storefront_setup';

export type AppRatingUserType = 'customer' | 'vendor';

export interface AppRatingPromptState {
  userId: string;
  userType: AppRatingUserType;
  platform: 'ios' | 'android' | 'web';
  promptShownCount: number;
  lastPromptShownAt: string | null;
  lastRatingSelected: number | null;
  internalFeedback: string | null;
  appStoreRedirectedAt: string | null;
  dismissedAt: string | null;
  cooldownUntil: string | null;
  triggerSource: AppRatingTriggerSource | null;
}

const STORAGE_KEY_PREFIX = '@the platform_app_rating_';
const MAX_PROMPTS_PER_YEAR = 3;
const DISMISS_COOLDOWN_DAYS = 30;
const STORE_REDIRECT_COOLDOWN_DAYS = 180;
const LOW_RATING_COOLDOWN_DAYS = 90;

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function isAfterNow(isoDate: string | null): boolean {
  if (!isoDate) return false;
  return new Date(isoDate) > new Date();
}

function promptsThisYear(lastPromptShownAt: string | null, promptShownCount: number): boolean {
  if (!lastPromptShownAt || promptShownCount === 0) return false;
  const lastYear = new Date(lastPromptShownAt).getFullYear();
  const currentYear = new Date().getFullYear();
  if (lastYear !== currentYear) return false;
  return promptShownCount >= MAX_PROMPTS_PER_YEAR;
}

export const [AppRatingProvider, useAppRating] = createContextHook(() => {
  const [visible, setVisible] = useState(false);
  const [currentTriggerSource, setCurrentTriggerSource] = useState<AppRatingTriggerSource | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserType, setCurrentUserType] = useState<AppRatingUserType | null>(null);
  const loadingRef = useRef<Record<string, boolean>>({});

  const getStorageKey = useCallback((userId: string): string => {
    return `${STORAGE_KEY_PREFIX}${userId}`;
  }, []);

  const loadState = useCallback(async (userId: string): Promise<AppRatingPromptState | null> => {
    try {
      const raw = await AsyncStorage.getItem(getStorageKey(userId));
      if (!raw) return null;
      return JSON.parse(raw) as AppRatingPromptState;
    } catch (err) {
      console.log('[AppRating] Failed to load state:', err);
      return null;
    }
  }, [getStorageKey]);

  const saveState = useCallback(async (state: AppRatingPromptState): Promise<void> => {
    try {
      await AsyncStorage.setItem(getStorageKey(state.userId), JSON.stringify(state));
    } catch (err) {
      console.log('[AppRating] Failed to save state:', err);
    }
  }, [getStorageKey]);

  const shouldShow = useCallback((state: AppRatingPromptState | null): boolean => {
    if (Platform.OS === 'web') {
      console.log('[AppRating] Web platform — skipping app store prompt');
      return false;
    }
    if (!state) return true;
    if (isAfterNow(state.cooldownUntil)) {
      console.log('[AppRating] In cooldown until:', state.cooldownUntil);
      return false;
    }
    if (promptsThisYear(state.lastPromptShownAt, state.promptShownCount)) {
      console.log('[AppRating] Max prompts per year reached');
      return false;
    }
    return true;
  }, []);

  const triggerAppRating = useCallback(async (
    userId: string,
    userType: AppRatingUserType,
    triggerSource: AppRatingTriggerSource
  ): Promise<void> => {
    if (Platform.OS === 'web') return;
    if (loadingRef.current[userId]) return;

    loadingRef.current[userId] = true;
    console.log('[AppRating] Trigger:', triggerSource, 'user:', userId, 'type:', userType);

    try {
      const state = await loadState(userId);
      if (!shouldShow(state)) {
        loadingRef.current[userId] = false;
        return;
      }

      setTimeout(() => {
        setCurrentUserId(userId);
        setCurrentUserType(userType);
        setCurrentTriggerSource(triggerSource);
        setVisible(true);
        loadingRef.current[userId] = false;
      }, 1200);
    } catch (err) {
      console.log('[AppRating] Error triggering prompt:', err);
      loadingRef.current[userId] = false;
    }
  }, [loadState, shouldShow]);

  const recordPromptShown = useCallback(async (
    userId: string,
    userType: AppRatingUserType,
    triggerSource: AppRatingTriggerSource
  ): Promise<void> => {
    const existing = await loadState(userId);
    const currentCount = existing?.promptShownCount ?? 0;
    const platform: 'ios' | 'android' | 'web' = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    const updated: AppRatingPromptState = {
      userId,
      userType,
      platform,
      promptShownCount: currentCount + 1,
      lastPromptShownAt: new Date().toISOString(),
      lastRatingSelected: existing?.lastRatingSelected ?? null,
      internalFeedback: existing?.internalFeedback ?? null,
      appStoreRedirectedAt: existing?.appStoreRedirectedAt ?? null,
      dismissedAt: existing?.dismissedAt ?? null,
      cooldownUntil: existing?.cooldownUntil ?? null,
      triggerSource,
    };
    await saveState(updated);
    console.log('[AppRating] Prompt shown recorded, count:', updated.promptShownCount);
  }, [loadState, saveState]);

  const recordDismiss = useCallback(async (userId: string, userType: AppRatingUserType): Promise<void> => {
    const existing = await loadState(userId);
    const platform: 'ios' | 'android' | 'web' = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    const updated: AppRatingPromptState = {
      ...(existing ?? {
        userId,
        userType,
        platform,
        promptShownCount: 0,
        lastPromptShownAt: null,
        lastRatingSelected: null,
        internalFeedback: null,
        appStoreRedirectedAt: null,
        triggerSource: null,
      }),
      userId,
      userType,
      platform,
      dismissedAt: new Date().toISOString(),
      cooldownUntil: daysFromNow(DISMISS_COOLDOWN_DAYS),
    };
    await saveState(updated);
    setVisible(false);
    setCurrentUserId(null);
    setCurrentUserType(null);
    setCurrentTriggerSource(null);
    console.log('[AppRating] Dismissed, cooldown until:', updated.cooldownUntil);
  }, [loadState, saveState]);

  const recordRating = useCallback(async (userId: string, userType: AppRatingUserType, stars: number): Promise<void> => {
    const existing = await loadState(userId);
    const platform: 'ios' | 'android' | 'web' = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    const cooldown = stars >= 4 ? daysFromNow(STORE_REDIRECT_COOLDOWN_DAYS) : daysFromNow(LOW_RATING_COOLDOWN_DAYS);
    const updated: AppRatingPromptState = {
      ...(existing ?? {
        userId,
        userType,
        platform,
        promptShownCount: 0,
        lastPromptShownAt: null,
        internalFeedback: null,
        appStoreRedirectedAt: null,
        dismissedAt: null,
        triggerSource: null,
      }),
      userId,
      userType,
      platform,
      lastRatingSelected: stars,
      cooldownUntil: cooldown,
    };
    await saveState(updated);
    console.log('[AppRating] Rating recorded:', stars, 'cooldown:', cooldown);
  }, [loadState, saveState]);

  const recordFeedback = useCallback(async (userId: string, userType: AppRatingUserType, feedback: string): Promise<void> => {
    const existing = await loadState(userId);
    if (!existing) return;
    const updated: AppRatingPromptState = {
      ...existing,
      internalFeedback: feedback,
    };
    await saveState(updated);
    console.log('[AppRating] Feedback recorded');
  }, [loadState, saveState]);

  const recordStoreRedirect = useCallback(async (userId: string, userType: AppRatingUserType): Promise<void> => {
    const existing = await loadState(userId);
    if (!existing) return;
    const updated: AppRatingPromptState = {
      ...existing,
      appStoreRedirectedAt: new Date().toISOString(),
      cooldownUntil: daysFromNow(STORE_REDIRECT_COOLDOWN_DAYS),
    };
    await saveState(updated);
    setVisible(false);
    setCurrentUserId(null);
    setCurrentUserType(null);
    setCurrentTriggerSource(null);
    console.log('[AppRating] Store redirect recorded');
  }, [loadState, saveState]);

  const dismissPrompt = useCallback(() => {
    if (currentUserId && currentUserType) {
      void recordDismiss(currentUserId, currentUserType);
    } else {
      setVisible(false);
    }
  }, [currentUserId, currentUserType, recordDismiss]);

  return {
    visible,
    currentTriggerSource,
    currentUserId,
    currentUserType,
    triggerAppRating,
    recordPromptShown,
    recordDismiss,
    recordRating,
    recordFeedback,
    recordStoreRedirect,
    dismissPrompt,
  };
});
