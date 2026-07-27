import { CatalogItem, Category } from '@/contexts/CatalogContext';

let categories: Category[] = [
  {
    id: 'uncategorized',
    name: 'Uncategorized',
    order: 0,
    isSystem: true,
  },
  {
    id: 'pastries',
    name: 'Pastries',
    order: 1,
    isSystem: false,
  },
  {
    id: 'small-chops',
    name: 'Small Chops',
    order: 2,
    isSystem: false,
  },
  {
    id: 'burgers',
    name: 'Burgers',
    order: 3,
    isSystem: false,
  },
];

let items: CatalogItem[] = [
  {
    id: '1',
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

export const catalogService = {
  async getAllCategories(): Promise<Category[]> {
    return [...categories];
  },

  async getCategoryById(id: string): Promise<Category | undefined> {
    return categories.find(cat => cat.id === id);
  },

  async createCategory(name: string): Promise<Category> {
    const newCategory: Category = {
      id: `cat_${Date.now()}`,
      name,
      order: categories.length,
      isSystem: false,
    };
    categories = [...categories, newCategory];
    console.log('[CatalogService] Created category:', newCategory.id);
    return newCategory;
  },

  async updateCategory(id: string, name: string): Promise<Category | null> {
    const category = categories.find(c => c.id === id);
    if (!category || category.isSystem) {
      console.error('[CatalogService] Cannot update system category or category not found:', id);
      return null;
    }

    categories = categories.map(cat => 
      cat.id === id ? { ...cat, name } : cat
    );

    console.log('[CatalogService] Updated category:', id);
    return categories.find(c => c.id === id) || null;
  },

  async deleteCategory(id: string): Promise<boolean> {
    const category = categories.find(c => c.id === id);
    if (!category || category.isSystem) {
      console.error('[CatalogService] Cannot delete system category or category not found:', id);
      return false;
    }

    items = items.map(item =>
      item.categoryId === id ? { ...item, categoryId: 'uncategorized' } : item
    );

    categories = categories.filter(cat => cat.id !== id);
    console.log('[CatalogService] Deleted category:', id);
    return true;
  },

  async reorderCategories(newOrder: Category[]): Promise<Category[]> {
    categories = newOrder.map((cat, index) => ({ ...cat, order: index }));
    console.log('[CatalogService] Reordered categories');
    return [...categories];
  },

  async getAllItems(): Promise<CatalogItem[]> {
    return [...items];
  },

  async getItemById(id: string): Promise<CatalogItem | undefined> {
    return items.find(item => item.id === id);
  },

  async getItemsByCategory(categoryId: string): Promise<CatalogItem[]> {
    return items.filter(item => item.categoryId === categoryId);
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
    items = [...items, newItem];
    console.log('[CatalogService] Created item:', newItem.id);
    return newItem;
  },

  async updateItem(id: string, updates: Omit<CatalogItem, 'id' | 'moderationStatus'>): Promise<CatalogItem | null> {
    const itemIndex = items.findIndex(item => item.id === id);
    if (itemIndex === -1) {
      console.error('[CatalogService] Item not found:', id);
      return null;
    }

    items = items.map(item =>
      item.id === id
        ? {
            ...updates,
            id,
            moderationStatus: 'pending_review',
            photos: Array.isArray(updates.photos) ? updates.photos.filter(Boolean) : [],
            addOnGroups: Array.isArray(updates.addOnGroups) ? updates.addOnGroups : [],
            description: updates.description ?? '',
          }
        : item
    );

    console.log('[CatalogService] Updated item:', id);
    return items.find(item => item.id === id) || null;
  },

  async deleteItem(id: string): Promise<boolean> {
    const initialLength = items.length;
    items = items.filter(item => item.id !== id);
    const deleted = items.length < initialLength;
    
    if (deleted) {
      console.log('[CatalogService] Deleted item:', id);
    }
    return deleted;
  },

  async updateItemAvailability(id: string, isAvailable: boolean): Promise<CatalogItem | null> {
    const item = items.find(i => i.id === id);
    if (!item) {
      console.error('[CatalogService] Item not found:', id);
      return null;
    }

    items = items.map(i => 
      i.id === id ? { ...i, isAvailable } : i
    );

    console.log('[CatalogService] Updated item availability:', id);
    return items.find(i => i.id === id) || null;
  },

  async updateItemStock(id: string, isOutOfStock: boolean): Promise<CatalogItem | null> {
    const item = items.find(i => i.id === id);
    if (!item) {
      console.error('[CatalogService] Item not found:', id);
      return null;
    }

    items = items.map(i => 
      i.id === id ? { ...i, isOutOfStock } : i
    );

    console.log('[CatalogService] Updated item stock:', id);
    return items.find(i => i.id === id) || null;
  },
};
