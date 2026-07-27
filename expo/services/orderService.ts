import type { OrderStatus } from '@/constants/orderStatus';
import { Order, PaymentStatus, PaymentRecord } from '@/mocks/ordersData';
import { FulfillmentMethod } from '@/utils/orderStateTransitions';
import { orderRepository } from '@/services/repositories/orderRepository';

/**
 * orderService — single boundary for order reads & writes.
 *
 * Data access is delegated to `orderRepository`, which owns the mock data
 * today. TODO(Henry): the repository is where Firestore calls will replace the
 * mock array; this service's API stays stable for screens.
 */

export interface CreateOrderParams {
  vendorId: string;
  vendorName: string;
  customerName?: string;
  customerId?: string;
  items: Order['items'];
  scheduledDate?: string;
  scheduledTime?: string;
  fulfillmentType: 'Pickup' | 'Delivery';
  fulfillmentMethod: FulfillmentMethod;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  orderNote?: string;
  vendorPolicy?: string;
}

export interface UpdateOrderParams {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  amountPaid?: number;
  amountReceived?: number;
  adjustedTotal?: number;
  scheduledDate?: string;
  scheduledTime?: string;
  completedBy?: 'vendor' | 'system';
  completedAt?: string;
  systemCompletionReason?: string;
  paymentHistory?: PaymentRecord[];
}

export const orderService = {
  async getAll(): Promise<Order[]> {
    return orderRepository.getAll();
  },

  async getById(orderId: string): Promise<Order | undefined> {
    return orderRepository.getById(orderId);
  },

  async getByVendorId(vendorId: string): Promise<Order[]> {
    return orderRepository.getByVendorId(vendorId);
  },

  async getByCustomerId(customerId: string): Promise<Order[]> {
    return orderRepository.getByCustomerId(customerId);
  },

  async getByStatus(status: OrderStatus): Promise<Order[]> {
    return orderRepository.getByStatus(status);
  },

  async create(params: CreateOrderParams): Promise<Order> {
    const timestamp = Date.now();
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const randomPart = Math.floor(10000000 + Math.random() * 90000000);
    const publicOrderId = `${params.vendorId.toLowerCase()}-${dateStr}-${randomPart}`;

    const newOrder: Order = {
      id: `ord-${timestamp}`,
      publicOrderId,
      vendorId: params.vendorId,
      vendorName: params.vendorName,
      customerName: params.customerName,
      customerId: params.customerId,
      status: 'requested',
      orderDate: new Date().toISOString(),
      scheduledDate: params.scheduledDate,
      scheduledTime: params.scheduledTime,
      fulfillmentType: params.fulfillmentType,
      fulfillmentMethod: params.fulfillmentMethod,
      items: params.items,
      subtotal: params.subtotal,
      tax: params.tax,
      discount: params.discount,
      total: params.total,
      amountPaid: 0,
      paymentStatus: 'payment_pending',
      orderNote: params.orderNote,
      vendorPolicy: params.vendorPolicy,
      orderSource: 'internal',
    };

    await orderRepository.insert(newOrder);
    console.log('[OrderService] Created order:', newOrder.id);
    return newOrder;
  },

  async update(orderId: string, params: UpdateOrderParams): Promise<Order | null> {
    const updated = await orderRepository.patch(orderId, params);
    if (updated) console.log('[OrderService] Updated order:', orderId, params);
    return updated;
  },

  async addPaymentRecord(orderId: string, amount: number): Promise<Order | null> {
    const order = await orderRepository.getById(orderId);
    if (!order) {
      console.error('[OrderService] Order not found:', orderId);
      return null;
    }

    const paymentRecord: PaymentRecord = {
      amount,
      timestamp: new Date().toISOString(),
    };

    const paymentHistory = [...(order.paymentHistory || []), paymentRecord];
    const totalPaid = paymentHistory.reduce((sum, record) => sum + record.amount, 0);
    const remainingBalance = order.total - totalPaid;

    let paymentStatus: PaymentStatus = 'payment_pending';
    if (remainingBalance <= 0) {
      paymentStatus = 'payment_received';
    } else if (totalPaid > 0) {
      paymentStatus = 'partially_received';
    }

    return this.update(orderId, {
      paymentHistory,
      amountPaid: totalPaid,
      paymentStatus,
    });
  },

  async delete(orderId: string): Promise<boolean> {
    const deleted = await orderRepository.remove(orderId);
    if (deleted) {
      console.log('[OrderService] Deleted order:', orderId);
    }
    return deleted;
  },

  async updateStatus(orderId: string, status: OrderStatus): Promise<Order | null> {
    return this.update(orderId, { status });
  },

  async markAsPaid(orderId: string, amount: number): Promise<Order | null> {
    return this.addPaymentRecord(orderId, amount);
  },

  async complete(orderId: string, source: 'vendor' | 'system', reason?: string): Promise<Order | null> {
    return this.update(orderId, {
      status: 'completed',
      completedBy: source,
      completedAt: new Date().toISOString(),
      systemCompletionReason: reason,
    });
  },

  async cancel(orderId: string): Promise<Order | null> {
    return this.update(orderId, { status: 'cancelled' });
  },
};
