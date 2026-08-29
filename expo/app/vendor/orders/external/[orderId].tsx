import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Platform,
} from 'react-native';
import { Alert } from '@/utils/alert';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import {
  Package,
  Truck,
  MapPin,
  Send,
  Copy,
  CheckCircle,
  CircleCheck,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '@/constants/colors';
import { useExternalOrders, type ExternalOrder } from '@/contexts/ExternalOrdersContext';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';
import { useVendor } from '@/contexts/VendorContext';
import { buildDetailedShareMessage } from '@/utils/externalOrderShare';
import LaektivaModal from '@/components/LaektivaModal';
import OrderHeader from '@/features/orders/components/OrderHeader';
import OrderItemsSection from '@/features/orders/components/OrderItemsSection';
import type { GenericOrderItem } from '@/features/orders/components/OrderItemsSection';

const PAYMENT_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  payment_received: { label: 'Paid', color: '#16A34A', bg: '#F0FDF4' },
  payment_pending: { label: 'Payment Pending', color: '#DC2626', bg: '#FEF2F2' },
  partially_received: { label: 'Partial Payment', color: '#EA580C', bg: '#FFF7ED' },
};

export default function ExternalOrderDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.orderId as string;
  const { externalOrders, updateExternalOrder, deleteExternalOrder } = useExternalOrders();
  const [copySuccess, setCopySuccess] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);

  const { vendor } = useVendor();
  const vendorCurrency = (vendor.currency as Currency) || 'NGN';

  const order = useMemo<ExternalOrder | undefined>(() => {
    return externalOrders.find(o => o.id === orderId);
  }, [externalOrders, orderId]);

  if (!order) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <OrderHeader onBack={() => router.back()} title="External Order" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>This order is no longer available.</Text>
        </View>
      </View>
    );
  }

  const paymentInfo = PAYMENT_STATUS_MAP[order.paymentStatus] ?? PAYMENT_STATUS_MAP.payment_pending;

  const amountPaid = order.paymentStatus === 'payment_received'
    ? order.total
    : (order.amountReceived ?? 0);

  const balance = order.total - amountPaid;
  const isPaid = order.paymentStatus === 'payment_received';

  const totalItemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  const genericItems: GenericOrderItem[] = order.items.map(item => ({
    id: item.id,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
  }));

  const handleCopyOrderId = async () => {
    try {
      await Clipboard.setStringAsync(order.externalOrderId);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      console.log('Copied external order ID:', order.externalOrderId);
    } catch {
      Alert.alert('Error', 'Failed to copy Order ID');
    }
  };

  const handleMarkPaid = async () => {
    try {
      await updateExternalOrder(order.id, {
        paymentStatus: 'payment_received',
        amountReceived: order.total,
      });
      setShowMarkPaidModal(false);
      console.log('External order marked as paid:', order.id);
    } catch (error) {
      console.error('Error marking order as paid:', error);
      Alert.alert('Error', 'Failed to update payment status.');
    }
  };

  const handleShowMarkPaid = () => {
    setShowMarkPaidModal(true);
  };

  const handleCancelOrder = async () => {
    try {
      await deleteExternalOrder(order.id);
      setShowCancelModal(false);
      console.log('External order cancelled/deleted:', order.id);
      router.back();
    } catch (error) {
      console.error('Error cancelling external order:', error);
      Alert.alert('Error', 'Failed to cancel the order.');
    }
  };

  const handleEditOrder = () => {
    console.log('Edit external order:', order.id);
    router.push(`/vendor/orders/edit-external/${order.id}` as any);
  };

  const handleSendToCustomer = async () => {
    try {
      const fulfillmentDisplay = order.fulfillmentTime
        ? `${formatScheduledDate(order.fulfillmentDate)} at ${order.fulfillmentTime}`
        : formatScheduledDate(order.fulfillmentDate);

      const message = buildDetailedShareMessage(
        order.vendorName,
        order.externalOrderId,
        formatPriceWithCommas(order.total, vendorCurrency),
        fulfillmentDisplay,
        order.externalOrderId,
        order.shareToken,
      );

      if (Platform.OS === 'web') {
        await Clipboard.setStringAsync(message);
        Alert.alert('Copied', 'Order details copied to clipboard. Share via your preferred messaging app.');
      } else {
        await Share.share({
          message,
          title: `Order from ${order.vendorName}`,
        });
      }
      console.log('Sent order to customer:', order.id);
    } catch (error) {
      console.error('Error sending to customer:', error);
    }
  };

  const hasCustomerName = order.customerName && order.customerName !== 'Walk-in customer' && order.customerName.trim() !== '';

  const markPaidModalMessage = order.paymentStatus === 'partially_received' && order.amountReceived != null
    ? `Remaining balance: ${formatPriceWithCommas(order.total - order.amountReceived, vendorCurrency)}`
    : `Confirm that payment of ${formatPriceWithCommas(order.total, vendorCurrency)} has been received for this order.`;

  const markPaidModalTitle = order.paymentStatus === 'partially_received'
    ? 'Mark this order as fully paid?'
    : 'Mark as Paid?';

  const editButton = (
    <TouchableOpacity onPress={handleEditOrder} style={styles.headerEditBtn} activeOpacity={0.7}>
      <Text style={styles.headerEditText}>Edit</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <OrderHeader
        onBack={() => router.back()}
        title="External Order"
        rightAction={editButton}
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>

          <View style={styles.section}>
            <View style={styles.customerCard}>
              {hasCustomerName && (
                <Text style={styles.customerName}>{order.customerName}</Text>
              )}

              <View style={[styles.statusChip, { backgroundColor: Colors.primary }]}>
                <Text style={[styles.statusChipText, { color: Colors.white }]}>External Order</Text>
              </View>

              <View style={styles.orderIdRow}>
                <Text style={styles.orderIdText}>{order.externalOrderId}</Text>
                <TouchableOpacity
                  onPress={handleCopyOrderId}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Copy size={14} color={Colors.textMuted} strokeWidth={2} />
                </TouchableOpacity>
                {copySuccess && <Text style={styles.copiedText}>Copied!</Text>}
              </View>

              <View style={styles.paymentBadgeRow}>
                <View style={[styles.paymentBadge, { backgroundColor: paymentInfo.bg }]}>
                  <Text style={[styles.paymentBadgeText, { color: paymentInfo.color }]}>
                    {paymentInfo.label}
                  </Text>
                </View>
              </View>

              {order.externalReference && (
                <Text style={styles.sourceText}>{order.externalReference}</Text>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fulfillment</Text>
            <View style={styles.fulfillmentCard}>
              <View style={styles.fulfillmentRow}>
                {order.fulfillmentType === 'Delivery' ? (
                  <Truck size={20} color={Colors.text} strokeWidth={2} />
                ) : (
                  <Package size={20} color={Colors.text} strokeWidth={2} />
                )}
                <Text style={styles.fulfillmentType}>{order.fulfillmentType}</Text>
              </View>
              <Text style={styles.requestedDateTime}>
                {formatScheduledDate(order.fulfillmentDate)}
                {order.fulfillmentTime ? ` • ${order.fulfillmentTime}` : ''}
              </Text>
              {order.address && (
                <View style={styles.addressRow}>
                  <MapPin size={14} color={Colors.textMuted} />
                  <Text style={styles.addressText}>{order.address}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <OrderItemsSection
              items={genericItems}
              totalItemCount={totalItemCount}
              navigateToItem={false}
            />
          </View>

          {order.notes ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Note</Text>
              <View style={styles.noteCard}>
                <Text style={styles.noteText}>{order.notes}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Summary</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>{formatPriceWithCommas(order.subtotal, vendorCurrency)}</Text>
              </View>
              {(order.deliveryFee ?? 0) > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery Fee</Text>
                  <Text style={styles.summaryValue}>+{formatPriceWithCommas(order.deliveryFee!, vendorCurrency)}</Text>
                </View>
              )}
              {(order.serviceFee ?? 0) > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Service Fee</Text>
                  <Text style={styles.summaryValue}>+{formatPriceWithCommas(order.serviceFee!, vendorCurrency)}</Text>
                </View>
              )}
              {(order.discountAmount ?? 0) > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: Colors.success }]}>Discount</Text>
                  <Text style={[styles.summaryValue, { color: Colors.success }]}>
                    -{formatPriceWithCommas(order.discountAmount!, vendorCurrency)}
                  </Text>
                </View>
              )}
              {order.tax > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    Tax{order.taxPercentage ? ` (${order.taxPercentage}%)` : ''}
                  </Text>
                  <Text style={styles.summaryValue}>+{formatPriceWithCommas(order.tax, vendorCurrency)}</Text>
                </View>
              )}
              <View style={[styles.summaryRow, styles.summaryRowTotal]}>
                <Text style={styles.summaryLabelTotal}>Total</Text>
                <Text style={styles.summaryValueTotal}>{formatPriceWithCommas(order.total, vendorCurrency)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment</Text>
            <View style={styles.paymentCard}>
              {isPaid && (
                <View style={styles.paymentConfirmedBanner}>
                  <CircleCheck size={20} color="#16A34A" strokeWidth={2.5} />
                  <Text style={styles.paymentConfirmedText}>Payment received</Text>
                </View>
              )}

              {(amountPaid > 0) && (
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Total received</Text>
                  <Text style={styles.paymentValuePaid}>
                    {formatPriceWithCommas(amountPaid, vendorCurrency)}
                  </Text>
                </View>
              )}

              {!isPaid && balance > 0 && (
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabelDue}>Balance due</Text>
                  <Text style={styles.paymentValueDue}>
                    {formatPriceWithCommas(balance, vendorCurrency)}
                  </Text>
                </View>
              )}

              {!isPaid && (
                <TouchableOpacity
                  style={styles.markPaidButton}
                  onPress={handleShowMarkPaid}
                  activeOpacity={0.7}
                >
                  <CheckCircle size={18} color={Colors.white} strokeWidth={2.5} />
                  <Text style={styles.markPaidButtonText}>Mark Paid</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.bottomButtonsRow}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setShowCancelModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSendToCustomer}
            activeOpacity={0.8}
          >
            <Send size={16} color={Colors.white} strokeWidth={2} />
            <Text style={styles.sendButtonText}>Send Order</Text>
          </TouchableOpacity>
        </View>
      </View>

      <LaektivaModal
        visible={showMarkPaidModal}
        title={markPaidModalTitle}
        message={markPaidModalMessage}
        primaryButton={{
          label: 'Mark Paid',
          onPress: handleMarkPaid,
        }}
        secondaryButton={{
          label: 'Cancel',
          onPress: () => setShowMarkPaidModal(false),
          variant: 'text',
        }}
        onRequestClose={() => setShowMarkPaidModal(false)}
      />

      <LaektivaModal
        visible={showCancelModal}
        title="Cancel this order?"
        message="This external order will be permanently removed."
        primaryButton={{
          label: 'Cancel Order',
          onPress: handleCancelOrder,
        }}
        secondaryButton={{
          label: 'Keep Order',
          onPress: () => setShowCancelModal(false),
          variant: 'text',
        }}
        onRequestClose={() => setShowCancelModal(false)}
      />
    </View>
  );
}

function formatScheduledDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollView: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 120 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  errorContainer: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  errorText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  headerEditBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerEditText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.primary,
  },

  customerCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16 },
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
  copiedText: { fontSize: 12, color: Colors.success },
  paymentBadgeRow: { marginBottom: 8 },
  paymentBadge: {
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  paymentBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  sourceText: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
  },

  fulfillmentCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16 },
  fulfillmentRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, marginBottom: 8 },
  fulfillmentType: { fontSize: 17, fontWeight: '600' as const, color: Colors.text },
  requestedDateTime: { fontSize: 15, color: Colors.textMuted },
  addressRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 8,
  },
  addressText: { fontSize: 14, color: Colors.textMuted, flex: 1 },

  noteCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16 },
  noteText: { fontSize: 15, color: Colors.textMuted, lineHeight: 22 },

  summaryCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16 },
  summaryRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  summaryRowTotal: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginBottom: 0,
  },
  summaryLabel: { fontSize: 16, color: Colors.textMuted },
  summaryValue: { fontSize: 16, fontWeight: '500' as const, color: Colors.text },
  summaryLabelTotal: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  summaryValueTotal: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },

  paymentCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16 },
  paymentConfirmedBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  paymentConfirmedText: { fontSize: 15, fontWeight: '600' as const, color: '#16A34A' },
  paymentRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  paymentLabel: { fontSize: 16, color: Colors.textMuted },
  paymentLabelDue: { fontSize: 17, fontWeight: '600' as const, color: Colors.text },
  paymentValuePaid: { fontSize: 16, fontWeight: '600' as const, color: '#16A34A' },
  paymentValueDue: { fontSize: 16, fontWeight: '700' as const, color: Colors.error },
  markPaidButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#16A34A',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
  },
  markPaidButtonText: { fontSize: 15, fontWeight: '700' as const, color: Colors.white },

  bottomBar: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: 34,
  },
  bottomButtonsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.background,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  sendButton: {
    flex: 2,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
