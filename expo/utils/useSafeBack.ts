import { useRouter, useNavigationContainerRef } from 'expo-router';
import { useCallback } from 'react';

export function useSafeBack(fallbackRoute?: string) {
  const router = useRouter();
  const navigationRef = useNavigationContainerRef();

  const goBack = useCallback(() => {
    try {
      if (navigationRef?.canGoBack()) {
        router.back();
      } else if (fallbackRoute) {
        router.replace(fallbackRoute as any);
      } else {
        router.replace('/' as any);
      }
    } catch (error) {
      console.log('useSafeBack: navigation error, using fallback', error);
      if (fallbackRoute) {
        router.replace(fallbackRoute as any);
      } else {
        router.replace('/' as any);
      }
    }
  }, [router, fallbackRoute, navigationRef]);

  return goBack;
}
