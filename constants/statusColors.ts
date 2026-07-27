import type { OrderStatus } from '@/mocks/ordersData';

export interface StatusColorToken {
  background: string;
  text: string;
}

export const ORDER_STATUS_COLORS: Record<OrderStatus, StatusColorToken> = {
  requested:  { background: '#EFF6FF', text: '#2563EB' },
  accepted:   { background: '#FFF7ED', text: '#EA580C' },
  confirmed:  { background: '#F5F3FF', text: '#7C3AED' },
  in_progress:{ background: '#F0FDFA', text: '#0D9488' },
  completed:  { background: '#F0FDF4', text: '#16A34A' },
  rejected:   { background: '#FEF2F2', text: '#DC2626' },
  cancelled:  { background: '#F9FAFB', text: '#6B7280' },
  expired:    { background: '#F9FAFB', text: '#6B7280' },
};

export function getOrderStatusColors(status: string): StatusColorToken {
  return ORDER_STATUS_COLORS[status as OrderStatus] ?? { background: '#F3F4F6', text: '#6B7280' };
}

export const ORDER_STATUS_PRIORITY: Record<OrderStatus, number> = {
  requested:   1,
  accepted:    2,
  confirmed:   3,
  in_progress: 4,
  completed:   5,
  rejected:    6,
  cancelled:   6,
  expired:     6,
};

export function getStatusPriorityOrder(status: string): number {
  return ORDER_STATUS_PRIORITY[status as OrderStatus] ?? 7;
}
