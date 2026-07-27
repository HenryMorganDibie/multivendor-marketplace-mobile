import { Vendor, MenuItem, Category } from '@/mocks/vendorData';
import { vendorRepository } from '@/services/repositories/vendorRepository';
import { vendorMapper } from '@/services/mappers/vendorMapper';

/**
 * vendorService — single boundary for vendor/menu/category reads & writes.
 *
 * Data access is delegated to `vendorRepository`, which owns the mock data
 * today. TODO(Henry): the repository is where Firestore calls will replace the
 * mock arrays; this service's API stays stable for screens.
 */
export const vendorService = {
  async getAll(): Promise<Vendor[]> {
    return vendorRepository.getAll();
  },

  /**
   * Vendors eligible for public discovery (Home / Explore / Search). Applies the
   * backend-aligned visibility rule via `vendorMapper.isDiscoverable`, so only
   * ACTIVE/approved + active-account + discoverable vendors are returned;
   * UNVERIFIED, WAITLISTED, SUSPENDED and DEACTIVATED vendors are excluded.
   *
   * TODO(Henry): a Firestore implementation can push this filter into the query
   * (e.g. where verificationStatus == approved && accountState == active).
   */
  async getDiscoverable(): Promise<Vendor[]> {
    const all = await vendorRepository.getAll();
    return all.filter(vendorMapper.isDiscoverable);
  },

  async getById(vendorId: string): Promise<Vendor | undefined> {
    return vendorRepository.getById(vendorId);
  },

  async getBySlug(slug: string): Promise<Vendor | undefined> {
    return vendorRepository.getBySlug(slug);
  },

  async getByUsername(username: string): Promise<Vendor | undefined> {
    return vendorRepository.getByUsername(username);
  },

  async getByCategory(category: string): Promise<Vendor[]> {
    const all = await vendorRepository.getAll();
    return all.filter(v => v.category === category);
  },

  async getByRegion(region: string): Promise<Vendor[]> {
    const all = await vendorRepository.getAll();
    return all.filter(v => v.region === region);
  },

  async getOpenNow(): Promise<Vendor[]> {
    const all = await vendorRepository.getAll();
    return all.filter(v => v.isOpenNow);
  },

  async search(query: string): Promise<Vendor[]> {
    const lowerQuery = query.toLowerCase();
    const all = await vendorRepository.getAll();
    return all.filter(v =>
      v.name.toLowerCase().includes(lowerQuery) ||
      v.category.toLowerCase().includes(lowerQuery) ||
      v.area.toLowerCase().includes(lowerQuery)
    );
  },

  async update(vendorId: string, updates: Partial<Vendor>): Promise<Vendor | null> {
    const updated = await vendorRepository.update(vendorId, updates);
    if (updated) console.log('[VendorService] Updated vendor:', vendorId);
    return updated;
  },
};

export const menuService = {
  async getItemsByVendor(vendorId: string): Promise<MenuItem[]> {
    return vendorRepository.getMenuItems(vendorId);
  },

  async getItemById(itemId: string): Promise<MenuItem | undefined> {
    return vendorRepository.getMenuItemById(itemId);
  },

  async getItemsByCategory(vendorId: string, categoryId: string): Promise<MenuItem[]> {
    const vendorItems = await this.getItemsByVendor(vendorId);
    return vendorItems.filter(item => item.categoryId === categoryId);
  },

  async getInStockItems(vendorId: string): Promise<MenuItem[]> {
    const vendorItems = await this.getItemsByVendor(vendorId);
    return vendorItems.filter(item => item.inStock);
  },

  async updateStock(itemId: string, inStock: boolean, stockCount?: number): Promise<MenuItem | null> {
    const updated = await vendorRepository.updateMenuItemStock(itemId, inStock, stockCount);
    if (updated) console.log('[MenuService] Updated item stock:', itemId);
    return updated;
  },
};

export const categoryService = {
  async getByVendor(vendorId: string): Promise<Category[]> {
    return vendorRepository.getCategories(vendorId);
  },

  async getById(categoryId: string): Promise<Category | undefined> {
    return vendorRepository.getCategoryById(categoryId);
  },
};
