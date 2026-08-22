import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CatalogItem, Category } from '@/contexts/CatalogContext';
import type { MenuItem, Category as StorefrontCategory } from '@/mocks/vendorData';
import type { VendorMenuData } from '@/types/domain';

/**
 * catalogRepository — data-access boundary for the vendor's catalog.
 *
 * SCAFFOLD ONLY. Owns the in-memory mock arrays that catalogService used to
 * hold directly, so there is a single mutable source. catalogService now
 * delegates here.
 *
 * TODO(Henry): replace these arrays with Firestore
 * `vendors/{vendorId}/catalogItems` + `.../categories`. Keep names stable.
 */
let categories: Category[] = [
  { id: 'uncategorized', name: 'Uncategorized', order: 0, isSystem: true },
  { id: 'pastries', name: 'Pastries', order: 1, isSystem: false },
  { id: 'small-chops', name: 'Small Chops', order: 2, isSystem: false },
  { id: 'burgers', name: 'Burgers', order: 3, isSystem: false },
];

let items: CatalogItem[] = [
  {
    id: '1',
    trackInventory: false,
    name: 'Meat Pie',
    basePrice: 500,
    description: 'Flaky pastry with spiced beef',
    photos: ['https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80'],
    isAvailable: true,
    isTaxExempt: false,
    isHidden: false,
    isOutOfStock: false,
    isFeatured: false,
    categoryId: 'pastries',
    addOnGroups: [],
    moderationStatus: 'approved',
  },
  {
    id: '2',
    trackInventory: false,
    name: 'Sausage Roll',
    basePrice: 450,
    description: 'Crispy roll with juicy sausage',
    photos: ['https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=400&q=80'],
    isAvailable: true,
    isTaxExempt: false,
    isHidden: false,
    isOutOfStock: false,
    isFeatured: false,
    categoryId: 'pastries',
    addOnGroups: [],
    moderationStatus: 'approved',
  },
  {
    id: '3',
    trackInventory: false,
    name: 'Puff Puff',
    basePrice: 2000,
    salePrice: 1500,
    description: 'Soft, fluffy fried dough balls. Lightly sweet.',
    photos: ['https://images.unsplash.com/photo-1626804475297-41608ea09aeb?w=400&q=80'],
    isAvailable: true,
    isTaxExempt: false,
    isHidden: false,
    isOutOfStock: false,
    isFeatured: false,
    categoryId: 'small-chops',
    moderationStatus: 'approved',
    addOnGroups: [
      {
        id: 'ag1',
        heading: 'Spice level',
        selectionType: 'radio',
        isRequired: true,
        options: [
          { id: 'opt1', name: 'Mild', isAvailable: true },
          { id: 'opt2', name: 'Medium', isAvailable: true },
          { id: 'opt3', name: 'Hot', isAvailable: true },
        ],
      },
      {
        id: 'ag2',
        heading: 'Add-ons',
        selectionType: 'checkbox',
        isRequired: false,
        options: [
          { id: 'opt4', name: 'Extra spice', price: 500, isAvailable: true },
          { id: 'opt5', name: 'Extra sauce', price: 300, isAvailable: true },
        ],
      },
    ],
  },
  {
    id: '4',
    trackInventory: false,
    name: 'Classic Burger',
    basePrice: 2000,
    description: 'Beef patty with cheese',
    photos: ['https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80'],
    isAvailable: true,
    isTaxExempt: false,
    isHidden: false,
    isOutOfStock: false,
    isFeatured: false,
    categoryId: 'burgers',
    addOnGroups: [],
    moderationStatus: 'approved',
  },
];

export const catalogRepository = {
  /**
   * Storefront vendor menu read path.
   *
   * CatalogContext already reads this same vendor/catalogItems +
   * catalogCategories data live for the vendor's own management screens —
   * this ignored vendorId entirely and always returned the mock menu, so
   * every customer storefront showed the same four fixture items regardless
   * of which vendor they were actually browsing. Mirrors CatalogContext's
   * field mapping (fromBackendItem), but into the storefront's MenuItem/
   * Category shape rather than the vendor-management CatalogItem shape, and
   * filtered to what a customer should actually see: approved and not
   * hidden. A one-shot read rather than a live subscription — a customer
   * browsing a menu re-opens the screen for updates, unlike the vendor's own
   * always-open editing view.
   */
  async getVendorMenu(vendorId: string): Promise<VendorMenuData> {
    const [itemsSnap, categoriesSnap] = await Promise.all([
      getDocs(collection(db, 'vendors', vendorId, 'catalogItems')),
      getDocs(collection(db, 'vendors', vendorId, 'catalogCategories')),
    ]);

    const categoryNameById = new Map<string, string>();
    categoriesSnap.docs.forEach((d) => {
      const data = d.data();
      categoryNameById.set((data.categoryId as string) ?? d.id, (data.name as string) ?? '');
    });

    const itemCountByCategory = new Map<string, number>();
    const menuItems: MenuItem[] = [];

    itemsSnap.docs.forEach((d) => {
      const data = d.data();
      const isApproved = data.moderationStatus === 'approved';
      const isHidden = Boolean(data.isHidden);
      if (!isApproved || isHidden) return;

      const categoryId = (data.categoryId as string | null) ?? 'uncategorized';
      itemCountByCategory.set(categoryId, (itemCountByCategory.get(categoryId) ?? 0) + 1);

      const addOnGroups = Array.isArray(data.addOnGroups) ? (data.addOnGroups as Record<string, unknown>[]) : [];
      const addOns = addOnGroups.flatMap((group) => {
        const options = Array.isArray(group.options) ? (group.options as Record<string, unknown>[]) : [];
        return options
          .filter((opt) => opt.isAvailable !== false)
          .map((opt) => ({
            id: (opt.id as string) ?? '',
            name: (opt.name as string) ?? '',
            price: (opt.price as number) ?? 0,
          }));
      });

      menuItems.push({
        id: (data.itemId as string) ?? d.id,
        name: (data.name as string) ?? '',
        description: (data.description as string | null) ?? undefined,
        price: (data.basePrice as number) ?? 0,
        salePrice: (data.salePrice as number | null) ?? undefined,
        image: Array.isArray(data.photos) ? (data.photos as string[])[0] : undefined,
        inStock: !Boolean(data.isOutOfStock) && Boolean(data.isAvailable),
        categoryId,
        stockCount: (data.inventoryQuantity as number | undefined) ?? undefined,
        addOns,
        orderCount: (data.orderCount as number | undefined) ?? 0,
        isFeatured: Boolean(data.isFeatured),
        highlightLabel: (data.highlightLabel as MenuItem['highlightLabel']) ?? undefined,
      });
    });

    const storefrontCategories: StorefrontCategory[] = Array.from(categoryNameById.entries()).map(
      ([id, name]) => ({
        id,
        name,
        itemCount: itemCountByCategory.get(id) ?? 0,
      }),
    );

    return { items: menuItems, categories: storefrontCategories };
  },

  async getAllCategories(): Promise<Category[]> {
    return [...categories];
  },

  async getCategoryById(id: string): Promise<Category | undefined> {
    return categories.find((cat) => cat.id === id);
  },

  async createCategory(category: Category): Promise<Category> {
    categories = [...categories, category];
    return category;
  },

  async updateCategory(id: string, name: string): Promise<Category | null> {
    const category = categories.find((c) => c.id === id);
    if (!category || category.isSystem) {
      console.error('[catalogRepository] Cannot update system/missing category:', id);
      return null;
    }
    categories = categories.map((cat) => (cat.id === id ? { ...cat, name } : cat));
    return categories.find((c) => c.id === id) ?? null;
  },

  async deleteCategory(id: string): Promise<boolean> {
    const category = categories.find((c) => c.id === id);
    if (!category || category.isSystem) {
      console.error('[catalogRepository] Cannot delete system/missing category:', id);
      return false;
    }
    items = items.map((item) =>
      item.categoryId === id ? { ...item, categoryId: 'uncategorized' } : item,
    );
    categories = categories.filter((cat) => cat.id !== id);
    return true;
  },

  async reorderCategories(newOrder: Category[]): Promise<Category[]> {
    categories = newOrder.map((cat, index) => ({ ...cat, order: index }));
    return [...categories];
  },

  async getAllItems(): Promise<CatalogItem[]> {
    return [...items];
  },

  async getItemById(id: string): Promise<CatalogItem | undefined> {
    return items.find((item) => item.id === id);
  },

  async getItemsByCategory(categoryId: string): Promise<CatalogItem[]> {
    return items.filter((item) => item.categoryId === categoryId);
  },

  async createItem(item: CatalogItem): Promise<CatalogItem> {
    items = [...items, item];
    return item;
  },

  async replaceItem(id: string, next: CatalogItem): Promise<CatalogItem | null> {
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) {
      console.error('[catalogRepository] Item not found:', id);
      return null;
    }
    items = items.map((item) => (item.id === id ? next : item));
    return items.find((item) => item.id === id) ?? null;
  },

  async patchItem(id: string, patch: Partial<CatalogItem>): Promise<CatalogItem | null> {
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) {
      console.error('[catalogRepository] Item not found:', id);
      return null;
    }
    items = items.map((item) => (item.id === id ? { ...item, ...patch } : item));
    return items.find((item) => item.id === id) ?? null;
  },

  async deleteItem(id: string): Promise<boolean> {
    const initialLength = items.length;
    items = items.filter((item) => item.id !== id);
    return items.length < initialLength;
  },
};
