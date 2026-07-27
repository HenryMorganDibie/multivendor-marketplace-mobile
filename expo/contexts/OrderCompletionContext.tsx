import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback } from 'react';
import { Order } from '@/mocks/ordersData';
import { 
  checkOrderCompletionEligibility, 
  systemCompleteOrder,
  CompletionEligibility 
} from '@/utils/orderCompletionSystem';

export const [OrderCompletionProvider, useOrderCompletion] = createContextHook(() => {
  const [processingOrderIds, setProcessingOrderIds] = useState<Set<string>>(new Set());

  const completeOrderAsVendor = useCallback((order: Order): Order => {
    console.log('Vendor completing order:', order.id);
    
    return {
      ...order,
      status: 'completed',
      completedBy: 'vendor',
      completedAt: new Date().toISOString(),
    };
  }, []);

  const checkEligibilityForSystemCompletion = useCallback((order: Order): CompletionEligibility => {
    return checkOrderCompletionEligibility(order);
  }, []);

  const trySystemCompleteOrder = useCallback((order: Order): Order | null => {
    if (processingOrderIds.has(order.id)) {
      console.log('Order already being processed:', order.id);
      return null;
    }

    setProcessingOrderIds((prev) => new Set(prev).add(order.id));

    try {
      const eligibility = checkOrderCompletionEligibility(order);
      
      if (!eligibility.isEligible) {
        console.log('Order not eligible for system completion:', order.id, eligibility.failedChecks);
        return null;
      }

      console.log('System completing order:', order.id);
      const completedOrder = systemCompleteOrder(order);
      
      return completedOrder;
    } catch (error) {
      console.error('Failed to system-complete order:', error);
      return null;
    } finally {
      setProcessingOrderIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(order.id);
        return newSet;
      });
    }
  }, [processingOrderIds]);

  const sendCompletionReminder = useCallback((order: Order): Order => {
    const remindersSent = (order.remindersSent || 0) + 1;
    
    console.log(`Sending completion reminder #${remindersSent} for order:`, order.id);
    
    return {
      ...order,
      remindersSent,
      lastReminderAt: new Date().toISOString(),
    };
  }, []);

  const scanAndAutoCompleteOrders = useCallback((orders: Order[]): Order[] => {
    console.log('Scanning orders for auto-completion eligibility...');
    
    const updatedOrders = orders.map((order) => {
      if (order.status === 'completed' || order.status === 'cancelled') {
        return order;
      }

      const eligibility = checkOrderCompletionEligibility(order);
      
      if (eligibility.isEligible) {
        console.log('Auto-completing eligible order:', order.id);
        return systemCompleteOrder(order);
      }
      
      return order;
    });

    return updatedOrders;
  }, []);

  return {
    completeOrderAsVendor,
    checkEligibilityForSystemCompletion,
    trySystemCompleteOrder,
    sendCompletionReminder,
    scanAndAutoCompleteOrders,
  };
});
