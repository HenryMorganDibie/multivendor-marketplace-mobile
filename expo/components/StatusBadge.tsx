import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { OrderStatus } from '@/mocks/ordersData';

interface StatusBadgeProps {
  status: OrderStatus | string;
  label?: string;
}

function getStatusStyle(status: string): { bg: string; text: string } {
  switch (status) {
    case 'requested':
      return { bg: '#EFF6FF', text: '#2563EB' };
    case 'accepted':
      return { bg: '#FFF7ED', text: '#EA580C' };
    case 'confirmed':
      return { bg: '#F5F3FF', text: '#7C3AED' };
    case 'in_progress':
      return { bg: '#F0FDFA', text: '#0F766E' };
    case 'completed':
      return { bg: '#F0FDF4', text: '#16A34A' };
    case 'rejected':
      return { bg: '#FEF2F2', text: '#DC2626' };
    case 'cancelled':
      return { bg: '#F9FAFB', text: '#6B7280' };
    default:
      return { bg: '#F3F4F6', text: '#6B7280' };
  }
}

function getDefaultLabel(status: string): string {
  switch (status) {
    case 'requested': return 'REQUESTED';
    case 'accepted': return 'ACCEPTED';
    case 'confirmed': return 'CONFIRMED';
    case 'in_progress': return 'IN PROGRESS';
    case 'completed': return 'COMPLETED';
    case 'rejected': return 'REJECTED';
    case 'cancelled': return 'CANCELLED';
    default: return status.toUpperCase().replace(/_/g, ' ');
  }
}

function StatusBadge({ status, label }: StatusBadgeProps) {
  const style = getStatusStyle(status);
  const displayLabel = label ?? getDefaultLabel(status);

  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]}>
      <Text style={[styles.text, { color: style.text }]}>
        {displayLabel}
      </Text>
    </View>
  );
}

export default React.memo(StatusBadge);

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'flex-start' as const,
  },
  text: {
    fontSize: 10.5,
    fontWeight: '700' as const,
    letterSpacing: 0.6,
  },
});
