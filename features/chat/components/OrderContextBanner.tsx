import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Package, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';
import { formatScheduledDate, formatOrderStatusLabel } from '@/features/chat/selectors/chatSelectors';
import { ChatMessage } from '@/mocks/chatData';

type OrderItem = {
  id: string;
  publicOrderId?: string;
  status: string;
  completedAt?: string;
  fulfillmentType?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  items: Array<{ quantity: number }>;
  total: number;
};

type Props = {
  pinnedOrders: OrderItem[];
  existingPaymentRequest: ChatMessage | null;
};

const PinnedCard = ({
  order,
  isScrollItem,
  existingPaymentRequest,
}: {
  order: OrderItem;
  isScrollItem?: boolean;
  existingPaymentRequest: ChatMessage | null;
}) => {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const displayOrderId = (order.publicOrderId || order.id).toUpperCase();
  let fulfillmentLine = order.fulfillmentType || 'Pickup';
  if (order.scheduledDate) fulfillmentLine += ` • ${formatScheduledDate(order.scheduledDate)}`;
  if (order.scheduledTime) fulfillmentLine += ` • ${order.scheduledTime}`;

  const hasPaymentPending = existingPaymentRequest && existingPaymentRequest.paymentRequestData;
  const orderStatusInfo = formatOrderStatusLabel(order.status);

  return (
    <TouchableOpacity
      style={[styles.pinnedCard, isScrollItem && styles.pinnedCardScrollItem]}
      onPress={() => router.push(`/vendor/orders/${order.id}` as any)}
      activeOpacity={0.8}
      testID={`pinned-order-card-${order.id}`}
    >
      <View style={styles.pinnedAccent} />
      <View style={styles.pinnedContent}>
        <View style={styles.pinnedTopRow}>
          <Package size={13} color={Colors.primary} />
          <Text style={styles.pinnedOrderId} numberOfLines={1}>
            Order #{displayOrderId}
          </Text>
        </View>
        <Text style={styles.pinnedFulfillment} numberOfLines={1}>
          {fulfillmentLine}
        </Text>
        <View style={styles.pinnedBottomRow}>
          <Text style={styles.pinnedMeta}>
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </Text>
          <Text style={styles.pinnedDot}>·</Text>
          <Text style={styles.pinnedTotal}>
            {formatPriceWithCommas(order.total, (mockVendor.currency as Currency) || 'NGN')}
          </Text>
        </View>
        {hasPaymentPending ? (
          <View style={styles.pinnedStatusRow}>
            <View style={styles.paymentPendingBadge}>
              <View style={styles.paymentPendingDot} />
              <Text style={styles.paymentPendingText}>Payment Pending</Text>
            </View>
          </View>
        ) : (
          <View style={styles.pinnedStatusRow}>
            <View style={[styles.statusBadge, { backgroundColor: orderStatusInfo.bgColor }]}>
              <Text style={[styles.statusBadgeText, { color: orderStatusInfo.color }]}>
                {orderStatusInfo.label}
              </Text>
            </View>
          </View>
        )}
      </View>
      <ChevronRight size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
};

export const OrderContextBanner = React.memo(({ pinnedOrders, existingPaymentRequest }: Props) => {
  if (pinnedOrders.length === 0) return null;

  if (pinnedOrders.length === 1) {
    return (
      <PinnedCard
        order={pinnedOrders[0]}
        existingPaymentRequest={existingPaymentRequest}
      />
    );
  }

  return (
    <View style={styles.scrollSection}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
      >
        {pinnedOrders.map((o) => (
          <PinnedCard
            key={o.id}
            order={o}
            isScrollItem
            existingPaymentRequest={existingPaymentRequest}
          />
        ))}
      </ScrollView>
    </View>
  );
});

OrderContextBanner.displayName = 'OrderContextBanner';

const styles = StyleSheet.create({
  pinnedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  pinnedCardScrollItem: {
    width: 268,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginRight: 0,
  },
  scrollSection: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 6,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  pinnedAccent: {
    width: 3,
    height: 44,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  pinnedContent: {
    flex: 1,
    gap: 2,
  },
  pinnedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pinnedOrderId: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  pinnedFulfillment: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginLeft: 18,
  },
  pinnedBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 18,
  },
  pinnedMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  pinnedDot: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  pinnedTotal: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  pinnedStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 18,
    marginTop: 2,
  },
  paymentPendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 5,
  },
  paymentPendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  paymentPendingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
