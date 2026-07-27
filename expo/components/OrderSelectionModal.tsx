import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatVendorOrderId } from '@/utils/formatOrderId';
import { formatCustomerNameFromFull } from '@/utils/formatCustomerName';
import { Colors } from '@/constants/colors';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';

interface Order {
  id: string;
  publicOrderId: string;
  orderDate: string;
  status: string;
  total: number;
  customerName?: string;
}

interface OrderSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectOrder: (orderId: string) => void;
  orders: Order[];
  title: string;
  description: string;
}

export default function OrderSelectionModal({
  visible,
  onClose,
  onSelectOrder,
  orders,
  title,
  description,
}: OrderSelectionModalProps) {
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return { color: Colors.success, backgroundColor: Colors.successLight };
      case 'READY':
        return { color: Colors.primary, backgroundColor: Colors.warningLight };
      case 'ORDER_REQUESTED':
        return { color: Colors.textSecondary, backgroundColor: Colors.surface };
      default:
        return { color: Colors.primary, backgroundColor: Colors.warningLight };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'Completed';
      case 'READY':
        return 'Ready';
      case 'ORDER_REQUESTED':
        return 'Order Requested';
      case 'CONFIRMED':
        return 'Confirmed';
      default:
        return status;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.descriptionContainer}>
          <Text style={styles.description}>{description}</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {orders.map((order) => {
            const statusStyle = getStatusStyle(order.status);
            return (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                onPress={() => {
                  onSelectOrder(order.id);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.orderHeader}>
                  <Text style={styles.orderId}>
                    {formatVendorOrderId(order.publicOrderId)}
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: statusStyle.backgroundColor },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: statusStyle.color }]}>
                      {getStatusLabel(order.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.orderDetails}>
                  <Text style={styles.orderDate}>
                    {new Date(order.orderDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                  {order.customerName && (
                    <Text style={styles.customerName}>
                      {formatCustomerNameFromFull(order.customerName)}
                    </Text>
                  )}
                </View>

                <Text style={styles.orderTotal}>{formatPriceWithCommas(order.total, (mockVendor.currency as Currency) || 'NGN')}</Text>
              </TouchableOpacity>
            );
          })}

          {orders.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No orders available</Text>
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerSpacer: {
    width: 60,
  },
  closeText: {
    fontSize: 16,
    color: Colors.charcoal,
    fontWeight: '600' as const,
  },
  title: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  descriptionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  orderHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 12,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  orderDetails: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 8,
  },
  orderDate: {
    fontSize: 14,
    color: Colors.textSecondaryOnSurface,
  },
  customerName: {
    fontSize: 14,
    color: Colors.textSecondaryOnSurface,
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center' as const,
  },
  emptyStateText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  bottomSpacer: {
    height: 20,
  },
});
