import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { auth } from '@/lib/firebase';

/**
 * AsyncStorage-only, device-local, and this is NOT device-local scratch
 * data — it represents real vendor external-order revenue. Evidence: a
 * customer-facing shareToken (getExternalOrderByShareToken), full financial
 * fields (total/subtotal/tax/amountReceived), a terminal `status:
 * 'completed'`, and it feeds real sales reporting (reports.tsx) alongside
 * genuine backend orders.
 *
 * It is not migrated to the real backend (createExternalOrder,
 * multivendor-marketplace-platform/functions/src/orders/createOrder.ts) in this pass,
 * deliberately: several fields this context supports — deliveryFee,
 * serviceFee, tax, manual discount, fulfillmentDate/fulfillmentTime — have
 * no backend equivalent at all (confirmed by direct code inspection, not
 * assumption), and building that backend support is scope that is already
 * under active, paused negotiation with the client, separate from and
 * predating this remediation pass. Migrating this context without that
 * backend work landing first would mean either dropping data the vendor
 * already relies on, or quietly inventing new backend fields nobody has
 * agreed to build or price — both out of scope here.
 *
 * Until that negotiation resolves, this remains the real (if not
 * backend-synced) record of a vendor's external orders — not a draft, not
 * safe to delete, not something to silently "fix" by rewiring to a backend
 * that cannot yet represent everything this data holds.
 */

export interface ExternalOrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface ExternalOrder {
  id: string;
  externalOrderId: string;
  shareToken: string;
  vendorName: string;
  vendorSlug: string;
  customerName: string;
  orderSource: 'external';
  externalReference?: string;
  items: ExternalOrderItem[];
  fulfillmentType: 'Pickup' | 'Delivery' | 'Service' | 'Event' | 'Other';
  fulfillmentDate: string;
  fulfillmentTime?: string;
  address?: string;
  deliveryNote?: string;
  taxOption: 'apply' | 'exempt';
  paymentStatus: 'payment_received' | 'payment_pending' | 'partially_received';
  amountReceived?: number;
  notes: string;
  total: number;
  subtotal: number;
  tax: number;
  taxPercentage?: number;
  deliveryFee?: number;
  serviceFee?: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountAmount?: number;
  orderDate: string;
  status: 'completed';
  screenshots?: string[];
  isManualPricing?: boolean;
  manualSubtotal?: number;
  manualAdjustmentType?: 'add' | 'subtract';
  manualAdjustmentAmount?: number;
  manualTotal?: number;
}

interface TodayNote {
  date: string;
  note: string;
}

/**
 * A draft is a not-yet-submitted External Order form. It never enters
 * analytics/revenue/inventory/payment ledger/customer history/submitted-order
 * counts — only a real backend order (created via createExternalOrder) or a
 * legacy ExternalOrder above does that. Kept as a fully separate type/model
 * rather than a variant of ExternalOrder so nothing can accidentally treat a
 * draft as a completed record.
 */
export interface ExternalOrderDraftItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  catalogItemId?: string;
}

export interface ExternalOrderDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
  /**
   * Stable idempotency key for the backend's createExternalOrder callable —
   * generated once (on first Save Draft or first Submit attempt, whichever
   * comes first) and persisted here so every retry of this logical
   * submission, including one after an app crash or a failed cleanup, sends
   * the same key. Optional because a draft saved before this field existed
   * won't have one yet; add-external.tsx generates and persists one on that
   * draft's first post-update Submit attempt.
   */
  submissionId?: string;
  customerName: string;
  items: ExternalOrderDraftItem[];
  fulfillmentType: 'Pickup' | 'Delivery' | 'Service' | 'Event' | 'Other';
  fulfillmentDateTime: string | null;
  fulfillmentDateTimeTouched: boolean;
  address: string;
  deliveryNote: string;
  paymentStatus: 'payment_pending' | 'partially_received' | 'payment_received';
  amountReceived: string;
  notes: string;
  screenshots: string[];
  showDeliveryFee: boolean;
  deliveryFeeInput: string;
  showServiceFee: boolean;
  serviceFeeInput: string;
  showDiscount: boolean;
  discountType: 'percentage' | 'fixed';
  discountValueInput: string;
  taxEnabled: boolean;
  taxPercentage: number;
}

const EXTERNAL_ORDERS_KEY = '@external_orders';
const TODAY_NOTE_KEY = '@today_note';
const draftsStorageKey = (uid: string) => `@external_order_drafts:${uid}`;

/**
 * Drafts (and their durable screenshot copies) are namespaced by Firebase
 * auth uid, not vendor.id — VendorContext's `vendor` state is not reset on
 * logout (only its Firestore listener unsubscribes), so it can still read as
 * a stale, previously-loaded vendor for a moment after a different account
 * signs in. `auth.currentUser?.uid` / the onIdTokenChanged listener below are
 * session-tied and correctly go to null on logout, which is why every read
 * here is done fresh at call time rather than from a captured value.
 */

/** The one directory this context is allowed to write into and delete from. */
function getDraftScreenshotsDirectory(uid: string): Directory {
  return new Directory(Paths.document, 'external-order-drafts', uid);
}

/**
 * Copies a picker/cache URI into our own durable, uid-namespaced directory
 * under Paths.document and returns the durable URI. Throws on failure (full
 * disk, unreadable source, etc.) — callers must surface this as a save error
 * rather than silently keeping the original (non-durable) URI.
 */
function copyScreenshotToDurableStorage(sourceUri: string, uid: string): string {
  const dir = getDraftScreenshotsDirectory(uid);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  const extMatch = sourceUri.split('?')[0].match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1] : 'jpg';
  const fileName = `screenshot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const destFile = new File(dir, fileName);
  const sourceFile = new File(sourceUri);
  sourceFile.copy(destFile);
  return destFile.uri;
}

/**
 * Deletes a durable screenshot file we previously copied — and only such a
 * file. The prefix check is a hard safety boundary: this must never be able
 * to delete an arbitrary path (a picker/cache URI, or anything outside our
 * own owned directory).
 */
function deleteDurableScreenshot(uri: string, uid: string): void {
  const dir = getDraftScreenshotsDirectory(uid);
  if (!uri.startsWith(dir.uri)) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch (error) {
    console.error('[ExternalOrdersContext] Failed to delete durable screenshot:', error);
  }
}

/** Whether a durable screenshot URI still points at an existing file. Used to render a safe missing-image state instead of crashing if it was removed out from under us. */
function screenshotExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

export { copyScreenshotToDurableStorage, deleteDurableScreenshot, screenshotExists };

export const [ExternalOrdersProvider, useExternalOrders] = createContextHook(() => {
  const [externalOrders, setExternalOrders] = useState<ExternalOrder[]>([]);
  const [todayNote, setTodayNote] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const getTodayDateString = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const loadData = useCallback(async () => {
    try {
      const ordersData = await AsyncStorage.getItem(EXTERNAL_ORDERS_KEY);
      const noteData = await AsyncStorage.getItem(TODAY_NOTE_KEY);
      
      if (ordersData) {
        const orders = JSON.parse(ordersData);
        setExternalOrders(orders);
      }

      if (noteData) {
        const parsedNote: TodayNote = JSON.parse(noteData);
        const today = getTodayDateString();
        
        if (parsedNote.date === today) {
          setTodayNote(parsedNote.note);
        } else {
          setTodayNote('');
          await AsyncStorage.setItem(TODAY_NOTE_KEY, JSON.stringify({ date: today, note: '' }));
        }
      }
    } catch (error) {
      console.error('Error loading external orders data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const [authUid, setAuthUid] = useState<string | null>(() => auth.currentUser?.uid ?? null);
  const [drafts, setDrafts] = useState<ExternalOrderDraft[]>([]);
  const [draftsLoaded, setDraftsLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onIdTokenChanged((fbUser) => {
      setAuthUid(fbUser?.uid ?? null);
    });
    return unsubscribe;
  }, []);

  /**
   * Drafts are reloaded whenever the authenticated uid changes (login,
   * logout, account switch). uidAtStart is captured here and re-checked
   * against the LIVE auth.currentUser?.uid (not this closure's authUid) once
   * the read resolves, and `cancelled` is set on cleanup — together these
   * stop a slow read started for one account from ever committing into
   * another account's state, in either direction, even if the account
   * changes again before the read finishes.
   *
   * The in-memory `drafts` array is cleared synchronously here, on every
   * identity change, not only when the new uid is null. login.tsx supports
   * signing in as a different account while still authenticated (its
   * `?switchAccount=1` flow calls login() without an intervening logout()),
   * so `authUid` can go directly from one real uid to another with no null
   * in between — if the clear only happened in the null branch, the
   * previous account's drafts (and screenshot URIs) would stay rendered for
   * as long as the next account's own read takes to resolve.
   */
  useEffect(() => {
    let cancelled = false;
    const uidAtStart = authUid;

    setDrafts([]);
    setDraftsLoaded(false);

    if (!uidAtStart) {
      setDraftsLoaded(true);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const stored = await AsyncStorage.getItem(draftsStorageKey(uidAtStart));
        if (cancelled || auth.currentUser?.uid !== uidAtStart) return;
        setDrafts(stored ? JSON.parse(stored) : []);
      } catch (error) {
        if (!cancelled && auth.currentUser?.uid === uidAtStart) {
          console.error('Error loading external order drafts:', error);
        }
      } finally {
        if (!cancelled && auth.currentUser?.uid === uidAtStart) {
          setDraftsLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUid]);

  const saveDraft = useCallback(async (draft: ExternalOrderDraft) => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      console.error('[ExternalOrdersContext] saveDraft called with no authenticated user; draft not saved.');
      return;
    }
    try {
      const now = new Date().toISOString();
      const existingIndex = drafts.findIndex(d => d.id === draft.id);
      const updatedDraft: ExternalOrderDraft = {
        ...draft,
        createdAt: existingIndex >= 0 ? drafts[existingIndex].createdAt : (draft.createdAt || now),
        updatedAt: now,
      };
      const newDrafts = existingIndex >= 0
        ? drafts.map((d, i) => (i === existingIndex ? updatedDraft : d))
        : [updatedDraft, ...drafts];
      setDrafts(newDrafts);
      await AsyncStorage.setItem(draftsStorageKey(uid), JSON.stringify(newDrafts));
    } catch (error) {
      console.error('Error saving external order draft:', error);
      throw error;
    }
  }, [drafts]);

  const deleteDraft = useCallback(async (draftId: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const draftToDelete = drafts.find(d => d.id === draftId);
    const newDrafts = drafts.filter(d => d.id !== draftId);
    try {
      /**
       * Persist before touching in-memory state. A caller (e.g. handleSave,
       * after createExternalOrder already succeeded) needs the in-memory
       * `drafts` array to stay truthful about what's actually on disk — if
       * the write below throws, the old ordering still applied the optimistic
       * setDrafts() first, so the vendor's UI stopped showing the draft while
       * AsyncStorage still held it. On next launch the "deleted" draft would
       * reappear, resumable and resubmittable, for an order that already
       * exists on the backend.
       */
      await AsyncStorage.setItem(draftsStorageKey(uid), JSON.stringify(newDrafts));
      setDrafts(newDrafts);
      if (draftToDelete) {
        draftToDelete.screenshots.forEach(uri => deleteDurableScreenshot(uri, uid));
      }
    } catch (error) {
      console.error('Error deleting external order draft:', error);
      throw error;
    }
  }, [drafts]);

  const getDraft = useCallback((draftId: string): ExternalOrderDraft | undefined => {
    return drafts.find(d => d.id === draftId);
  }, [drafts]);

  const addExternalOrder = useCallback(async (order: ExternalOrder) => {
    try {
      const newOrders = [order, ...externalOrders];
      setExternalOrders(newOrders);
      await AsyncStorage.setItem(EXTERNAL_ORDERS_KEY, JSON.stringify(newOrders));
      console.log('External order saved:', order.id);
    } catch (error) {
      console.error('Error saving external order:', error);
      throw error;
    }
  }, [externalOrders]);

  const deleteExternalOrder = useCallback(async (orderId: string) => {
    try {
      const newOrders = externalOrders.filter(o => o.id !== orderId);
      setExternalOrders(newOrders);
      await AsyncStorage.setItem(EXTERNAL_ORDERS_KEY, JSON.stringify(newOrders));
      console.log('External order deleted:', orderId);
    } catch (error) {
      console.error('Error deleting external order:', error);
      throw error;
    }
  }, [externalOrders]);

  const updateExternalOrder = useCallback(async (orderId: string, updates: Partial<ExternalOrder>) => {
    try {
      const newOrders = externalOrders.map(o =>
        o.id === orderId ? { ...o, ...updates } : o
      );
      setExternalOrders(newOrders);
      await AsyncStorage.setItem(EXTERNAL_ORDERS_KEY, JSON.stringify(newOrders));
      console.log('External order updated:', orderId);
    } catch (error) {
      console.error('Error updating external order:', error);
      throw error;
    }
  }, [externalOrders]);

  const getExternalOrderByShareToken = useCallback((externalOrderId: string, token: string): ExternalOrder | undefined => {
    return externalOrders.find(
      o => o.externalOrderId === externalOrderId && o.shareToken === token
    );
  }, [externalOrders]);

  const updateTodayNote = useCallback(async (note: string) => {
    try {
      const today = getTodayDateString();
      const noteData: TodayNote = { date: today, note };
      
      setTodayNote(note);
      await AsyncStorage.setItem(TODAY_NOTE_KEY, JSON.stringify(noteData));
      console.log('Today note saved:', note);
    } catch (error) {
      console.error('Error saving today note:', error);
      throw error;
    }
  }, []);

  const getTodayOrders = useCallback(() => {
    const today = getTodayDateString();
    return externalOrders.filter(order => {
      if (order.fulfillmentDate) {
        return order.fulfillmentDate === today;
      }
      const orderDate = new Date(order.orderDate);
      const orderDateString = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`;
      return orderDateString === today;
    });
  }, [externalOrders]);

  return useMemo(() => ({
    externalOrders,
    todayNote,
    isLoading,
    addExternalOrder,
    deleteExternalOrder,
    updateExternalOrder,
    getExternalOrderByShareToken,
    updateTodayNote,
    getTodayOrders,
    drafts,
    draftsLoaded,
    saveDraft,
    deleteDraft,
    getDraft,
  }), [externalOrders, todayNote, isLoading, addExternalOrder, deleteExternalOrder, updateExternalOrder, getExternalOrderByShareToken, updateTodayNote, getTodayOrders, drafts, draftsLoaded, saveDraft, deleteDraft, getDraft]);
});
