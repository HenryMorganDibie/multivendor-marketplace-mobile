/**
 * Shared character limits for all invoice free-text fields.
 *
 * These limits are enforced in the UI for MVP. Henry must validate the same
 * limits server-side when saving invoices and branding settings; the mobile
 * UI should not be the only gate.
 */
export const INVOICE_TEXT_LIMITS = {
  /** Thank-you message shown under the business name. */
  thankYouMessage: 120,
  /** Footer text printed below invoice totals (payment instructions, etc.). */
  footerText: 300,
  /** Invoice-specific notes (customer instructions, fulfilment details). */
  notes: 500,
  /** External customer display name. */
  externalCustomerName: 80,
  /** Line item product/service name. */
  lineItemName: 100,
  /** Optional line item description. */
  lineItemDescription: 200,
  /** Fulfilment location / address / service location. */
  fulfilmentLocation: 200,
  /** Fulfilment instructions / service notes. */
  fulfilmentInstructions: 300,
} as const;

/**
 * Returns a clean string that obeys the invoice text limit.
 * - Trims leading/trailing whitespace.
 * - Treats whitespace-only strings as empty.
 * - Does not silently truncate; callers must validate length before saving.
 */
export function sanitizeInvoiceText(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value.trim();
}

/**
 * Checks whether the provided text exceeds the limit for a given field.
 * Returns a validation message when it does, otherwise `null`.
 */
export function getInvoiceTextLimitError(
  field: keyof typeof INVOICE_TEXT_LIMITS,
  value: string | null | undefined,
): string | null {
  const cleaned = sanitizeInvoiceText(value);
  if (!cleaned) return null;
  const limit = INVOICE_TEXT_LIMITS[field];
  if (cleaned.length > limit) {
    return `${cleaned.length}/${limit} characters. Please shorten this field.`;
  }
  return null;
}

/**
 * Formats a live character counter such as "84/120".
 */
export function formatInvoiceCharacterCount(
  field: keyof typeof INVOICE_TEXT_LIMITS,
  value: string | null | undefined,
): string {
  const count = (value ?? '').length;
  const limit = INVOICE_TEXT_LIMITS[field];
  return `${count}/${limit}`;
}
