import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { auth, db, callable } from '@/lib/firebase';
import type { HighlightLabel } from '@/utils/itemTagging';

export type SelectionType = 'radio' | 'checkbox';

/**
 * Backend ↔ app shape translation for catalog items.
 *
 * Two vocabularies genuinely differ and must be translated at this boundary
 * rather than leaking either way:
 *  - the backend's id field is `itemId`, the app's is `id`
 *  - the backend's ModerationStatus is 'pending' | 'approved' | 'rejected' |
 *    'flagged'; this app's older type uses 'pending_review' for the first of
 *    those. Screens were comparing against 'pending_review', so a real item
 *    never matched and its "under review" treatment never appeared.
 */
const BACKEND_TO_APP_STATUS: Record<string, ModerationStatus> = {
  pending: 'pending_review',
  approved: 'approved',
  rejected: 'rejected',
  // 'flagged' has no app-side equivalent; treat it as rejected so it is at
  // least visibly not-live rather than silently rendering as approved.
  flagged: 'rejected',
};

export function fromBackendItem(docId: string, d: Record<string, unknown>): CatalogItem {
  return {
    id: (d.itemId as string) ?? docId,
    name: (d.name as string) ?? '',
    basePrice: (d.basePrice as number) ?? 0,
    salePrice: (d.salePrice as number | null) ?? undefined,
    description: (d.description as string | null) ?? '',
    photos: Array.isArray(d.photos) ? (d.photos as string[]) : [],
    isAvailable: Boolean(d.isAvailable),
    isTaxExempt: Boolean(d.isTaxExempt),
    isHidden: Boolean(d.isHidden),
    isOutOfStock: Boolean(d.isOutOfStock),
    isFeatured: Boolean(d.isFeatured),
    categoryId: (d.categoryId as string | null) ?? UNCATEGORIZED_ID,
    addOnGroups: Array.isArray(d.addOnGroups) ? (d.addOnGroups as CatalogItem['addOnGroups']) : [],
    moderationStatus: BACKEND_TO_APP_STATUS[(d.moderationStatus as string) ?? 'pending'] ?? 'pending_review',
    trackInventory: Boolean(d.trackInventory),
    inventoryQuantity: (d.inventoryQuantity as number | undefined) ?? undefined,
    lowStockThreshold: (d.lowStockThreshold as number | null) ?? undefined,
    highlightLabel: (d.highlightLabel as HighlightLabel | undefined) ?? undefined,
    orderCount: (d.orderCount as number | undefined) ?? 0,
  };
}

/** Strips app-only and server-controlled fields before sending to the backend.
 * moderationStatus is deliberately never sent: the client does not get to
 * decide its own review state, and the backend rejects it anyway. */
function toBackendPayload(item: Omit<CatalogItem, 'id'>): Record<string, unknown> {
  return {
    name: item.name,
    description: item.description ?? null,
    basePrice: item.basePrice,
    salePrice: item.salePrice ?? null,
    photos: item.photos,
    categoryId: item.categoryId === UNCATEGORIZED_ID ? null : item.categoryId,
    isAvailable: item.isAvailable,
    isHidden: item.isHidden,
    isFeatured: item.isFeatured,
    isTaxExempt: item.isTaxExempt,
    trackInventory: item.trackInventory,
    inventoryQuantity: item.inventoryQuantity ?? 0,
    lowStockThreshold: item.lowStockThreshold ?? null,
    addOnGroups: item.addOnGroups,
  };
}

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
  addCategory: (name: string) => Promise<void>;
  updateCategory: (id: string, name: string) => void;
  deleteCategory: (id: string) => Promise<void>;
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

  /**
   * Live subscription to the vendor's real catalog.
   *
   * A Firestore listener rather than a one-off fetch, because moderation
   * decisions are made by someone else: when an admin approves or rejects an
   * item, the vendor's screen should update without them having to pull to
   * refresh or guess. Vendors can read their own catalogItems under the
   * security rules, so this needs no extra backend endpoint.
   *
   * The mock array above is the pre-auth placeholder. Once a real vendor session
   * exists, the first snapshot replaces it wholesale — including with an empty
   * list, which is the correct view for a new vendor with no items.
   */
  useEffect(() => {
    let unsubscribeItems: (() => void) | null = null;
    let unsubscribeCategories: (() => void) | null = null;

    const unsubscribeAuth = auth.onIdTokenChanged(async (user) => {
      unsubscribeItems?.();
      unsubscribeCategories?.();
      unsubscribeItems = null;
      unsubscribeCategories = null;

      if (!user) return;
      // vendorId lives on the custom claim, set by completeRegistration.
      const token = await user.getIdTokenResult();
      const vendorId = token.claims.vendorId as string | undefined;
      if (!vendorId) return;

      unsubscribeItems = onSnapshot(
        collection(db, 'vendors', vendorId, 'catalogItems'),
        (snap) => {
          setItems(snap.docs.map((d) => fromBackendItem(d.id, d.data())));
        },
        (err) => {
          // Leaving stale mock data on screen would be worse than an empty
          // catalog, since the vendor could act on items that don't exist.
          console.error('[Catalog] Live items subscription failed:', err);
          setItems([]);
        },
      );

      // Categories must come from the backend too, not just items. With real
      // items and mock categories, every real item's categoryId matched nothing
      // in the local list and the detail screen fell back to showing
      // "Uncategorized" for items that were properly categorised.
      unsubscribeCategories = onSnapshot(
        collection(db, 'vendors', vendorId, 'catalogCategories'),
        (snap) => {
          setCategories(
            snap.docs
              .map((d) => {
                const data = d.data();
                return {
                  id: (data.categoryId as string) ?? d.id,
                  name: (data.name as string) ?? '',
                  order: (data.order as number) ?? 0,
                  isSystem: Boolean(data.isSystem),
                };
              })
              .sort((a, b) => a.order - b.order),
          );
        },
        (err) => {
          console.error('[Catalog] Live categories subscription failed:', err);
          setCategories([]);
        },
      );
    });

    return () => {
      unsubscribeItems?.();
      unsubscribeCategories?.();
      unsubscribeAuth();
    };
  }, []);

  /**
   * Creates the category on the backend. createCatalogCategory has been
   * deployed since Phase 4 and nothing called it — this added the category
   * to local state only, so it vanished on the next real snapshot (or, for a
   * signed-in vendor, never really existed: no other device or the vendor
   * portal would ever see it).
   *
   * No optimistic local insert: the categories listener above will pick up
   * the real document the moment Firestore commits it, same as addItem does
   * for catalog items.
   */
  const addCategory = useCallback(async (name: string) => {
    try {
      const create = callable<{ name: string; order?: number }, { success: true; categoryId: string }>('createCatalogCategory');
      await create({ name, order: categories.length });
    } catch (err) {
      console.error('[Catalog] createCatalogCategory failed:', err);
      throw err;
    }
  }, [categories.length]);

  const updateCategory = useCallback((id: string, name: string) => {
    setCategories((prev) =>
      prev.map((cat) => (cat.id === id && !cat.isSystem ? { ...cat, name } : cat))
    );
  }, []);

  /**
   * Deletes the category on the backend. deleteCatalogCategory reassigns the
   * category's items to Uncategorized and deletes the category doc in one
   * batch — this used to only touch local state, so it appeared to work but
   * the category (and its items' old categoryId) came right back on the next
   * real snapshot. No optimistic local update, same reasoning as addCategory:
   * the categories/items listeners above pick up the real result.
   */
  const deleteCategory = useCallback(async (id: string) => {
    const category = categories.find((c) => c.id === id);
    if (!category || category.isSystem) return;
    try {
      const remove = callable<{ categoryId: string }, { success: true; reassignedItemCount: number }>('deleteCatalogCategory');
      await remove({ categoryId: id });
    } catch (err) {
      console.error('[Catalog] deleteCatalogCategory failed:', err);
      throw err;
    }
  }, [categories]);

  const reorderCategories = useCallback((newOrder: Category[]) => {
    const reordered = newOrder.map((cat, index) => ({ ...cat, order: index }));
    setCategories(reordered);
  }, []);

  // ── Backend-backed mutations ────────────────────────────────────────────
  // These call the real Cloud Functions rather than mutating local state. The
  // Firestore listener above then pushes the authoritative result back, so the
  // UI reflects what the backend actually stored — including moderation status,
  // which the client must never decide for itself. Local state is deliberately
  // NOT optimistically updated for moderation-relevant fields: showing an item
  // as live before it has been approved is the exact failure this system exists
  // to prevent.
  const addItem = useCallback(async (item: Omit<CatalogItem, 'id' | 'moderationStatus'>) => {
    const normalized = normalizeItem(item);
    try {
      const create = callable<Record<string, unknown>, { success: true; itemId: string }>('createCatalogItem');
      await create(toBackendPayload(normalized));
    } catch (err) {
      console.error('[Catalog] createCatalogItem failed:', err);
      throw err;
    }
  }, []);

  const updateItem = useCallback(async (id: string, item: Omit<CatalogItem, 'id' | 'moderationStatus'>) => {
    const normalized = normalizeItem(item);
    try {
      const update = callable<Record<string, unknown>, { success: true; pendingRevision?: boolean }>('updateCatalogItem');
      const res = await update({ itemId: id, ...toBackendPayload(normalized) });
      if (res.data.pendingRevision) {
        console.log('[Catalog] Edit held as a pending revision; live version unchanged:', id);
      }
    } catch (err) {
      console.error('[Catalog] updateCatalogItem failed:', err);
      throw err;
    }
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    try {
      const remove = callable<{ itemId: string }, { success: true }>('deleteCatalogItem');
      await remove({ itemId: id });
    } catch (err) {
      console.error('[Catalog] deleteCatalogItem failed:', err);
      throw err;
    }
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
