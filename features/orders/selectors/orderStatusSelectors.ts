import type { OrderStatus } from '@/constants/orderStatus';
import {
  getOrderStatusMeta,
  type OrderStatusMeta,
  type StatusColorToken,
} from '@/features/orders/constants/orderStatusMeta';

export type { OrderStatusMeta, StatusColorToken };

export function getOrderStatusMeta_(status: string): OrderStatusMeta {
  return getOrderStatusMeta(status);
}

export function getCustomerOrderStatusLabel(status: string): string {
  return getOrderStatusMeta(status).customerVisibleText;
}

export function getVendorOrderStatusLabel(status: string): string {
  return getOrderStatusMeta(status).vendorVisibleText;
}

export function getOrderStatusColor(status: string): StatusColorToken {
  return getOrderStatusMeta(status).color;
}

export function getOrderStatusLabel(status: string): string {
  return getOrderStatusMeta(status).label;
}

export function isOrderStatusTerminal(status: string): boolean {
  return getOrderStatusMeta(status).isTerminal;
}

export function getOrderNextStates(status: string): OrderStatus[] {
  return getOrderStatusMeta(status).nextStates;
}

export function getOrderStatusBadgeStyle(status: string): {
  backgroundColor: string;
  textColor: string;
} {
  const color = getOrderStatusColor(status);
  return { backgroundColor: color.background, textColor: color.text };
}

export { getOrderStatusMeta };
