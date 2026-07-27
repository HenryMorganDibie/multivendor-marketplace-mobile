/**
 * Vendor handle formatting helpers.
 *
 * The app standardizes on Instagram/Threads-style `@handle` format for vendor
 * usernames across the chat list, chat header, vendor info screen, storefront
 * metadata, search results, and shared vendor cards.
 *
 * We never hardcode handles. Inputs are pulled from real vendor/inbox data
 * (username, slug, vendorSlug, vendorPublicId). We preserve the vendor's
 * chosen casing when available (typically lowercase from backend); only
 * sanitized fallbacks derived from display names are forced lowercase.
 */

export interface VendorHandleSource {
  username?: string | null;
  slug?: string | null;
  vendorSlug?: string | null;
  vendorPublicId?: string | null;
  name?: string | null;
  id?: string | null;
}

/**
 * Convert a free-form name into a safe handle-friendly token
 * (lowercase, alphanumerics only). Used only as a last-resort fallback
 * when no real handle/slug/publicId exists.
 */
function sanitizeToHandle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);
}

/**
 * Resolve the best raw handle value (no `@` prefix) for a vendor.
 * Priority: explicit username → slug → inbox vendorSlug → sanitized
 * vendorPublicId → sanitized display name → vendor id.
 */
export function resolveVendorHandle(source: VendorHandleSource | null | undefined): string | undefined {
  if (!source) return undefined;
  const username = source.username?.trim();
  if (username) return username;

  const slug = source.slug?.trim();
  if (slug) return slug;

  const vendorSlug = source.vendorSlug?.trim();
  if (vendorSlug) return vendorSlug;

  const publicId = source.vendorPublicId?.trim();
  if (publicId) return publicId.toLowerCase();

  const name = source.name?.trim();
  if (name) {
    const sanitized = sanitizeToHandle(name);
    if (sanitized.length > 0) return sanitized;
  }

  const id = source.id?.trim();
  if (id) return id;

  return undefined;
}

/**
 * Format a vendor handle with the `@` prefix, preserving the vendor's
 * chosen casing. Returns `undefined` if no handle can be resolved.
 */
export function formatVendorHandle(source: VendorHandleSource | null | undefined): string | undefined {
  const handle = resolveVendorHandle(source);
  if (!handle) return undefined;
  return `@${handle}`;
}

/**
 * Format with a guaranteed string fallback (defaults to `@vendor`).
 * Useful for UI surfaces where an empty label would break layout.
 */
export function formatVendorHandleOrFallback(
  source: VendorHandleSource | null | undefined,
  fallback: string = '@vendor',
): string {
  return formatVendorHandle(source) ?? fallback;
}
