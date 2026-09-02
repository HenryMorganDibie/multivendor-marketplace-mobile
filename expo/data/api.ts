import { mockVendors } from '@/mocks/vendorData';
import { mockOrders } from '@/mocks/ordersData';
import type { Vendor } from '@/mocks/vendorData';
import type { Order } from '@/mocks/ordersData';
import type { VendorCart } from '@/contexts/CartContext';
import type { VendorMenuData, CreateOrderPayload } from '@/types/domain';
import { generatePlatformOrderId } from '@/utils/orderIdGenerator';
import { canAccessViaDirectLink } from '@/utils/vendorDiscovery';
import { vendorService } from '@/services/vendorService';
import { catalogService } from '@/services/catalogService';

export async function getVendorByUsername(username: string): Promise<Vendor | null> {
  const normalized = username.trim().toLowerCase().replace(/^@/, '');

  // Through the service stack, which reads Firestore. This is the route a
  // shared storefront link lands on, so it has to resolve a real vendor: a
  // customer following a link to a business that only exists in fixture data
  // sees a storefront nobody can order from.
  const vendor = (await vendorService.getByUsername(normalized)) ?? null;
  // Direct link access: null if blocked (suspended/deactivated)
  if (vendor && !canAccessViaDirectLink(vendor)) {
    console.log('[API] Vendor blocked:', normalized, '| status:', vendor.vendorStatus);
    // Return the vendor but let the route guard handle the blocked UI
    return vendor;
  }
  return vendor;
}

/**
 * getAllVendors — used by AllVendors screen.
 * Only returns vendors eligible for public discovery (approved/active).
 */
export async function getAllVendors(countryCode?: string, region?: string): Promise<Vendor[]> {
  console.log('[API] getAllVendors countryCode:', countryCode, 'region:', region);
  // Canonical visibility comes from the service/repository/mapper stack
  // (vendorService.getDiscoverable → vendorRepository → vendorMapper.isDiscoverable).
  let results = await vendorService.getDiscoverable();
  if (countryCode) {
    results = results.filter(v => v.countryCode === countryCode);
  }
  if (region) {
    results = results.filter(v => v.region === region);
  }
  console.log('[API] getAllVendors filtered:', results.length, 'vendors');
  return results;
}

/**
 * getVendorsByCategory — used by category browse screens.
 * Only returns vendors eligible for public discovery.
 */
export async function getVendorsByCategory(category: string, countryCode?: string, region?: string): Promise<Vendor[]> {
  console.log('[API] getVendorsByCategory:', category, 'country:', countryCode, 'region:', region);
  const discoverable = await vendorService.getDiscoverable();
  let results = discoverable.filter(v => v.category === category);
  if (countryCode) {
    results = results.filter(v => v.countryCode === countryCode);
  }
  if (region) {
    results = results.filter(v => v.region === region);
  }
  return results;
}

/**
 * getOpenNowVendors — used by Open Now browse screen.
 * Only returns vendors eligible for public discovery.
 */
export async function getOpenNowVendors(countryCode?: string, region?: string): Promise<Vendor[]> {
  console.log('[API] getOpenNowVendors country:', countryCode, 'region:', region);
  const discoverable = await vendorService.getDiscoverable();
  let results = discoverable.filter(v => v.isOpenNow);
  if (countryCode) {
    results = results.filter(v => v.countryCode === countryCode);
  }
  if (region) {
    results = results.filter(v => v.region === region);
  }
  return results;
}

/**
 * getVendorsNearYou — used by near-you screens.
 * Only returns vendors eligible for public discovery.
 */
export async function getVendorsNearYou(countryCode?: string, region?: string, city?: string): Promise<Vendor[]> {
  console.log('[API] getVendorsNearYou country:', countryCode, 'region:', region, 'city:', city);
  const discoverable = await vendorService.getDiscoverable();
  let results = discoverable.filter(v => v.pickup || v.delivery);
  if (countryCode) {
    results = results.filter(v => v.countryCode === countryCode);
  }
  if (region) {
    results = results.filter(v => v.region === region);
  }
  if (city) {
    const cityLower = city.toLowerCase();
    results.sort((a, b) => {
      const aMatch = a.city.toLowerCase() === cityLower ? 0 : 1;
      const bMatch = b.city.toLowerCase() === cityLower ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return b.rating - a.rating;
    });
  }
  return results;
}

/**
 * getVendorMenu — storefront vendor menu read path.
 * Delegates to catalogService.getVendorMenu → catalogRepository →
 * catalogMapper.vendorMenuFromRaw. Output shape (`VendorMenuData`) unchanged.
 */
export async function getVendorMenu(vendorId: string): Promise<VendorMenuData> {
  console.log('[API] getVendorMenu vendorId:', vendorId);
  return catalogService.getVendorMenu(vendorId);
}

export async function getOrders(): Promise<Order[]> {
  console.log('[API] getOrders:', mockOrders.length, 'orders');
  return mockOrders;
}

export async function getCustomerCarts(): Promise<VendorCart[]> {
  console.log('[API] getCustomerCarts — delegated to CartContext');
  return [];
}

export async function createOrder(payload: CreateOrderPayload): Promise<{ orderId: string }> {
  console.log('[API] createOrder for vendor:', payload.vendorId);
  return { orderId: `order-${Date.now()}` };
}

export async function submitOrder(payload: CreateOrderPayload): Promise<{ orderId: string }> {
  console.log('[API] submitOrder for vendor:', payload.vendorId);
  return { orderId: `order-${Date.now()}` };
}

export async function markInProgress(orderId: string): Promise<{ orderId: string; newStatus: 'in_progress' }> {
  console.log('[API] markInProgress:', orderId);
  return { orderId, newStatus: 'in_progress' };
}

export async function completeOrder(orderId: string): Promise<{ orderId: string; newStatus: 'completed' }> {
  console.log('[API] completeOrder:', orderId);
  return { orderId, newStatus: 'completed' };
}

export async function cancelOrder(
  orderId: string,
  reason?: string,
  reasonCode?: string,
  reasonText?: string,
): Promise<{ orderId: string; newStatus: 'cancelled'; reason?: string; reasonCode?: string; reasonText?: string }> {
  console.log('[API] cancelOrder:', orderId, 'reason:', reason);
  return { orderId, newStatus: 'cancelled', reason, reasonCode, reasonText };
}

export async function markOrderPaid(orderId: string): Promise<{ orderId: string; newStatus: 'confirmed' }> {
  console.log('[API] markOrderPaid:', orderId);
  return { orderId, newStatus: 'confirmed' };
}

export async function acceptOrder(orderId: string): Promise<{ orderId: string; newStatus: 'accepted' }> {
  console.log('[API] acceptOrder:', orderId);
  return { orderId, newStatus: 'accepted' };
}

export async function rejectOrder(orderId: string, reason?: string): Promise<{ orderId: string; newStatus: 'rejected'; reason?: string }> {
  console.log('[API] rejectOrder:', orderId, 'reason:', reason);
  return { orderId, newStatus: 'rejected', reason };
}
