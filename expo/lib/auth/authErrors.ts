/**
 * Auth failures, turned into something a person can act on.
 *
 * Every failure used to surface as "Could not create your account. Please try
 * again." — advice that cannot work when the actual problem is that the email is
 * already registered. Someone hit exactly that and retried it repeatedly,
 * because nothing on screen suggested the email was the issue.
 *
 * The reason is read from `code` rather than the message text. A FirebaseError
 * carries the machine-readable reason on `.code`; the message wording is not
 * contractual and matching on it is how the duplicate-email case slipped
 * through to the generic branch in the first place.
 *
 * `field` is returned alongside the message so the screen can attach the error
 * to the input it belongs to and put focus there, rather than showing a banner
 * that leaves the person hunting for what to change.
 */

export type AuthErrorField = 'email' | 'phone' | 'password' | 'form';

export interface MappedAuthError {
  field: AuthErrorField;
  message: string;
}

function codeOf(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  return '';
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? '');
}

/** Both are searched: the code is authoritative, the message is the fallback. */
function reasonOf(error: unknown): string {
  return `${codeOf(error)} ${messageOf(error)}`;
}

export function mapRegistrationError(error: unknown): MappedAuthError {
  const reason = reasonOf(error);

  if (/email-already-in-use/.test(reason)) {
    return {
      field: 'email',
      message: 'An account with this email already exists. Log in or reset your password.',
    };
  }
  if (/phone-number-already-exists|phone-already-in-use/.test(reason)) {
    return {
      field: 'phone',
      message: 'This phone number is already associated with another account.',
    };
  }
  if (/invalid-email/.test(reason)) {
    return { field: 'email', message: 'Enter a valid email address.' };
  }
  if (/invalid-phone-number/.test(reason)) {
    return { field: 'phone', message: 'Enter a valid phone number for the country you selected.' };
  }
  if (/weak-password/.test(reason)) {
    return { field: 'password', message: 'Password does not meet the requirements below.' };
  }
  if (/too-many-requests/.test(reason)) {
    return {
      field: 'form',
      message: 'Too many attempts. Please wait a few minutes and try again.',
    };
  }
  if (/network-request-failed/.test(reason)) {
    return {
      field: 'form',
      message: 'We could not reach theplatform. Check your connection and try again.',
    };
  }
  if (/operation-not-allowed/.test(reason)) {
    // A configuration fault rather than anything the person did. Saying "try
    // again" would send them in circles on something only we can fix.
    return {
      field: 'form',
      message: 'Sign-up is temporarily unavailable. Please contact the platform Support.',
    };
  }

  /**
   * A backend validation message is already written for a person, so it is shown
   * rather than replaced.
   *
   * completeRegistration rejects with invalid-argument and text like "A country
   * is required." Because that code was unmapped it fell through to "Something
   * went wrong on our side. Please try again." — which is both false and
   * useless: nothing was wrong on our side, and trying again without changing
   * anything cannot work. Someone hit exactly that and had no way to know a
   * field was missing.
   *
   * Only these two codes. They are the ones the backend raises deliberately
   * with a human-readable reason; anything else may carry internal detail that
   * should not be shown.
   */
  if (/invalid-argument|failed-precondition/.test(codeOf(error))) {
    const backendMessage = messageOf(error).trim();
    if (backendMessage) return { field: 'form', message: backendMessage };
  }

  // Reserved for genuine server or network faults, which is the only case where
  // trying again is real advice.
  return { field: 'form', message: 'Something went wrong on our side. Please try again.' };
}

export function mapLoginError(error: unknown): MappedAuthError {
  const reason = reasonOf(error);

  if (/invalid-email/.test(reason)) {
    return { field: 'email', message: 'Enter a valid email address.' };
  }
  /**
   * Wrong password, unknown account and Firebase's newer catch-all all resolve
   * to the same wording, deliberately. Distinguishing "no such account" from
   * "wrong password" tells anyone who asks which email addresses are registered
   * here, which is an account-enumeration hole that costs nothing to close.
   */
  if (/invalid-credential|wrong-password|user-not-found/.test(reason)) {
    return { field: 'password', message: 'Incorrect email or password.' };
  }
  if (/user-disabled/.test(reason)) {
    return {
      field: 'form',
      message: 'Your account has been disabled. Contact the platform Support.',
    };
  }
  if (/email-not-verified/.test(reason)) {
    return { field: 'form', message: 'Please verify your email before logging in.' };
  }
  if (/too-many-requests/.test(reason)) {
    return {
      field: 'form',
      message: 'Too many failed attempts. Please try again in 15 minutes.',
    };
  }
  if (/network-request-failed/.test(reason)) {
    return {
      field: 'form',
      message: 'We could not reach theplatform. Check your connection and try again.',
    };
  }

  return { field: 'form', message: 'Something went wrong on our side. Please try again.' };
}
