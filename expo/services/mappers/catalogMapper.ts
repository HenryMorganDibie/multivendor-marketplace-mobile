import type { CatalogItem, Category } from '@/contexts/CatalogContext';
import type { MenuItem, Category as MenuCategory } from '@/mocks/vendorData';
import type { VendorMenuData } from '@/types/domain';

/**
 * catalogMapper — converts raw catalog records into the app's catalog types.
 *
 * SCAFFOLD ONLY. Mock catalog records already match `CatalogItem`/`Category`,
 * so these are pass-through with light normalization (arrays/strings defaulted).
 *
 * TODO(Henry): map Firestore `vendors/{vendorId}/catalogItems/{itemId}` and
 * `.../categories/{categoryId}` documents into these shapes.
 */
export type RawCatalogItem = Record<string, unknown>;
export type RawCatalogCategory = Record<string, unknown>;

export const catalogMapper = {
  /** Raw catalog item record → domain `CatalogItem`. */
  itemFromRaw(raw: RawCatalogItem): CatalogItem {
    const item = raw as unknown as CatalogItem;
    return {
      ...item,
      photos: Array.isArray(item.photos) ? item.photos.filter(Boolean) : [],
      addOnGroups: Array.isArray(item.addOnGroups) ? item.addOnGroups : [],
      description: item.description ?? '',
    };
  },

  /** Domain `CatalogItem` → raw record for persistence. */
  itemToRaw(item: CatalogItem): RawCatalogItem {
    return { ...item };
  },

  /** Raw category record → domain `Category`. */
  categoryFromRaw(raw: RawCatalogCategory): Category {
    return raw as unknown as Category;
  },

  /** Raw storefront menu item → display `MenuItem` (light normalization). */
  menuItemFromRaw(raw: RawCatalogItem): MenuItem {
    return raw as unknown as MenuItem;
  },

  /** Raw storefront menu category → display `Category`. */
  menuCategoryFromRaw(raw: RawCatalogCategory): MenuCategory {
    return raw as unknown as MenuCategory;
  },

  /**
   * Raw vendor menu payload → `VendorMenuData` consumed by the storefront.
   * Pass-through today; TODO(Henry): map Firestore menu docs into this shape.
   */
  vendorMenuFromRaw(items: RawCatalogItem[], categories: RawCatalogCategory[]): VendorMenuData {
    return {
      items: items.map((i) => this.menuItemFromRaw(i)),
      categories: categories.map((c) => this.menuCategoryFromRaw(c)),
    };
  },
};
