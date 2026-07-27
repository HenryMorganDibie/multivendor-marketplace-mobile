import type { CartItem, VendorCart } from '@/types/domain';

/**
 * cartMapper — converts raw cart records into domain cart types.
 *
 * SCAFFOLD ONLY. Persisted carts already match `VendorCart`, so this is a
 * defensive normalization layer (filtering empty/submitted carts is left to the
 * repository). It exists so cart shape conversion lives in ONE place.
 *
 * TODO(Henry): map Firestore `users/{uid}/carts/{vendorId}` documents into
 * these shapes.
 */
export type RawCart = Record<string, unknown>;

export const cartMapper = {
  /** Raw cart record → domain `VendorCart`. */
  fromRaw(raw: RawCart): VendorCart {
    const cart = raw as unknown as VendorCart;
    return {
      ...cart,
      items: Array.isArray(cart.items) ? cart.items : [],
    };
  },

  /** Domain `VendorCart` → raw record for persistence. */
  toRaw(cart: VendorCart): RawCart {
    return { ...cart };
  },

  /** Raw item record → domain `CartItem`. */
  itemFromRaw(raw: RawCart): CartItem {
    return raw as unknown as CartItem;
  },
};
