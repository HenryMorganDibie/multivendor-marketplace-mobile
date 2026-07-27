/**
 * Deterministic avatar color helper.
 *
 * Use `customerId` as the primary stable key whenever available.
 * Fall back to a normalised customer name only when no ID exists.
 *
 * The same key always returns the same color — across every screen,
 * every re-render, and every app restart.
 *
 * @example
 *   getAvatarColor(order.customerId ?? order.customerName)
 */

const AVATAR_PALETTE: readonly string[] = [
  '#E8845C', // warm terracotta
  '#5B9BD5', // calm blue
  '#7BC8B8', // soft teal
  '#F0C75E', // muted amber
  '#A78BCA', // gentle violet
  '#6AADDB', // sky blue
  '#E89B6C', // peach
  '#6DBF8A', // sage green
  '#D96B8A', // dusty rose
  '#7BA3C8', // steel blue
];

/**
 * Hash a string into a bucket index deterministically.
 * Uses the djb2 variant — simple, fast, and well-distributed for short strings.
 */
function hashKey(key: string): number {
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash) ^ key.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return hash;
}

/**
 * Returns a stable avatar background color for the given identity key.
 *
 * Pass `customerId` as the key — it is immutable and unique per customer.
 * If only a name is available, normalise it first (trim + lowercase) so that
 * "Sarah Johnson" and "sarah johnson" resolve to the same color.
 */
export function getAvatarColor(key: string | null | undefined): string {
  if (!key || key.trim() === '') {
    return AVATAR_PALETTE[0];
  }
  const normalised = key.trim().toLowerCase();
  const index = hashKey(normalised) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}
