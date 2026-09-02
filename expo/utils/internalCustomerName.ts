/**
 * Privacy-safe display name formatter for INTERNAL the platform customers.
 *
 * Privacy rule: vendors must never see a customer's full last name on any
 * internal-customer surface (invoice selector, invoice detail, chat card,
 * invoice list, notifications, revenue activity, toasts, etc.). Internal
 * the platform customers are always rendered as "First L." (first name + last
 * initial). External customers may use whatever display name the vendor
 * typed manually — those go through `formatExternalCustomerName` below.
 *
 * Centralized so every surface formats identically. Screens should never
 * manually format names with `firstName + ' ' + lastName[0] + '.'`.
 */

export interface InternalCustomerNameInput {
  firstName: string;
  lastName?: string;
}

/**
 * Format an internal the platform customer's name as "First L."
 *
 * @example
 * formatInternalCustomerName({ firstName: 'Jane', lastName: 'Smith' }) // 'Jane S.'
 * formatInternalCustomerName({ firstName: 'Jane' })                     // 'Jane'
 * formatInternalCustomerName({ firstName: '', lastName: 'Smith' })      // 'Customer'
 */
export function formatInternalCustomerName(input: InternalCustomerNameInput): string {
  const first = (input?.firstName ?? '').trim();
  const last = (input?.lastName ?? '').trim();

  if (!first && !last) return 'Customer';
  if (!last) return first;
  return `${first} ${last.charAt(0).toUpperCase()}.`;
}

/**
 * Parse a full display name string ("Jane Smith" / "Jane Middle Smith" /
 * "Jane") into first + last components. The last token becomes the last
 * name; everything before it is the first name (matching how we render
 * initials — only the final token's initial is shown).
 */
export function parseFullName(fullName: string): InternalCustomerNameInput {
  const trimmed = (fullName ?? '').trim();
  if (!trimmed) return { firstName: '', lastName: undefined };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: undefined };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

/**
 * Format an internal customer from a stored full-name string. This is the
 * convenience overload for surfaces that only have a single string (the
 * common case — `invoice.customerName`, `chat.customerName`, inbox title).
 *
 * @example
 * formatInternalCustomerFromFull('Jane Smith') // 'Jane S.'
 * formatInternalCustomerFromFull('Jane')       // 'Jane'
 */
export function formatInternalCustomerFromFull(fullName?: string): string {
  if (!fullName) return 'Customer';
  const parsed = parseFullName(fullName);
  return formatInternalCustomerName(parsed);
}

/**
 * Resolve a customer display name for an invoice row / card, honoring the
 * internal vs external distinction.
 *
 * - `customerSource === 'external'` → return the vendor-typed display name
 *   verbatim (vendors may enter whatever name they like for external
 *   customers who are not in the platform system).
 * - `customerSource === 'the platform'` (or undefined) → always privacy-safe
 *   "First L." via `formatInternalCustomerFromFull`.
 *
 * This is the canonical helper for invoice list rows, invoice detail,
 * chat invoice cards, the invoice selector, search results, notifications,
 * and revenue activity descriptions.
 */
export function formatInvoiceCustomerName(
  fullName: string | undefined,
  customerSource: 'the platform' | 'external' | undefined,
): string {
  if (customerSource === 'external') {
    const trimmed = (fullName ?? '').trim();
    return trimmed || 'External customer';
  }
  return formatInternalCustomerFromFull(fullName);
}
