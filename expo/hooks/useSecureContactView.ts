import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  preventScreenCaptureAsync,
  allowScreenCaptureAsync,
  enableAppSwitcherProtectionAsync,
  disableAppSwitcherProtectionAsync,
} from 'expo-screen-capture';

/**
 * Secures a sensitive view (e.g. a contact-card modal) while it is visible.
 *
 * - On Android, sets FLAG_SECURE via `preventScreenCaptureAsync` so screenshots,
 *   screen recordings, and the recent-apps preview show a blank surface.
 * - On iOS, enables the app-switcher privacy blur so the content is hidden when
 *   the app is backgrounded or shown in the app switcher.
 * - Tracks AppState locally so the caller can also hide content while the app
 *   is inactive (covers multi-tasking gestures, notification center, etc.).
 *
 * Pass `active: true` only while the secure surface is actually on screen so we
 * don't lock down the rest of the app.
 */
export function useSecureContactView(active: boolean) {
  const [isBlurred, setIsBlurred] = useState<boolean>(false);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const key = 'the platform-contact-card';

    // Lock down screen capture + app-switcher preview while the secure view is open.
    preventScreenCaptureAsync(key).catch((error) => {
      console.warn('[useSecureContactView] preventScreenCapture failed:', error);
    });
    enableAppSwitcherProtectionAsync(0.85).catch((error) => {
      console.warn('[useSecureContactView] enableAppSwitcherProtection failed:', error);
    });

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        setIsBlurred(false);
      } else if (nextState === 'inactive' || nextState === 'background') {
        setIsBlurred(true);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      cancelled = true;
      subscription.remove();
      allowScreenCaptureAsync(key).catch((error) => {
        console.warn('[useSecureContactView] allowScreenCapture failed:', error);
      });
      disableAppSwitcherProtectionAsync().catch((error) => {
        console.warn('[useSecureContactView] disableAppSwitcherProtection failed:', error);
      });
      setIsBlurred(false);
      void cancelled;
    };
  }, [active]);

  return { isBlurred };
}
