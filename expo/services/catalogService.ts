import { CatalogItem, Category } from '@/contexts/CatalogContext';
import { catalogRepository } from '@/services/repositories/catalogRepository';
import type { VendorMenuData } from '@/types/domain';

/**
 * catalogService — single boundary for catalog category & item reads/writes.
 *
 * Data access is delegated to `catalogRepository`, which owns the mock data
 * today. TODO(Henry): the repository is where Firestore calls will replace the
 * mock arrays; this service's API and moderation defaults stay stable.
 */
export const catalogService = {
  /**
   * Storefront vendor menu read path: storefront screen → catalogService →
   * catalogRepository → catalogMapper.vendorMenuFromRaw.
   *
   * TODO(Henry): repository swaps mock arrays for Firestore; this boundary and
   * the `VendorMenuData` output shape stay stable.
   */
  async getVendorMenu(vendorId: string): Promise<VendorMenuData> {
    return catalogRepository.getVendorMenu(vendorId);
  },

  async getAllCategories(): Promise<Category[]> {
    return catalogRepository.getAllCategories();
  },

  async getCategoryById(id: string): Promise<Category | undefined> {
    return catalogRepository.getCategoryById(id);
  },

  async createCategory(name: string): Promise<Category> {
    const all = await catalogRepository.getAllCategories();
    const newCategory: Category = {
      id: `cat_${Date.now()}`,
      name,
      order: all.length,
      isSystem: false,
    };
    const created = await catalogRepository.createCategory(newCategory);
    console.log('[CatalogService] Created category:', created.id);
    return created;
  },

  async updateCategory(id: string, name: string): Promise<Category | null> {
    const updated = await catalogRepository.updateCategory(id, name);
    if (updated) console.log('[CatalogService] Updated category:', id);
    return updated;
  },

  async deleteCategory(id: string): Promise<boolean> {
    const deleted = await catalogRepository.deleteCategory(id);
    if (deleted) console.log('[CatalogService] Deleted category:', id);
    return deleted;
  },

  async reorderCategories(newOrder: Category[]): Promise<Category[]> {
    const result = await catalogRepository.reorderCategories(newOrder);
    console.log('[CatalogService] Reordered categories');
    return result;
  },

  async getAllItems(): Promise<CatalogItem[]> {
    return catalogRepository.getAllItems();
  },

  async getItemById(id: string): Promise<CatalogItem | undefined> {
    return catalogRepository.getItemById(id);
  },

  async getItemsByCategory(categoryId: string): Promise<CatalogItem[]> {
    return catalogRepository.getItemsByCategory(categoryId);
  },

  async createItem(item: Omit<CatalogItem, 'id' | 'moderationStatus'>): Promise<CatalogItem> {
    const newItem: CatalogItem = {
      ...item,
      id: `item_${Date.now()}`,
      moderationStatus: 'pending_review',
      photos: Array.isArray(item.photos) ? item.photos.filter(Boolean) : [],
      addOnGroups: Array.isArray(item.addOnGroups) ? item.addOnGroups : [],
      description: item.description ?? '',
    };
    const created = await catalogRepository.createItem(newItem);
    console.log('[CatalogService] Created item:', created.id);
    return created;
  },

  async updateItem(id: string, updates: Omit<CatalogItem, 'id' | 'moderationStatus'>): Promise<CatalogItem | null> {
    const next: CatalogItem = {
      ...updates,
      id,
      moderationStatus: 'pending_review',
      photos: Array.isArray(updates.photos) ? updates.photos.filter(Boolean) : [],
      addOnGroups: Array.isArray(updates.addOnGroups) ? updates.addOnGroups : [],
      description: updates.description ?? '',
    };
    const updated = await catalogRepository.replaceItem(id, next);
    if (updated) console.log('[CatalogService] Updated item:', id);
    return updated;
  },

  async deleteItem(id: string): Promise<boolean> {
    const deleted = await catalogRepository.deleteItem(id);
    if (deleted) console.log('[CatalogService] Deleted item:', id);
    return deleted;
  },

  async updateItemAvailability(id: string, isAvailable: boolean): Promise<CatalogItem | null> {
    const updated = await catalogRepository.patchItem(id, { isAvailable });
    if (updated) console.log('[CatalogService] Updated item availability:', id);
    return updated;
  },

  async updateItemStock(id: string, isOutOfStock: boolean): Promise<CatalogItem | null> {
    const updated = await catalogRepository.patchItem(id, { isOutOfStock });
    if (updated) console.log('[CatalogService] Updated item stock:', id);
    return updated;
  },
};
