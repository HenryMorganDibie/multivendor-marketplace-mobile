import { callable } from '@/lib/firebase';
import { DEV_LOCAL_AUTH_ENABLED } from '@/constants/devAuth';

/**
 * One-time codes, verified by the server.
 *
 * The verify screen accepted the literal 123456 and nothing else, so any phone
 * number or email address could be "verified" by anyone who knew the constant —
 * which is everyone, since it is in the source. sendPhoneOtp, verifyPhoneOtp,
 * sendEmailOtp and verifyEmailOtp have all been deployed since Phase 1 and
 * nothing called them.
 *
 * The backend decides. It rate limits sends, expires codes, counts attempts and
 * refuses a reused one — none of which a client-side equality check can do.
 *
 * A contact is treated as an email when it contains "@". Everything else is a
 * phone number, which is how the rest of the app already reads the same field.
 */

export function isEmailContact(contact: string): boolean {
  return contact.includes('@');
}

export async function sendOtp(contact: string): Promise<void> {
  // The demo logins have no backend account to send anything to. Outside
  // development this branch does not exist.
  if (DEV_LOCAL_AUTH_ENABLED && contact === '') return;

  if (isEmailContact(contact)) {
    await callable<{ email: string }, { success: true }>('sendEmailOtp')({
      email: contact.trim().toLowerCase(),
    });
    return;
  }

  await callable<{ phoneNumber: string }, { success: true }>('sendPhoneOtp')({
    phoneNumber: contact.trim(),
  });
}

export interface OtpResult {
  verified: boolean;
  /** The backend's reason, which names what actually happened. */
  message?: string;
}

export async function verifyOtp(contact: string, code: string): Promise<OtpResult> {
  try {
    if (isEmailContact(contact)) {
      const res = await callable<
        { email: string; code: string },
        { success: true; verified: boolean }
      >('verifyEmailOtp')({ email: contact.trim().toLowerCase(), code });
      return { verified: res.data.verified };
    }

    const res = await callable<
      { phoneNumber: string; code: string },
      { success: true; verified: boolean }
    >('verifyPhoneOtp')({ phoneNumber: contact.trim(), code });
    return { verified: res.data.verified };
  } catch (error) {
    /**
     * The backend distinguishes expired, already-used, too-many-attempts and
     * simply wrong, and says which. That message is passed through rather than
     * flattened to "incorrect code", because a customer who has waited out an
     * expiry needs to know to request another rather than retyping the same
     * digits.
     */
    const message = (error as { message?: string })?.message;
    return { verified: false, message };
  }
}
