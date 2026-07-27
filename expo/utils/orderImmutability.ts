import type { OrderStatus } from '@/constants/orderStatus';

export type OrderLockState =
  | 'EDITABLE'
  | 'REQUESTED'
  | 'ACCEPTED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export type BannerType = 'none' | 'warning' | 'neutral' | 'success' | 'error';

export interface OrderLockConfig {
  lockState: OrderLockState;
  isLocked: boolean;
  bannerText: string | null;
  bannerSubtext: string | null;
  bannerType: BannerType;
  badgeLabel: string | null;
}

// Backend Enforced Rule — UI Display Only
export function getOrderLockState(status: OrderStatus): OrderLockState {
  switch (status) {
    case 'requested': return 'REQUESTED';
    case 'accepted': return 'ACCEPTED';
    case 'confirmed': return 'CONFIRMED';
    case 'in_progress': return 'IN_PROGRESS';
    case 'completed': return 'COMPLETED';
    case 'rejected': return 'REJECTED';
    case 'cancelled': return 'CANCELLED';
    default: return 'EDITABLE';
  }
}

// Backend Enforced Rule — UI Display Only
export function getOrderLockConfig(status: OrderStatus, vendorName?: string): OrderLockConfig {
  const lockState = getOrderLockState(status);

  switch (lockState) {
    case 'REQUESTED':
      return {
        lockState,
        isLocked: true,
        bannerText: 'Order request submitted',
        bannerSubtext: `Waiting for ${vendorName ?? 'the vendor'} to review your request.`,
        bannerType: 'warning',
        badgeLabel: 'REQUESTED',
      };
    case 'ACCEPTED':
      return {
        lockState,
        isLocked: true,
        bannerText: `${vendorName ?? 'Vendor'} accepted your order`,
        bannerSubtext: 'Please complete payment to proceed.',
        bannerType: 'neutral',
        badgeLabel: 'ACCEPTED',
      };
    case 'CONFIRMED':
      return {
        lockState,
        isLocked: true,
        bannerText: `${vendorName ?? 'Vendor'} confirmed payment`,
        bannerSubtext: 'Your order is being prepared.',
        bannerType: 'neutral',
        badgeLabel: 'CONFIRMED',
      };
    case 'IN_PROGRESS':
      return {
        lockState,
        isLocked: true,
        bannerText: `${vendorName ?? 'Vendor'} is fulfilling your order`,
        bannerSubtext: null,
        bannerType: 'neutral',
        badgeLabel: 'IN PROGRESS',
      };
    case 'COMPLETED':
      return {
        lockState,
        isLocked: true,
        bannerText: 'Order completed',
        bannerSubtext: null,
        bannerType: 'success',
        badgeLabel: 'COMPLETED',
      };
    case 'REJECTED':
      return {
        lockState,
        isLocked: true,
        bannerText: `${vendorName ?? 'Vendor'} declined this order`,
        bannerSubtext: null,
        bannerType: 'error',
        badgeLabel: 'REJECTED',
      };
    case 'CANCELLED':
      return {
        lockState,
        isLocked: true,
        bannerText: 'Order cancelled',
        bannerSubtext: null,
        bannerType: 'error',
        badgeLabel: 'CANCELLED',
      };
    default:
      return {
        lockState: 'EDITABLE',
        isLocked: false,
        bannerText: null,
        bannerSubtext: null,
        bannerType: 'none',
        badgeLabel: null,
      };
  }
}

export function isOrderLocked(status: OrderStatus): boolean {
  return getOrderLockState(status) !== 'EDITABLE';
}
