import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Animated,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';

import * as Clipboard from 'expo-clipboard';
import { Share as ShareIcon, Package, Truck, Check, X, CircleDollarSign, CheckCircle2, ShieldCheck, FileImage, AlertCircle, Eye, Send } from 'lucide-react-native';
import PaymentProofViewerModal from '@/components/vendor/PaymentProofViewerModal';
import { Alert } from '@/utils/alert';
import { Colors } from '@/constants/colors';
import LaektivaModal from '@/components/LaektivaModal';
import { getStatusPriorityOrder } from '@/constants/orderStatus';
import { formatVendorOrderId } from '@/utils/formatOrderId';
import { formatPriceWithCommas, getCurrencySymbol, type Currency } from '@/utils/formatPrice';
import { buildShareMessage } from '@/utils/externalOrderShare';
import { safeShare } from '@/utils/share';
import { mockVendor } from '@/mocks/vendorData';
import { isOrderCancelled, isOrderRejected } from '@/utils/orderHelpers';
import { useVendorOrderDetails } from '@/features/orders/hooks/useVendorOrderDetails';
import OrderHeader from '@/features/orders/components/OrderHeader';
import OrderCustomerCard from '@/features/orders/components/OrderCustomerCard';
import OrderItemsSection from '@/features/orders/components/OrderItemsSection';
import OrderActionsPanel from '@/features/orders/components/OrderActionsPanel';
import CancelOrderModal from '@/features/orders/components/CancelOrderModal';

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
  dotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.white },
  line: { width: 2, flex: 1, minHeight: 24, marginVertical: 2 },
  textCol: { flex: 1, paddingLeft: 12, paddingBottom: 4 },
  textColWithLine: { paddingBottom: 16 },
  stepLabel: { fontSize: 14, color: Colors.text, marginBottom: 2 },
  stepDesc: { fontSize: 12, color: Colors.textMuted, lineHeight: 16 },
});

interface Props {
  orderId: string;
  openedFromChat: boolean;
}

export default function VendorOrderDetailsScreen({ orderId, openedFromChat }: Props) {
  const router = useRouter();
  const vm = useVendorOrderDetails(orderId, openedFromChat);

  const currency = (mockVendor.currency as Currency) || 'NGN';

  const {
    order,
    isProcessing,
    displayFlags,
    financials,
    paymentState,
    requestedDateTime,
    externalOrderData,
    paymentHistory,
    showAcceptModal,
    setShowAcceptModal,
    showDeclineModal,
    setShowDeclineModal,
    showInProgressModal,
    setShowInProgressModal,
    showCompletedModal,
    setShowCompletedModal,
    showCancelModal,
    setShowCancelModal,
    showCancelDropdown,
    setShowCancelDropdown,
    cancelReasonCode,
    setCancelReasonCode,
    cancelReasonText,
    setCancelReasonText,
    customEventMessage,
    setCustomEventMessage,
    showNotifyUpdateModal,
    setShowNotifyUpdateModal,
    notifyUpdateMode,
    setNotifyUpdateMode,
    showUndoBanner,
    undoBannerOpacity,
    showAdjustTotalModal,
    setShowAdjustTotalModal,
    adjustmentLabel,
    setAdjustmentLabel,
    adjustmentAmount,
    setAdjustmentAmount,
    appliedAdjustments,
    showPaymentConfirmModal,
    paymentType,
    setPaymentType,
    partialPaymentAmount,
    setPartialPaymentAmount,
    partialAmountError,
    setPartialAmountError,
    showPaymentNotRecordedModal,
    setShowPaymentNotRecordedModal,
    showPaymentProofViewer,
    setShowPaymentProofViewer,
    handleAcceptOrder,
    confirmAcceptOrder,
    handleDeclineOrder,
    confirmDeclineOrder,
    handleMarkInProgress,
    confirmMarkInProgress,
    handleMarkCompleted,
    confirmMarkCompleted,
    handleCancelOrder,
    confirmCancelOrder,
    handleVendorEvent,
    handleNotifyReadyWithUndo,
    handleUndoNotifyReady,
    confirmPaymentReceived,
    openPaymentModal,
    closePaymentModal,
    applyAdjustment,
    handleOpenChat,
    handleVendorRecordPayment,
    handleVendorRequestProof,
    handleViewPaymentProof,
  } = vm;

  if (!order) {
    return (
      <View style={styles.container}>
        <OrderHeader onBack={() => router.back()} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Order not found</Text>
        </View>
      </View>
    );
  }

  const orderStatus = order.status;
  const isExternal = displayFlags?.isExternal ?? false;
  const isCancelled = isOrderCancelled(orderStatus);
  const isRejected = isOrderRejected(orderStatus);

  const calculatedTotal = financials?.calculatedTotal ?? order.total;
  const balanceDue = financials?.balanceDue ?? 0;
  const totalItemCount = financials?.totalItemCount ?? 0;

  const handleCopyOrderId = async () => {
    try {
      await Clipboard.setStringAsync(order.publicOrderId);
      Alert.alert('Order ID copied', formatVendorOrderId(order.publicOrderId));
    } catch {
      Alert.alert('Error', 'Failed to copy Order ID');
    }
  };

  return (
    <View style={styles.container}>
      <OrderHeader onBack={() => router.back()} />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>

          <View style={styles.section}>
            <OrderCustomerCard
              order={order}
              openedFromChat={openedFromChat}
              onCopyOrderId={handleCopyOrderId}
              onOpenChat={handleOpenChat}
            />
          </View>

          {!isExternal && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Progress</Text>
              <View style={styles.timelineCard}>
                <OrderProgressTimeline status={orderStatus} />
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fulfillment</Text>
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
            <OrderItemsSection order={order} totalItemCount={totalItemCount} />
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
              {paymentState?.shouldShowAdjustButton && (
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
                  {formatPriceWithCommas(order.subtotal, currency)}
                </Text>
              </View>
              {!isExternal && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Tax</Text>
                  <Text style={styles.summaryValue}>
                    {formatPriceWithCommas(order.tax, currency)}
                  </Text>
                </View>
              )}
              {order.discount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Discount</Text>
                  <Text style={[styles.summaryValue, styles.discountValue]}>
                    -{formatPriceWithCommas(order.discount, currency)}
                  </Text>
                </View>
              )}
              {appliedAdjustments.map((adj, i) => (
                <View key={i} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{adj.label}</Text>
                  <Text style={styles.summaryValue}>
                    {formatPriceWithCommas(adj.amount, currency)}
                  </Text>
                </View>
              ))}
              <View style={[styles.summaryRow, styles.summaryRowTotal]}>
                <Text style={styles.summaryLabelTotal}>Total</Text>
                <Text style={styles.summaryValueTotal}>
                  {formatPriceWithCommas(calculatedTotal, currency)}
                </Text>
              </View>
            </View>
          </View>

          {!isExternal && paymentState?.isCustomerMarkedPaid && paymentState?.showVendorPaymentActions && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Customer Payment</Text>
              <View style={styles.customerPaymentCard}>
                <View style={styles.customerPaymentStatusRow}>
                  <ShieldCheck size={20} color={Colors.primary} />
                  <View style={styles.customerPaymentStatusInfo}>
                    <Text style={styles.customerPaymentStatusTitle}>
                      {order.customerName || 'Customer'} marked as paid
                    </Text>
                    {paymentState.customerMarkedPaidAt && (
                      <Text style={styles.customerPaymentStatusDate}>
                        {new Date(paymentState.customerMarkedPaidAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                        })}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.customerPaymentProofRow}>
                  <FileImage size={15} color={paymentState.hasPaymentProof ? Colors.success : Colors.textMuted} />
                  <Text style={[
                    styles.customerPaymentProofText,
                    paymentState.hasPaymentProof && styles.customerPaymentProofTextAvailable,
                  ]}>
                    Payment Proof: {paymentState.hasPaymentProof
                      ? `${paymentState.paymentProofCount} file${paymentState.paymentProofCount > 1 ? 's' : ''} available`
                      : 'Not uploaded'}
                  </Text>
                </View>

                <View style={styles.customerPaymentActions}>
                  {paymentState.hasPaymentProof && (
                    <TouchableOpacity
                      style={styles.viewProofButton}
                      onPress={handleViewPaymentProof}
                      activeOpacity={0.7}
                      testID="view-payment-proof-button"
                    >
                      <Eye size={16} color={Colors.primary} />
                      <Text style={styles.viewProofButtonText}>View Proof</Text>
                    </TouchableOpacity>
                  )}
                  {!paymentState.hasPaymentProof && !paymentState.vendorPaymentProofRequested && (
                    <TouchableOpacity
                      style={styles.requestProofButton}
                      onPress={handleVendorRequestProof}
                      activeOpacity={0.7}
                      testID="request-payment-proof-button"
                    >
                      <Send size={16} color={Colors.primary} />
                      <Text style={styles.requestProofButtonText}>Request Proof</Text>
                    </TouchableOpacity>
                  )}
                  {paymentState.vendorPaymentProofRequested && !paymentState.hasPaymentProof && (
                    <View style={styles.proofRequestedInfo}>
                      <AlertCircle size={14} color={Colors.warning} />
                      <Text style={styles.proofRequestedInfoText}>Proof requested from customer</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.vendorRecordPaymentButton}
                    onPress={handleVendorRecordPayment}
                    activeOpacity={0.7}
                    testID="vendor-record-payment-button"
                  >
                    <CircleDollarSign size={18} color={Colors.white} strokeWidth={2.5} />
                    <Text style={styles.vendorRecordPaymentButtonText}>Record Payment</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {!isExternal && !['requested', 'rejected', 'cancelled', 'expired'].includes(orderStatus) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payments</Text>
              <View style={styles.paymentCard}>
                {paymentState?.isPaymentConfirmed && (
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
                            {formatPriceWithCommas(payment.amount, currency)}
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
                      {formatPriceWithCommas(order.amountPaid || 0, currency)}
                    </Text>
                  </View>
                )}
                {balanceDue > 0 && (
                  <View style={styles.paymentRow}>
                    <Text style={styles.paymentLabelDue}>Balance due</Text>
                    <Text style={styles.paymentValueDue}>
                      {formatPriceWithCommas(balanceDue, currency)}
                    </Text>
                  </View>
                )}
                {paymentState?.showRecordPayment && (
                  <TouchableOpacity
                    style={styles.recordPaymentButton}
                    onPress={openPaymentModal}
                    activeOpacity={0.7}
                    testID="record-payment-button"
                  >
                    <CircleDollarSign size={18} color={Colors.white} strokeWidth={2.5} />
                    <Text style={styles.recordPaymentButtonText}>Record Payment</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {isExternal && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment</Text>
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

          {isExternal && externalOrderData && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Share</Text>
              <View style={styles.shareCard}>
                <Text style={styles.shareCardDescription}>
                  Share a live order summary with your customer via WhatsApp, SMS, or email.
                </Text>
                <Text style={styles.shareCardOrderId}>
                  {externalOrderData.externalOrderId}
                </Text>
                <TouchableOpacity
                  style={styles.shareOrderButton}
                  onPress={async () => {
                    const totalFormatted = formatPriceWithCommas(externalOrderData.total, currency);
                    const message = buildShareMessage(
                      externalOrderData.vendorName,
                      externalOrderData.externalOrderId,
                      externalOrderData.shareToken,
                      totalFormatted,
                    );
                    console.log('[Share] Sharing external order:', externalOrderData.externalOrderId);
                    await safeShare({
                      message,
                      title: `Order ${externalOrderData.externalOrderId}`,
                    });
                  }}
                  activeOpacity={0.7}
                  testID="share-order-button"
                >
                  <ShareIcon size={18} color={Colors.white} strokeWidth={2.5} />
                  <Text style={styles.shareOrderButtonText}>Share Order</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

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

      {displayFlags && (
        <OrderActionsPanel
          showAcceptDecline={displayFlags.showAcceptDecline}
          showMarkInProgress={displayFlags.showMarkInProgress}
          isInProgress={displayFlags.isInProgress}
          isExternal={displayFlags.isExternal}
          showCancel={displayFlags.showCancel}
          isProcessing={isProcessing}
          onAccept={handleAcceptOrder}
          onDecline={handleDeclineOrder}
          onMarkInProgress={handleMarkInProgress}
          onMarkCompleted={handleMarkCompleted}
          onNotifyUpdate={() => {
            setNotifyUpdateMode('menu');
            setCustomEventMessage('');
            setShowNotifyUpdateModal(true);
          }}
          onCancelOrder={handleCancelOrder}
        />
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

      <CancelOrderModal
        visible={showCancelModal}
        cancelReasonCode={cancelReasonCode}
        cancelReasonText={cancelReasonText}
        showCancelDropdown={showCancelDropdown}
        onSetCancelReasonCode={setCancelReasonCode}
        onSetCancelReasonText={setCancelReasonText}
        onSetShowCancelDropdown={setShowCancelDropdown}
        onKeepOrder={() => setShowCancelModal(false)}
        onConfirmCancel={confirmCancelOrder}
      />

      <Modal
        visible={showNotifyUpdateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotifyUpdateModal(false)}
      >
        <View style={styles.modalOverlay}>
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
                <View style={styles.notifyUpdateDivider} />
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
        </View>
      </Modal>

      <Modal
        visible={showPaymentConfirmModal}
        transparent
        animationType="slide"
        onRequestClose={closePaymentModal}
      >
        <View style={styles.paymentSheetOverlay}>
          <TouchableOpacity
            style={styles.paymentSheetDismiss}
            activeOpacity={1}
            onPress={closePaymentModal}
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
                    {formatPriceWithCommas(calculatedTotal, currency)}
                  </Text>
                </View>
                <View style={styles.paymentSheetSummaryDivider} />
                <View style={styles.paymentSheetSummaryItem}>
                  <Text style={styles.paymentSheetSummaryLabel}>Outstanding</Text>
                  <Text style={[styles.paymentSheetSummaryValue, styles.paymentSheetOutstandingValue]}>
                    {formatPriceWithCommas(balanceDue, currency)}
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
                        {formatPriceWithCommas(balanceDue, currency)}
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
                        <Text style={styles.currencySymbol}>{getCurrencySymbol(currency)}</Text>
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
                            {formatPriceWithCommas(remaining, currency)}
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
                  testID="confirm-payment-button"
                >
                  <Text style={styles.paymentConfirmButtonText}>Confirm payment</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.paymentCancelButton}
                  onPress={closePaymentModal}
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

      <PaymentProofViewerModal
        visible={showPaymentProofViewer}
        onClose={() => setShowPaymentProofViewer(false)}
        proofs={order?.paymentProof ?? []}
        customerName={order?.customerName || 'Customer'}
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
                <Text style={styles.adjustCurrencySymbol}>{getCurrencySymbol(currency)}</Text>
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
                onPress={applyAdjustment}
                disabled={!adjustmentLabel.trim() || !adjustmentAmount || parseFloat(adjustmentAmount) <= 0}
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
  sectionTitleRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  timelineCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16 },
  fulfillmentCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16 },
  fulfillmentCardGreyed: { opacity: 0.6 },
  fulfillmentRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, marginBottom: 8 },
  fulfillmentType: { fontSize: 17, fontWeight: '600' as const, color: Colors.text },
  fulfillmentTypeGreyed: { color: Colors.textSecondary },
  requestedDateTime: { fontSize: 15, color: Colors.textMuted },
  requestedDateTimeGreyed: { color: Colors.textSecondary },
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
  discountValue: { color: Colors.success },
  summaryLabelTotal: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  summaryValueTotal: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  adjustTotalButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.border,
  },
  adjustTotalButtonText: { fontSize: 13, fontWeight: '600' as const, color: Colors.text },
  paymentCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16 },
  externalPaymentCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16 },
  shareCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16 },
  shareCardDescription: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 12 },
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
    borderRadius: 12,
    gap: 8,
  },
  shareOrderButtonText: { fontSize: 15, fontWeight: '700' as const, color: Colors.white },
  paymentRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  paymentLabel: { fontSize: 16, color: Colors.textMuted },
  paymentLabelDue: { fontSize: 17, fontWeight: '600' as const, color: Colors.text },
  paymentValue: { fontSize: 16, fontWeight: '500' as const, color: Colors.textMuted },
  paymentValueDue: { fontSize: 16, fontWeight: '700' as const, color: Colors.error },
  paymentValuePaid: { fontSize: 16, fontWeight: '600' as const, color: Colors.success },
  paymentValueReceived: { color: Colors.success },
  paymentValuePartial: { color: Colors.primary },
  paymentValuePending: { color: Colors.error },
  paymentHistoryTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.text, marginBottom: 12 },
  paymentHistoryRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.border,
    borderRadius: 8,
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
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  paymentConfirmedText: { fontSize: 15, fontWeight: '600' as const, color: Colors.success },
  recordPaymentButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
  },
  recordPaymentButtonText: { fontSize: 15, fontWeight: '700' as const, color: Colors.white },
  undoBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  undoBannerText: { fontSize: 14, color: '#ffffff', flex: 1, marginRight: 12 },
  undoBannerAction: { fontSize: 14, fontWeight: '700' as const, color: Colors.primary },
  errorContainer: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  errorText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
  },
  notifyUpdateModalContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  notifyUpdateTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, marginBottom: 6 },
  notifyUpdateSubtitle: { fontSize: 14, color: Colors.textMuted, marginBottom: 20, lineHeight: 20 },
  notifyUpdateOption: { paddingVertical: 14, paddingHorizontal: 4 },
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
  eventInput: {
    backgroundColor: Colors.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top' as const,
  },
  eventModalActions: { flexDirection: 'row' as const, gap: 12, marginTop: 16 },
  eventCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.border,
    alignItems: 'center' as const,
  },
  eventCancelText: { fontSize: 15, fontWeight: '600' as const, color: Colors.textMuted },
  eventSendButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
  },
  eventSendButtonDisabled: { backgroundColor: Colors.border, opacity: 0.5 },
  eventSendText: { fontSize: 15, fontWeight: '700' as const, color: Colors.white },
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
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center' as const,
    marginTop: 12,
    marginBottom: 20,
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
  paymentConfirmModalTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, marginBottom: 16 },
  paymentConfirmModalDescription: { fontSize: 15, color: Colors.textMuted, marginBottom: 20, lineHeight: 22 },
  paymentOptionsSection: { marginBottom: 20 },
  paymentOptionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.border,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paymentOptionRowSelected: { borderColor: Colors.primary, backgroundColor: Colors.surface },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.textSecondary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 12,
  },
  radioCircleSelected: { borderColor: Colors.primary },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary },
  paymentOptionTextContainer: { flex: 1 },
  paymentOptionText: { fontSize: 16, color: Colors.text, fontWeight: '500' as const, marginBottom: 2 },
  paymentOptionSubtext: { fontSize: 14, color: Colors.textMuted },
  partialPaymentSection: { marginBottom: 24 },
  partialPaymentLabel: { fontSize: 14, fontWeight: '600' as const, color: Colors.text, marginBottom: 8 },
  partialPaymentInput: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  partialPaymentInputError: { borderColor: Colors.error, backgroundColor: '#FFF5F5' },
  partialAmountErrorText: { fontSize: 13, color: Colors.error, marginTop: 6, fontWeight: '500' as const },
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
  paymentCancelButton: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  paymentCancelButtonText: { fontSize: 15, fontWeight: '600' as const, color: Colors.textMuted },
  paymentConfirmButton: {
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.success,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  paymentConfirmButtonDisabled: { backgroundColor: Colors.border, opacity: 0.5 },
  paymentConfirmButtonText: { fontSize: 16, fontWeight: '700' as const, color: Colors.white },
  adjustModalContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  adjustModalTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, marginBottom: 8 },
  adjustModalDescription: { fontSize: 14, color: Colors.textMuted, marginBottom: 24, lineHeight: 20 },
  adjustInputSection: { marginBottom: 20 },
  adjustInputLabel: { fontSize: 14, fontWeight: '600' as const, color: Colors.text, marginBottom: 8 },
  adjustInput: { backgroundColor: Colors.border, borderRadius: 10, padding: 14, fontSize: 16, color: Colors.text },
  adjustAmountInput: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  adjustCurrencySymbol: { fontSize: 18, fontWeight: '600' as const, color: Colors.text, marginRight: 8 },
  adjustAmountField: { flex: 1, fontSize: 18, fontWeight: '600' as const, color: Colors.text, paddingVertical: 12 },
  adjustModalActions: { flexDirection: 'row' as const, gap: 12 },
  adjustCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  adjustCancelButtonText: { fontSize: 15, fontWeight: '600' as const, color: Colors.textMuted },
  adjustSaveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  adjustSaveButtonDisabled: { backgroundColor: Colors.border },
  adjustSaveButtonText: { fontSize: 15, fontWeight: '700' as const, color: Colors.white },
  customerPaymentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  customerPaymentStatusRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    marginBottom: 14,
  },
  customerPaymentStatusInfo: {
    flex: 1,
  },
  customerPaymentStatusTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  customerPaymentStatusDate: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  customerPaymentProofRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.background,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  customerPaymentProofText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  customerPaymentProofTextAvailable: {
    color: Colors.success,
  },
  customerPaymentActions: {
    gap: 8,
  },
  viewProofButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: 'rgba(255,140,66,0.04)',
  },
  viewProofButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  requestProofButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  requestProofButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  proofRequestedInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    backgroundColor: Colors.warningLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
  },
  proofRequestedInfoText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#92400E',
  },
  vendorRecordPaymentButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  vendorRecordPaymentButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});
