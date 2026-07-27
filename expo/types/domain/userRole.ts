/**
 * Roles a the platform account can hold.
 *
 * Single source of truth. Mirrors the private `UserRole` used inside
 * `AuthContext` and the implicit roles referenced across chat/storefront code.
 * `admin` exists for the separate web portal and is never selectable in-app.
 */
export type UserRole = 'customer' | 'vendor' | 'admin';

export const USER_ROLES: readonly UserRole[] = ['customer', 'vendor', 'admin'];

export function isUserRole(value: unknown): value is UserRole {
  return value === 'customer' || value === 'vendor' || value === 'admin';
}
