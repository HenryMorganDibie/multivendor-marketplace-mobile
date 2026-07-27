import type { OrderStatus } from '@/constants/orderStatus';

export type FulfillmentMethod = 'pickup' | 'delivery' | 'shipping';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  requested: ['accepted', 'rejected', 'cancelled', 'expired'],
  accepted: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  rejected: [],
  cancelled: [],
  expired: [],
};

const TERMINAL_STATUSES: OrderStatus[] = ['completed', 'rejected', 'cancelled', 'expired'];

const CANCELLABLE_STATUSES: OrderStatus[] = ['requested', 'accepted', 'confirmed', 'in_progress'];

// Backend Enforced Rule — UI Display Only
export function isValidTransition(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
  _fulfillmentMethod?: FulfillmentMethod
): boolean {
  if (TERMINAL_STATUSES.includes(fromStatus)) return false;
  const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];
  return allowed.includes(toStatus);
}

// Backend Enforced Rule — UI Display Only
export function getNextAllowedStatuses(
  currentStatus: OrderStatus,
  _fulfillmentMethod?: FulfillmentMethod
): OrderStatus[] {
  if (TERMINAL_STATUSES.includes(currentStatus)) return [];
  return ALLOWED_TRANSITIONS[currentStatus] ?? [];
}

export function isTerminalStatus(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function isCancellable(status: OrderStatus): boolean {
  return CANCELLABLE_STATUSES.includes(status);
}

export function getInvalidTransitionMessage(
  fromStatus: OrderStatus,
  toStatus: OrderStatus
): string {
  if (TERMINAL_STATUSES.includes(fromStatus)) {
    return `Order is in terminal state "${fromStatus}" and cannot be changed.`;
  }
  const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];
  if (!allowed.includes(toStatus)) {
    return `Cannot transition from "${fromStatus}" to "${toStatus}". Allowed: ${allowed.join(', ') || 'none'}.`;
  }
  return '';
}

export function getStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    requested: 'Requested',
    accepted: 'Accepted',
    confirmed: 'Confirmed',
    in_progress: 'In Progress',
    completed: 'Completed',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    expired: 'Expired',
  };
  return labels[status] ?? status;
}

export function getOrderStatusFlow(): OrderStatus[] {
  return ['requested', 'accepted', 'confirmed', 'in_progress', 'completed'];
}

export function getFulfillmentMethodLabel(method: FulfillmentMethod): string {
  const labels: Record<FulfillmentMethod, string> = {
    pickup: 'Pickup',
    delivery: 'Delivery',
    shipping: 'Shipping',
  };
  return labels[method] ?? method;
}
