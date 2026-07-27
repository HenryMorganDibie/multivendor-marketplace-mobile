import { Invoice, InvoiceStatus, InvoiceLineItem } from '@/contexts/InvoiceContext';
import type { Currency } from '@/utils/formatPrice';

export interface CreateInvoiceParams {
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  items: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string;
  status: InvoiceStatus;
  currency: Currency;
}

let invoices: Invoice[] = [];

export const invoiceService = {
  async getAll(): Promise<Invoice[]> {
    return [...invoices];
  },

  async getById(invoiceId: string): Promise<Invoice | undefined> {
    return invoices.find(inv => inv.id === invoiceId);
  },

  async getByStatus(status: InvoiceStatus): Promise<Invoice[]> {
    return invoices.filter(inv => inv.status === status);
  },

  async create(params: CreateInvoiceParams): Promise<Invoice> {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    
    const newInvoice: Invoice = {
      id: `invoice_${timestamp}_${Math.random().toString(36).substring(2, 9)}`,
      invoiceNumber: `INV-${timestamp}-${random}`,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      customerEmail: params.customerEmail,
      items: params.items,
      subtotal: params.subtotal,
      tax: params.tax,
      discount: params.discount,
      total: params.total,
      notes: params.notes,
      status: params.status,
      currency: params.currency,
      createdAt: new Date().toISOString(),
    };

    invoices = [newInvoice, ...invoices];
    console.log('[InvoiceService] Created invoice:', newInvoice.id);
    return newInvoice;
  },

  async update(invoiceId: string, updates: Partial<Invoice>): Promise<Invoice | null> {
    const invoiceIndex = invoices.findIndex(inv => inv.id === invoiceId);
    if (invoiceIndex === -1) {
      console.error('[InvoiceService] Invoice not found:', invoiceId);
      return null;
    }

    invoices = invoices.map(inv => 
      inv.id === invoiceId ? { ...inv, ...updates } : inv
    );

    console.log('[InvoiceService] Updated invoice:', invoiceId);
    return invoices[invoiceIndex];
  },

  async delete(invoiceId: string): Promise<boolean> {
    const initialLength = invoices.length;
    invoices = invoices.filter(inv => inv.id !== invoiceId);
    const deleted = invoices.length < initialLength;
    
    if (deleted) {
      console.log('[InvoiceService] Deleted invoice:', invoiceId);
    }
    return deleted;
  },

  async markAsSent(invoiceId: string): Promise<Invoice | null> {
    return this.update(invoiceId, {
      status: 'sent',
      sentAt: new Date().toISOString(),
    });
  },

  async markAsPaid(invoiceId: string): Promise<Invoice | null> {
    return this.update(invoiceId, {
      status: 'paid',
      paidAt: new Date().toISOString(),
    });
  },

  async cancel(invoiceId: string): Promise<Invoice | null> {
    return this.update(invoiceId, { status: 'cancelled' });
  },
};
