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
