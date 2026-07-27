export type OrderStatus =
  | 'requested'
  | 'accepted'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'expired';

export const TERMINAL_STATUSES: readonly OrderStatus[] = [
  'completed',
  'rejected',
  'cancelled',
  'expired',
];

export const CUSTOMER_STATUS_LABELS: Record<OrderStatus, string> = {
  requested:   'Waiting for vendor',
  accepted:    'Payment required',
  confirmed:   'Payment confirmed',
  in_progress: 'Order in progress',
  completed:   'Order completed',
  rejected:    'Order declined',
  cancelled:   'Order cancelled',
  expired:     'Request expired',
};

export const VENDOR_STATUS_LABELS: Record<OrderStatus, string> = {
  requested:   'NEW',
  accepted:    'ACCEPTED',
  confirmed:   'CONFIRMED',
  in_progress: 'IN PROGRESS',
  completed:   'COMPLETED',
  rejected:    'REJECTED',
  cancelled:   'CANCELLED',
  expired:     'EXPIRED',
};

export const DISPLAY_STATUS_LABELS: Record<OrderStatus, string> = {
  requested:   'REQUESTED',
  accepted:    'ACCEPTED',
  confirmed:   'CONFIRMED',
  in_progress: 'IN PROGRESS',
  completed:   'COMPLETED',
  rejected:    'REJECTED',
  cancelled:   'CANCELLED',
  expired:     'EXPIRED',
};

export interface StatusColorToken {
  background: string;
  text: string;
}

export const ORDER_STATUS_COLORS: Record<OrderStatus, StatusColorToken> = {
  requested:   { background: '#EFF6FF', text: '#2563EB' },
  accepted:    { background: '#FFF7ED', text: '#EA580C' },
  confirmed:   { background: '#F5F3FF', text: '#7C3AED' },
  in_progress: { background: '#F0FDFA', text: '#0D9488' },
  completed:   { background: '#F0FDF4', text: '#16A34A' },
  rejected:    { background: '#FEF2F2', text: '#DC2626' },
  cancelled:   { background: '#F9FAFB', text: '#6B7280' },
  expired:     { background: '#F9FAFB', text: '#6B7280' },
};

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

export function getStatusColor(status: string): StatusColorToken {
  return ORDER_STATUS_COLORS[status as OrderStatus] ?? { background: '#F3F4F6', text: '#6B7280' };
}

export function getCustomerStatusLabel(status: string): string {
  return CUSTOMER_STATUS_LABELS[status as OrderStatus] ?? (status as string).replace(/_/g, ' ');
}

export function getVendorStatusLabel(status: string): string {
  return VENDOR_STATUS_LABELS[status as OrderStatus] ?? (status as string).toUpperCase().replace(/_/g, ' ');
}

export function getDisplayStatusLabel(status: string): string {
  return DISPLAY_STATUS_LABELS[status as OrderStatus] ?? (status as string).toUpperCase().replace(/_/g, ' ');
}

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.includes(status as OrderStatus);
}

export function getStatusPriorityOrder(status: string): number {
  return ORDER_STATUS_PRIORITY[status as OrderStatus] ?? 7;
}
