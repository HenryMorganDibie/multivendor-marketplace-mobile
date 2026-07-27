import { mockVendors, mockMenuItems, mockCategories } from '@/mocks/vendorData';
import type { Vendor } from '@/mocks/vendorData';
import type { Order } from '@/mocks/ordersData';
import type { VendorCart } from '@/contexts/CartContext';
import type { VendorMenuData, CreateOrderPayload } from '@/types/domain';
import { generatethe platformOrderId } from '@/utils/orderIdGenerator';
import { canAppearInPublicDiscovery, canAccessViaDirectLink } from '@/utils/vendorDiscovery';

export async function getVendorByUsername(username: string): Promise<Vendor | null> {
  const normalized = username.trim().toLowerCase().replace(/^@/, '');
  console.log('[API] getVendorByUsername:', normalized);
  const vendor = mockVendors.find(v => v.username.toLowerCase() === normalized) ?? null;
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
  let results = mockVendors.filter(canAppearInPublicDiscovery);
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
  let results = mockVendors.filter(v => v.category === category && canAppearInPublicDiscovery(v));
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
  let results = mockVendors.filter(v => v.isOpenNow && canAppearInPublicDiscovery(v));
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
  let results = mockVendors.filter(v => (v.pickup || v.delivery) && canAppearInPublicDiscovery(v));
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

export async function getVendorMenu(vendorId: string): Promise<VendorMenuData> {
  console.log('[API] getVendorMenu vendorId:', vendorId);
  return {
    items: mockMenuItems,
    categories: mockCategories,
  };
}

export async function getOrders(): Promise<Order[]> {
  console.log('[API] getOrders:', mockOrders.length, 'orders');
  return mockOrders;
}

export async function getCustomerCarts(): Promise<VendorCart[]> {
  console.log('[API] getCustomerCarts — delegated to CartContext');
  return [];
}

export async function acceptOrder(orderId: string): Promise<{ orderId: string; newStatus: 'accepted' }> {
  console.log('[API] acceptOrder:', orderId);
  return { orderId, newStatus: 'accepted' };
}

export async function rejectOrder(orderId: string, reason?: string): Promise<{ orderId: string; newStatus: 'rejected'; reason?: string }> {
  console.log('[API] rejectOrder:', orderId, 'reason:', reason);
  return { orderId, newStatus: 'rejected', reason };
}
