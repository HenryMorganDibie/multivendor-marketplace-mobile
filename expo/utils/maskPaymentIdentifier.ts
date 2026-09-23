import type { BankAccountIdentifier, ContactIdentifier } from '@/types/paymentInstructions';

/**
 * Display-only masking, mirroring the backend's own
 * functions/src/paymentInstructions/maskPaymentIdentifier.ts semantics so a
 * vendor sees the same masking convention here as in any backend-driven
 * audit surface. This NEVER touches the stored/raw value -- Firestore's
 * paymentInstructionsCurrent document holds the real value (masking is a
 * backend audit-log/change-event concept, not something the stored record
 * itself carries), so this file's job is purely what gets rendered on
 * screen. Never logs anything.
 */
export function maskPaymentIdentifier(identifier: BankAccountIdentifier | ContactIdentifier): string {
  switch (identifier.type) {
    case 'account_number':
      return maskAccountNumber(identifier.value);
    case 'iban':
      return maskIban(identifier.value);
    case 'email':
      return maskEmail(identifier.value);
    case 'phone':
      return maskPhone(identifier.value);
  }
}

/** Last 4 characters visible, rest replaced. */
export function maskAccountNumber(value: string): string {
  if (value.length <= 4) return '•'.repeat(value.length);
  return `${'•'.repeat(value.length - 4)}${value.slice(-4)}`;
}

/** Same shape as maskAccountNumber -- an IBAN's tail is not reversible to the full value. */
export function maskIban(value: string): string {
  if (value.length <= 4) return '•'.repeat(value.length);
  return `${'•'.repeat(value.length - 4)}${value.slice(-4)}`;
}

/** Keeps the first character of the local part and the whole domain. */
export function maskEmail(value: string): string {
  const at = value.indexOf('@');
  if (at <= 0) return '•'.repeat(value.length); // malformed input should never reach here post-validation, but never throw from a masking helper
  const localPart = value.slice(0, at);
  const domain = value.slice(at);
  const visible = localPart.slice(0, 1);
  return `${visible}${'•'.repeat(Math.max(localPart.length - 1, 0))}${domain}`;
}

/** Keeps only the last 2-4 digits, matching common SMS-verification masking conventions. */
export function maskPhone(value: string): string {
  const visibleCount = value.length > 6 ? 4 : 2;
  if (value.length <= visibleCount) return '•'.repeat(value.length);
  return `${'•'.repeat(value.length - visibleCount)}${value.slice(-visibleCount)}`;
}
