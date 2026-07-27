import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Package, MessageSquare, CreditCard, AlertCircle, ShieldAlert, CheckCircle, XCircle, Bell } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

export type NotificationCategory = 'order' | 'message' | 'payment' | 'system' | 'error';

export interface NotificationItemData {
  id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: string;
  is_read: boolean;
  is_high_priority?: boolean;
  orderId?: string;
}

interface NotificationItemProps {
  notification: NotificationItemData;
  onPress: (notification: NotificationItemData) => void;
}

const ICON_CONFIG: Record<NotificationCategory, { icon: typeof Package; color: string; bgColor: string }> = {
  order: { icon: Package, color: '#E8590C', bgColor: '#FFF4E6' },
  message: { icon: MessageSquare, color: '#16A34A', bgColor: '#F0FDF4' },
  payment: { icon: CreditCard, color: '#2563EB', bgColor: '#EFF6FF' },
  system: { icon: Bell, color: '#6B7280', bgColor: '#F3F4F6' },
  error: { icon: XCircle, color: '#DC2626', bgColor: '#FEF2F2' },
};

export function mapNotificationType(type: string): NotificationCategory {
  switch (type) {
    case 'order_sent':
    case 'order_accepted':
    case 'order_ready':
    case 'new_order':
    case 'customer_cancelled_order':
    case 'order_expired':
      return 'order';
    case 'new_vendor_message':
    case 'new_customer_message':
    case 'new_support_message':
      return 'message';
    case 'partial_payment_confirmed':
    case 'payment_confirmed':
      return 'payment';
    case 'order_rejected':
    case 'account_warning':
    case 'account_restriction':
    case 'verification_rejected':
      return 'error';
    case 'verification_requested':
    case 'verification_approved':
    case 'pickup_instructions':
    default:
      return 'system';
  }
}

export function isHighPriority(type: string): boolean {
  return [
    'order_rejected',
    'payment_confirmed',
    'order_ready',
    'new_order',
    'account_warning',
    'account_restriction',
  ].includes(type);
}

export function formatNotificationTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function groupNotificationsByDate<T extends { timestamp: string }>(
  notifications: T[]
): { title: string; data: T[] }[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;

  const today: T[] = [];
  const yesterday: T[] = [];
  const earlier: T[] = [];

  for (const notif of notifications) {
    const ts = new Date(notif.timestamp).getTime();
    if (ts >= todayStart) {
      today.push(notif);
    } else if (ts >= yesterdayStart) {
      yesterday.push(notif);
    } else {
      earlier.push(notif);
    }
  }

  const groups: { title: string; data: T[] }[] = [];
  if (today.length > 0) groups.push({ title: 'Today', data: today });
  if (yesterday.length > 0) groups.push({ title: 'Yesterday', data: yesterday });
  if (earlier.length > 0) groups.push({ title: 'Earlier', data: earlier });
  return groups;
}

function NotificationItemComponent({ notification, onPress }: NotificationItemProps) {
  const config = ICON_CONFIG[notification.category];
  const IconComponent = config.icon;

  const handlePress = useCallback(() => {
    onPress(notification);
  }, [notification, onPress]);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        !notification.is_read && styles.containerUnread,
        notification.is_high_priority && !notification.is_read && styles.containerHighPriority,
      ]}
      onPress={handlePress}
      activeOpacity={0.6}
      testID={`notification-item-${notification.id}`}
    >
      <View style={[styles.iconWrapper, { backgroundColor: config.bgColor }]}>
        <IconComponent size={18} color={config.color} strokeWidth={2} />
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.title,
              !notification.is_read && styles.titleUnread,
              notification.is_high_priority && !notification.is_read && styles.titleHighPriority,
            ]}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          <Text style={styles.time}>
            {formatNotificationTime(notification.timestamp)}
          </Text>
        </View>

        <Text style={styles.message} numberOfLines={2}>
          {notification.message}
        </Text>

        {notification.orderId && (
          <Text style={styles.orderId}>#{notification.orderId}</Text>
        )}
      </View>

      {!notification.is_read && (
        <View style={[styles.unreadDot, { backgroundColor: config.color }]} />
      )}
    </TouchableOpacity>
  );
}

export const NotificationItem = React.memo(NotificationItemComponent);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    gap: 12,
  },
  containerUnread: {
    backgroundColor: '#FAFBFC',
  },
  containerHighPriority: {
    backgroundColor: '#FFF8F3',
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginTop: 2,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    flex: 1,
  },
  titleUnread: {
    fontWeight: '600' as const,
    color: Colors.text,
  },
  titleHighPriority: {
    fontWeight: '700' as const,
  },
  time: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '400' as const,
  },
  message: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  orderId: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 18,
  },
});
