import { callable } from '@/lib/firebase';
import type {
  SetPaymentInstructionsRequest,
  SetPaymentInstructionsResponse,
} from '@/types/paymentInstructions';

/**
 * Typed wrapper around the deployed `setVendorPaymentInstructions` callable.
 * No legacy `updateVendorPaymentInstructions` usage, no direct Firestore
 * writes -- every mutation goes through this one call. Never logs `request`
 * or any part of it: it carries raw account numbers, IBANs, emails, and
 * phone numbers, and this file has no legitimate reason to persist or print
 * any of that.
 */
export function setVendorPaymentInstructions(
  request: SetPaymentInstructionsRequest
): Promise<{ data: SetPaymentInstructionsResponse }> {
  return callable<SetPaymentInstructionsRequest, SetPaymentInstructionsResponse>(
    'setVendorPaymentInstructions'
  )(request);
}

/**
 * Re-exported so callers can generate a save operation's idempotency key
 * from this same module. Implementation lives in utils/idempotencyKey.ts,
 * kept separate so idempotency/UUID generation stays isolated from this
 * file's Firebase-transport concern -- see that module for why.
 */
export { generateIdempotencyKey } from '@/utils/idempotencyKey';
