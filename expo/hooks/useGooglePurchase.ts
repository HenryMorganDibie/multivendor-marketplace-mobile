import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  ErrorCode,
  type Purchase,
  type PurchaseError,
} from 'react-native-iap';
import { callable } from '@/lib/firebase';
import { Alert } from '@/utils/alert';
import type { PlanId } from '@/constants/planCatalog';

/**
 * Google Play product ids, mirroring platform-backend's
 * GOOGLE_PRODUCT_ID_TO_PLAN (googleServerApi.ts). Placeholder strings --
 * the real ids don't exist until the client creates the products in Play
 * Console; fill in to match exactly whatever she actually creates
 * (Play Console has its own naming rules, does not have to match Apple's
 * product id strings).
 */
const PLAN_TO_GOOGLE_PRODUCT_ID: Partial<Record<PlanId, string>> = {
  // standard: 'standard_monthly',
  // pro: 'pro_monthly',
  // pro_plus: 'pro_plus_monthly',
};

/**
 * Whether Google Play purchases can actually be attempted at all. Unlike
 * Apple's product ids (real, already created), Google's are still empty
 * placeholders -- callers (upgrade-plan.tsx) MUST check this before
 * routing Android to the native purchase flow instead of the existing
 * hosted-checkout path. Real Android vendors already use that hosted
 * checkout today (EAS has android-dev/android-preview build profiles,
 * meaning real Android builds are a live, in-use thing, not just a
 * placeholder platform) -- gating them into a purchase flow with no real
 * products behind it would silently break subscribing on Android entirely
 * the moment this ships, not just leave a feature unfinished.
 */
export const GOOGLE_PURCHASE_CONFIGURED = Object.keys(PLAN_TO_GOOGLE_PRODUCT_ID).length > 0;

/**
 * Google Play in-app purchase flow for vendor subscriptions on Android.
 * Structurally the same as useApplePurchase.ts -- see that file's header
 * for the full reasoning on why this is the only purchase path on its
 * platform (App Store guideline equivalent applies to Play Store digital
 * subscriptions too), and why an app-side confirmation call
 * (verifyGoogleTransaction) exists alongside the async webhook
 * (handleGoogleWebhook / RTDN).
 *
 * One real simplification versus Apple: Google's obfuscatedAccountId has
 * no UUID format requirement, so this passes the vendorId directly --
 * no token-minting/reverse-lookup step the way Apple's appAccountToken
 * needed (see appleAppAccountToken.ts on the backend for why that one
 * was necessary and this one is not).
 *
 * Cannot be exercised in Expo Go -- native purchases require a real
 * development build, same as the Apple side. Unlike Apple, this CAN be
 * tested on an Android emulator (a Play Store-enabled image with a
 * license tester account signed in) -- no physical device required.
 */
export function useGooglePurchase(vendorId: string | undefined, onPurchaseConfirmed: (plan: string | null) => void) {
  const purchasingSkuRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    void initConnection().catch((err) => {
      console.error('[useGooglePurchase] initConnection failed:', err);
    });

    const updateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
      const purchaseToken = 'purchaseToken' in purchase ? purchase.purchaseToken : undefined;
      try {
        if (purchaseToken) {
          const verify = callable<{ purchaseToken: string }, { success: true; plan: string | null }>(
            'verifyGoogleTransaction',
          );
          const res = await verify({ purchaseToken });
          onPurchaseConfirmed(res.data.plan);
        }
      } catch (err) {
        console.error('[useGooglePurchase] verifyGoogleTransaction failed:', err);
        Alert.alert(
          'Purchase received, confirming...',
          'Your payment went through. If your plan does not update within a minute, please contact support.',
        );
      } finally {
        // Android purchases must be finalized within 3 days or Google
        // auto-refunds -- always finish regardless of whether our own
        // verification call succeeded, same reasoning as the iOS side.
        try {
          await finishTransaction({ purchase, isConsumable: false });
        } catch (err) {
          console.error('[useGooglePurchase] finishTransaction failed:', err);
        }
        purchasingSkuRef.current = null;
      }
    });

    const errorSub = purchaseErrorListener((error: PurchaseError) => {
      console.error('[useGooglePurchase] Purchase error:', error);
      purchasingSkuRef.current = null;
      if (error.code !== ErrorCode.UserCancelled) {
        Alert.alert('Purchase failed', error.message || 'Could not complete the purchase. Please try again.');
      }
    });

    return () => {
      updateSub.remove();
      errorSub.remove();
      void endConnection();
    };
  }, [onPurchaseConfirmed]);

  const purchasePlan = useCallback(async (plan: PlanId): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      console.error('[useGooglePurchase] purchasePlan called on non-Android platform');
      return false;
    }
    const sku = PLAN_TO_GOOGLE_PRODUCT_ID[plan];
    if (!sku) {
      Alert.alert('Not available', 'This plan is not available for purchase yet.');
      return false;
    }
    if (!vendorId) {
      console.error('[useGooglePurchase] purchasePlan called with no vendorId');
      return false;
    }
    if (purchasingSkuRef.current) {
      return false;
    }

    try {
      purchasingSkuRef.current = sku;
      await requestPurchase({
        request: {
          google: { skus: [sku], obfuscatedAccountId: vendorId },
        },
        type: 'subs',
      });
      // Real outcome arrives via purchaseUpdatedListener/purchaseErrorListener
      // above, not here -- same documented react-native-iap pattern as iOS.
      return true;
    } catch (err) {
      purchasingSkuRef.current = null;
      console.error('[useGooglePurchase] requestPurchase failed to dispatch:', err);
      const message = err instanceof Error ? err.message : 'Could not start the purchase. Please try again.';
      Alert.alert('Could not start purchase', message);
      return false;
    }
  }, [vendorId]);

  return { purchasePlan };
}
