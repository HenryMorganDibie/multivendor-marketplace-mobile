import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * AsyncStorage-only, device-local, and this is NOT device-local scratch
 * data — it represents real vendor external-order revenue. Evidence: a
 * customer-facing shareToken (getExternalOrderByShareToken), full financial
 * fields (total/subtotal/tax/amountReceived), a terminal `status:
 * 'completed'`, and it feeds real sales reporting (reports.tsx) alongside
 * genuine backend orders.
 *
 * It is not migrated to the real backend (createExternalOrder,
 * platform-backend/functions/src/orders/createOrder.ts) in this pass,
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

const EXTERNAL_ORDERS_KEY = '@external_orders';
const TODAY_NOTE_KEY = '@today_note';

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
  }), [externalOrders, todayNote, isLoading, addExternalOrder, deleteExternalOrder, updateExternalOrder, getExternalOrderByShareToken, updateTodayNote, getTodayOrders]);
});
