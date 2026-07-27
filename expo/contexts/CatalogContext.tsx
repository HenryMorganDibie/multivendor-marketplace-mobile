import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { HighlightLabel } from '@/utils/itemTagging';

export type SelectionType = 'radio' | 'checkbox';

function normalizeItem(input: Omit<CatalogItem, 'id' | 'moderationStatus'>): Omit<CatalogItem, 'id'> {
  return {
    ...input,
    photos: Array.isArray(input.photos) ? input.photos.filter(Boolean) : [],
    addOnGroups: Array.isArray(input.addOnGroups) ? input.addOnGroups : [],
    description: input.description ?? '',
    salePrice: input.salePrice ?? undefined,
    isFeatured: input.isFeatured ?? false,
    trackInventory: input.trackInventory ?? false,
    inventoryQuantity: input.inventoryQuantity,
    lowStockThreshold: input.lowStockThreshold,
    highlightLabel: input.highlightLabel ?? undefined,
    createdAt: input.createdAt ?? new Date().toISOString(),
    orderCount: input.orderCount ?? 0,
    recentOrderCount: input.recentOrderCount ?? 0,
    moderationStatus: 'pending_review',
  };
}

export interface AddOnOption {
  id: string;
  name: string;
  price?: number;
  isAvailable: boolean;
}

export interface AddOnGroup {
  id: string;
  heading: string;
  subheading?: string;
  selectionType: SelectionType;
  isRequired: boolean;
  options: AddOnOption[];
}

export type ModerationStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';

export interface CatalogItem {
  id: string;
  name: string;
  basePrice: number;
  salePrice?: number;
  description?: string;
  photos: string[];
  isAvailable: boolean;
  isTaxExempt: boolean;
  isHidden: boolean;
  isOutOfStock: boolean;
  isFeatured: boolean;
  categoryId: string;
  addOnGroups: AddOnGroup[];
  moderationStatus: ModerationStatus;
  trackInventory: boolean;
  inventoryQuantity?: number;
  lowStockThreshold?: number;
  highlightLabel?: HighlightLabel;
  createdAt?: string;
  orderCount?: number;
  recentOrderCount?: number;
}

export interface Category {
  id: string;
  name: string;
  order: number;
  isSystem: boolean;
}

interface CatalogContextValue {
  categories: Category[];
  items: CatalogItem[];
  addCategory: (name: string) => void;
  updateCategory: (id: string, name: string) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (newOrder: Category[]) => void;
  addItem: (item: Omit<CatalogItem, 'id' | 'moderationStatus'>) => void;
  updateItem: (id: string, item: Omit<CatalogItem, 'id' | 'moderationStatus'>) => void;
  deleteItem: (id: string) => void;
  getItemsByCategory: (categoryId: string) => CatalogItem[];
  getCategoryById: (id: string) => Category | undefined;
  getItemById: (id: string) => CatalogItem | undefined;
}

const CatalogContext = createContext<CatalogContextValue | undefined>(undefined);

const UNCATEGORIZED_ID = 'uncategorized';

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([
    { id: UNCATEGORIZED_ID, name: 'Uncategorized', order: 0, isSystem: true },
    { id: 'pastries', name: 'Pastries', order: 1, isSystem: false },
    { id: 'small-chops', name: 'Small Chops', order: 2, isSystem: false },
    { id: 'burgers', name: 'Burgers', order: 3, isSystem: false },
  ]);

  const [items, setItems] = useState<CatalogItem[]>([
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
      trackInventory: true,
      inventoryQuantity: 3,
      lowStockThreshold: 5,
      createdAt: '2025-09-10T10:00:00Z',
      orderCount: 142,
      recentOrderCount: 18,
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
      trackInventory: false,
      createdAt: '2025-10-01T10:00:00Z',
      orderCount: 88,
      recentOrderCount: 9,
    },
    {
      id: '6',
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
      trackInventory: true,
      inventoryQuantity: 0,
      lowStockThreshold: 5,
      createdAt: '2025-07-01T10:00:00Z',
      orderCount: 178,
      recentOrderCount: 15,
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
      id: '9',
      name: 'Classic Burger',
      basePrice: 2000,
      description: 'Beef patty with cheese',
      photos: ['https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80'],
      isAvailable: true,
      isTaxExempt: false,
      isHidden: false,
      isOutOfStock: false,
      isFeatured: true,
      categoryId: 'burgers',
      addOnGroups: [],
      moderationStatus: 'approved',
      trackInventory: false,
      createdAt: '2025-06-15T10:00:00Z',
      orderCount: 320,
      recentOrderCount: 28,
    },
    {
      id: '5',
      name: 'Spring Rolls',
      basePrice: 300,
      salePrice: 220,
      description: 'Crispy vegetable rolls',
      photos: ['https://images.unsplash.com/photo-1541529086526-db283c563270?w=400&q=80'],
      isAvailable: true,
      isTaxExempt: false,
      isHidden: false,
      isOutOfStock: false,
      isFeatured: true,
      categoryId: 'small-chops',
      addOnGroups: [],
      moderationStatus: 'approved',
      trackInventory: false,
      createdAt: '2025-08-20T10:00:00Z',
      orderCount: 210,
      recentOrderCount: 22,
    },
    {
      id: '7',
      name: 'Samosa',
      basePrice: 250,
      description: 'Spiced beef in crispy shell',
      photos: ['https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80'],
      isAvailable: true,
      isTaxExempt: false,
      isHidden: false,
      isOutOfStock: false,
      isFeatured: false,
      categoryId: 'small-chops',
      addOnGroups: [],
      moderationStatus: 'approved',
      trackInventory: false,
      createdAt: '2026-03-20T10:00:00Z',
      orderCount: 20,
      recentOrderCount: 8,
      highlightLabel: 'spicy',
    },
    {
      id: '12',
      name: 'Pepperoni Pizza',
      basePrice: 3500,
      description: 'Classic pepperoni with mozzarella',
      photos: ['https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&q=80'],
      isAvailable: true,
      isTaxExempt: false,
      isHidden: false,
      isOutOfStock: false,
      isFeatured: true,
      categoryId: 'uncategorized',
      addOnGroups: [],
      moderationStatus: 'approved',
      trackInventory: false,
      createdAt: '2026-03-28T10:00:00Z',
      orderCount: 5,
      recentOrderCount: 3,
    },
  ]);

  const addCategory = useCallback((name: string) => {
    const newCategory: Category = {
      id: `cat_${Date.now()}`,
      name,
      order: categories.length,
      isSystem: false,
    };
    setCategories((prev) => [...prev, newCategory]);
  }, [categories.length]);

  const updateCategory = useCallback((id: string, name: string) => {
    setCategories((prev) =>
      prev.map((cat) => (cat.id === id && !cat.isSystem ? { ...cat, name } : cat))
    );
  }, []);

  const deleteCategory = useCallback((id: string) => {
    const category = categories.find((c) => c.id === id);
    if (!category || category.isSystem) return;
    setItems((prev) =>
      prev.map((item) =>
        item.categoryId === id ? { ...item, categoryId: UNCATEGORIZED_ID } : item
      )
    );
    setCategories((prev) => prev.filter((cat) => cat.id !== id));
  }, [categories]);

  const reorderCategories = useCallback((newOrder: Category[]) => {
    const reordered = newOrder.map((cat, index) => ({ ...cat, order: index }));
    setCategories(reordered);
  }, []);

  const addItem = useCallback((item: Omit<CatalogItem, 'id' | 'moderationStatus'>) => {
    const normalized = normalizeItem(item);
    const newItem: CatalogItem = {
      ...normalized,
      id: `item_${Date.now()}`,
    };
    setItems((prev) => [...prev, newItem]);
    console.log('New item created with pending_review status:', newItem.name);
  }, []);

  const updateItem = useCallback((id: string, item: Omit<CatalogItem, 'id' | 'moderationStatus'>) => {
    const normalized = normalizeItem(item);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...normalized, id } : i)));
    console.log('Item updated - now pending review:', id);
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const getItemsByCategory = useCallback(
    (categoryId: string) => {
      return items
        .filter((item) => item.categoryId === categoryId)
        .sort((a, b) => {
          if (a.isFeatured && !b.isFeatured) return -1;
          if (!a.isFeatured && b.isFeatured) return 1;
          return 0;
        });
    },
    [items]
  );

  const getCategoryById = useCallback(
    (id: string) => categories.find((cat) => cat.id === id),
    [categories]
  );

  const getItemById = useCallback(
    (id: string) => items.find((item) => item.id === id),
    [items]
  );

  const value = useMemo(() => ({
    categories,
    items,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    addItem,
    updateItem,
    deleteItem,
    getItemsByCategory,
    getCategoryById,
    getItemById,
  }), [categories, items, addCategory, updateCategory, deleteCategory, reorderCategories, addItem, updateItem, deleteItem, getItemsByCategory, getCategoryById, getItemById]);

  return (
    <CatalogContext.Provider value={value}>
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error('useCatalog must be used within CatalogProvider');
  }
  return context;
}
