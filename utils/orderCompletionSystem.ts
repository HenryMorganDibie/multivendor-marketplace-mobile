import { Order } from '@/mocks/ordersData';

const INACTIVITY_DAYS = 7;
const REQUIRED_REMINDERS = 3;

export interface CompletionEligibility {
  isEligible: boolean;
  reason?: string;
  failedChecks?: string[];
}

export function checkOrderCompletionEligibility(order: Order): CompletionEligibility {
  const failedChecks: string[] = [];

  if (order.status === 'completed') {
    return { isEligible: false, reason: 'Order already completed' };
  }

  if (order.status === 'cancelled' || order.status === 'rejected') {
    return { isEligible: false, reason: 'Order is cancelled or rejected' };
  }

  if (order.status === 'pending') {
    return { isEligible: false, reason: 'Order not yet accepted by vendor' };
  }

  if (order.hasDispute) {
    failedChecks.push('Order has an active dispute');
  }

  if (order.hasRefund) {
    failedChecks.push('Order has a refund');
  }

  if (!order.scheduledDate || !order.scheduledTime) {
    failedChecks.push('No fulfillment date/time set');
  } else {
    const hasFulfillmentPassed = checkFulfillmentPassed(order.scheduledDate, order.scheduledTime);
    if (!hasFulfillmentPassed) {
      failedChecks.push('Fulfillment date/time has not passed');
    }
  }

  const paymentStatus = order.paymentStatus || 'payment_pending';
  if (paymentStatus !== 'payment_received') {
    failedChecks.push('Payment not fully settled (status: ' + paymentStatus + ')');
  }

  const remindersSent = order.remindersSent || 0;
  if (remindersSent < REQUIRED_REMINDERS) {
    failedChecks.push(`Only ${remindersSent}/${REQUIRED_REMINDERS} reminders sent`);
  }

  if (order.lastReminderAt) {
    const hasInactivityPeriodPassed = checkInactivityPeriodPassed(order.lastReminderAt);
    if (!hasInactivityPeriodPassed) {
      failedChecks.push(`Inactivity period of ${INACTIVITY_DAYS} days not yet elapsed`);
    }
  } else {
    failedChecks.push('No reminder tracking available');
  }

  if (failedChecks.length > 0) {
    return {
      isEligible: false,
      reason: 'Order does not meet all auto-completion criteria',
      failedChecks,
    };
  }

  return { isEligible: true };
}

function checkFulfillmentPassed(scheduledDate: string, scheduledTime: string): boolean {
  try {
    const [year, month, day] = scheduledDate.split('-').map(Number);
    const timeParts = scheduledTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
    
    if (!timeParts) return false;
    
    let hours = parseInt(timeParts[1], 10);
    const minutes = parseInt(timeParts[2], 10);
    const period = timeParts[3].toUpperCase();
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    const fulfillmentDateTime = new Date(year, month - 1, day, hours, minutes);
    const now = new Date();
    
    return now > fulfillmentDateTime;
  } catch (error) {
    console.error('Error parsing fulfillment date/time:', error);
    return false;
  }
}

function checkInactivityPeriodPassed(lastReminderAt: string): boolean {
  try {
    const lastReminder = new Date(lastReminderAt);
    const now = new Date();
    const daysSinceLastReminder = (now.getTime() - lastReminder.getTime()) / (1000 * 60 * 60 * 24);
    
    return daysSinceLastReminder >= INACTIVITY_DAYS;
  } catch (error) {
    console.error('Error calculating inactivity period:', error);
    return false;
  }
}

export function generateSystemCompletionReason(order: Order): string {
  const fulfillmentInfo = order.scheduledDate && order.scheduledTime 
    ? `Fulfillment scheduled for ${order.scheduledDate} at ${order.scheduledTime}`
    : 'Fulfillment date passed';
  
  const paymentInfo = `Payment status: ${order.paymentStatus || 'paid'}`;
  const reminderInfo = `${order.remindersSent || 0} completion reminders sent`;
  const inactivityInfo = order.lastReminderAt 
    ? `Last reminder: ${new Date(order.lastReminderAt).toLocaleString()}`
    : 'Inactivity period elapsed';
  
  return [
    'System auto-completion triggered.',
    fulfillmentInfo,
    paymentInfo,
    reminderInfo,
    inactivityInfo,
    `Completed at: ${new Date().toISOString()}`,
  ].join(' | ');
}

export function systemCompleteOrder(order: Order): Order {
  const eligibility = checkOrderCompletionEligibility(order);
  
  if (!eligibility.isEligible) {
    console.error('Order not eligible for system completion:', eligibility);
    throw new Error('Order not eligible for system completion: ' + eligibility.reason);
  }
  
  return {
    ...order,
    status: 'completed',
    completedBy: 'system',
    completedAt: new Date().toISOString(),
    systemCompletionReason: generateSystemCompletionReason(order),
  };
}

export function isOrderCompleted(order: Order): boolean {
  return order.status === 'completed';
}

export function getCompletedOrders(orders: Order[]): Order[] {
  return orders.filter(isOrderCompleted);
}

export function getFirstCompletedOrderDate(orders: Order[], customerId: string): Date | null {
  const completedOrders = orders.filter(
    (order) => 
      order.customerId === customerId && 
      order.status === 'completed'
  );
  
  if (completedOrders.length === 0) return null;
  
  const sortedOrders = completedOrders.sort((a, b) => {
    const dateA = new Date(a.completedAt || a.orderDate);
    const dateB = new Date(b.completedAt || b.orderDate);
    return dateA.getTime() - dateB.getTime();
  });
  
  const firstOrder = sortedOrders[0];
  return new Date(firstOrder.completedAt || firstOrder.orderDate);
}

export function formatCustomerSince(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
