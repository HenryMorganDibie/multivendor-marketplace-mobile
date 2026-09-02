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
 * The paths below are the real routes in the platform-website repo, confirmed
 * against its app router rather than guessed. Each page is built and reads its
 * body from the CMS; they currently render "Content pending publication"
 * because the legal copy has not been published yet. That is a content
 * dependency, not a code one: these links start working the moment the
 * documents go live, with no app change.
 *
 * Every legal URL in the app comes from this file so there is one place to
 * correct. Still to confirm: the domain. The app references theplatform.com,
 * theplatform.app and vendor.platform.com in different places. This uses
 * theplatform.com, matching the existing terms and privacy references.
 */
const SITE_BASE_URL = 'https://theplatform.com';

export const LEGAL_LINKS = {
  termsOfUse: `${SITE_BASE_URL}/terms-of-service`,
  privacyPolicy: `${SITE_BASE_URL}/privacy-policy`,
  customerAgreement: `${SITE_BASE_URL}/customer-terms`,
  vendorAgreement: `${SITE_BASE_URL}/vendor-terms`,
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
