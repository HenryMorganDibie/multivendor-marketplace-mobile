import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MessageSquare, Copy, Lock } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { Order } from '@/mocks/ordersData';
import { getOrderStatusColor, getVendorOrderStatusLabel } from '@/features/orders/selectors/orderStatusSelectors';
import { formatVendorOrderId } from '@/utils/formatOrderId';
import { formatVendorDisplayName } from '@/utils/vendorDisplayHelpers';
import { isExternalOrder, isOrderRejected } from '@/utils/orderHelpers';

interface OrderCustomerCardProps {
  order: Order;
  openedFromChat: boolean;
  onCopyOrderId: () => void;
  onOpenChat: () => void;
}

export default function OrderCustomerCard({
  order,
  openedFromChat,
  onCopyOrderId,
  onOpenChat,
}: OrderCustomerCardProps) {
  const orderStatus = order.status;
  const isExternal = isExternalOrder(order);
  const isRejected = isOrderRejected(orderStatus);
  const orderChatAvailable = !['requested', 'rejected', 'cancelled', 'expired'].includes(orderStatus);

  const statusColors = getOrderStatusColor(orderStatus);
  const badgeColor = { bg: statusColors.background, text: statusColors.text };

  const CANCELLATION_LABELS: Record<string, string> = {
    item_unavailable: 'Item unavailable',
    ingredient_unavailable: 'Ingredient/material unavailable',
    service_unavailable: 'Service unavailable at requested time',
    overbooked: 'Overbooked / capacity reached',
    staff_unavailable: 'Staff unavailable',
    incorrect_details: 'Incorrect order details',
    customer_requested: 'Customer requested cancellation',
    customer_no_payment: 'Customer did not complete payment',
    duplicate_order: 'Duplicate order',
    other: 'Other',
  };

  const cancellationDisplay = order.cancellationReasonCode
    ? (() => {
        const label = CANCELLATION_LABELS[order.cancellationReasonCode] ?? order.cancellationReasonCode;
        return order.cancellationReasonText ? `${label}: ${order.cancellationReasonText}` : label;
      })()
    : order.cancellationReason;

  return (
    <View style={styles.infoCard} testID="order-customer-card">
      <Text style={styles.customerName}>
        {formatVendorDisplayName(order.customerName)}
      </Text>

      {isExternal ? (
        <View style={[styles.statusChip, { backgroundColor: Colors.primary }]}>
          <Text style={[styles.statusChipText, { color: Colors.white }]}>External Order</Text>
        </View>
      ) : (
        <View style={[styles.statusChip, { backgroundColor: badgeColor.bg }]}>
          <Text style={[styles.statusChipText, { color: badgeColor.text }]}>
            {getVendorOrderStatusLabel(orderStatus)}
          </Text>
        </View>
      )}

      <View style={styles.orderIdRow}>
        <Text style={styles.orderIdText}>{formatVendorOrderId(order.publicOrderId)}</Text>
        <TouchableOpacity
          onPress={onCopyOrderId}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          testID="copy-order-id"
        >
          <Copy size={14} color={Colors.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <Text style={styles.orderPlacedDate}>
        {new Date(order.orderDate).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}
      </Text>

      {!openedFromChat && !isExternal && orderChatAvailable && (
        <TouchableOpacity
          style={styles.openChatButtonInline}
          onPress={onOpenChat}
          activeOpacity={0.7}
          testID="open-chat-button"
        >
          <MessageSquare size={18} color={Colors.text} strokeWidth={2} />
          <Text style={styles.openChatButtonText}>Open order chat</Text>
        </TouchableOpacity>
      )}
      {!openedFromChat && !isExternal && orderStatus === 'requested' && (
        <View style={styles.chatLockedNotice}>
          <Lock size={14} color={Colors.textMuted} strokeWidth={2.5} />
          <Text style={styles.chatLockedNoticeText}>Order chat unlocks after you accept</Text>
        </View>
      )}

      {(order.rejectionReason || order.cancellationReason || order.cancellationReasonCode) && (
        <View style={styles.reasonCard}>
          <Text style={styles.reasonLabel}>
            {isRejected ? 'Rejection reason:' : 'Cancellation reason:'}
          </Text>
          <Text style={styles.reasonText}>
            {isRejected ? order.rejectionReason : cancellationDisplay}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  infoCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16 },
  customerName: { fontSize: 20, fontWeight: '600' as const, color: Colors.text, marginBottom: 8 },
  statusChip: {
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusChipText: { fontSize: 12, fontWeight: '600' as const },
  orderIdRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 8,
  },
  orderIdText: { fontSize: 14, color: Colors.textMuted },
  orderPlacedDate: { fontSize: 14, color: Colors.textMuted, marginBottom: 12 },
  openChatButtonInline: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  openChatButtonText: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  chatLockedNotice: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    borderLeftColor: Colors.textMuted,
  },
  chatLockedNoticeText: { fontSize: 13, color: Colors.textMuted },
  reasonCard: {
    backgroundColor: Colors.errorLight,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  reasonLabel: { fontSize: 12, fontWeight: '600' as const, color: Colors.error, marginBottom: 4 },
  reasonText: { fontSize: 14, color: Colors.text },
});
