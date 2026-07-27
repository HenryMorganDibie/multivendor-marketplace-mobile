import React, { createContext, useContext, useState, useCallback } from 'react';

export type SelectionType = 'radio' | 'checkbox';

export interface AddOnOption {
  id: string;
  name: string;
  price?: number;
  isAvailable: boolean;
}

export interface AddOnGroup {
  id: string;
  heading: string;
  selectionType: SelectionType;
  isRequired: boolean;
  options: AddOnOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  basePrice: number;
  salePrice?: number;
  description?: string;
  photos: string[];
  isAvailable: boolean;
  isTaxExempt: boolean;
  categoryId: string;
  addOnGroups: AddOnGroup[];
}

export interface Category {
  id: string;
  name: string;
  order: number;
  isSystem: boolean;
}

interface CatalogContextValue {
  categories: Category[];
  items: MenuItem[];
  addCategory: (name: string) => void;
  updateCategory: (id: string, name: string) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (newOrder: Category[]) => void;
  addItem: (item: Omit<MenuItem, 'id'>) => void;
  updateItem: (id: string, item: Omit<MenuItem, 'id'>) => void;
  deleteItem: (id: string) => void;
  getItemsByCategory: (categoryId: string) => MenuItem[];
  getCategoryById: (id: string) => Category | undefined;
  getItemById: (id: string) => MenuItem | undefined;
}

const CatalogContext = createContext<CatalogContextValue | undefined>(undefined);

const UNCATEGORIZED_ID = 'uncategorized';

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([
    {
      id: UNCATEGORIZED_ID,
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
  ]);

  const [items, setItems] = useState<MenuItem[]>([
    {
      id: '1',
      name: 'Meat Pie',
      basePrice: 500,
      description: 'Flaky pastry with spiced beef',
      photos: ['https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80'],
      isAvailable: true,
      isTaxExempt: false,
      categoryId: 'pastries',
      addOnGroups: [],
    },
    {
      id: '2',
      name: 'Sausage Roll',
      basePrice: 450,
      description: 'Crispy roll with juicy sausage',
      photos: ['https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=400&q=80'],
      isAvailable: true,
      isTaxExempt: false,
      categoryId: 'pastries',
      addOnGroups: [],
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
      categoryId: 'small-chops',
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
      categoryId: 'burgers',
      addOnGroups: [],
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

  const addItem = useCallback((item: Omit<MenuItem, 'id'>) => {
    const newItem: MenuItem = {
      ...item,
      id: `item_${Date.now()}`,
    };
    setItems((prev) => [...prev, newItem]);
  }, []);

  const updateItem = useCallback((id: string, item: Omit<MenuItem, 'id'>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...item, id } : i)));
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const getItemsByCategory = useCallback(
    (categoryId: string) => {
      return items.filter((item) => item.categoryId === categoryId);
    },
    [items]
  );

  const getCategoryById = useCallback(
    (id: string) => {
      return categories.find((cat) => cat.id === id);
    },
    [categories]
  );

  const getItemById = useCallback(
    (id: string) => {
      return items.find((item) => item.id === id);
    },
    [items]
  );

  return (
    <CatalogContext.Provider
      value={{
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
      }}
    >
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
