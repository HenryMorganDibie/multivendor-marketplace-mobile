/**
 * Builds the dashboard insight cards.
 *
 * This lived in mocks/insightsData.ts as getMockInsights, which was a
 * misleading name: it invents nothing. It takes figures the backend computed —
 * pending payments, genuinely new customers, low stock, the real best seller —
 * and turns them into cards. Presentation logic, not fixtures.
 *
 * Sitting under mocks/ meant the dashboard imported from a mocks path while
 * reading entirely real data, so an audit for remaining mock imports flagged a
 * file that had none. Moved and renamed; the behaviour is unchanged.
 *
 * Every card is still guarded on presence. A figure the backend could not
 * compute honestly arrives as null or undefined and its card does not render,
 * which is correct for a vendor with no data yet and better than a confident
 * wrong number.
 */

import React from 'react';
import {
  CreditCard,
  Star,
  MessageCircle,
  Package,
  TrendingUp,
  Users,
  ShoppingBag,
  Zap,
} from 'lucide-react-native';

export interface InsightData {
  id: string;
  type: 'payment' | 'bestseller' | 'response_time' | 'inventory' | 'growth' | 'customers' | 'promotion' | 'custom';
  iconName: string;
  iconColor: string;
  iconBg: string;
  message: string;
  actionLabel?: string;
  actionRoute?: string;
  priority: number;
  meta?: Record<string, string | number | boolean>;
}

export function buildInsightCards(context: {
  pendingPaymentCount: number;
  bestSellerName: string | null;
  bestSellerCount?: number;
  totalCustomers?: number;
  newCustomersThisWeek?: number;
  lowStockCount?: number;
  avgResponseMinutes?: number;
}): InsightData[] {
  const list: InsightData[] = [];

  if (context.pendingPaymentCount > 0) {
    list.push({
      id: 'payment_pending',
      type: 'payment',
      iconName: 'CreditCard',
      iconColor: '#2563EB',
      iconBg: '#EFF6FF',
      message: `${context.pendingPaymentCount} order${context.pendingPaymentCount > 1 ? 's' : ''} waiting for payment confirmation.`,
      actionLabel: 'View Orders',
      actionRoute: '/vendor/orders?filter=AWAITING_PAYMENT',
      priority: 1,
      meta: { count: context.pendingPaymentCount },
    });
  }

  if (context.bestSellerName && context.bestSellerCount) {
    list.push({
      id: 'bestseller',
      type: 'bestseller',
      iconName: 'Star',
      iconColor: '#D97706',
      iconBg: '#FFFBEB',
      message: `Your top item "${context.bestSellerName}" sold ${context.bestSellerCount} units. Consider featuring it.`,
      actionLabel: 'View Catalog',
      actionRoute: '/vendor/catalog',
      priority: 2,
      meta: { itemName: context.bestSellerName, unitsSold: context.bestSellerCount },
    });
  }

  if (context.newCustomersThisWeek && context.newCustomersThisWeek > 0) {
    list.push({
      id: 'new_customers',
      type: 'customers',
      iconName: 'Users',
      iconColor: '#16A34A',
      iconBg: '#F0FDF4',
      message: `${context.newCustomersThisWeek} new customer${context.newCustomersThisWeek > 1 ? 's' : ''} this week. Keep up the momentum.`,
      actionLabel: 'Growth Insights',
      actionRoute: '/vendor/growth-insights',
      priority: 3,
      meta: { newCustomers: context.newCustomersThisWeek },
    });
  }

  if (context.avgResponseMinutes !== undefined) {
    const isGood = context.avgResponseMinutes < 15;
    list.push({
      id: 'response_time',
      type: 'response_time',
      iconName: 'MessageCircle',
      iconColor: isGood ? '#16A34A' : '#D97706',
      iconBg: isGood ? '#F0FDF4' : '#FFFBEB',
      message: isGood
        ? `Average reply time: ${context.avgResponseMinutes} min. Great job keeping customers engaged.`
        : `Average reply time: ${context.avgResponseMinutes} min. Faster replies improve conversion.`,
      actionLabel: 'View Chats',
      actionRoute: '/vendor/chats',
      priority: 4,
      meta: { avgMinutes: context.avgResponseMinutes },
    });
  } else {
    list.push({
      id: 'response_time_default',
      type: 'response_time',
      iconName: 'MessageCircle',
      iconColor: '#16A34A',
      iconBg: '#F0FDF4',
      message: 'Fast replies build trust. Respond to new messages quickly.',
      actionLabel: 'View Chats',
      actionRoute: '/vendor/chats',
      priority: 4,
    });
  }

  if (context.lowStockCount && context.lowStockCount > 0) {
    list.push({
      id: 'low_stock',
      type: 'inventory',
      iconName: 'Package',
      iconColor: '#C2410C',
      iconBg: '#FFF7ED',
      message: `${context.lowStockCount} item${context.lowStockCount > 1 ? 's' : ''} running low on stock. Update your catalog.`,
      actionLabel: 'View Catalog',
      actionRoute: '/vendor/catalog',
      priority: 5,
      meta: { lowStockCount: context.lowStockCount },
    });
  } else {
    list.push({
      id: 'inventory_default',
      type: 'inventory',
      iconName: 'Package',
      iconColor: '#C2410C',
      iconBg: '#FFF7ED',
      message: 'Review your catalog regularly to keep stock levels accurate.',
      actionLabel: 'View Catalog',
      actionRoute: '/vendor/catalog',
      priority: 5,
    });
  }

  return list.sort((a, b) => a.priority - b.priority);
}

export const ICON_MAP: Record<string, React.ComponentType<{ size: number; color: string; strokeWidth?: number }>> = {
  CreditCard,
  Star,
  MessageCircle,
  Package,
  TrendingUp,
  Users,
  ShoppingBag,
  Zap,
};
