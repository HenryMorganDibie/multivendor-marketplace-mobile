import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Currency } from '@/utils/formatPrice';

/**
 * DRAFT          — created, not yet delivered
 * SHARED_EXTERNALLY — sent via native share sheet (WhatsApp, email, etc.)
 * SENT_IN_CHAT   — attached to a real the platform customer chat thread
 * VIEWED         — customer has opened the invoice link (future)
 * PAID           — vendor manually marked as paid
 * CANCELLED      — voided
 */
export type InvoiceStatus =
  | 'draft'
  | 'shared_externally'
  | 'sent_in_chat'
  | 'viewed'
  | 'paid'
  | 'cancelled';

export interface InvoiceLineItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  /** Bound the platform chat thread — required for SENT_IN_CHAT delivery */
  chatId?: string;
  /** Bound the platform customer id — required for SENT_IN_CHAT delivery */
  customerId?: string;
  items: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string;
  status: InvoiceStatus;
  currency: Currency;
  createdAt: string;
  sharedAt?: string;
  sentInChatAt?: string;
  paidAt?: string;
}

const STORAGE_KEY = 'vendor_invoices_v2';

export const [InvoiceProvider, useInvoices] = createContextHook(() => {
  const queryClient = useQueryClient();

  const invoicesQuery = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as Invoice[]) : [];
    },
  });

  const saveInvoicesMutation = useMutation({
    mutationFn: async (invoices: Invoice[]) => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
      return invoices;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  const generateInvoiceNumber = () => {
    const ts = Date.now();
    const rand = Math.floor(Math.random() * 1000);
    return `INV-${ts}-${rand}`;
  };

  const generateInvoiceId = () =>
    `invoice_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const createInvoice = async (
    invoiceData: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt'>
  ): Promise<Invoice> => {
    const invoices = invoicesQuery.data || [];
    const newInvoice: Invoice = {
      ...invoiceData,
      id: generateInvoiceId(),
      invoiceNumber: generateInvoiceNumber(),
      createdAt: new Date().toISOString(),
    };
    await saveInvoicesMutation.mutateAsync([newInvoice, ...invoices]);
    return newInvoice;
  };

  const updateInvoice = async (id: string, updates: Partial<Invoice>) => {
    const invoices = invoicesQuery.data || [];
    const updated = invoices.map((inv) =>
      inv.id === id ? { ...inv, ...updates } : inv
    );
    await saveInvoicesMutation.mutateAsync(updated);
  };

  const deleteInvoice = async (id: string) => {
    const invoices = invoicesQuery.data || [];
    await saveInvoicesMutation.mutateAsync(
      invoices.filter((inv) => inv.id !== id)
    );
  };

  const getInvoiceById = (id: string): Invoice | undefined =>
    (invoicesQuery.data || []).find((inv) => inv.id === id);

  /**
   * Mark an invoice as sent inside a the platform chat thread.
   * Requires a valid chatId — will throw if missing.
   */
  const sendInvoiceInChat = async (id: string, chatId: string, customerId?: string) => {
    await updateInvoice(id, {
      status: 'sent_in_chat',
      chatId,
      customerId,
      sentInChatAt: new Date().toISOString(),
    });
  };

  /**
   * Mark an invoice as externally shared (via native share sheet).
   */
  const markInvoiceSharedExternally = async (id: string) => {
    await updateInvoice(id, {
      status: 'shared_externally',
      sharedAt: new Date().toISOString(),
    });
  };

  return {
    invoices: invoicesQuery.data || [],
    isLoading: invoicesQuery.isLoading,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    getInvoiceById,
    sendInvoiceInChat,
    markInvoiceSharedExternally,
  };
});
