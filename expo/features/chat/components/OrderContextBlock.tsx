import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Package, Truck, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { OrderContextData } from '@/mocks/chatData';
import { formatTime } from '@/features/chat/selectors/chatSelectors';

type Props = {
  orderContextData: OrderContextData;
  timestamp: string;
  role: 'customer' | 'vendor';
};

const formatOrderType = (type: string): string => {
  if (type === 'delivery') return 'Delivery';
  return 'Pickup';
};

const formatStatus = (status: string): { label: string; color: string; bgColor: string } => {
  switch (status) {
    case 'accepted':
      return { label: 'Accepted', color: '#FF8C42', bgColor: 'rgba(255,140,66,0.1)' };
    case 'confirmed':
      return { label: 'Confirmed', color: '#FF8C42', bgColor: 'rgba(255,140,66,0.1)' };
    case 'in_progress':
      return { label: 'In Progress', color: '#FF8C42', bgColor: 'rgba(255,140,66,0.1)' };
    case 'completed':
      return { label: 'Completed', color: '#22C55E', bgColor: '#F0FDF4' };
    default:
      return { label: 'Active', color: '#FF8C42', bgColor: 'rgba(255,140,66,0.1)' };
  }
};

export const OrderContextBlock = React.memo(({ orderContextData, timestamp, role }: Props) => {
  const { orderId, publicOrderId, orderStatus, orderType } = orderContextData;
  const statusInfo = formatStatus(orderStatus);
  const isPickup = orderType === 'pickup';
  const displayId = publicOrderId || orderId.slice(0, 8).toUpperCase();

  const handlePress = () => {
    if (role === 'vendor') {
      router.push(`/vendor/orders/${orderId}` as any);
    } else {
      router.push({ pathname: '/order/[id]' as any, params: { id: orderId, source: 'chat' } });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerLabel}>Order started</Text>
        <View style={styles.dividerLine} />
      </View>
      <TouchableOpacity
        style={styles.card}
        onPress={handlePress}
        activeOpacity={0.7}
        testID={`order-context-block-${orderId}`}
      >
        <View style={styles.iconContainer}>
          {isPickup ? (
            <Package size={18} color={Colors.primary} />
          ) : (
            <Truck size={18} color={Colors.primary} />
          )}
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>Order #{displayId.toUpperCase()}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.typeText}>{formatOrderType(orderType)}</Text>
            <View style={styles.dot} />
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
              <Text style={[styles.statusText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
          </View>
        </View>
        <ChevronRight size={16} color={Colors.textMuted} />
      </TouchableOpacity>
      <Text style={styles.timestamp}>{formatTime(timestamp)}</Text>
    </View>
  );
});

OrderContextBlock.displayName = 'OrderContextBlock';

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,140,66,0.25)',
  },
  dividerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,140,66,0.2)',
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,140,66,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
