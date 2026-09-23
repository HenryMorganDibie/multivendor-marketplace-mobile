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
 * Apple product ids, mirroring multivendor-marketplace-platform's PRODUCT_ID_TO_PLAN exactly
 * (appleServerApi.ts) -- these are the real ids Founder created in App Store
 * Connect, not placeholders. Kept as the single reverse map here rather
 * than duplicated per call site.
 */
const PLAN_TO_APPLE_PRODUCT_ID: Partial<Record<PlanId, string>> = {
  standard: 'com.platform.app.standard.monthly',
  pro: 'com.platform.app.pro.monthly',
  pro_plus: 'com.platform.app.proplus.monthly',
};

/**
 * Apple in-app purchase flow for vendor subscriptions on iOS.
 *
 * On the App Store, a digital subscription MUST be sold through StoreKit --
 * redirecting to an external hosted payment page (what
 * createSubscriptionCheckout does for web/Android) is not permitted by
 * Apple's guidelines for this kind of purchase. So this is not an
 * alternative payment path a vendor picks; on iOS, it is the only path.
 *
 * Sequence per purchase:
 *  1. getOrCreateAppleAppAccountToken -- mints/fetches this vendor's real
 *     UUID token (StoreKit requires appAccountToken to BE a UUID; this
 *     app's own vendorId is not one -- see appleAppAccountToken.ts).
 *  2. requestPurchase -- hands off to StoreKit's native purchase sheet.
 *     Outcome arrives via purchaseUpdatedListener/purchaseErrorListener,
 *     not this call's return value (see react-native-iap's own docs).
 *  3. On success, verifyAppleTransaction fetches the transaction directly
 *     from Apple's server by id and activates the plan immediately --
 *     without this, the vendor would only see their plan change once
 *     Apple's asynchronous server notification happens to land.
 *  4. finishTransaction -- required regardless of step 3's outcome, or
 *     iOS replays the same unfinished transaction on every future launch.
 *
 * Cannot be exercised in Expo Go -- native purchases require a real
 * development build (EAS), which is why this integration was blocked on
 * that build existing.
 */
export function useApplePurchase(onPurchaseConfirmed: (plan: string | null) => void) {
  const purchasingSkuRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    void initConnection().catch((err) => {
      console.error('[useApplePurchase] initConnection failed:', err);
    });

    const updateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
      const transactionId = 'transactionId' in purchase ? purchase.transactionId : undefined;
      try {
        if (transactionId) {
          const verify = callable<{ transactionId: string }, { success: true; plan: string | null }>(
            'verifyAppleTransaction',
          );
          const res = await verify({ transactionId });
          onPurchaseConfirmed(res.data.plan);
        }
      } catch (err) {
        console.error('[useApplePurchase] verifyAppleTransaction failed:', err);
        Alert.alert(
          'Purchase received, confirming...',
          'Your payment went through. If your plan does not update within a minute, please contact support.',
        );
      } finally {
        // Always finish the transaction once Apple has told us about it,
        // independent of whether our own verification call succeeded --
        // an unfinished transaction replays on every app launch, and the
        // purchase itself already happened on Apple's side regardless of
        // whether verifyAppleTransaction's network call did.
        try {
          await finishTransaction({ purchase, isConsumable: false });
        } catch (err) {
          console.error('[useApplePurchase] finishTransaction failed:', err);
        }
        purchasingSkuRef.current = null;
      }
    });

    const errorSub = purchaseErrorListener((error: PurchaseError) => {
      console.error('[useApplePurchase] Purchase error:', error);
      purchasingSkuRef.current = null;
      // userCancelled is not an error worth surfacing -- StoreKit's own
      // sheet already communicated that to the vendor.
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
    if (Platform.OS !== 'ios') {
      console.error('[useApplePurchase] purchasePlan called on non-iOS platform');
      return false;
    }
    const sku = PLAN_TO_APPLE_PRODUCT_ID[plan];
    if (!sku) {
      Alert.alert('Not available', 'This plan is not available for purchase yet.');
      return false;
    }
    if (purchasingSkuRef.current) {
      return false;
    }

    try {
      const getToken = callable<Record<string, never>, { success: true; appAccountToken: string }>(
        'getOrCreateAppleAppAccountToken',
      );
      const tokenRes = await getToken({});

      purchasingSkuRef.current = sku;
      await requestPurchase({
        request: {
          apple: { sku, appAccountToken: tokenRes.data.appAccountToken },
        },
        type: 'subs',
      });
      // Real outcome arrives via purchaseUpdatedListener/purchaseErrorListener
      // above, not here -- see react-native-iap's own documented pattern.
      return true;
    } catch (err) {
      purchasingSkuRef.current = null;
      console.error('[useApplePurchase] requestPurchase failed to dispatch:', err);
      const message = err instanceof Error ? err.message : 'Could not start the purchase. Please try again.';
      Alert.alert('Could not start purchase', message);
      return false;
    }
  }, []);

  return { purchasePlan };
}
