import { Linking, Alert, Platform } from 'react-native';
import { callable } from '@/lib/firebase';

interface HandoffResponse {
  success: true;
  portalUrl: string;
}

/**
 * Fetches a fresh, short-lived signed portal URL from
 * generateVendorPortalHandoffUrl and opens it. The URL is never cached or
 * read from a stored field — the custom token backing it expires in about
 * an hour, so it's generated on demand right before opening.
 */
export async function openVendorPortalHandoff(destination: '/subscription' | '/billing' = '/subscription'): Promise<void> {
  try {
    const generate = callable<{ destination: string }, HandoffResponse>('generateVendorPortalHandoffUrl');
    const res = await generate({ destination });
    await openVendorPortal(res.data.portalUrl);
  } catch (error) {
    console.error('[openVendorPortalHandoff] Failed to generate portal link:', error);
    Alert.alert('Unable to open', 'Could not reach the vendor portal right now. Try again in a moment.');
  }
}

/**
 * Open the authenticated vendor portal in the system browser.
 *
 * On web, opens in a new tab. On native, uses the system browser.
 */
export async function openVendorPortal(portalUrl: string): Promise<void> {
  if (!portalUrl) {
    Alert.alert('Unable to open', 'The vendor portal link is unavailable right now.');
    return;
  }
  try {
    if (Platform.OS === 'web') {
      window.open(portalUrl, '_blank', 'noopener,noreferrer');
    } else {
      const supported = await Linking.canOpenURL(portalUrl);
      if (supported) {
        await Linking.openURL(portalUrl);
      } else {
        Alert.alert('Unable to open', 'Could not open the vendor portal link.');
      }
    }
  } catch (error) {
    console.error('[openVendorPortal] Failed to open portal:', error);
    Alert.alert('Unable to open', 'Could not open the vendor portal link.');
  }
}
