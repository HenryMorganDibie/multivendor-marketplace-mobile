/**
 * Whether Apple and Google sign-in are shown.
 *
 * Off until the providers are really implemented. The buttons existed and were
 * wired to a placeholder that waited 900ms and fabricated a local account, so
 * anyone tapping them appeared to sign in while no Firebase user was created.
 * The client's instruction was that they must not reach production in that
 * state, and hiding them is better than leaving a control that lies about what
 * it did.
 *
 * Turning this back on requires, in order:
 *   1. Google and Apple providers enabled in the Firebase console
 *   2. OAuth client IDs for iOS, Android and web, and an Apple Service ID + key
 *   3. socialLogin() in AuthContext replaced with a real signInWithCredential
 *   4. account-linking handling for an email that already has a password login
 *
 * The backend needs nothing: onUserCreate fires for any provider and reads only
 * email, phoneNumber, displayName and photoURL, each with a null fallback, so a
 * Google or Apple user gets the same users/{uid} document and default claims as
 * an email/password one.
 */
export const SOCIAL_AUTH_ENABLED = false;
