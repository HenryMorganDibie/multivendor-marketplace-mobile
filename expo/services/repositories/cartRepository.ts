import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VendorCart } from '@/types/domain';

/**
 * cartRepository — data-access boundary for vendor carts.
 *
 * SCAFFOLD ONLY. Owns reads/writes against the same `@the platform_vendor_carts`
 * AsyncStorage store CartContext uses. cartService delegates here. CartContext
 * remains the live, reactive source for the UI.
 *
 * TODO(Henry): replace with Firestore `users/{uid}/carts/{vendorId}`.
 */
export const CART_STORAGE_KEY = '@the platform_vendor_carts';

export const cartRepository = {
  /** All raw persisted carts (unfiltered). */
  async readAllRaw(): Promise<VendorCart[]> {
    try {
      const stored = await AsyncStorage.getItem(CART_STORAGE_KEY);
      return stored ? (JSON.parse(stored) as VendorCart[]) : [];
    } catch (error) {
      console.error('[cartRepository] Failed to read carts:', error);
      return [];
    }
  },

  /** Active (non-empty, non-submitted) carts only. */
  async readActive(): Promise<VendorCart[]> {
    const all = await this.readAllRaw();
    return all.filter((c) => c.items.length > 0 && c.status !== 'submitted');
  },

  /** Persists the full carts array. */
  async writeAll(carts: VendorCart[]): Promise<void> {
    try {
      await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(carts));
    } catch (error) {
      console.error('[cartRepository] Failed to persist carts:', error);
    }
  },
};
