import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  ShoppingBag,
  MessageCircle,
  Headphones,
  CreditCard,
  CheckCircle,
  XCircle,
  Package,
  Bell,
  Clock,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { CustomerNotificationType } from '@/contexts/CustomerNotificationContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationCategory =
  | 'order'
  | 'payment'
  | 'message'
  | 'support'
  | 'verification'
  | 'account'
  | 'general';

export interface NotificationItemData {
  id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: string;
  is_read: boolean;
  is_high_priority: boolean;
  orderId?: string;
  /** Optional extras used by the screens for routing + icon precision */
  _vendorId?: string;
  _domain?: string;
  _type?: string;
}

export interface NotificationSection {
  title: string;
  data: NotificationItemData[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map a raw notification type (customer OR vendor) to a display category. */
export function mapNotificationType(type: CustomerNotificationType | string): NotificationCategory {
  switch (type) {
    case 'order_sent':
    case 'order_accepted':
    case 'order_rejected':
    case 'order_ready':
    case 'pickup_instructions':
    case 'new_order':
    case 'customer_cancelled_order':
    case 'order_expired':
      return 'order';
    case 'payment_confirmed':
    case 'partial_payment_confirmed':
      return 'payment';
    case 'new_vendor_message':
    case 'new_customer_message':
      return 'message';
    case 'new_support_message':
      return 'support';
    case 'verification_requested':
    case 'verification_approved':
    case 'verification_rejected':
      return 'verification';
    case 'account_warning':
    case 'account_restriction':
      return 'account';
    default:
      return 'general';
  }
}

/** Returns true for time-sensitive / attention-critical notification types. */
export function isHighPriority(type: CustomerNotificationType | string): boolean {
  return (
    type === 'order_accepted' ||
    type === 'order_rejected' ||
    type === 'order_ready' ||
    type === 'payment_confirmed' ||
    type === 'partial_payment_confirmed' ||
    type === 'new_order' ||
    type === 'customer_cancelled_order' ||
    type === 'order_expired' ||
    type === 'verification_rejected' ||
    type === 'account_warning' ||
    type === 'account_restriction'
  );
}

/**
 * Groups a flat list of notifications into sections keyed by relative date label.
 * Returns an array compatible with React Native's SectionList.
 */
export function groupNotificationsByDate(
  notifications: NotificationItemData[]
): NotificationSection[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const startOfWeek = startOfToday - 6 * 86_400_000;

  const buckets: Record<string, NotificationItemData[]> = {
    Today: [],
    Yesterday: [],
    'This week': [],
    Earlier: [],
  };

  for (const n of notifications) {
    const ms = new Date(n.timestamp).getTime();
    if (ms >= startOfToday) {
      buckets['Today'].push(n);
    } else if (ms >= startOfYesterday) {
      buckets['Yesterday'].push(n);
    } else if (ms >= startOfWeek) {
      buckets['This week'].push(n);
    } else {
      buckets['Earlier'].push(n);
    }
  }

  return Object.entries(buckets)
    .filter(([, data]) => data.length > 0)
    .map(([title, data]) => ({ title, data }));
}

// ─── Icon + chip meta ──────────────────────────────────────────────────────────

const VERIFICATION_BG = '#EAF1FF';
const VERIFICATION_ACCENT = '#2F6BFF';
const SUPPORT_BG = '#F0EDFE';
const SUPPORT_ACCENT = '#7C63F5';

interface CategoryMeta {
  icon: React.ReactNode;
  bg: string;
  accent: string;
  /** Short chip label shown on the card; null hides the category chip. */
  label: string | null;
}

function getCategoryMeta(category: NotificationCategory, type?: string): CategoryMeta {
  switch (category) {
    case 'order': {
      let icon: React.ReactNode = <ShoppingBag size={18} color={Colors.primary} strokeWidth={2} />;
      let bg = Colors.primaryTint;
      let accent = Colors.primary;
      if (type === 'order_accepted') {
        icon = <CheckCircle size={18} color={Colors.success} strokeWidth={2} />;
        bg = Colors.successLight;
        accent = Colors.success;
      } else if (type === 'order_rejected' || type === 'customer_cancelled_order') {
        icon = <XCircle size={18} color={Colors.error} strokeWidth={2} />;
        bg = Colors.errorLight;
        accent = Colors.error;
      } else if (type === 'order_expired') {
        icon = <Clock size={18} color={Colors.textTertiary} strokeWidth={2} />;
        bg = Colors.surface;
        accent = Colors.textTertiary;
      } else if (type === 'order_ready' || type === 'pickup_instructions') {
        icon = <Package size={18} color={Colors.primary} strokeWidth={2} />;
      }
      return { icon, bg, accent, label: 'Order' };
    }
    case 'payment':
      return {
        icon: <CreditCard size={18} color={Colors.success} strokeWidth={2} />,
        bg: Colors.successLight,
        accent: Colors.success,
        label: 'Payment',
      };
    case 'message':
      return {
        icon: <MessageCircle size={18} color={Colors.primary} strokeWidth={2} />,
        bg: Colors.primaryTint,
        accent: Colors.primary,
        label: 'Message',
      };
    case 'support':
      return {
        icon: <Headphones size={18} color={SUPPORT_ACCENT} strokeWidth={2} />,
        bg: SUPPORT_BG,
        accent: SUPPORT_ACCENT,
        label: 'Support',
      };
    case 'verification': {
      let icon: React.ReactNode = <ShieldCheck size={18} color={VERIFICATION_ACCENT} strokeWidth={2} />;
      let bg = VERIFICATION_BG;
      let accent = VERIFICATION_ACCENT;
      if (type === 'verification_approved') {
        icon = <CheckCircle size={18} color={Colors.success} strokeWidth={2} />;
        bg = Colors.successLight;
        accent = Colors.success;
      } else if (type === 'verification_rejected') {
        icon = <XCircle size={18} color={Colors.error} strokeWidth={2} />;
        bg = Colors.errorLight;
        accent = Colors.error;
      }
      return { icon, bg, accent, label: 'Verification' };
    }
    case 'account':
      return {
        icon: <AlertTriangle size={18} color={Colors.warning} strokeWidth={2} />,
        bg: Colors.warningLight,
        accent: Colors.warning,
        label: 'Account',
      };
    default:
      return {
        icon: <Bell size={18} color={Colors.textSecondary} strokeWidth={2} />,
        bg: Colors.surface,
        accent: Colors.textSecondary,
        label: null,
      };
  }
}

/** Format ISO timestamp into a short human-readable string. */
function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// ─── Chip ───────────────────────────────────────────────────────────────────

interface ChipProps {
  label: string;
  color: string;
  bg: string;
}

const Chip = memo(function Chip({ label, color, bg }: ChipProps) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});

// ─── Component ────────────────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: NotificationItemData;
  onPress?: (notification: NotificationItemData) => void;
}

export const NotificationItem = memo(function NotificationItem({
  notification,
  onPress,
}: NotificationItemProps) {
  const { icon, bg, accent, label } = getCategoryMeta(notification.category, notification._type);
  const isUnread = !notification.is_read;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress?.(notification)}
      style={[styles.card, isUnread ? styles.cardUnread : styles.cardRead]}
      accessibilityRole="button"
      accessibilityLabel={notification.title}
    >
      <View style={[styles.iconCircle, { backgroundColor: bg }]}>{icon}</View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.title, isUnread && styles.titleUnread]}
            numberOfLines={2}
          >
            {notification.title}
          </Text>
          <View style={styles.metaRight}>
            <Text style={styles.time}>{formatTime(notification.timestamp)}</Text>
            {isUnread && <View style={styles.dot} />}
          </View>
        </View>

        <Text style={styles.message} numberOfLines={3}>
          {notification.message}
        </Text>

        <View style={styles.chipsRow}>
          {label && <Chip label={label} color={accent} bg={`${bg}`} />}
          {notification.orderId && (
            <Chip
              label={`Order ${notification.orderId}`}
              color={Colors.textSecondary}
              bg={Colors.surface}
            />
          )}
          {notification.is_high_priority && (
            <Chip label="High priority" color={Colors.error} bg={Colors.errorLight} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  cardRead: {
    backgroundColor: Colors.white,
    borderColor: Colors.border,
  },
  cardUnread: {
    backgroundColor: '#FFF9F4',
    borderColor: 'rgba(255,122,40,0.20)',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 20,
  },
  titleUnread: {
    fontWeight: '700' as const,
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingTop: 2,
    flexShrink: 0,
  },
  time: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  message: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: 200,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  },
});
