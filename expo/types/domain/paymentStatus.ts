/**
 * Payment progress status — single source of truth.
 *
 * Kept separate from {@link OrderStatus}: an order's fulfillment progress and
 * its payment progress are two independent axes. The canonical union lives in
 * `mocks/ordersData` and is re-exported here.
 *
 * Backend names map as: `payment_pending` → unpaid,
 * `partially_received` → partially paid, `payment_received` → paid.
 */
export type { PaymentStatus } from '@/mocks/ordersData';

/** Backend-canonical payment status names. */
export type BackendPaymentStatus = 'unpaid' | 'partially_paid' | 'paid';
