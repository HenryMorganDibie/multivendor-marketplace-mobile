import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Alert } from '@/utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Package,
  Truck,
  Check,
  X,
  MessageSquare,
  Copy,
  Lock,
  Receipt,
  ChevronDown,
  CircleDollarSign,
  CheckCircle2,

} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Share as ShareIcon } from 'lucide-react-native';
import LaektivaModal from '@/components/LaektivaModal';
import { formatVendorOrderId } from '@/utils/formatOrderId';
import { useExternalOrders } from '@/contexts/ExternalOrdersContext';
import { buildShareMessage } from '@/utils/externalOrderShare';
import { safeShare } from '@/utils/share';
import { getStatusColor, getVendorStatusLabel, getStatusPriorityOrder } from '@/constants/orderStatus';
import { useVendorAutoAccept } from '@/contexts/VendorAutoAcceptContext';
import { useVendorPickup } from '@/contexts/VendorPickupContext';
import { useAuditLog } from '@/contexts/AuditLogContext';
import { formatVendorDisplayName } from '@/utils/vendorDisplayHelpers';
import {
  canAcceptOrder,
  canCancelOrder,
  canMarkInProgress,

  shouldShowAdjustTotalButton,
  calculateTotalWithAdjustments,
  calculateOrderBalance,
  getTotalItemCount,
  isExternalOrder,
  isOrderCancelled,
  isOrderRejected,
} from '@/utils/orderHelpers';
import { formatRequestedDateTime } from '@/utils/orderDateFormatting';
import { validatePartialPaymentAmount, calculatePaymentUpdate } from '@/utils/paymentHelpers';
import { useOrders } from '@/contexts/OrdersContext';
import {
  useAcceptOrder,
  useRejectOrder,
  useMarkOrderPaid,
  useMarkInProgress,
  useCompleteOrder,
  useCancelOrder,
} from '@/data/hooks';
import { getVendorEventMessage } from '@/utils/systemMessages';
import { formatPriceWithCommas, getCurrencySymbol, type Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';

const TIMELINE_STEPS = [
  { status: 'requested', label: 'Requested', description: 'Order received from customer' },
  { status: 'accepted', label: 'Accepted', description: 'You accepted the order' },
  { status: 'confirmed', label: 'Confirmed', description: 'Payment confirmed' },
  { status: 'in_progress', label: 'In Progress', description: 'Order being fulfilled' },
  { status: 'completed', label: 'Completed', description: 'Order completed' },
];

function OrderProgressTimeline({ status }: { status: string }) {
  const isTerminal = status === 'rejected' || status === 'cancelled' || status === 'expired';
  const currentPriority = getStatusPriorityOrder(status);

  return (
    <View style={timelineStyles.container}>
      {TIMELINE_STEPS.map((step, index) => {
        const stepPriority = getStatusPriorityOrder(step.status);
        const isDone = !isTerminal && stepPriority < currentPriority;
        const isCurrent = !isTerminal && step.status === status;
        void (isTerminal ? true : stepPriority > currentPriority);
        const isLast = index === TIMELINE_STEPS.length - 1;

        let dotColor = Colors.border;
        let dotBorderColor = Colors.border;
        let labelColor = Colors.textMuted;

        if (isDone) {
          dotColor = Colors.success;
          dotBorderColor = Colors.success;
          labelColor = Colors.textSecondary;
        } else if (isCurrent) {
          dotColor = Colors.primary;
          dotBorderColor = Colors.primary;
          labelColor = Colors.text;
        }

        return (
          <View key={step.status} style={timelineStyles.row}>
            <View style={timelineStyles.indicatorCol}>
              <View
                style={[
                  timelineStyles.dot,
                  { backgroundColor: isDone || isCurrent ? dotColor : Colors.background, borderColor: dotBorderColor },
                ]}
              >
                {isDone && <Check size={10} color={Colors.white} strokeWidth={3} />}
                {isCurrent && <View style={timelineStyles.dotInner} />}
              </View>
              {!isLast && (
                <View
                  style={[
                    timelineStyles.line,
                    { backgroundColor: isDone ? Colors.success : Colors.border },
                  ]}
                />
              )}
            </View>
            <View style={[timelineStyles.textCol, !isLast && timelineStyles.textColWithLine]}>
              <Text style={[timelineStyles.stepLabel, { color: labelColor, fontWeight: isCurrent ? '700' : '500' }]}>
                {step.label}
              </Text>
              <Text style={timelineStyles.stepDesc}>{step.description}</Text>
            </View>
          </View>
        );
      })}

      {isTerminal && (
        <View style={timelineStyles.terminalRow}>
          <View style={timelineStyles.indicatorCol}>
            <View style={[timelineStyles.dot, { backgroundColor: Colors.error, borderColor: Colors.error }]}>
              <X size={10} color={Colors.white} strokeWidth={3} />
            </View>
          </View>
          <View style={timelineStyles.textCol}>
            <Text style={[timelineStyles.stepLabel, { color: Colors.error, fontWeight: '700' }]}>
              {status === 'rejected' ? 'Rejected' : status === 'cancelled' ? 'Cancelled' : 'Expired'}
            </Text>
            <Text style={timelineStyles.stepDesc}>
              {status === 'rejected' ? 'Order was declined' : status === 'cancelled' ? 'Order was cancelled' : 'Order expired'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const timelineStyles = StyleSheet.create({
  container: { paddingLeft: 4 },
  row: { flexDirection: 'row' as const, alignItems: 'flex-start' as const },
  terminalRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, marginTop: 2 },
  indicatorCol: { alignItems: 'center' as const, width: 28 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.white,
  },
  line: { width: 2, flex: 1, minHeight: 24, marginVertical: 2 },
  textCol: { flex: 1, paddingLeft: 12, paddingBottom: 4 },
  textColWithLine: { paddingBottom: 16 },
  stepLabel: { fontSize: 14, color: Colors.text, marginBottom: 2 },
  stepDesc: { fontSize: 12, color: Colors.textMuted, lineHeight: 16 },
});

export default function VendorOrderDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.orderId as string;
  const openedFromChat = params.fromChat === 'true';

  const { getOrder, addVendorEvent } = useOrders();
  const order = getOrder(orderId);

  const acceptOrderMutation = useAcceptOrder();
  const rejectOrderMutation = useRejectOrder();
  const markOrderPaidMutation = useMarkOrderPaid();
  const markInProgressMutation = useMarkInProgress();
  const completeOrderMutation = useCompleteOrder();
  const cancelOrderMutation = useCancelOrder();

  const isProcessing =
    acceptOrderMutation.isPending ||
    rejectOrderMutation.isPending ||
    markOrderPaidMutation.isPending ||
    markInProgressMutation.isPending ||
    completeOrderMutation.isPending ||
    cancelOrderMutation.isPending;

  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showInProgressModal, setShowInProgressModal] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCancelDropdown, setShowCancelDropdown] = useState(false);
  const [cancelReasonCode, setCancelReasonCode] = useState('');
  const [cancelReasonText, setCancelReasonText] = useState('');

  const [customEventMessage, setCustomEventMessage] = useState('');
  const [showNotifyUpdateModal, setShowNotifyUpdateModal] = useState(false);
  const [notifyUpdateMode, setNotifyUpdateMode] = useState<'menu' | 'custom'>('menu');

  const [showUndoBanner, setShowUndoBanner] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoBannerOpacity = useRef(new Animated.Value(0)).current;

  const [showAdjustTotalModal, setShowAdjustTotalModal] = useState(false);
  const [adjustmentLabel, setAdjustmentLabel] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [appliedAdjustments, setAppliedAdjustments] = useState<{ label: string; amount: number }[]>([]);

  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState(false);
  const [paymentType, setPaymentType] = useState<'full' | 'partial' | null>(null);
  const [partialPaymentAmount, setPartialPaymentAmount] = useState('');
  const [partialAmountError, setPartialAmountError] = useState('');
  const [paymentHistory, setPaymentHistory] = useState<{ amount: number; timestamp: string }[]>([]);
  const [showPaymentNotRecordedModal, setShowPaymentNotRecordedModal] = useState(false);

  const { externalOrders } = useExternalOrders();

  const { autoAcceptEnabled } = useVendorAutoAccept();
  useVendorPickup();
  const { logEvent } = useAuditLog();

  React.useEffect(() => {
    if (order?.paymentHistory) {
      setPaymentHistory(order.paymentHistory);
    }
  }, [order?.paymentHistory]);

  if (!order) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <ChevronLeft size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Order details</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Order not found</Text>
        </View>
      </View>
    );
  }

  const orderStatus = order.status;
  const isExternal = isExternalOrder(order);

  const isInProgress = orderStatus === 'in_progress';
  const isCancelled = isOrderCancelled(orderStatus);
  const isRejected = isOrderRejected(orderStatus);
  const orderChatAvailable = !['requested', 'rejected', 'cancelled', 'expired'].includes(orderStatus);

  const showAcceptDecline = canAcceptOrder(orderStatus) && !autoAcceptEnabled;
  const showMarkInProgress = canMarkInProgress(orderStatus, isExternal);
  const showCancel = canCancelOrder(orderStatus) && !isExternal;


  const calculatedTotal = calculateTotalWithAdjustments(order.total, appliedAdjustments);
  const balanceDue = calculateOrderBalance(calculatedTotal, order.amountPaid || 0);
  const totalItemCount = getTotalItemCount(order.items);

  const requestedDateTime = formatRequestedDateTime(
    isExternal && 'fulfillmentDate' in order ? (order as any).fulfillmentDate : undefined,
    isExternal && 'fulfillmentTime' in order ? (order as any).fulfillmentTime : undefined,
    order.scheduledDate,
    order.scheduledTime,
    isExternal
  );

  const shouldShowAdjustButton = shouldShowAdjustTotalButton(orderStatus, isExternal, balanceDue);

  const handleAcceptOrder = () => setShowAcceptModal(true);
  const confirmAcceptOrder = () => {
    setShowAcceptModal(false);
    acceptOrderMutation.mutate(orderId, {
      onSuccess: () => {
        void logEvent({
          eventType: 'order_status_changed',
          orderId: order.id,
          vendorId: 'vendor_mock',
          customerId: order.customerId || 'customer_mock',
          previousState: orderStatus,
          newState: 'accepted',
        });
        setTimeout(() => router.back(), 600);
      },
      onError: () => Alert.alert('Error', 'Unable to accept order. Please try again.'),
    });
  };

  const handleDeclineOrder = () => setShowDeclineModal(true);
  const confirmDeclineOrder = () => {
    setShowDeclineModal(false);
    rejectOrderMutation.mutate({ orderId }, {
      onSuccess: () => {
        void logEvent({
          eventType: 'order_status_changed',
          orderId: order.id,
          vendorId: 'vendor_mock',
          customerId: order.customerId || 'customer_mock',
          previousState: orderStatus,
          newState: 'rejected',
        });
        setTimeout(() => router.back(), 600);
      },
      onError: () => Alert.alert('Error', 'Unable to decline order. Please try again.'),
    });
  };

  const handleMarkInProgress = () => {
    // Real orders carry the backend's payment-proof workflow state in
    // paymentState (mapOrderDoc.ts), not the amount-based paymentStatus
    // values external orders use — paymentStatus never holds
    // 'payment_received'/'partially_received' for a real order, so checking
    // it here always failed and blocked every real order from progressing.
    const isPaymentSufficient = isExternal
      ? order.paymentStatus === 'payment_received' || order.paymentStatus === 'partially_received'
      : order.paymentState === 'VENDOR_PAYMENT_CONFIRMED';
    if (!isPaymentSufficient) {
      setShowPaymentNotRecordedModal(true);
      return;
    }
    setShowInProgressModal(true);
  };
  const confirmMarkInProgress = () => {
    setShowInProgressModal(false);
    markInProgressMutation.mutate(orderId, {
      onSuccess: () => {
        void logEvent({
          eventType: 'order_status_changed',
          orderId: order.id,
          vendorId: 'vendor_mock',
          customerId: order.customerId || 'customer_mock',
          previousState: orderStatus,
          newState: 'in_progress',
        });
        setTimeout(() => router.back(), 600);
      },
      onError: () => Alert.alert('Error', 'Unable to mark in progress. Please try again.'),
    });
  };

  const handleMarkCompleted = () => setShowCompletedModal(true);
  const confirmMarkCompleted = () => {
    setShowCompletedModal(false);
    completeOrderMutation.mutate(orderId, {
      onSuccess: () => {
        void logEvent({
          eventType: 'order_status_changed',
          orderId: order.id,
          vendorId: 'vendor_mock',
          customerId: order.customerId || 'customer_mock',
          previousState: orderStatus,
          newState: 'completed',
        });
        setTimeout(() => router.back(), 600);
      },
      onError: () => Alert.alert('Error', 'Unable to complete order. Please try again.'),
    });
  };

  const CANCELLATION_REASONS = [
    { code: 'item_unavailable', label: 'Item unavailable' },
    { code: 'ingredient_unavailable', label: 'Ingredient/material unavailable' },
    { code: 'service_unavailable', label: 'Service unavailable at requested time' },
    { code: 'overbooked', label: 'Overbooked / capacity reached' },
    { code: 'staff_unavailable', label: 'Staff unavailable' },
    { code: 'incorrect_details', label: 'Incorrect order details' },
    { code: 'customer_requested', label: 'Customer requested cancellation' },
    { code: 'customer_no_payment', label: 'Customer did not complete payment' },
    { code: 'duplicate_order', label: 'Duplicate order' },
    { code: 'other', label: 'Other' },
  ];

  const handleCancelOrder = () => {
    setCancelReasonCode('');
    setCancelReasonText('');
    setShowCancelModal(true);
  };

  const confirmCancelOrder = () => {
    if (!cancelReasonCode) {
      Alert.alert('Reason required', 'Please select a reason for cancelling this order.');
      return;
    }
    if (cancelReasonCode === 'other' && !cancelReasonText.trim()) {
      Alert.alert('Details required', 'Please provide details for the cancellation reason.');
      return;
    }
    const reasonLabel = CANCELLATION_REASONS.find(r => r.code === cancelReasonCode)?.label ?? cancelReasonCode;
    const reason = cancelReasonCode === 'other' ? cancelReasonText.trim() : reasonLabel;
    const reasonText = cancelReasonCode === 'other' ? cancelReasonText.trim() : undefined;
    setShowCancelModal(false);
    cancelOrderMutation.mutate({ orderId, reason, reasonCode: cancelReasonCode, reasonText }, {
      onSuccess: () => {
        setCancelReasonCode('');
        setCancelReasonText('');
        void logEvent({
          eventType: 'order_status_changed',
          orderId: order.id,
          vendorId: 'vendor_mock',
          customerId: order.customerId || 'customer_mock',
          previousState: orderStatus,
          newState: 'cancelled',
        });
        setTimeout(() => router.back(), 600);
      },
      onError: () => Alert.alert('Error', 'Unable to cancel order. Please try again.'),
    });
  };

  const handleVendorEvent = useCallback((
    eventType: 'ready' | 'dispatched' | 'service_started' | 'custom_update',
    msg?: string
  ) => {
    const message = getVendorEventMessage(eventType, order.vendorName, msg);
    const success = addVendorEvent(orderId, {
      eventType: eventType,
      actor: { type: 'vendor', name: order.vendorName },
      message,
    });
    if (success) {
      console.log('[VendorOrders] Event sent:', eventType, message);
      if (eventType !== 'ready') {
        Alert.alert('Update sent', 'Customer has been notified.');
      }
    }
  }, [orderId, order.vendorName, addVendorEvent]);

  const handleNotifyReadyWithUndo = useCallback(() => {
    setShowUndoBanner(true);
    Animated.timing(undoBannerOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    undoTimerRef.current = setTimeout(() => {
      handleVendorEvent('ready');
      Animated.timing(undoBannerOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowUndoBanner(false));
    }, 5000);
  }, [handleVendorEvent, undoBannerOpacity]);

  const handleUndoNotifyReady = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    Animated.timing(undoBannerOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setShowUndoBanner(false));
  }, [undoBannerOpacity]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const handleCopyOrderId = async () => {
    try {
      await Clipboard.setStringAsync(order.publicOrderId);
      Alert.alert('Order ID copied', formatVendorOrderId(order.publicOrderId));
    } catch {
      Alert.alert('Error', 'Failed to copy Order ID');
    }
  };

  const handleOpenChat = () => {
    router.push({
      pathname: '/vendor/chats/[orderId]' as any,
      params: { orderId: order.id },
    });
  };

  const confirmPaymentReceived = () => {
    if (!paymentType) {
      Alert.alert('Selection Required', 'Please select whether you received full or partial payment.');
      return;
    }
    if (paymentType === 'partial') {
      const validation = validatePartialPaymentAmount(partialPaymentAmount, balanceDue);
      if (!validation.valid) {
        setPartialAmountError('Amount cannot exceed the outstanding balance.');
        return;
      }
    }
    setShowPaymentConfirmModal(false);
    const paymentUpdate = calculatePaymentUpdate(
      paymentType,
      partialPaymentAmount,
      balanceDue,
      order.amountPaid || 0,
      calculatedTotal
    );
    const timestamp = new Date().toISOString();
    const newRecord = { amount: paymentUpdate.amountReceived, timestamp };
    setPaymentHistory((prev) => [...prev, newRecord]);
    void logEvent({
      eventType: paymentType === 'full' ? 'full_payment_marked' : 'partial_payment_marked',
      orderId: order.id,
      vendorId: 'vendor_mock',
      customerId: order.customerId || 'customer_mock',
      metadata: {
        amountReceived: paymentUpdate.amountReceived / 100,
        totalPaid: paymentUpdate.newTotalPaid / 100,
        balanceDue: paymentUpdate.newBalanceDue / 100,
        timestamp,
      },
    });
    setTimeout(() => {
      router.back();
    }, 600);
  };

  const statusColors = getStatusColor(orderStatus);
  const badgeColor = { bg: statusColors.background, text: statusColors.text };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <ChevronLeft size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>

          <View style={[styles.section, { marginBottom: 0 }]}>
            <View style={styles.infoCard}>
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
                    {getVendorStatusLabel(orderStatus)}
                  </Text>
                </View>
              )}

              <View style={styles.orderIdRow}>
                <Text style={styles.orderIdText}>{formatVendorOrderId(order.publicOrderId)}</Text>
                <TouchableOpacity
                  onPress={handleCopyOrderId}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
                  onPress={handleOpenChat}
                  activeOpacity={0.7}
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
                    {isRejected
                      ? order.rejectionReason
                      : order.cancellationReasonCode
                        ? (() => {
                            const LABELS: Record<string, string> = {
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
                            const label = LABELS[order.cancellationReasonCode!] ?? order.cancellationReasonCode!;
                            return order.cancellationReasonText ? `${label}: ${order.cancellationReasonText}` : label;
                          })()
                        : order.cancellationReason
                    }
                  </Text>
                </View>
              )}
            </View>
          </View>

          {!isExternal && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Progress</Text>
              <View style={styles.timelineCard}>
                <OrderProgressTimeline status={orderStatus} />
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fulfillment Details</Text>
            <View
              style={[
                styles.fulfillmentCard,
                (isCancelled || isRejected) && styles.fulfillmentCardGreyed,
              ]}
            >
              <View style={styles.fulfillmentRow}>
                {order.fulfillmentType === 'Pickup' ? (
                  <Package
                    size={20}
                    color={isCancelled || isRejected ? Colors.textSecondary : Colors.text}
                    strokeWidth={2}
                  />
                ) : (
                  <Truck
                    size={20}
                    color={isCancelled || isRejected ? Colors.textSecondary : Colors.text}
                    strokeWidth={2}
                  />
                )}
                <Text
                  style={[
                    styles.fulfillmentType,
                    (isCancelled || isRejected) && styles.fulfillmentTypeGreyed,
                  ]}
                >
                  {order.fulfillmentType}
                </Text>
              </View>
              {requestedDateTime && (
                <Text
                  style={[
                    styles.requestedDateTime,
                    (isCancelled || isRejected) && styles.requestedDateTimeGreyed,
                  ]}
                >
                  {requestedDateTime}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Items · {totalItemCount}</Text>
            <View style={{ backgroundColor: Colors.white, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border }}>
              {order.items.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.itemCard}
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push({ pathname: '/item/[id]' as any, params: { id: item.id } })
                  }
                >
                  <View style={styles.itemHeader}>
                    {item.image && (
                      <Image source={{ uri: item.image }} style={styles.itemImage} resizeMode="cover" />
                    )}
                    <View style={styles.itemInfo}>
                      <View style={styles.itemNameRow}>
                        <Text style={styles.itemQuantity}>{item.quantity}×</Text>
                        <Text style={styles.itemName}>{item.name}</Text>
                      </View>
                      {item.addOns && item.addOns.length > 0 && (
                        <View style={styles.addOnsContainer}>
                          {item.addOns.map((addOn, addOnIndex) => (
                            <View key={addOnIndex} style={styles.addOnRow}>
                              <Text style={styles.addOnText}>+ {addOn.name}</Text>
                              <Text style={styles.addOnPrice}>
                                {formatPriceWithCommas(addOn.price, (mockVendor.currency as Currency) || 'NGN')}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                    <Text style={styles.itemPrice}>
                      {formatPriceWithCommas(item.price, (mockVendor.currency as Currency) || 'NGN')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {order.orderNote && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Note</Text>
              <View style={styles.noteCard}>
                <Text style={styles.noteText}>{order.orderNote}</Text>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Payment Summary</Text>
              {shouldShowAdjustButton && (
                <TouchableOpacity
                  style={styles.adjustTotalButton}
                  onPress={() => setShowAdjustTotalModal(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.adjustTotalButtonText}>Adjust total</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>
                  {formatPriceWithCommas(order.subtotal, (mockVendor.currency as Currency) || 'NGN')}
                </Text>
              </View>
              {!isExternal && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Tax</Text>
                  <Text style={styles.summaryValue}>
                    {formatPriceWithCommas(order.tax, (mockVendor.currency as Currency) || 'NGN')}
                  </Text>
                </View>
              )}
              {order.discount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Discount</Text>
                  <Text style={[styles.summaryValue, styles.discountValue]}>
                    -{formatPriceWithCommas(order.discount, (mockVendor.currency as Currency) || 'NGN')}
                  </Text>
                </View>
              )}
              {appliedAdjustments.map((adj, i) => (
                <View key={i} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{adj.label}</Text>
                  <Text style={styles.summaryValue}>
                    {formatPriceWithCommas(adj.amount, (mockVendor.currency as Currency) || 'NGN')}
                  </Text>
                </View>
              ))}
              <View style={[styles.summaryRow, styles.summaryRowTotal]}>
                <Text style={styles.summaryLabelTotal}>Total</Text>
                <Text style={styles.summaryValueTotal}>
                  {formatPriceWithCommas(calculatedTotal, (mockVendor.currency as Currency) || 'NGN')}
                </Text>
              </View>
            </View>
          </View>

          {!isExternal && !['requested', 'rejected', 'cancelled', 'expired'].includes(orderStatus) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment</Text>
              <View style={styles.paymentCard}>
                {/* This section only renders for real (non-external) orders — see
                    the !isExternal guard above — so paymentState is always the
                    right field to read; paymentStatus here would be the raw,
                    untranslated backend enum and never match. */}
                {order.paymentState === 'VENDOR_PAYMENT_CONFIRMED' && balanceDue <= 0 && (
                  <View style={styles.paymentConfirmedBanner}>
                    <CheckCircle2 size={20} color={Colors.success} strokeWidth={2.5} />
                    <Text style={styles.paymentConfirmedText}>Payment confirmed</Text>
                  </View>
                )}
                {paymentHistory.length > 0 && (
                  <>
                    <Text style={styles.paymentHistoryTitle}>Payment History</Text>
                    {paymentHistory.map((payment, index) => (
                      <View key={index} style={styles.paymentHistoryRow}>
                        <View style={styles.paymentHistoryLeft}>
                          <Text style={styles.paymentHistoryAmount}>
                            {formatPriceWithCommas(payment.amount, (mockVendor.currency as Currency) || 'NGN')}
                          </Text>
                          <Text style={styles.paymentHistoryTimestamp}>
                            {new Date(payment.timestamp).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                        <Text style={styles.paymentHistoryStatus}>Confirmed</Text>
                      </View>
                    ))}
                    <View style={styles.paymentHistoryDivider} />
                  </>
                )}
                {(order.amountPaid || 0) > 0 && (
                  <View style={styles.paymentRow}>
                    <Text style={styles.paymentLabel}>Total received</Text>
                    <Text style={styles.paymentValuePaid}>
                      {formatPriceWithCommas(order.amountPaid || 0, (mockVendor.currency as Currency) || 'NGN')}
                    </Text>
                  </View>
                )}
                {balanceDue > 0 && (
                  <View style={styles.paymentRow}>
                    <Text style={styles.paymentLabelDue}>Balance due</Text>
                    <Text style={styles.paymentValueDue}>
                      {formatPriceWithCommas(balanceDue, (mockVendor.currency as Currency) || 'NGN')}
                    </Text>
                  </View>
                )}
                {((orderStatus === 'accepted' || order.paymentStatus === 'partially_received') && order.paymentStatus !== 'payment_received' && balanceDue > 0) && (
                  <TouchableOpacity
                    style={styles.recordPaymentButton}
                    onPress={() => {
                      setPaymentType(null);
                      setPartialPaymentAmount('');
                      setShowPaymentConfirmModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <CircleDollarSign size={18} color={Colors.white} strokeWidth={2.5} />
                    <Text style={styles.recordPaymentButtonText}>Record Payment</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {orderStatus === 'completed' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Receipt</Text>
              <View style={styles.receiptCard}>
                <TouchableOpacity
                  style={styles.viewReceiptButton}
                  onPress={() =>
                    router.push({
                      pathname: '/vendor/settings/receipt-preview' as any,
                      params: { orderId: order.id },
                    })
                  }
                  activeOpacity={0.7}
                >
                  <Receipt size={18} color={Colors.text} strokeWidth={2} />
                  <Text style={styles.viewReceiptButtonText}>View Receipt</Text>
                </TouchableOpacity>
                <Text style={styles.receiptHint}>
                  Automatically generated for completed orders. Read-only.
                </Text>
              </View>
            </View>
          )}

          {isExternal && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment Status</Text>
              <View style={styles.externalPaymentCard}>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Payment status</Text>
                  <Text
                    style={[
                      styles.paymentValue,
                      order.paymentStatus === 'payment_received' && styles.paymentValueReceived,
                      order.paymentStatus === 'partially_received' && styles.paymentValuePartial,
                      order.paymentStatus === 'payment_pending' && styles.paymentValuePending,
                    ]}
                  >
                    {order.paymentStatus === 'payment_received' && 'Payment received'}
                    {order.paymentStatus === 'partially_received' && 'Partially received'}
                    {order.paymentStatus === 'payment_pending' && 'Payment pending'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {isExternal && (() => {
            const extOrder = externalOrders.find(o => o.id === orderId);
            if (!extOrder) return null;
            const vendorCurrency = (mockVendor.currency as Currency) || 'NGN';
            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Share</Text>
                <View style={styles.shareCard}>
                  <Text style={styles.shareCardDescription}>
                    Share a live order summary with your customer via WhatsApp, SMS, or email.
                  </Text>
                  <Text style={styles.shareCardOrderId}>
                    {extOrder.externalOrderId}
                  </Text>
                  <TouchableOpacity
                    style={styles.shareOrderButton}
                    onPress={async () => {
                      const totalFormatted = formatPriceWithCommas(extOrder.total, vendorCurrency);
                      const message = buildShareMessage(
                        extOrder.vendorName,
                        extOrder.externalOrderId,
                        extOrder.shareToken,
                        totalFormatted,
                      );
                      console.log('[Share] Sharing external order:', extOrder.externalOrderId);
                      await safeShare({
                        message,
                        title: `Order ${extOrder.externalOrderId}`,
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <ShareIcon size={18} color={Colors.white} strokeWidth={2.5} />
                    <Text style={styles.shareOrderButtonText}>Share Order</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()}

          {showUndoBanner && (
            <Animated.View style={[styles.undoBanner, { opacity: undoBannerOpacity }]}>
              <Text style={styles.undoBannerText}>Customer notified that the order is ready.</Text>
              <TouchableOpacity onPress={handleUndoNotifyReady} activeOpacity={0.7}>
                <Text style={styles.undoBannerAction}>Undo</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

        </View>
      </ScrollView>

      {showAcceptDecline && (
        <SafeAreaView edges={['bottom']} style={styles.actionsContainer}>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={handleDeclineOrder}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              <X size={20} color={Colors.error} strokeWidth={2.5} />
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={handleAcceptOrder}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              <Check size={20} color={Colors.white} strokeWidth={2.5} />
              <Text style={styles.acceptButtonText}>
                {isProcessing ? 'Processing...' : 'Accept Order'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}

      {showMarkInProgress && (
        <SafeAreaView edges={['bottom']} style={styles.actionsContainer}>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleMarkInProgress}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              <Text style={styles.actionButtonText}>
                {isProcessing ? 'Processing...' : 'Mark In Progress'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}

      {isInProgress && !isExternal && (
        <SafeAreaView edges={['bottom']} style={styles.actionsContainer}>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.bottomOutlineButton}
              onPress={() => {
                setNotifyUpdateMode('menu');
                setCustomEventMessage('');
                setShowNotifyUpdateModal(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.bottomOutlineButtonText}>Notify or Update</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { flex: 1 }]}
              onPress={handleMarkCompleted}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              <Text style={styles.actionButtonText}>
                {isProcessing ? 'Processing...' : 'Complete'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}

      {showCancel && !showAcceptDecline && !showMarkInProgress && !isInProgress && (
        <SafeAreaView edges={['bottom']} style={styles.actionsContainer}>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelOrder}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel Order</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}

      <LaektivaModal
        visible={showAcceptModal}
        title="Accept order?"
        message="Are you sure you want to accept this order?"
        primaryButton={{ label: 'Accept order', onPress: confirmAcceptOrder }}
        secondaryButton={{ label: 'Cancel', onPress: () => setShowAcceptModal(false) }}
        onRequestClose={() => setShowAcceptModal(false)}
      />
      <LaektivaModal
        visible={showDeclineModal}
        title="Decline order?"
        message="Are you sure you want to decline this order? The customer will be notified."
        primaryButton={{ label: 'Decline order', onPress: confirmDeclineOrder }}
        secondaryButton={{ label: 'Cancel', onPress: () => setShowDeclineModal(false) }}
        onRequestClose={() => setShowDeclineModal(false)}
      />

      <LaektivaModal
        visible={showInProgressModal}
        title="Mark as in progress?"
        message="This will move the order to in progress status."
        primaryButton={{ label: 'Mark in progress', onPress: confirmMarkInProgress }}
        secondaryButton={{ label: 'Cancel', onPress: () => setShowInProgressModal(false) }}
        onRequestClose={() => setShowInProgressModal(false)}
      />
      <LaektivaModal
        visible={showCompletedModal}
        title="Complete Order?"
        message="This will mark the order as completed."
        primaryButton={{ label: 'Complete', onPress: confirmMarkCompleted }}
        secondaryButton={{ label: 'Cancel', onPress: () => setShowCompletedModal(false) }}
        onRequestClose={() => setShowCompletedModal(false)}
      />
      <Modal
        visible={showCancelModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.cancelModalOverlay}>
          <TouchableOpacity style={styles.cancelModalDismiss} activeOpacity={1} onPress={() => setShowCancelModal(false)} />
          <View style={styles.cancelModalSheet}>
            <View style={styles.cancelModalHandle} />
            <Text style={styles.cancelModalTitle}>Cancel Order</Text>
            <Text style={styles.cancelModalSubtitle}>Why are you cancelling this order?</Text>
            <View style={styles.cancelDropdownContainer}>
              <TouchableOpacity
                style={styles.cancelDropdownButton}
                onPress={() => setShowCancelDropdown(!showCancelDropdown)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.cancelDropdownButtonText,
                  cancelReasonCode ? styles.cancelDropdownButtonTextSelected : null,
                ]}>
                  {cancelReasonCode
                    ? CANCELLATION_REASONS.find(r => r.code === cancelReasonCode)?.label ?? 'Select reason'
                    : 'Select reason'}
                </Text>
                <ChevronDown size={18} color={Colors.textMuted} />
              </TouchableOpacity>
              {showCancelDropdown && (
                <View style={styles.cancelDropdownList}>
                  <ScrollView style={styles.cancelDropdownScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                    {CANCELLATION_REASONS.map((reason) => (
                      <TouchableOpacity
                        key={reason.code}
                        style={[
                          styles.cancelDropdownItem,
                          cancelReasonCode === reason.code && styles.cancelDropdownItemSelected,
                        ]}
                        onPress={() => {
                          setCancelReasonCode(reason.code);
                          if (reason.code !== 'other') setCancelReasonText('');
                          setShowCancelDropdown(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.cancelDropdownItemText,
                          cancelReasonCode === reason.code && styles.cancelDropdownItemTextSelected,
                        ]}>{reason.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
            {cancelReasonCode === 'other' && (
              <View style={styles.cancelOtherInputContainer}>
                <Text style={styles.cancelOtherInputLabel}>Please provide details</Text>
                <TextInput
                  style={styles.cancelOtherInput}
                  value={cancelReasonText}
                  onChangeText={(text) => setCancelReasonText(text.slice(0, 100))}
                  placeholder="Describe the reason for cancellation..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  maxLength={100}
                />
                <Text style={styles.cancelOtherCharCount}>{cancelReasonText.length}/100</Text>
              </View>
            )}
            <View style={styles.cancelModalActions}>
              <TouchableOpacity
                style={styles.cancelModalKeepButton}
                onPress={() => setShowCancelModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelModalKeepText}>Keep Order</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.cancelModalConfirmButton,
                  (!cancelReasonCode || (cancelReasonCode === 'other' && !cancelReasonText.trim())) && styles.cancelModalConfirmButtonDisabled,
                ]}
                onPress={confirmCancelOrder}
                disabled={!cancelReasonCode || (cancelReasonCode === 'other' && !cancelReasonText.trim())}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelModalConfirmText}>Cancel Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showNotifyUpdateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotifyUpdateModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.notifyUpdateModalContainer}>
            {notifyUpdateMode === 'menu' ? (
              <>
                <Text style={styles.notifyUpdateTitle}>Notify or Update</Text>
                <Text style={styles.notifyUpdateSubtitle}>Choose an action to send to the customer.</Text>
                <TouchableOpacity
                  style={styles.notifyUpdateOption}
                  onPress={() => {
                    setShowNotifyUpdateModal(false);
                    handleNotifyReadyWithUndo();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.notifyUpdateOptionText}>Notify Ready</Text>
                  <Text style={styles.notifyUpdateOptionDesc}>Let the customer know their order is ready</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.notifyUpdateOption}
                  onPress={() => setNotifyUpdateMode('custom')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.notifyUpdateOptionText}>Custom Update</Text>
                  <Text style={styles.notifyUpdateOptionDesc}>Send a custom message to the customer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.notifyUpdateCancelButton}
                  onPress={() => setShowNotifyUpdateModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.notifyUpdateCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.notifyUpdateTitle}>Custom Update</Text>
                <Text style={styles.notifyUpdateSubtitle}>
                  Send a custom message to the customer. This does not change the order status.
                </Text>
                <TextInput
                  style={styles.eventInput}
                  value={customEventMessage}
                  onChangeText={setCustomEventMessage}
                  placeholder="e.g. Your order is being packed..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={3}
                  autoFocus
                />
                <View style={styles.eventModalActions}>
                  <TouchableOpacity
                    style={styles.eventCancelButton}
                    onPress={() => {
                      setShowNotifyUpdateModal(false);
                      setCustomEventMessage('');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.eventCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.eventSendButton,
                      !customEventMessage.trim() && styles.eventSendButtonDisabled,
                    ]}
                    onPress={() => {
                      if (customEventMessage.trim()) {
                        handleVendorEvent('custom_update', customEventMessage.trim());
                        setShowNotifyUpdateModal(false);
                        setCustomEventMessage('');
                      }
                    }}
                    disabled={!customEventMessage.trim()}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.eventSendText}>Send Update</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showPaymentConfirmModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentConfirmModal(false)}
      >
        <View style={styles.paymentSheetOverlay}>
          <TouchableOpacity
            style={styles.paymentSheetDismiss}
            activeOpacity={1}
            onPress={() => {
              setShowPaymentConfirmModal(false);
              setPaymentType(null);
              setPartialPaymentAmount('');
              setPartialAmountError('');
            }}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.paymentSheetContainer}>
              <View style={styles.paymentSheetHandle} />

              <Text style={styles.paymentConfirmModalTitle}>Confirm payment received</Text>

              <View style={styles.paymentSheetSummaryRow}>
                <View style={styles.paymentSheetSummaryItem}>
                  <Text style={styles.paymentSheetSummaryLabel}>Order total</Text>
                  <Text style={styles.paymentSheetSummaryValue}>
                    {formatPriceWithCommas(calculatedTotal, (mockVendor.currency as Currency) || 'NGN')}
                  </Text>
                </View>
                <View style={styles.paymentSheetSummaryDivider} />
                <View style={styles.paymentSheetSummaryItem}>
                  <Text style={styles.paymentSheetSummaryLabel}>Outstanding</Text>
                  <Text style={[styles.paymentSheetSummaryValue, styles.paymentSheetOutstandingValue]}>
                    {formatPriceWithCommas(balanceDue, (mockVendor.currency as Currency) || 'NGN')}
                  </Text>
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.paymentConfirmModalDescription}>
                  How much payment did you receive from the customer?
                </Text>

                <View style={styles.paymentOptionsSection}>
                  <TouchableOpacity
                    style={[
                      styles.paymentOptionRow,
                      paymentType === 'full' && styles.paymentOptionRowSelected,
                    ]}
                    onPress={() => {
                      setPaymentType('full');
                      setPartialAmountError('');
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.radioCircle, paymentType === 'full' && styles.radioCircleSelected]}>
                      {paymentType === 'full' && <View style={styles.radioInner} />}
                    </View>
                    <View style={styles.paymentOptionTextContainer}>
                      <Text style={styles.paymentOptionText}>Full payment received</Text>
                      <Text style={styles.paymentOptionSubtext}>
                        {formatPriceWithCommas(balanceDue, (mockVendor.currency as Currency) || 'NGN')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.paymentOptionRow,
                      paymentType === 'partial' && styles.paymentOptionRowSelected,
                    ]}
                    onPress={() => {
                      setPaymentType('partial');
                      setPartialAmountError('');
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.radioCircle, paymentType === 'partial' && styles.radioCircleSelected]}>
                      {paymentType === 'partial' && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.paymentOptionText}>Partial payment received</Text>
                  </TouchableOpacity>
                </View>

                {paymentType === 'partial' && (() => {
                  const enteredCents = Math.round((parseFloat(partialPaymentAmount) || 0) * 100);
                  const remaining = balanceDue - enteredCents;
                  return (
                    <View style={styles.partialPaymentSection}>
                      <Text style={styles.partialPaymentLabel}>Amount received</Text>
                      <View style={[
                        styles.partialPaymentInput,
                        partialAmountError ? styles.partialPaymentInputError : null,
                      ]}>
                        <Text style={styles.currencySymbol}>{getCurrencySymbol((mockVendor.currency as Currency) || 'NGN')}</Text>
                        <TextInput
                          style={styles.partialPaymentField}
                          value={partialPaymentAmount}
                          onChangeText={(text) => {
                            const sanitized = text.replace(/[^0-9.]/g, '');
                            const parts = sanitized.split('.');
                            if (parts.length > 2) return;
                            if (parts[1] && parts[1].length > 2) return;
                            setPartialPaymentAmount(sanitized);
                            const cents = Math.round((parseFloat(sanitized) || 0) * 100);
                            if (cents > balanceDue) {
                              setPartialAmountError('Amount cannot exceed the outstanding balance.');
                            } else {
                              setPartialAmountError('');
                            }
                          }}
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          placeholderTextColor={Colors.textMuted}
                          autoFocus
                        />
                      </View>
                      {partialAmountError ? (
                        <Text style={styles.partialAmountErrorText}>{partialAmountError}</Text>
                      ) : enteredCents > 0 && remaining >= 0 ? (
                        <View style={styles.remainingBalanceRow}>
                          <Text style={styles.remainingBalanceLabel}>Remaining balance</Text>
                          <Text style={styles.remainingBalanceValue}>
                            {formatPriceWithCommas(remaining, (mockVendor.currency as Currency) || 'NGN')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })()}
              </ScrollView>

              <View style={styles.paymentSheetFooter}>
                <TouchableOpacity
                  style={[
                    styles.paymentConfirmButton,
                    (!paymentType || !!partialAmountError) && styles.paymentConfirmButtonDisabled,
                  ]}
                  onPress={confirmPaymentReceived}
                  disabled={!paymentType || !!partialAmountError}
                  activeOpacity={0.7}
                >
                  <Text style={styles.paymentConfirmButtonText}>Confirm payment</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.paymentCancelButton}
                  onPress={() => {
                    setShowPaymentConfirmModal(false);
                    setPaymentType(null);
                    setPartialPaymentAmount('');
                    setPartialAmountError('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.paymentCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <LaektivaModal
        visible={showPaymentNotRecordedModal}
        title="Payment not recorded"
        message="You have not recorded payment for this order yet. Are you sure you want to start fulfillment?"
        primaryButton={{
          label: 'Start anyway',
          onPress: () => {
            setShowPaymentNotRecordedModal(false);
            setShowInProgressModal(true);
          },
        }}
        secondaryButton={{
          label: 'Cancel',
          onPress: () => setShowPaymentNotRecordedModal(false),
        }}
        onRequestClose={() => setShowPaymentNotRecordedModal(false)}
      />

      <Modal
        visible={showAdjustTotalModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAdjustTotalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.adjustModalContainer}>
            <Text style={styles.adjustModalTitle}>Adjust Order Total</Text>
            <Text style={styles.adjustModalDescription}>
              Add extra fees like delivery charges to this order.
            </Text>
            <View style={styles.adjustInputSection}>
              <Text style={styles.adjustInputLabel}>Fee label</Text>
              <TextInput
                style={styles.adjustInput}
                value={adjustmentLabel}
                onChangeText={setAdjustmentLabel}
                placeholder="e.g., Delivery"
                placeholderTextColor={Colors.textMuted}
                maxLength={50}
              />
            </View>
            <View style={styles.adjustInputSection}>
              <Text style={styles.adjustInputLabel}>Amount</Text>
              <View style={styles.adjustAmountInput}>
                <Text style={styles.adjustCurrencySymbol}>{getCurrencySymbol((mockVendor.currency as Currency) || 'NGN')}</Text>
                <TextInput
                  style={styles.adjustAmountField}
                  value={adjustmentAmount}
                  onChangeText={(text) => {
                    const sanitized = text.replace(/[^0-9.]/g, '');
                    const parts = sanitized.split('.');
                    if (parts.length > 2) return;
                    setAdjustmentAmount(sanitized);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>
            <View style={styles.adjustModalActions}>
              <TouchableOpacity
                style={styles.adjustCancelButton}
                onPress={() => {
                  setShowAdjustTotalModal(false);
                  setAdjustmentLabel('');
                  setAdjustmentAmount('');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.adjustCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.adjustSaveButton,
                  (!adjustmentLabel.trim() || !adjustmentAmount || parseFloat(adjustmentAmount) <= 0) &&
                    styles.adjustSaveButtonDisabled,
                ]}
                onPress={() => {
                  const amountInCents = Math.round(parseFloat(adjustmentAmount) * 100);
                  if (amountInCents > 0) {
                    setAppliedAdjustments((prev) => [
                      ...prev,
                      { label: adjustmentLabel.trim(), amount: amountInCents },
                    ]);
                  }
                  setShowAdjustTotalModal(false);
                  setAdjustmentLabel('');
                  setAdjustmentAmount('');
                }}
                disabled={
                  !adjustmentLabel.trim() || !adjustmentAmount || parseFloat(adjustmentAmount) <= 0
                }
                activeOpacity={0.7}
              >
                <Text style={styles.adjustSaveButtonText}>Apply adjustment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundCanvas },
  safeArea: { backgroundColor: Colors.background },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerSpacer: { width: 36 },
  headerTitle: { fontSize: 16, fontWeight: '600' as const, color: Colors.text, flex: 1, textAlign: 'center' as const },
  scrollView: { flex: 1, backgroundColor: Colors.backgroundCanvas },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 11, fontWeight: '600' as const, color: Colors.textMuted,
    letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: 8, paddingHorizontal: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, marginBottom: 12,
  },
  infoCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginTop: 12 },
  customerName: { fontSize: 22, fontWeight: '700' as const, color: Colors.text, marginBottom: 8 },
  statusChip: {
    alignSelf: 'flex-start' as const, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, marginBottom: 8,
  },
  statusChipText: { fontSize: 12, fontWeight: '600' as const },
  orderIdRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 8,
  },
  orderIdText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' as const },
  orderPlacedDate: { fontSize: 13, color: Colors.textMuted, marginBottom: 12 },
  openChatButtonInline: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: Colors.backgroundCanvas, paddingVertical: 12, borderRadius: 10, gap: 8,
    borderWidth: 1, borderColor: Colors.border,
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
    backgroundColor: Colors.errorLight, borderRadius: 10, padding: 12,
    marginTop: 12, borderWidth: 1, borderColor: Colors.errorBorder,
  },
  reasonLabel: { fontSize: 12, fontWeight: '600' as const, color: Colors.error, marginBottom: 4 },
  reasonText: { fontSize: 14, color: Colors.text },
  timelineCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  fulfillmentCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  fulfillmentCardGreyed: { opacity: 0.6 },
  fulfillmentRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, marginBottom: 8 },
  fulfillmentType: { fontSize: 16, fontWeight: '600' as const, color: Colors.text },
  fulfillmentTypeGreyed: { color: Colors.textSecondary },
  requestedDateTime: { fontSize: 14, color: Colors.textSecondary },
  requestedDateTimeGreyed: { color: Colors.textSecondary },
  itemCard: { backgroundColor: Colors.white, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderSoft },
  itemHeader: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 12 },
  itemImage: { width: 52, height: 52, borderRadius: 10, backgroundColor: Colors.surface },
  itemInfo: { flex: 1 },
  itemNameRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 8, marginBottom: 4 },
  itemQuantity: { fontSize: 14, fontWeight: '400' as const, color: Colors.textTertiary },
  itemName: { fontSize: 14, fontWeight: '500' as const, color: Colors.text, flex: 1 },
  itemPrice: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  addOnsContainer: { marginTop: 8 },
  addOnRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, marginBottom: 6,
  },
  addOnText: { fontSize: 14, color: Colors.textMuted, flex: 1 },
  addOnPrice: { fontSize: 14, color: Colors.textMuted },
  noteCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border },
  noteText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21 },
  summaryCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  summaryRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, marginBottom: 8,
  },
  summaryRowTotal: {
    marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, marginBottom: 0,
  },
  summaryLabel: { fontSize: 14, color: Colors.textSecondary },
  summaryValue: { fontSize: 14, fontWeight: '500' as const, color: Colors.text },
  discountValue: { color: Colors.success },
  summaryLabelTotal: { fontSize: 17, fontWeight: '700' as const, color: Colors.text },
  summaryValueTotal: { fontSize: 17, fontWeight: '700' as const, color: Colors.primary },
  adjustTotalButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.primaryTint, borderWidth: 1, borderColor: 'rgba(255,122,40,0.15)' },
  adjustTotalButtonText: { fontSize: 12, fontWeight: '600' as const, color: Colors.primary },
  paymentCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  externalPaymentCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  receiptCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  viewReceiptButton: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: Colors.backgroundCanvas, paddingVertical: 12, borderRadius: 10, gap: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  viewReceiptButtonText: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  receiptHint: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' as const, marginTop: 10 },
  shareCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shareCardDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  shareCardOrderId: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  shareOrderButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  shareOrderButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  paymentRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, marginBottom: 10,
  },
  paymentLabel: { fontSize: 14, color: Colors.textSecondary },
  paymentLabelDue: { fontSize: 16, fontWeight: '600' as const, color: Colors.text },
  paymentValue: { fontSize: 14, fontWeight: '500' as const, color: Colors.textSecondary },
  paymentValueDue: { fontSize: 16, fontWeight: '700' as const, color: Colors.error },
  paymentValuePaid: { fontSize: 15, fontWeight: '600' as const, color: Colors.success },
  paymentValueReceived: { color: Colors.success },
  paymentValuePartial: { color: Colors.primary },
  paymentValuePending: { color: Colors.error },
  paymentHistoryTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.text, marginBottom: 12 },
  paymentHistoryRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, marginBottom: 10, paddingVertical: 8,
    paddingHorizontal: 12, backgroundColor: Colors.successLight, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.successBorder,
  },
  paymentHistoryLeft: { flex: 1 },
  paymentHistoryAmount: { fontSize: 16, fontWeight: '600' as const, color: Colors.success, marginBottom: 4 },
  paymentHistoryTimestamp: { fontSize: 13, color: Colors.textMuted },
  paymentHistoryStatus: { fontSize: 14, fontWeight: '500' as const, color: Colors.textMuted },
  paymentHistoryDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  paymentConfirmedBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: Colors.successLight,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.successBorder,
  },
  paymentConfirmedText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  recordPaymentButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 4,
  },
  recordPaymentButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  notifyUpdateModalContainer: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400,
  },
  notifyUpdateTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, marginBottom: 6 },
  notifyUpdateSubtitle: { fontSize: 14, color: Colors.textMuted, marginBottom: 20, lineHeight: 20 },
  notifyUpdateOption: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  notifyUpdateOptionText: { fontSize: 16, fontWeight: '600' as const, color: Colors.text, marginBottom: 4 },
  notifyUpdateOptionDesc: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  notifyUpdateDivider: { height: 1, backgroundColor: Colors.border },
  notifyUpdateCancelButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.border,
    alignItems: 'center' as const,
  },
  notifyUpdateCancelText: { fontSize: 15, fontWeight: '600' as const, color: Colors.textMuted },
  undoBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.charcoal,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  undoBannerText: {
    fontSize: 14,
    color: '#ffffff',
    flex: 1,
    marginRight: 12,
  },
  undoBannerAction: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  actionsContainer: { backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border },
  actions: { flexDirection: 'row' as const, paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  actionsColumn: { flexDirection: 'column' as const, paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  declineButton: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: Colors.surface, paddingVertical: 15, paddingHorizontal: 16,
    borderRadius: 14, gap: 6, borderWidth: 1, borderColor: Colors.border, minHeight: 50,
  },
  declineButtonText: { fontSize: 16, fontWeight: '600' as const, color: Colors.error },
  acceptButton: {
    flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'center' as const, backgroundColor: Colors.primary,
    paddingVertical: 15, borderRadius: 14, gap: 6, minHeight: 50,
  },
  acceptButtonText: { fontSize: 16, fontWeight: '600' as const, color: Colors.white },
  sendPaymentRequestButton: {
    flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 12, minHeight: 52,
  },
  sendPaymentRequestButtonText: { fontSize: 17, fontWeight: '600' as const, color: Colors.white },
  bottomOutlineButton: {
    flex: 1, alignItems: 'center' as const,
    justifyContent: 'center' as const, backgroundColor: Colors.surface,
    paddingVertical: 15, borderRadius: 14, minHeight: 50,
    borderWidth: 1, borderColor: Colors.border,
  },
  bottomOutlineButtonText: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },
  actionButton: {
    flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'center' as const, backgroundColor: Colors.primary,
    paddingVertical: 15, borderRadius: 14, gap: 8, minHeight: 50,
  },
  actionButtonText: { fontSize: 16, fontWeight: '600' as const, color: Colors.white },
  cancelButton: {
    flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: Colors.white, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.errorBorder, minHeight: 44,
  },
  cancelButtonText: { fontSize: 14, fontWeight: '500' as const, color: Colors.error },
  errorContainer: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  errorText: { fontSize: 18, fontWeight: '600' as const, color: Colors.textSecondary, textAlign: 'center' as const },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center' as const, alignItems: 'center' as const, paddingHorizontal: 20,
  },
  eventModalContainer: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400,
  },
  eventModalTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, marginBottom: 6 },
  eventModalSubtitle: { fontSize: 14, color: Colors.textMuted, marginBottom: 16, lineHeight: 20 },
  eventInput: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14, fontSize: 15,
    color: Colors.text, minHeight: 96, textAlignVertical: 'top' as const,
    borderWidth: 1, borderColor: Colors.border, lineHeight: 21,
  },
  eventModalActions: { flexDirection: 'row' as const, gap: 12, marginTop: 16 },
  eventCancelButton: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    backgroundColor: Colors.border, alignItems: 'center' as const,
  },
  eventCancelText: { fontSize: 15, fontWeight: '600' as const, color: Colors.textMuted },
  eventSendButton: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    backgroundColor: Colors.primary, alignItems: 'center' as const,
  },
  eventSendButtonDisabled: { backgroundColor: Colors.border, opacity: 0.5 },
  eventSendText: { fontSize: 15, fontWeight: '700' as const, color: Colors.white },
  adjustModalContainer: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400,
  },
  adjustModalTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, marginBottom: 8 },
  adjustModalDescription: { fontSize: 14, color: Colors.textMuted, marginBottom: 24, lineHeight: 20 },
  adjustInputSection: { marginBottom: 20 },
  adjustInputLabel: { fontSize: 14, fontWeight: '600' as const, color: Colors.text, marginBottom: 8 },
  adjustInput: { backgroundColor: Colors.border, borderRadius: 10, padding: 14, fontSize: 16, color: Colors.text },
  adjustAmountInput: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    backgroundColor: Colors.border, borderRadius: 10, paddingHorizontal: 14,
  },
  adjustCurrencySymbol: { fontSize: 18, fontWeight: '600' as const, color: Colors.text, marginRight: 8 },
  adjustAmountField: { flex: 1, fontSize: 18, fontWeight: '600' as const, color: Colors.text, paddingVertical: 12 },
  adjustModalActions: { flexDirection: 'row' as const, gap: 12 },
  adjustCancelButton: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    backgroundColor: Colors.border, alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  adjustCancelButtonText: { fontSize: 15, fontWeight: '600' as const, color: Colors.textMuted },
  adjustSaveButton: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    backgroundColor: Colors.primary, alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  adjustSaveButtonDisabled: { backgroundColor: Colors.border },
  adjustSaveButtonText: { fontSize: 15, fontWeight: '700' as const, color: Colors.white },
  paymentSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end' as const,
  },
  paymentSheetDismiss: { flex: 1 },
  paymentSheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '85%' as any,
  },
  paymentSheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center' as const,
    marginTop: 12, marginBottom: 20,
  },
  paymentSheetSummaryRow: {
    flexDirection: 'row' as const,
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paymentSheetSummaryItem: { flex: 1, alignItems: 'center' as const },
  paymentSheetSummaryLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 4, fontWeight: '500' as const },
  paymentSheetSummaryValue: { fontSize: 17, fontWeight: '700' as const, color: Colors.text },
  paymentSheetOutstandingValue: { color: Colors.error },
  paymentSheetSummaryDivider: { width: 1, backgroundColor: Colors.border, marginHorizontal: 8 },
  paymentSheetFooter: { paddingTop: 16, gap: 10 },
  paymentConfirmModalContainer: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400,
  },
  paymentConfirmModalTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, marginBottom: 16 },
  paymentConfirmModalDescription: { fontSize: 15, color: Colors.textMuted, marginBottom: 20, lineHeight: 22 },
  paymentOptionsSection: { marginBottom: 20 },
  paymentOptionRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 14,
    paddingHorizontal: 16, backgroundColor: Colors.border, borderRadius: 12,
    marginBottom: 12, borderWidth: 2, borderColor: 'transparent',
  },
  paymentOptionRowSelected: { borderColor: Colors.primary, backgroundColor: Colors.surface },
  radioCircle: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.textSecondary,
    alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: 12,
  },
  radioCircleSelected: { borderColor: Colors.primary },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary },
  paymentOptionTextContainer: { flex: 1 },
  paymentOptionText: { fontSize: 16, color: Colors.text, fontWeight: '500' as const, marginBottom: 2 },
  paymentOptionSubtext: { fontSize: 14, color: Colors.textMuted },
  partialPaymentSection: { marginBottom: 24 },
  partialPaymentLabel: { fontSize: 14, fontWeight: '600' as const, color: Colors.text, marginBottom: 8 },
  partialPaymentInput: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    backgroundColor: Colors.border, borderRadius: 10, paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  partialPaymentInputError: {
    borderColor: Colors.error,
    backgroundColor: '#FFF5F5',
  },
  partialAmountErrorText: {
    fontSize: 13, color: Colors.error, marginTop: 6, fontWeight: '500' as const,
  },
  remainingBalanceRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  remainingBalanceLabel: { fontSize: 13, color: Colors.textSecondary },
  remainingBalanceValue: { fontSize: 13, fontWeight: '700' as const, color: Colors.text },
  currencySymbol: { fontSize: 18, fontWeight: '600' as const, color: Colors.text, marginRight: 8 },
  partialPaymentField: { flex: 1, fontSize: 18, fontWeight: '600' as const, color: Colors.text, paddingVertical: 12 },
  partialPaymentHelper: { fontSize: 13, color: Colors.textSecondary, marginTop: 8 },
  paymentConfirmActions: { flexDirection: 'row' as const, gap: 12 },
  paymentCancelButton: {
    paddingVertical: 14, borderRadius: 12,
    backgroundColor: Colors.border, alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  paymentCancelButtonText: { fontSize: 15, fontWeight: '600' as const, color: Colors.textMuted },
  paymentConfirmButton: {
    paddingVertical: 16, borderRadius: 12,
    backgroundColor: Colors.success, alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  paymentConfirmButtonDisabled: { backgroundColor: Colors.border, opacity: 0.5 },
  paymentConfirmButtonText: { fontSize: 16, fontWeight: '700' as const, color: Colors.white },
  cancelModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end' as const,
  },
  cancelModalDismiss: {
    flex: 1,
  },
  cancelModalSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '80%' as any,
  },
  cancelModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center' as const,
    marginTop: 12,
    marginBottom: 20,
  },
  cancelModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  cancelModalSubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 20,
    lineHeight: 20,
  },
  cancelDropdownContainer: {
    marginBottom: 16,
    zIndex: 10,
  },
  cancelDropdownButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  cancelDropdownButtonText: {
    fontSize: 15,
    color: Colors.textMuted,
    flex: 1,
  },
  cancelDropdownButtonTextSelected: {
    color: Colors.text,
    fontWeight: '500' as const,
  },
  cancelDropdownList: {
    marginTop: 4,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
  },
  cancelDropdownScroll: {
    maxHeight: 240,
  },
  cancelDropdownItem: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cancelDropdownItemSelected: {
    backgroundColor: Colors.errorLight,
  },
  cancelDropdownItemText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 20,
  },
  cancelDropdownItemTextSelected: {
    color: Colors.error,
    fontWeight: '600' as const,
  },
  cancelOtherInputContainer: {
    marginTop: 4,
    marginBottom: 8,
  },
  cancelOtherInputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  cancelOtherInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Colors.text,
    minHeight: 80,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelOtherCharCount: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'right' as const,
    marginTop: 6,
  },
  cancelModalActions: {
    flexDirection: 'row' as const,
    gap: 12,
    marginTop: 20,
  },
  cancelModalKeepButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelModalKeepText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  cancelModalConfirmButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.error,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  cancelModalConfirmButtonDisabled: {
    opacity: 0.4,
  },
  cancelModalConfirmText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});
