/**
 * Whether the local development login path is available.
 *
 * The app carries a local account store with plaintext passwords and a fixed
 * OTP of 123456. That existed so the built-in test logins worked before
 * Firebase Auth was wired, and it is genuinely useful for demos and for
 * reviewing screens without a backend.
 *
 * It must never be reachable in a shipped build. A fixed OTP accepts any phone
 * number, and a local password store means the device holds credentials it can
 * read and edit.
 *
 * `__DEV__` is false in any production or release build, including EAS preview
 * and production profiles, so this cannot be switched on by accident. It is a
 * separate constant rather than `__DEV__` used inline so there is one place to
 * find every path that depends on it.
 */
export const DEV_LOCAL_AUTH_ENABLED = __DEV__;

/**
 * Whether registration requires a real email OTP before an account is created.
 *
 * Off because there is nowhere for the code to go: sendEmailOtp writes to the
 * mail collection for the Firebase "Trigger Email" extension to pick up, and
 * that extension has never been installed on platform-dev (`firebase ext:list`
 * confirms "there are no extensions installed"). Every document written there
 * sits unprocessed, no `delivery` field ever gets added, no email is ever
 * sent, to any address, real or fake. Registration was a dead end for every
 * single vendor and customer: the account is not created until the code is
 * verified, and the code never arrives.
 *
 * With this off, register/vendor.tsx and register/customer.tsx skip straight
 * to registerAccount() and never route through /verify-otp. Login is
 * unaffected either way — it authenticates with a password, not a code.
 *
 * Turn back on once a real email provider is installed and configured (the
 * extension, or a direct SendGrid/SMTP call) and a live send has actually
 * been confirmed to land in an inbox, not just written to Firestore.
 */
export const EMAIL_OTP_REGISTRATION_REQUIRED = false;
