import * as WebBrowser from 'expo-web-browser';

/**
 * Legal documents live on the the platform website, not in the app.
 *
 * The client's direction, with WhatsApp as the reference: tapping a legal link
 * opens the browser and loads the published page. The app deliberately does not
 * try to render these itself. They are long documents that change on legal
 * advice, and shipping them inside the app means an app-store release every
 * time a clause moves.
 *
 * Every legal URL in the app comes from this file so there is exactly one place
 * to correct. Two things still need confirming from the client:
 *
 *  1. The domain. The app currently references the platform.com, the platform.app and
 *     vendor.the platform.com in different places. These use the platform.com because
 *     that is what the existing terms and privacy references already use.
 *  2. The paths below, once the website's legal section is published. The site
 *     is not finished yet, so these will not resolve until it is.
 */
const LEGAL_BASE_URL = 'https://the platform.com/legal';

export const LEGAL_LINKS = {
  termsOfUse: `${LEGAL_BASE_URL}/terms-of-use`,
  privacyPolicy: `${LEGAL_BASE_URL}/privacy-policy`,
  customerAgreement: `${LEGAL_BASE_URL}/customer-agreement`,
  vendorAgreement: `${LEGAL_BASE_URL}/vendor-agreement`,
} as const;

export type LegalDocument = keyof typeof LEGAL_LINKS;

/**
 * Open a legal document in the browser.
 *
 * openBrowserAsync gives the same presentation as the WhatsApp reference: a
 * browser sheet over the app with a back affordance, rather than throwing the
 * customer out into a separate app mid-signup and losing the form they were
 * filling in.
 */
export async function openLegalDocument(doc: LegalDocument): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(LEGAL_LINKS[doc]);
  } catch (error) {
    console.error('[LEGAL] Failed to open document:', doc, error);
  }
}
