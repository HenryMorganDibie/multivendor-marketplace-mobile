import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Vendor, mockVendors, mockVendor, MenuItem, mockMenuItems, Category, mockCategories } from '@/mocks/vendorData';
import { mapVendorDoc } from './mapVendorDoc';

/**
 * vendorRepository — data-access boundary for vendors, menu items, categories.
 *
 * Vendor reads now come from Firestore. This is the seam the previous scaffold
 * pointed at: the method names are unchanged, so vendorService and every screen
 * above it are untouched.
 *
 * Only discoverable vendors are returned, which is what the security rules
 * permit a customer to read anyway. A rule that refuses is not a filter to rely
 * on for correctness, but querying the same condition means the query returns a
 * short list rather than erroring on the first document it cannot read.
 *
 * The mock arrays remain for the demo logins and for menu items and categories,
 * which are still scaffold. Those are the vendor's own catalog, already served
 * by CatalogContext for the vendor's own view; the customer-facing version of
 * them is a separate piece of work.
 */
let menuItems: MenuItem[] = [...mockMenuItems];

/** The demo vendor ids that only exist in mock data. */
const DEMO_VENDOR_IDS = new Set(['v1', 'v2', 'v3']);
const DEMO_SLUGS = new Set(['spicyrest']);

async function findOneBy(field: 'slug' | 'username', value: string): Promise<Vendor | undefined> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'vendors'),
        where(field, '==', value),
        where('verificationStatus', '==', 'approved'),
        where('vendorStatus', '==', 'active'),
        where('isDiscoverable', '==', true),
        limit(1),
      ),
    );
    return snap.empty ? undefined : mapVendorDoc(snap.docs[0].id, snap.docs[0].data());
  } catch (error) {
    console.error(`[vendorRepository] Could not look up vendor by ${field}:`, value, error);
    return undefined;
  }
}

export const vendorRepository = {
  async getAll(): Promise<Vendor[]> {
    try {
      // All three conditions, because a list query has to constrain every
      // field the security rule tests. The rule requires approved, active and
      // discoverable; a query filtering only on discoverable is refused
      // outright — Firestore rejects the whole query rather than filtering,
      // since it cannot prove in advance that no denied document would be
      // returned.
      const snap = await getDocs(
        query(
          collection(db, 'vendors'),
          where('verificationStatus', '==', 'approved'),
          where('vendorStatus', '==', 'active'),
          where('isDiscoverable', '==', true),
          limit(200),
        ),
      );
      return snap.docs.map((d) => mapVendorDoc(d.id, d.data()));
    } catch (error) {
      // An empty list is the honest answer when the read fails. Falling back to
      // mock vendors would show a customer businesses that do not exist and let
      // them try to order from one.
      console.error('[vendorRepository] Could not load vendors:', error);
      return [];
    }
  },

  async getById(vendorId: string): Promise<Vendor | undefined> {
    if (DEMO_VENDOR_IDS.has(vendorId)) {
      return vendorId === 'v1' ? mockVendor : mockVendors.find((v) => v.id === vendorId);
    }
    try {
      const snap = await getDoc(doc(db, 'vendors', vendorId));
      return snap.exists() ? mapVendorDoc(snap.id, snap.data()) : undefined;
    } catch (error) {
      console.error('[vendorRepository] Could not load vendor:', vendorId, error);
      return undefined;
    }
  },

  async getBySlug(slug: string): Promise<Vendor | undefined> {
    if (DEMO_SLUGS.has(slug)) return mockVendor;
    return findOneBy('slug', slug);
  },

  async getByUsername(username: string): Promise<Vendor | undefined> {
    if (DEMO_SLUGS.has(username)) return mockVendor;
    return findOneBy('username', username);
  },

  /**
   * Vendor documents are not writable from a client: the rules forbid it and
   * every legitimate change goes through a callable. This returns the current
   * record so callers relying on the old scaffold behaviour still get a value,
   * rather than silently appearing to save something that was never written.
   */
  async update(vendorId: string, _updates: Partial<Vendor>): Promise<Vendor | null> {
    console.warn('[vendorRepository] Vendor updates go through a callable, not a direct write.');
    return (await vendorRepository.getById(vendorId)) ?? null;
  },

  async getMenuItems(vendorId: string): Promise<MenuItem[]> {
    if (vendorId === 'v1') return [...mockMenuItems];
    return menuItems.filter((item) => item.id.startsWith(vendorId));
  },

  async getMenuItemById(itemId: string): Promise<MenuItem | undefined> {
    return mockMenuItems.find((item) => item.id === itemId);
  },

  async updateMenuItemStock(
    itemId: string,
    inStock: boolean,
    stockCount?: number,
  ): Promise<MenuItem | null> {
    const index = menuItems.findIndex((item) => item.id === itemId);
    if (index === -1) {
      console.error('[vendorRepository] Menu item not found:', itemId);
      return null;
    }
    menuItems = menuItems.map((item) =>
      item.id === itemId ? { ...item, inStock, stockCount } : item,
    );
    return menuItems[index];
  },

  async getCategories(vendorId: string): Promise<Category[]> {
    if (vendorId === 'v1') return [...mockCategories];
    return [];
  },

  async getCategoryById(categoryId: string): Promise<Category | undefined> {
    return mockCategories.find((cat) => cat.id === categoryId);
  },
};
