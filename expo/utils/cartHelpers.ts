import { VendorCart } from '@/contexts/CartContext';

export function getCartBadgeCount(carts: VendorCart[]): number {
  return carts.length;
}
