import type { CartItem, VendorCart } from '@/types/domain';

/**
 * cartService — single boundary for cart persistence.
 *
 * SCAFFOLD ONLY. Reads/writes the same `@the platform_vendor_carts` AsyncStorage
 * store that `contexts/CartContext` already owns, keeping the one-cart-per-vendor
 * shape intact. CartContext remains the live, reactive source for the UI; this
 * service exposes a stable async API Henry can repoint at Firestore
 * (`users/{uid}/carts/{vendorId}`) without touching screens.
 *
 * NOTE: do not wire screens to this yet — CartContext stays the live store so
 * cart reactivity is preserved. This is the future swap surface only.
 *
 * TODO(Henry): back these with Firestore per-user vendor carts.
 */
import { cartRepository } from '@/services/repositories/cartRepository';

async function readCarts(): Promise<VendorCart[]> {
  return cartRepository.readActive();
}

async function writeCarts(carts: VendorCart[]): Promise<void> {
  await cartRepository.writeAll(carts);
}

export const cartService = {
  /** All non-empty, non-submitted vendor carts for the current device/user. */
  async getAllCarts(): Promise<VendorCart[]> {
    return readCarts();
  },

  /** The active cart for a single vendor, if any. */
  async getVendorCart(vendorId: string): Promise<VendorCart | null> {
    const carts = await readCarts();
    return carts.find((c) => c.vendorId === vendorId) ?? null;
  },

  /** Replaces (or creates) a vendor's cart with the given items. */
  async replaceVendorCart(
    vendorId: string,
    vendorName: string,
    items: CartItem[],
  ): Promise<VendorCart | null> {
    const carts = await readCarts();
    const others = carts.filter((c) => c.vendorId !== vendorId);
    if (items.length === 0) {
      await writeCarts(others);
      return null;
    }
    const updated: VendorCart = {
      vendorId,
      vendorName,
      items,
      lastUpdated: Date.now(),
      status: 'active',
    };
    await writeCarts([...others, updated]);
    return updated;
  },

  /** Marks a vendor cart as submitted (kept for history, removed from active set). */
  async markSubmitted(vendorId: string): Promise<void> {
    const all = await cartRepository.readAllRaw();
    const next = all.map((c) =>
      c.vendorId === vendorId ? { ...c, status: 'submitted' as const, lastUpdated: Date.now() } : c,
    );
    await writeCarts(next);
  },

  /** Clears a single vendor's cart, or all carts when no vendorId is given. */
  async clearCart(vendorId?: string): Promise<void> {
    if (!vendorId) {
      await writeCarts([]);
      return;
    }
    const carts = await readCarts();
    await writeCarts(carts.filter((c) => c.vendorId !== vendorId));
  },
};
