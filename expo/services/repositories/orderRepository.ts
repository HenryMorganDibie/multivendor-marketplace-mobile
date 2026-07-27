import { Order, mockOrders } from '@/mocks/ordersData';

/**
 * orderRepository — data-access boundary for orders.
 *
 * SCAFFOLD ONLY. Owns the in-memory mock order array that orderService used to
 * hold directly, so there is a single mutable source. orderService now
 * delegates here.
 *
 * TODO(Henry): replace this array with Firestore `orders/{orderId}` reads.
 * Keep the method names stable.
 */
let orders: Order[] = [...mockOrders];

export const orderRepository = {
  async getAll(): Promise<Order[]> {
    return [...orders];
  },

  async getById(orderId: string): Promise<Order | undefined> {
    return orders.find((o) => o.id === orderId);
  },

  async getByVendorId(vendorId: string): Promise<Order[]> {
    return orders.filter((o) => o.vendorId === vendorId);
  },

  async getByCustomerId(customerId: string): Promise<Order[]> {
    return orders.filter((o) => o.customerId === customerId);
  },

  async getByStatus(status: Order['status']): Promise<Order[]> {
    return orders.filter((o) => o.status === status);
  },

  async insert(order: Order): Promise<Order> {
    orders = [...orders, order];
    return order;
  },

  async patch(orderId: string, patch: Partial<Order>): Promise<Order | null> {
    const index = orders.findIndex((o) => o.id === orderId);
    if (index === -1) {
      console.error('[orderRepository] Order not found:', orderId);
      return null;
    }
    orders = orders.map((o) => (o.id === orderId ? { ...o, ...patch } : o));
    return orders[index];
  },

  async remove(orderId: string): Promise<boolean> {
    const initialLength = orders.length;
    orders = orders.filter((o) => o.id !== orderId);
    return orders.length < initialLength;
  },
};
