import { Vendor, mockVendors, mockVendor, MenuItem, mockMenuItems, Category, mockCategories } from '@/mocks/vendorData';

/**
 * vendorRepository — data-access boundary for vendors, menu items, categories.
 *
 * SCAFFOLD ONLY. Owns the in-memory mock arrays that vendorService used to hold
 * directly, so there is a single mutable source. vendorService now delegates
 * here. Returns raw domain-shaped records (mock data already matches `Vendor`/
 * `MenuItem`/`Category`).
 *
 * TODO(Henry): replace these arrays with Firestore `vendors/{vendorId}` reads
 * (+ menu/category subcollections). Keep the method names stable.
 */
let vendors: Vendor[] = [...mockVendors];
let menuItems: MenuItem[] = [...mockMenuItems];

export const vendorRepository = {
  async getAll(): Promise<Vendor[]> {
    return [...vendors];
  },

  async getById(vendorId: string): Promise<Vendor | undefined> {
    if (vendorId === 'v1') return mockVendor;
    return vendors.find((v) => v.id === vendorId);
  },

  async getBySlug(slug: string): Promise<Vendor | undefined> {
    if (slug === 'spicyrest') return mockVendor;
    return vendors.find((v) => v.slug === slug);
  },

  async getByUsername(username: string): Promise<Vendor | undefined> {
    if (username === 'spicyrest') return mockVendor;
    return vendors.find((v) => v.username === username);
  },

  async update(vendorId: string, updates: Partial<Vendor>): Promise<Vendor | null> {
    const index = vendors.findIndex((v) => v.id === vendorId);
    if (index === -1) {
      console.error('[vendorRepository] Vendor not found:', vendorId);
      return null;
    }
    vendors = vendors.map((v) => (v.id === vendorId ? { ...v, ...updates } : v));
    return vendors[index];
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
