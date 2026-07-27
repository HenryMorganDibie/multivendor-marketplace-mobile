import type { OrderStatus } from '@/constants/orderStatus';
import type { Order } from '@/mocks/ordersData';
import { getPaymentPriority, getStatusPriority } from './orderHelpers';

export const ACTIVE_STATUSES: OrderStatus[] = ['requested', 'accepted', 'confirmed', 'in_progress'];
export const CLOSED_STATUSES: OrderStatus[] = ['completed', 'rejected', 'cancelled', 'expired'];

export function filterUpcomingOrders(orders: Order[]): Order[] {
  return orders.filter(
    (order) =>
      order.orderSource === 'the platform' && ACTIVE_STATUSES.includes(order.status)
  );
}

export function filterPastOrders(orders: Order[]): Order[] {
  return orders.filter(
    (order) =>
      order.orderSource === 'the platform' && CLOSED_STATUSES.includes(order.status)
  );
}

export function filterPendingOrders(orders: Order[]): Order[] {
  return orders
    .filter((order) => order.status === 'requested')
    .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());
}

export function filterAcceptedOrders(orders: Order[]): Order[] {
  return orders
    .filter((order) => order.status === 'accepted')
    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
}

export function filterConfirmedOrders(orders: Order[]): Order[] {
  return orders
    .filter((order) => order.status === 'confirmed')
    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
}

export function filterInProgressOrders(orders: Order[]): Order[] {
  return orders
    .filter((order) => order.status === 'in_progress')
    .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());
}

export function filterCompletedOrders(orders: Order[]): Order[] {
  return orders
    .filter((order) => order.status === 'completed')
    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
}

export function filterClosedOrders(orders: Order[]): Order[] {
  return orders
    .filter((order) => CLOSED_STATUSES.includes(order.status))
    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
}

export function filterActiveOrders(orders: Order[]): Order[] {
  return orders.filter((order) => ACTIVE_STATUSES.includes(order.status));
}

export function filterUnpaidOrders(orders: Order[]): Order[] {
  return orders
    .filter((order) => {
      const paymentStatus = order.paymentStatus || 'payment_pending';
      return paymentStatus === 'payment_pending' || paymentStatus === 'partially_received';
    })
    .sort((a, b) => {
      const paymentPriorityDiff = getPaymentPriority(a) - getPaymentPriority(b);
      if (paymentPriorityDiff !== 0) return paymentPriorityDiff;
      return new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime();
    });
}

export function sortOrdersByPriority(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    const paymentPriorityDiff = getPaymentPriority(a) - getPaymentPriority(b);
    if (paymentPriorityDiff !== 0) return paymentPriorityDiff;

    const priorityDiff = getStatusPriority(a.status) - getStatusPriority(b.status);
    if (priorityDiff !== 0) return priorityDiff;

    return new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime();
  });
}

export function searchOrders(orders: Order[], query: string): Order[] {
  if (!query.trim()) return orders;

  const searchQuery = query.toLowerCase();
  return orders.filter((order) => {
    const customerName = order.customerName?.toLowerCase() || '';
    const orderId = order.publicOrderId.toLowerCase();
    return customerName.includes(searchQuery) || orderId.includes(searchQuery);
  });
}

export function hasOldUnpaidExternalOrders(
  orders: Order[],
  hoursThreshold: number = 6
): boolean {
  const thresholdTime = Date.now() - (hoursThreshold * 60 * 60 * 1000);

  return orders.some((order) => {
    const isExternal = order.orderSource === 'external';
    const isPending =
      !order.paymentStatus ||
      order.paymentStatus === 'payment_pending' ||
      order.paymentStatus === 'partially_received';
    const orderTime = new Date(order.orderDate).getTime();

    return isExternal && isPending && orderTime < thresholdTime;
  });
}

export function filterPinnedOrders(orders: Order[]): Order[] {
  return filterActiveOrders(orders);
}
