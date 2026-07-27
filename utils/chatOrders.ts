import type { OrderStatus } from '@/constants/orderStatus';
import { Order } from '@/mocks/ordersData';

export const isActiveOrderStatus = (status: OrderStatus): boolean => {
  return status === 'accepted' || status === 'confirmed' || status === 'in_progress';
};

export const getActiveOrdersForChat = (
  orders: Order[],
  vendorId: string,
  customerId: string
): Order[] => {
  return orders
    .filter(
      (order) =>
        order.vendorId === vendorId &&
        order.customerId === customerId &&
        isActiveOrderStatus(order.status)
    )
    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
    .slice(0, 5);
};

export const hasCompletedOrders = (
  orders: Order[],
  vendorId: string,
  customerId: string
): boolean => {
  return orders.some(
    (order) =>
      order.vendorId === vendorId &&
      order.customerId === customerId &&
      order.status === 'completed'
  );
};

export const getChatOrders = (
  orders: Order[],
  vendorId: string,
  customerId: string
): Order[] => {
  return orders
    .filter(
      (order) =>
        order.vendorId === vendorId &&
        order.customerId === customerId
    )
    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
};
