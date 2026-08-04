import { useState, useEffect, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { auth, callable } from '@/lib/firebase';

/**
 * Phase 1 — progressive onboarding state.
 *
 * Reads the checklist from the backend rather than deriving it locally, on
 * purpose: the same call is what gates publishing server-side, so the
 * checklist can never tell a vendor they're ready while the publish button
 * disagrees. Anything computed here would be a second, drifting copy of the
 * rules.
 */

export type OnboardingStepId =
  | 'business_details'
  | 'business_location'
  | 'first_catalog_item'
  | 'fulfillment'
  | 'payment_method'
  | 'publish_storefront'
  | 'verification';

export interface OnboardingStep {
  id: OnboardingStepId;
  label: string;
  complete: boolean;
  blocksPublication: boolean;
}

interface OnboardingStatusResponse {
  success: true;
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  canPublish: boolean;
  blockedReasons: string[];
  isPublished: boolean;
  isDiscoverable: boolean;
  hasSystemGeneratedUsername: boolean;
}

/** Where each checklist row sends the vendor when tapped. */
export const ONBOARDING_STEP_ROUTES: Record<OnboardingStepId, string> = {
  business_details: '/vendor/settings/business-profile',
  business_location: '/vendor/settings/business-location',
  first_catalog_item: '/vendor/catalog/item/new',
  fulfillment: '/vendor/settings/fulfillment',
  payment_method: '/vendor/settings/payment-methods',
  publish_storefront: '/vendor/settings/storefront',
  verification: '/vendor/settings/verification',
};

export const [VendorOnboardingProvider, useVendorOnboarding] = createContextHook(() => {
  const [status, setStatus] = useState<OnboardingStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!auth.currentUser) {
      setStatus(null);
      setIsLoading(false);
      return;
    }
    setError(null);
    try {
      const getStatus = callable<Record<string, never>, OnboardingStatusResponse>(
        'getVendorOnboardingStatus',
      );
      const res = await getStatus({});
      setStatus(res.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      // Right after signup the user is authenticated a moment before the
      // vendor role lands on their token, so this legitimately rejects once.
      // Treating it as a real failure would leave a permanent error on the
      // dashboard of a vendor whose account is actually fine — the token
      // listener below re-runs this as soon as the claim arrives.
      if (/Vendors only|permission-denied/i.test(message)) {
        setStatus(null);
      } else {
        console.error('[VendorOnboarding] Failed to load status:', err);
        setError("Couldn't load your setup progress.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // onIdTokenChanged, not onAuthStateChanged: the vendor role arrives as a
    // custom claim via a token refresh after completeRegistration, which
    // onAuthStateChanged does not fire for. Listening to the token means the
    // checklist appears as soon as the role is real, with no manual reload.
    const unsub = auth.onIdTokenChanged(() => {
      void refresh();
    });
    return () => unsub();
  }, [refresh]);

  const incompleteSteps = useMemo(
    () => (status?.steps ?? []).filter((s) => !s.complete),
    [status],
  );

  /** True once every step is done — the checklist hides itself at that point
   * rather than sitting on the dashboard forever as a completed list. */
  const isSetupComplete = useMemo(
    () => Boolean(status) && incompleteSteps.length === 0,
    [status, incompleteSteps],
  );

  /**
   * Publishing a storefront, which nothing could do before.
   *
   * This context read isPublished and canPublish and offered no way to change
   * either, while setVendorPublishStatus sat deployed and uncalled. A vendor
   * could complete every onboarding step, see that they were allowed to
   * publish, and have no means of doing it.
   *
   * The backend re-checks eligibility rather than trusting that the button was
   * only shown when canPublish was true — a stale screen is exactly when
   * someone taps it and should be refused.
   *
   * Status is refreshed afterwards so isPublished and isDiscoverable reflect
   * what the server decided. Publishing does not by itself make a vendor
   * discoverable: that also needs verification and an open country, which the
   * server resolves and the client should not try to predict.
   */
  const setPublished = useCallback(
    async (isPublished: boolean): Promise<void> => {
      const setStatus = callable<
        { isPublished: boolean },
        { success: true; isPublished: boolean }
      >('setVendorPublishStatus');
      await setStatus({ isPublished });
      await refresh();
    },
    [refresh],
  );

  return useMemo(
    () => ({
      status,
      setPublished,
      steps: status?.steps ?? [],
      incompleteSteps,
      completedCount: status?.completedCount ?? 0,
      totalCount: status?.totalCount ?? 0,
      canPublish: status?.canPublish ?? false,
      blockedReasons: status?.blockedReasons ?? [],
      hasSystemGeneratedUsername: status?.hasSystemGeneratedUsername ?? false,
      // Exposed so the dashboard can decide where verification is mentioned:
      // inside the setup stepper before publishing, or as a discovery prompt
      // after. Defaults to false so a vendor whose status hasn't loaded yet is
      // never wrongly treated as already live.
      isPublished: status?.isPublished ?? false,
      isDiscoverable: status?.isDiscoverable ?? false,
      isSetupComplete,
      isLoading,
      error,
      refresh,
    }),
    [status, setPublished, incompleteSteps, isSetupComplete, isLoading, error, refresh],
  );
});
