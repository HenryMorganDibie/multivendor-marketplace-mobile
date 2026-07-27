import { Linking, Alert, Platform } from 'react-native';

/**
 * Open the authenticated vendor portal in the system browser.
 *
 * Henry should return a signed, vendor-specific `portalUrl` on the
 * subscription document. This helper opens that URL securely. We never
 * hard-code the final portal route in the UI — the caller passes the
 * `portalUrl` from the subscription data.
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
