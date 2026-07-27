import type { OrderStatus } from '@/constants/orderStatus';

/**
 * GLOBAL SYSTEM COPY RULE (MANDATORY)
 * All system-generated messages MUST explicitly reference the vendor's display name.
 * Generic phrases like "by the vendor", "the seller", "the business" are STRICTLY FORBIDDEN.
 *
 * Format: "{VendorName} + action"
 *
 * If vendor display name is unavailable, this function will throw an error.
 */

export interface SystemMessageOptions {
  vendorName: string;
  actorName?: string;
  fulfillmentType?: string;
}

export const getStatusMessage = (
  status: OrderStatus,
  options: SystemMessageOptions
): string => {
  const { vendorName } = options;

  if (!vendorName || vendorName.trim() === '') {
    throw new Error('SYSTEM_COPY_RULE_VIOLATION: Vendor display name is required for system messages');
  }

  switch (status) {
    case 'requested':
      return `Order request sent.\n${vendorName} has received your request and will respond when ready.`;
    case 'accepted':
      return `${vendorName} accepted your order request.\nYou can continue the conversation to arrange next steps.`;
    case 'confirmed':
      return `${vendorName} confirmed payment and will begin fulfilling your order.`;
    case 'in_progress':
      return `${vendorName} is currently fulfilling your order.`;
    case 'completed':
      return `${vendorName} marked this order as completed.`;
    case 'rejected':
      return `${vendorName} declined your order request.`;
    case 'cancelled':
      return `This order has been cancelled.`;
    case 'expired':
      return `This order request expired because ${vendorName} did not respond in time.`;
    default:
      return `Order request sent.\n${vendorName} has received your request and will respond when ready.`;
  }
};

export const getStatusExplanation = (
  status: OrderStatus,
  vendorName: string
): string => {
  if (!vendorName || vendorName.trim() === '') {
    throw new Error('SYSTEM_COPY_RULE_VIOLATION: Vendor display name is required for status explanations');
  }

  switch (status) {
    case 'requested':
      return `Waiting for ${vendorName} to review your order request.`;
    case 'accepted':
      return `${vendorName} accepted your order request. Please complete payment to proceed.`;
    case 'confirmed':
      return `${vendorName} confirmed payment and will begin fulfilling your order.`;
    case 'in_progress':
      return `${vendorName} is currently fulfilling your order.`;
    case 'completed':
      return `${vendorName} marked this order as completed.`;
    case 'rejected':
      return `${vendorName} declined your order request.`;
    case 'cancelled':
      return 'This order has been cancelled.';
    case 'expired':
      return `Your order request expired. ${vendorName} did not respond within 48 hours.`;
    default:
      return 'Order status unknown.';
  }
};

export const getVendorEventMessage = (
  eventType: 'ready' | 'dispatched' | 'service_started' | 'custom_update',
  vendorName: string,
  customMessage?: string
): string => {
  if (!vendorName || vendorName.trim() === '') {
    throw new Error('SYSTEM_COPY_RULE_VIOLATION: Vendor display name is required for event messages');
  }

  switch (eventType) {
    case 'ready':
      return `${vendorName} marked your order as ready.`;
    case 'dispatched':
      return `${vendorName} has dispatched your order.`;
    case 'service_started':
      return `${vendorName} has started your service.`;
    case 'custom_update':
      return customMessage || `${vendorName} sent an update on your order.`;
    default:
      return `${vendorName} sent an update on your order.`;
  }
};

/**
 * Generates notification text with vendor attribution
 */
export const getOrderNotificationText = (
  action: string,
  vendorName: string,
  _orderId?: string
): { title: string; message: string } => {
  if (!vendorName || vendorName.trim() === '') {
    throw new Error('SYSTEM_COPY_RULE_VIOLATION: Vendor display name is required for notifications');
  }

  switch (action) {
    case 'new_order':
      return {
        title: 'New Order',
        message: 'New order request from a customer',
      };
    case 'order_accepted':
      return {
        title: 'Order Accepted',
        message: `${vendorName} accepted your order`,
      };
    case 'order_confirmed':
      return {
        title: 'Payment Confirmed',
        message: `${vendorName} confirmed your payment`,
      };
    case 'order_in_progress':
      return {
        title: 'Order In Progress',
        message: `${vendorName} is fulfilling your order`,
      };
    case 'order_completed':
      return {
        title: 'Order Completed',
        message: `${vendorName} marked your order as completed`,
      };
    case 'order_rejected':
      return {
        title: 'Order Declined',
        message: `${vendorName} declined your order request`,
      };
    case 'order_cancelled':
      return {
        title: 'Order Cancelled',
        message: `This order has been cancelled`,
      };
    case 'order_expired':
      return {
        title: 'Order Request Expired',
        message: `${vendorName} did not respond within 48 hours. Your order request has expired.`,
      };
    default:
      return {
        title: 'Order Update',
        message: `Update from ${vendorName}`,
      };
  }
};

/**
 * Generates timeline text with vendor attribution
 */
export const getTimelineText = (
  status: OrderStatus,
  vendorName: string
): string => {
  if (!vendorName || vendorName.trim() === '') {
    throw new Error('SYSTEM_COPY_RULE_VIOLATION: Vendor display name is required for timeline text');
  }

  switch (status) {
    case 'requested':
      return `Order sent to ${vendorName}`;
    case 'accepted':
      return `Accepted by ${vendorName}`;
    case 'confirmed':
      return `Payment confirmed by ${vendorName}`;
    case 'in_progress':
      return `${vendorName} is fulfilling your order`;
    case 'completed':
      return `Completed by ${vendorName}`;
    case 'rejected':
      return `${vendorName} declined this order`;
    case 'cancelled':
      return 'Order cancelled';
    case 'expired':
      return 'Order request expired';
    default:
      return `Updated by ${vendorName}`;
  }
};
