import type { OrderStatus } from '@/constants/orderStatus';

export interface StatusColorToken {
  background: string;
  text: string;
}

export interface OrderStatusMeta {
  label: string;
  color: StatusColorToken;
  customerVisibleText: string;
  vendorVisibleText: string;
  isTerminal: boolean;
  nextStates: OrderStatus[];
}

export const ORDER_STATUS_META: Record<OrderStatus, OrderStatusMeta> = {
  requested: {
    label: 'Requested',
    color: { background: '#EFF6FF', text: '#2563EB' },
    customerVisibleText: 'Waiting for vendor',
    vendorVisibleText: 'NEW',
    isTerminal: false,
    nextStates: ['accepted', 'rejected', 'cancelled', 'expired', 'awaiting_customer_update'],
  },
  awaiting_customer_update: {
    label: 'Awaiting Update',
    color: { background: '#FFFBEB', text: '#B45309' },
    customerVisibleText: 'Update requested',
    vendorVisibleText: 'AWAITING UPDATE',
    isTerminal: false,
    nextStates: ['requested', 'accepted', 'rejected', 'cancelled'],
  },
  accepted: {
    label: 'Accepted',
    color: { background: '#FFF7ED', text: '#EA580C' },
    customerVisibleText: 'Payment required',
    vendorVisibleText: 'ACCEPTED',
    isTerminal: false,
    nextStates: ['confirmed', 'cancelled'],
  },
  confirmed: {
    label: 'Confirmed',
    color: { background: '#F5F3FF', text: '#7C3AED' },
    customerVisibleText: 'Payment confirmed',
    vendorVisibleText: 'CONFIRMED',
    isTerminal: false,
    nextStates: ['in_progress', 'cancelled'],
  },
  in_progress: {
    label: 'In Progress',
    color: { background: '#F0FDFA', text: '#0D9488' },
    customerVisibleText: 'Order in progress',
    vendorVisibleText: 'IN PROGRESS',
    isTerminal: false,
    nextStates: ['completed', 'cancelled'],
  },
  completed: {
    label: 'Completed',
    color: { background: '#F0FDF4', text: '#16A34A' },
    customerVisibleText: 'Order completed',
    vendorVisibleText: 'COMPLETED',
    isTerminal: true,
    nextStates: [],
  },
  rejected: {
    label: 'Rejected',
    color: { background: '#FEF2F2', text: '#DC2626' },
    customerVisibleText: 'Order declined',
    vendorVisibleText: 'REJECTED',
    isTerminal: true,
    nextStates: [],
  },
  cancelled: {
    label: 'Cancelled',
    color: { background: '#F9FAFB', text: '#6B7280' },
    customerVisibleText: 'Order cancelled',
    vendorVisibleText: 'CANCELLED',
    isTerminal: true,
    nextStates: [],
  },
  expired: {
    label: 'Expired',
    color: { background: '#F9FAFB', text: '#6B7280' },
    customerVisibleText: 'Request expired',
    vendorVisibleText: 'EXPIRED',
    isTerminal: true,
    nextStates: [],
  },
};

const FALLBACK_META: OrderStatusMeta = {
  label: 'Unknown',
  color: { background: '#F3F4F6', text: '#6B7280' },
  customerVisibleText: 'Unknown status',
  vendorVisibleText: 'UNKNOWN',
  isTerminal: false,
  nextStates: [],
};

export function getOrderStatusMeta(status: string): OrderStatusMeta {
  return ORDER_STATUS_META[status as OrderStatus] ?? FALLBACK_META;
}
