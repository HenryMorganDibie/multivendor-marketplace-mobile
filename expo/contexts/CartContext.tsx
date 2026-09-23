import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/lib/firebase';

const CART_STORAGE_KEY_PREFIX = '@platform_vendor_carts';
const cartStorageKey = (uid: string) => `${CART_STORAGE_KEY_PREFIX}:${uid}`;
const PERSIST_DEBOUNCE_MS = 600;

export interface CartAddOn {
  id: string;
  name: string;
  price: number;
  /**
   * The add-on group this option belongs to. repriceCart.ts looks up the
   * real price by (groupId, optionId) against the catalog item's
   * addOnGroups and ignores everything else about the add-on — without
   * this, the lookup can never match and the add-on silently reprices to 0
   * server-side even though it displayed correctly on-device.
   */
  groupId: string;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  image?: string;
  addOns?: CartAddOn[];
  isUpdated?: boolean;
  requiresSelection?: boolean;
}

export interface ReorderIssue {
  type: 'updated' | 'unavailable' | 'removed';
  itemName: string;
  reason?: string;
}

export interface ReorderResult {
  success: boolean;
  itemsAdded: number;
  issues: ReorderIssue[];
}

export type CartStatus = 'active' | 'submitted' | 'abandoned';

export interface VendorCart {
  vendorId: string;
  vendorName: string;
  items: CartItem[];
  lastUpdated: number;
  status: CartStatus;
  userId?: string;
}

function migrateCart(raw: any): VendorCart {
  return {
    vendorId: raw.vendorId,
    vendorName: raw.vendorName,
    items: raw.items || [],
    lastUpdated: raw.lastUpdated ?? Date.now(),
    status: raw.status ?? 'active',
    userId: raw.userId,
  };
}

export const [CartProvider, useCart] = createContextHook(() => {
  const [vendorCarts, setVendorCarts] = useState<VendorCart[]>([]);
  const [activeVendorId, setActiveVendorId] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  // Which uid the currently-loaded/persisted cart belongs to. The cart used
  // to live under one device-global key (`@platform_vendor_carts`) with no uid
  // in it at all: Customer B signing in right after Customer A signed out on
  // the same device inherited A's leftover vendor/items/quantities and could
  // carry them straight into a real checkout under B's own identity. Now the
  // storage key is uid-scoped, and switching identities clears the in-memory
  // cart immediately rather than waiting for a screen to happen to reload it.
  const currentUidRef = useRef<string | null>(null);
  /** Debounce timer ref — clears on each cart mutation before scheduling a new write */
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onIdTokenChanged((fbUser) => {
      const uid = fbUser?.uid ?? null;
      if (uid === currentUidRef.current) return;
      currentUidRef.current = uid;

      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      hasLoadedRef.current = false;
      setActiveVendorId(null);

      if (!uid) {
        // Signed out: nothing persists for "no one," and the previous
        // identity's cart must not linger in memory for whoever looks next.
        setVendorCarts([]);
        return;
      }

      setVendorCarts([]);
      AsyncStorage.getItem(cartStorageKey(uid))
        .then((data) => {
          if (currentUidRef.current !== uid) return; // identity moved on again before this resolved
          if (data) {
            const parsed = JSON.parse(data) as any[];
            const saved = parsed
              .map(migrateCart)
              .filter((c) => c.items.length > 0 && c.status !== 'submitted');
            setVendorCarts(saved);
          }
        })
        .catch((err) => console.error('[CART] Failed to load persisted carts:', err))
        .finally(() => {
          if (currentUidRef.current === uid) hasLoadedRef.current = true;
        });
    });

    return () => {
      unsubscribe();
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, []);

  /**
   * Debounced persistence — batches rapid cart mutations (e.g. rapid +/- taps)
   * into a single AsyncStorage write after PERSIST_DEBOUNCE_MS of inactivity.
   */
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    const uid = currentUidRef.current;
    if (!uid) return;

    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      AsyncStorage.setItem(cartStorageKey(uid), JSON.stringify(vendorCarts)).catch(
        (err) => console.error('[CART] Failed to persist carts:', err),
      );
    }, PERSIST_DEBOUNCE_MS);
  }, [vendorCarts]);

  const clearAllCartsForCountryChange = useCallback(() => {
    setVendorCarts([]);
    setActiveVendorId(null);
  }, []);

  const setActiveVendor = useCallback((vendorId: string, _vendorName: string) => {
    setActiveVendorId(vendorId);
  }, []);

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>, vendorId?: string, vendorName?: string) => {
    if (!vendorId && !activeVendorId) {
      console.error('[CART] No vendor context available for adding item');
      return;
    }

    const targetVendorId = vendorId || activeVendorId!;
    const now = Date.now();

    setVendorCarts((prev) => {
      const cartIndex = prev.findIndex((c) => c.vendorId === targetVendorId);

      if (cartIndex === -1) {
        const name = vendorName || '';
        return [
          ...prev,
          {
            vendorId: targetVendorId,
            vendorName: name,
            items: [{ ...item, quantity: 1 }],
            lastUpdated: now,
            status: 'active' as CartStatus,
          },
        ];
      }

      const newCarts = [...prev];
      const cart = { ...newCarts[cartIndex], lastUpdated: now, status: 'active' as CartStatus };
      const addOnIds = item.addOns?.map(a => a.id).sort().join(',') || '';
      const existing = cart.items.find((i) => {
        const existingAddOnIds = i.addOns?.map(a => a.id).sort().join(',') || '';
        return i.id === item.id && existingAddOnIds === addOnIds;
      });

      if (existing) {
        cart.items = cart.items.map((i) => {
          const existingAddOnIds = i.addOns?.map(a => a.id).sort().join(',') || '';
          return i.id === item.id && existingAddOnIds === addOnIds
            ? { ...i, quantity: i.quantity + 1 }
            : i;
        });
      } else {
        cart.items = [...cart.items, { ...item, quantity: 1 }];
      }

      newCarts[cartIndex] = cart;
      return newCarts;
    });
  }, [activeVendorId]);

  const updateItemQuantity = useCallback((index: number, delta: number, vendorId?: string) => {
    const targetVendorId = vendorId || activeVendorId;
    if (!targetVendorId) return;

    const now = Date.now();

    setVendorCarts((prev) => {
      const cartIndex = prev.findIndex((c) => c.vendorId === targetVendorId);
      if (cartIndex === -1) return prev;

      const newCarts = [...prev];
      const cart = { ...newCarts[cartIndex], lastUpdated: now, status: 'active' as CartStatus };
      const newItems = [...cart.items];
      const item = newItems[index];
      if (!item) return prev;

      const newQuantity = item.quantity + delta;
      if (newQuantity <= 0) {
        newItems.splice(index, 1);
      } else {
        newItems[index] = { ...item, quantity: newQuantity };
      }

      cart.items = newItems;

      if (newItems.length === 0) {
        newCarts.splice(cartIndex, 1);
      } else {
        newCarts[cartIndex] = cart;
      }

      return newCarts;
    });
  }, [activeVendorId]);

  const removeItemByIndex = useCallback((index: number, vendorId?: string) => {
    const targetVendorId = vendorId || activeVendorId;
    if (!targetVendorId) return;

    const now = Date.now();

    setVendorCarts((prev) => {
      const cartIndex = prev.findIndex((c) => c.vendorId === targetVendorId);
      if (cartIndex === -1) return prev;

      const newCarts = [...prev];
      const cart = { ...newCarts[cartIndex], lastUpdated: now, status: 'active' as CartStatus };
      const newItems = [...cart.items];
      newItems.splice(index, 1);

      cart.items = newItems;

      if (newItems.length === 0) {
        newCarts.splice(cartIndex, 1);
      } else {
        newCarts[cartIndex] = cart;
      }

      return newCarts;
    });
  }, [activeVendorId]);

  const removeItem = useCallback((id: string, vendorId?: string) => {
    const targetVendorId = vendorId || activeVendorId;
    if (!targetVendorId) return;

    const now = Date.now();

    setVendorCarts((prev) => {
      const cartIndex = prev.findIndex((c) => c.vendorId === targetVendorId);
      if (cartIndex === -1) return prev;

      const newCarts = [...prev];
      const cart = { ...newCarts[cartIndex], lastUpdated: now, status: 'active' as CartStatus };
      const existing = cart.items.find((i) => i.id === id);

      if (existing && existing.quantity > 1) {
        cart.items = cart.items.map((i) =>
          i.id === id ? { ...i, quantity: i.quantity - 1 } : i
        );
      } else {
        cart.items = cart.items.filter((i) => i.id !== id);
      }

      if (cart.items.length === 0) {
        newCarts.splice(cartIndex, 1);
      } else {
        newCarts[cartIndex] = cart;
      }

      return newCarts;
    });
  }, [activeVendorId]);

  const markCartAsSubmitted = useCallback((vendorId: string) => {
    setVendorCarts((prev) =>
      prev.map((c) =>
        c.vendorId === vendorId
          ? { ...c, status: 'submitted' as CartStatus, lastUpdated: Date.now() }
          : c
      )
    );
  }, []);

  const clearCart = useCallback((vendorId?: string) => {
    if (vendorId) {
      setVendorCarts((prev) => prev.filter((c) => c.vendorId !== vendorId));
    } else if (activeVendorId) {
      setVendorCarts((prev) => prev.filter((c) => c.vendorId !== activeVendorId));
    }
  }, [activeVendorId]);

  const clearAllCarts = useCallback(() => {
    setVendorCarts([]);
  }, []);

  const getVendorCart = useCallback((vendorId: string) => {
    return vendorCarts.find((c) => c.vendorId === vendorId);
  }, [vendorCarts]);

  const replaceCart = useCallback((vendorId: string, vendorName: string, items: CartItem[]) => {
    setVendorCarts((prev) => {
      const otherCarts = prev.filter((c) => c.vendorId !== vendorId);
      if (items.length === 0) {
        return otherCarts;
      }
      return [
        ...otherCarts,
        { vendorId, vendorName, items, lastUpdated: Date.now(), status: 'active' as CartStatus },
      ];
    });
    setActiveVendorId(vendorId);
  }, []);

  const mergeCart = useCallback((vendorId: string, items: CartItem[]) => {
    setVendorCarts((prev) => {
      const cartIndex = prev.findIndex((c) => c.vendorId === vendorId);
      if (cartIndex === -1) {
        console.error('[CART] Cannot merge: vendor cart not found');
        return prev;
      }

      const newCarts = [...prev];
      const cart = { ...newCarts[cartIndex], lastUpdated: Date.now(), status: 'active' as CartStatus };
      const mergedItems = [...cart.items];

      items.forEach((newItem) => {
        const addOnIds = newItem.addOns?.map(a => a.id).sort().join(',') || '';
        const existingIndex = mergedItems.findIndex((i) => {
          const existingAddOnIds = i.addOns?.map(a => a.id).sort().join(',') || '';
          return i.id === newItem.id && existingAddOnIds === addOnIds;
        });

        if (existingIndex !== -1) {
          mergedItems[existingIndex] = {
            ...mergedItems[existingIndex],
            quantity: mergedItems[existingIndex].quantity + newItem.quantity,
          };
        } else {
          mergedItems.push(newItem);
        }
      });

      cart.items = mergedItems;
      newCarts[cartIndex] = cart;
      return newCarts;
    });
    setActiveVendorId(vendorId);
  }, []);

  // Memoized derived values — computed once per vendorCarts/activeVendorId change
  const nonEmptyVendorCarts = useMemo(
    () => vendorCarts.filter((c) => c.items.length > 0 && c.status !== 'submitted'),
    [vendorCarts],
  );

  const activeCart = useMemo(
    () => (activeVendorId ? nonEmptyVendorCarts.find((c) => c.vendorId === activeVendorId) ?? null : null),
    [activeVendorId, nonEmptyVendorCarts],
  );

  const items = useMemo(() => activeCart?.items ?? [], [activeCart]);

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const totalPrice = useMemo(
    () =>
      items.reduce((sum, item) => {
        const addOnTotal = item.addOns?.reduce((addOnSum, addOn) => addOnSum + addOn.price, 0) ?? 0;
        return sum + (item.price + addOnTotal) * item.quantity;
      }, 0),
    [items],
  );

  const vendorCartCount = nonEmptyVendorCarts.length;

  const globalItemCount = useMemo(
    () =>
      nonEmptyVendorCarts.reduce(
        (sum, cart) => sum + cart.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0,
      ),
    [nonEmptyVendorCarts],
  );

  return Object.freeze({
    items,
    addItem,
    removeItem,
    updateItemQuantity,
    removeItemByIndex,
    clearCart,
    clearAllCarts,
    clearAllCartsForCountryChange,
    markCartAsSubmitted,
    totalItems,
    totalPrice,
    vendorCarts: nonEmptyVendorCarts,
    allVendorCarts: vendorCarts,
    vendorCartCount,
    globalItemCount,
    activeVendorId,
    setActiveVendor,
    getVendorCart,
    replaceCart,
    mergeCart,
  });
});
