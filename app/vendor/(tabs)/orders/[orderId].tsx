import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Package, Truck, Check, X, Send, User, FileEdit, Clock, CheckCircle, AlertCircle, Play } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useOrders } from '@/contexts/OrdersContext';
import { useChangeRequests } from '@/contexts/ChangeRequestsContext';
import RequestChangesModal from '@/components/vendor/RequestChangesModal';
import ChangeSummaryModal from '@/components/vendor/ChangeSummaryModal';
import type { OrderChangeRequest } from '@/types/orderChanges';
import { useChats } from '@/contexts/ChatContext';

export default function VendorOrderAcceptanceScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams();
  const orderIdStr = orderId as string;

  const {
    getOrder,
    updateOrderStatus,
    vendorConfirmPayment,
    vendorMarkNotPaid,
  } = useOrders();
  const { requests, getRequestForOrder } = useChangeRequests();

  const [isProcessing, setIsProcessing] = useState(false);
  const [showContactRequestModal, setShowContactRequestModal] = useState(false);
  const [contactDetailsRequested, setContactDetailsRequested] = useState(false);
  const contactDetailsReceived = false;
  const [showRequestChanges, setShowRequestChanges] = useState(false);
  const [showChangeSummary, setShowChangeSummary] = useState(false);
  const [pendingChangeData, setPendingChangeData] = useState<Omit<OrderChangeRequest, 'status' | 'createdAt'> | null>(null);
  const [changesSent, setChangesSent] = useState(false);

  const order = getOrder(orderIdStr);

  const latestChangeRequest = useMemo(() => {
    if (!orderIdStr) return null;
    const allForOrder = requests.filter((r) => r.orderId === orderIdStr);
    if (allForOrder.length === 0) return null;
    return allForOrder[allForOrder.length - 1];
  }, [requests, orderIdStr]);

  const pendingChangeRequest = getRequestForOrder(orderIdStr);

  if (!order) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <ArrowLeft size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Order Details</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Order not found</Text>
        </View>
      </View>
    );
  }

  const isRequested = order.status === 'requested';
  const isAccepted = order.status === 'accepted';
  const isConfirmed = order.status === 'confirmed';
  const isInProgress = order.status === 'in_progress';
  const isCompleted = order.status === 'completed';
  const isCancelled = order.status === 'cancelled';
  const isRejected = order.status === 'rejected';
  const isTerminal = isCompleted || isCancelled || isRejected;

  const paymentState = order.paymentState;
  const isPaymentPending = isAccepted && (!paymentState || paymentState === 'AWAITING_VENDOR_PAYMENT_DETAILS' || paymentState === 'PAYMENT_DETAILS_SENT');
  const isPaymentSubmitted = isAccepted && paymentState === 'CUSTOMER_MARKED_PAID';
  const isPaymentConfirmed = paymentState === 'VENDOR_PAYMENT_CONFIRMED';
  const isPaymentRejected = paymentState === 'PAYMENT_REJECTED';

  const handleAcceptOrder = () => {
    Alert.alert(
      'Accept Order',
      'Are you sure you want to accept this order?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: () => {
            setIsProcessing(true);
            const success = updateOrderStatus(orderIdStr, 'accepted');
            console.log('[VendorOrderDetail] Accept order:', orderIdStr, 'success:', success);
            setIsProcessing(false);
            if (success) {
              Alert.alert('Success', 'Order accepted successfully');
            }
          },
        },
      ]
    );
  };

  const handleDeclineOrder = () => {
    Alert.alert(
      'Decline Order',
      'Are you sure you want to decline this order? The customer will be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => {
            setIsProcessing(true);
            const success = updateOrderStatus(orderIdStr, 'rejected', 'Vendor declined the order');
            console.log('[VendorOrderDetail] Decline order:', orderIdStr, 'success:', success);
            setIsProcessing(false);
            if (success) {
              Alert.alert('Order Declined', 'The customer has been notified', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            }
          },
        },
      ]
    );
  };

  const handleConfirmPayment = () => {
    Alert.alert(
      'Confirm Payment',
      'Have you received and verified the payment from this customer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Payment',
          onPress: () => {
            setIsProcessing(true);
            const success = vendorConfirmPayment(orderIdStr);
            console.log('[VendorOrderDetail] Confirm payment:', orderIdStr, 'success:', success);
            setIsProcessing(false);
            if (success) {
              Alert.alert('Payment Confirmed', 'Payment confirmed. You can now begin the order.');
            }
          },
        },
      ]
    );
  };

  const handleMarkNotPaid = () => {
    Alert.alert(
      'Mark as Not Paid',
      'Are you sure payment was not received? The customer will be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Not Paid',
          style: 'destructive',
          onPress: () => {
            setIsProcessing(true);
            const success = vendorMarkNotPaid(orderIdStr);
            console.log('[VendorOrderDetail] Mark not paid:', orderIdStr, 'success:', success);
            setIsProcessing(false);
            if (success) {
              Alert.alert('Updated', 'Payment marked as not received. Customer has been notified.');
            }
          },
        },
      ]
    );
  };

  const handleMarkInProgress = () => {
    Alert.alert(
      'Start Order',
      'Mark this order as in progress?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: () => {
            setIsProcessing(true);
            const success = updateOrderStatus(orderIdStr, 'in_progress');
            console.log('[VendorOrderDetail] Mark in progress:', orderIdStr, 'success:', success);
            setIsProcessing(false);
            if (success) {
              Alert.alert('Success', 'Order is now in progress.');
            }
          },
        },
      ]
    );
  };

  const handleMarkCompleted = () => {
    Alert.alert(
      'Complete Order',
      'Has this order been completed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: () => {
            setIsProcessing(true);
            const success = updateOrderStatus(orderIdStr, 'completed');
            console.log('[VendorOrderDetail] Mark completed:', orderIdStr, 'success:', success);
            setIsProcessing(false);
            if (success) {
              Alert.alert('Success', 'Order marked as completed.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            }
          },
        },
      ]
    );
  };

  const handleCancelOrder = () => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancel Order',
          style: 'destructive',
          onPress: () => {
            setIsProcessing(true);
            const success = updateOrderStatus(orderIdStr, 'cancelled', 'Vendor cancelled');
            console.log('[VendorOrderDetail] Cancel order:', orderIdStr, 'success:', success);
            setIsProcessing(false);
            if (success) {
              Alert.alert('Order Cancelled', 'The customer has been notified', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            }
          },
        },
      ]
    );
  };

  const handleSendPaymentRequest = () => {
    Alert.alert(
      'Send Payment Request',
      'Send a payment request to the customer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: () => {
            console.log('[VendorOrderDetail] Payment request sent:', orderIdStr);
            Alert.alert('Success', 'Payment request sent to customer');
          },
        },
      ]
    );
  };

  const handleRequestContactDetails = () => {
    setIsProcessing(true);
    console.log('[VendorOrderDetail] Contact details requested for order:', orderIdStr);
    setTimeout(() => {
      setIsProcessing(false);
      setShowContactRequestModal(false);
      setContactDetailsRequested(true);
      Alert.alert('Request Sent', 'The customer will be asked to share their contact details.');
    }, 500);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatRequestedDateTime = () => {
    if (!order.scheduledDate && !order.scheduledTime) return null;
    if (order.scheduledDate && order.scheduledTime) {
      const date = new Date(order.scheduledDate);
      const formattedDate = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      return `${formattedDate} • ${order.scheduledTime}`;
    }
    if (order.scheduledDate) {
      const date = new Date(order.scheduledDate);
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    return order.scheduledTime || null;
  };

  const handleReviewChanges = useCallback((data: Omit<OrderChangeRequest, 'status' | 'createdAt'>) => {
    console.log('[VendorOrderDetail] Reviewing changes:', data);
    setPendingChangeData(data);
    setShowRequestChanges(false);
    setTimeout(() => setShowChangeSummary(true), 300);
  }, []);

  const { chats, addMessageToChat } = useChats();

  const handleSendChanges = useCallback((changeRequest: OrderChangeRequest) => {
    console.log('[VendorOrderDetail] Change request sent:', changeRequest);
    if (order) {
      const chat = chats.find(
        (c) => c.vendorId === order.vendorId && c.customerId === (order.customerId || 'customer-001')
      );
      if (chat) {
        addMessageToChat(chat.id, {
          type: 'system',
          content: `${order.vendorName} requested changes to your order.`,
          sender: 'system',
        });
        addMessageToChat(chat.id, {
          type: 'change_request',
          content: 'Vendor requested changes',
          sender: 'vendor',
          changeRequestData: changeRequest,
        });
        console.log('[VendorOrderDetail] Change request message injected into chat:', chat.id);
      }
    }
    setShowChangeSummary(false);
    setPendingChangeData(null);
    setChangesSent(true);
    Alert.alert('Changes Sent', 'The customer has been notified about the requested changes.', [{ text: 'OK' }]);
  }, [order, chats, addMessageToChat]);

  const handleBackToEdit = useCallback(() => {
    setShowChangeSummary(false);
    setTimeout(() => setShowRequestChanges(true), 300);
  }, []);

  const totalItemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  const getStatusConfig = () => {
    if (isRequested) return { label: 'NEW ORDER', bg: '#EFF6FF', text: '#2563EB' };
    if (isAccepted) {
      if (isPaymentSubmitted) return { label: 'PAYMENT SUBMITTED', bg: '#FFFBEB', text: '#92400E' };
      if (isPaymentRejected) return { label: 'PAYMENT ISSUE', bg: '#FEF2F2', text: '#DC2626' };
      return { label: 'ACCEPTED – AWAITING PAYMENT', bg: '#FFF7ED', text: '#EA580C' };
    }
    if (isConfirmed) return { label: 'CONFIRMED', bg: '#F5F3FF', text: '#7C3AED' };
    if (isInProgress) return { label: 'IN PROGRESS', bg: '#F0FDFA', text: '#0D9488' };
    if (isCompleted) return { label: 'COMPLETED', bg: '#F0FDF4', text: '#16A34A' };
    if (isCancelled) return { label: 'CANCELLED', bg: '#FEF2F2', text: '#DC2626' };
    if (isRejected) return { label: 'DECLINED', bg: '#F9FAFB', text: '#6B7280' };
    return { label: order.status.toUpperCase(), bg: '#F9FAFB', text: '#6B7280' };
  };

  const statusConfig = getStatusConfig();

  const renderChangeRequestResponseCard = () => {
    if (!latestChangeRequest || latestChangeRequest.status === 'pending') return null;

    if (latestChangeRequest.status === 'accepted') {
      return (
        <View style={styles.section}>
          <View style={styles.changeResponseCard}>
            <View style={styles.changeResponseIconRow}>
              <CheckCircle size={20} color={Colors.success} />
              <Text style={styles.changeResponseAcceptedText}>Customer accepted your changes</Text>
            </View>
            {latestChangeRequest.proposedTotal !== latestChangeRequest.originalTotal && (
              <Text style={styles.changeResponseDetail}>
                Updated total: ₦{(latestChangeRequest.proposedTotal / 100).toFixed(2)}
              </Text>
            )}
          </View>
        </View>
      );
    }

    if (latestChangeRequest.status === 'declined') {
      return (
        <View style={styles.section}>
          <View style={styles.changeResponseCardDeclined}>
            <View style={styles.changeResponseIconRow}>
              <AlertCircle size={20} color={Colors.error} />
              <Text style={styles.changeResponseDeclinedText}>Customer declined your changes</Text>
            </View>
            <View style={styles.changeResponseActions}>
              <TouchableOpacity
                style={styles.editRequestAgainButton}
                onPress={() => setShowRequestChanges(true)}
                activeOpacity={0.7}
              >
                <FileEdit size={16} color={Colors.primary} />
                <Text style={styles.editRequestAgainText}>Edit Request Again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelOrderSmallButton}
                onPress={handleCancelOrder}
                activeOpacity={0.7}
              >
                <X size={16} color={Colors.error} />
                <Text style={styles.cancelOrderSmallText}>Cancel Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    return null;
  };

  const renderPaymentStatusCard = () => {
    if (!isAccepted && !isConfirmed && !isInProgress && !isCompleted) return null;
    if (isTerminal && !isCompleted) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment</Text>
        <View style={styles.paymentStatusCard}>
          {isPaymentPending && (
            <>
              <View style={styles.paymentStatusRow}>
                <View style={[styles.paymentStatusDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.paymentStatusLabel}>Payment Pending</Text>
              </View>
              <View style={styles.paymentAmountRow}>
                <Text style={styles.paymentAmountLabel}>Amount due</Text>
                <Text style={styles.paymentAmountValueDue}>₦{(order.total / 100).toFixed(2)}</Text>
              </View>
            </>
          )}

          {isPaymentSubmitted && (
            <>
              <View style={styles.paymentStatusRow}>
                <View style={[styles.paymentStatusDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={styles.paymentStatusLabelBlue}>Payment Submitted (Awaiting Verification)</Text>
              </View>
              <View style={styles.paymentAmountRow}>
                <Text style={styles.paymentAmountLabel}>Amount</Text>
                <Text style={styles.paymentAmountValue}>₦{(order.total / 100).toFixed(2)}</Text>
              </View>
              {order.customerMarkedPaidAt && (
                <Text style={styles.paymentTimestamp}>
                  Submitted {formatDate(order.customerMarkedPaidAt)}
                </Text>
              )}
            </>
          )}

          {isPaymentRejected && (
            <>
              <View style={styles.paymentStatusRow}>
                <View style={[styles.paymentStatusDot, { backgroundColor: Colors.error }]} />
                <Text style={styles.paymentStatusLabelRed}>Payment Not Received</Text>
              </View>
              <View style={styles.paymentAmountRow}>
                <Text style={styles.paymentAmountLabel}>Amount due</Text>
                <Text style={styles.paymentAmountValueDue}>₦{(order.total / 100).toFixed(2)}</Text>
              </View>
            </>
          )}

          {isPaymentConfirmed && (
            <>
              <View style={styles.paymentStatusRow}>
                <View style={[styles.paymentStatusDot, { backgroundColor: Colors.success }]} />
                <Text style={styles.paymentStatusLabelGreen}>Payment Confirmed</Text>
              </View>
              <View style={styles.paymentAmountRow}>
                <Text style={styles.paymentAmountLabel}>Amount received</Text>
                <Text style={styles.paymentAmountValuePaid}>₦{(order.total / 100).toFixed(2)}</Text>
              </View>
            </>
          )}

          {!isPaymentSubmitted && !isPaymentConfirmed && !isPaymentRejected && isAccepted && (
            <View style={styles.paymentAmountRow}>
              <Text style={styles.paymentAmountLabel}>Balance due</Text>
              <Text style={styles.paymentAmountValueDue}>₦{(order.total / 100).toFixed(2)}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderBottomActions = () => {
    if (isTerminal) return null;

    if (isRequested) {
      return (
        <SafeAreaView edges={['bottom']} style={styles.actionsContainer}>
          {!changesSent && !pendingChangeRequest && (
            <TouchableOpacity
              style={styles.requestChangesButton}
              onPress={() => setShowRequestChanges(true)}
              activeOpacity={0.7}
            >
              <FileEdit size={16} color={Colors.primary} />
              <Text style={styles.requestChangesButtonText}>Request Changes</Text>
            </TouchableOpacity>
          )}
          {(changesSent || !!pendingChangeRequest) && (
            <View style={styles.changesSentBanner}>
              <Clock size={14} color="#92400E" />
              <Text style={styles.changesPendingText}>Waiting for customer response</Text>
            </View>
          )}
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
              <Check size={20} color="#fff" strokeWidth={2.5} />
              <Text style={styles.acceptButtonText}>
                {isProcessing ? 'Processing...' : 'Accept Order'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    if (isAccepted) {
      if (isPaymentSubmitted) {
        return (
          <SafeAreaView edges={['bottom']} style={styles.actionsContainer}>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.markNotPaidButton}
                onPress={handleMarkNotPaid}
                disabled={isProcessing}
                activeOpacity={0.7}
              >
                <X size={18} color={Colors.error} strokeWidth={2} />
                <Text style={styles.markNotPaidText}>Not Paid</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmPaymentButton}
                onPress={handleConfirmPayment}
                disabled={isProcessing}
                activeOpacity={0.7}
              >
                <Check size={20} color="#fff" strokeWidth={2.5} />
                <Text style={styles.confirmPaymentText}>
                  {isProcessing ? 'Confirming...' : 'Confirm Payment'}
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        );
      }

      return (
        <SafeAreaView edges={['bottom']} style={styles.actionsContainer}>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelOrder}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel order</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.paymentRequestButton}
              onPress={handleSendPaymentRequest}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              <Send size={20} color="#fff" strokeWidth={2.5} />
              <Text style={styles.paymentRequestButtonText}>
                {isProcessing ? 'Sending...' : 'Send payment request'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    if (isConfirmed) {
      return (
        <SafeAreaView edges={['bottom']} style={styles.actionsContainer}>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.markInProgressButton}
              onPress={handleMarkInProgress}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              <Play size={20} color="#fff" strokeWidth={2.5} />
              <Text style={styles.markInProgressText}>
                {isProcessing ? 'Processing...' : 'Mark In Progress'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    if (isInProgress) {
      return (
        <SafeAreaView edges={['bottom']} style={styles.actionsContainer}>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.markCompletedButton}
              onPress={handleMarkCompleted}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              <Check size={20} color="#fff" strokeWidth={2.5} />
              <Text style={styles.markCompletedText}>
                {isProcessing ? 'Processing...' : 'Mark as Completed'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <ArrowLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.section}>
            <View style={styles.infoCard}>
              <View style={styles.customerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.customerName}>{order.customerName || 'Customer'}</Text>
                  <Text style={styles.orderId}>{order.publicOrderId}</Text>
                  <Text style={styles.orderPlacedDate}>{formatDate(order.orderDate)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: statusConfig.text }]}>
                    {statusConfig.label}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {renderChangeRequestResponseCard()}

          {renderPaymentStatusCard()}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fulfillment</Text>
            <View style={[styles.fulfillmentCard, isTerminal && styles.fulfillmentCardGreyed]}>
              <View style={styles.fulfillmentRow}>
                {order.fulfillmentType === 'Pickup' ? (
                  <Package size={20} color={isTerminal ? "#999" : Colors.text} strokeWidth={2} />
                ) : (
                  <Truck size={20} color={isTerminal ? "#999" : Colors.text} strokeWidth={2} />
                )}
                <Text style={[styles.fulfillmentType, isTerminal && styles.fulfillmentTypeGreyed]}>{order.fulfillmentType}</Text>
              </View>
              {formatRequestedDateTime() && (
                <Text style={[styles.requestedDateTime, isTerminal && styles.requestedDateTimeGreyed]}>{formatRequestedDateTime()}</Text>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Items ({totalItemCount})</Text>
            {order.items.map((item, index) => (
              <View key={index} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemQuantity}>{item.quantity}x</Text>
                    <Text style={styles.itemName}>{item.name}</Text>
                  </View>
                  <Text style={styles.itemPrice}>₦{(item.price / 100).toFixed(2)}</Text>
                </View>
                {item.addOns && item.addOns.length > 0 && (
                  <View style={styles.addOnsContainer}>
                    {item.addOns.map((addOn, addOnIndex) => (
                      <View key={addOnIndex} style={styles.addOnRow}>
                        <Text style={styles.addOnText}>+ {addOn.name}</Text>
                        <Text style={styles.addOnPrice}>₦{(addOn.price / 100).toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
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
            <Text style={styles.sectionTitle}>Order Summary</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>₦{(order.subtotal / 100).toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax</Text>
                <Text style={styles.summaryValue}>₦{(order.tax / 100).toFixed(2)}</Text>
              </View>
              {order.discount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Discount</Text>
                  <Text style={[styles.summaryValue, styles.discountValue]}>
                    -₦{(order.discount / 100).toFixed(2)}
                  </Text>
                </View>
              )}
              <View style={[styles.summaryRow, styles.summaryRowTotal]}>
                <Text style={styles.summaryLabelTotal}>Total</Text>
                <Text style={styles.summaryValueTotal}>₦{(order.total / 100).toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {(isAccepted || isConfirmed || isInProgress) && !isTerminal && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact Details</Text>
              <View style={styles.contactDetailsCard}>
                {contactDetailsReceived ? (
                  <TouchableOpacity style={styles.viewContactButton} activeOpacity={0.7}>
                    <User size={20} color={Colors.text} />
                    <Text style={styles.viewContactButtonText}>View contact card</Text>
                  </TouchableOpacity>
                ) : contactDetailsRequested ? (
                  <View style={styles.pendingContactContainer}>
                    <Text style={styles.pendingContactText}>
                      Waiting for customer to share contact details
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.requestContactButton}
                    onPress={() => setShowContactRequestModal(true)}
                    activeOpacity={0.7}
                  >
                    <User size={20} color="#fff" />
                    <Text style={styles.requestContactButtonText}>Request contact details</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {renderBottomActions()}

      <Modal
        visible={showContactRequestModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowContactRequestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalCardTitle}>Request contact details?</Text>
            <Text style={styles.modalCardBody}>
              Contact details are required to complete this order. The customer will be asked to share their contact information for this order only.
            </Text>
            <View style={styles.modalCardActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowContactRequestModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleRequestContactDetails}
                disabled={isProcessing}
                activeOpacity={0.7}
              >
                <Text style={styles.modalConfirmButtonText}>
                  {isProcessing ? 'Requesting...' : 'Request'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <RequestChangesModal
        visible={showRequestChanges}
        onClose={() => setShowRequestChanges(false)}
        onReview={handleReviewChanges}
        items={order.items}
        orderId={order.id}
        vendorId={order.vendorId}
        originalTotal={order.total}
        currency={(order.currency as any) || 'NGN'}
      />

      <ChangeSummaryModal
        visible={showChangeSummary}
        onClose={() => {
          setShowChangeSummary(false);
          setPendingChangeData(null);
        }}
        onBack={handleBackToEdit}
        onSend={handleSendChanges}
        changeData={pendingChangeData}
        currency={(order.currency as any) || 'NGN'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  safeArea: {
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
    marginRight: 40,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  customerRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  orderPlacedDate: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  statusBadge: {
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginTop: 2,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  changeResponseCard: {
    backgroundColor: Colors.successLight,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.successBorder,
  },
  changeResponseIconRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  changeResponseAcceptedText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.success,
    flex: 1,
  },
  changeResponseDetail: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    marginLeft: 30,
  },
  changeResponseCardDeclined: {
    backgroundColor: Colors.errorLight,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  changeResponseDeclinedText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.error,
    flex: 1,
  },
  changeResponseActions: {
    flexDirection: 'row' as const,
    marginTop: 14,
    gap: 10,
  },
  editRequestAgainButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    gap: 6,
  },
  editRequestAgainText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  cancelOrderSmallButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: Colors.error,
    gap: 6,
  },
  cancelOrderSmallText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.error,
  },
  paymentStatusCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paymentStatusRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: 14,
  },
  paymentStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  paymentStatusLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#92400E',
  },
  paymentStatusLabelBlue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1D4ED8',
    flex: 1,
  },
  paymentStatusLabelRed: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.error,
  },
  paymentStatusLabelGreen: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  paymentAmountRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  paymentAmountLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  paymentAmountValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  paymentAmountValueDue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#DC2626',
  },
  paymentAmountValuePaid: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.success,
  },
  paymentTimestamp: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 8,
  },
  fulfillmentCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fulfillmentCardGreyed: {
    backgroundColor: '#f5f5f5',
  },
  fulfillmentRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: 4,
  },
  fulfillmentType: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  fulfillmentTypeGreyed: {
    color: Colors.textMuted,
  },
  requestedDateTime: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    marginTop: 4,
  },
  requestedDateTimeGreyed: {
    color: Colors.textMuted,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
  },
  itemInfo: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    flex: 1,
    gap: 8,
  },
  itemQuantity: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  addOnsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  addOnRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 6,
  },
  addOnText: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  addOnPrice: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  noteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noteText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
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
  summaryLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  discountValue: {
    color: Colors.success,
  },
  summaryLabelTotal: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  summaryValueTotal: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  contactDetailsCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  requestContactButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.text,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  requestContactButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  pendingContactContainer: {
    paddingVertical: 12,
    alignItems: 'center' as const,
  },
  pendingContactText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    fontStyle: 'italic' as const,
  },
  viewContactButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  viewContactButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  actionsContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  requestChangesButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(255,140,66,0.2)',
    gap: 6,
  },
  requestChangesButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  changesSentBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 6,
  },
  changesPendingText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#92400E',
  },
  actions: {
    flexDirection: 'row' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  declineButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.error,
    gap: 8,
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.error,
  },
  acceptButton: {
    flex: 2,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.text,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  paymentRequestButton: {
    flex: 2,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.text,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  paymentRequestButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  confirmPaymentButton: {
    flex: 2,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.success,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  confirmPaymentText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  markNotPaidButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.error,
    gap: 6,
  },
  markNotPaidText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.error,
  },
  markInProgressButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#0D9488',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  markInProgressText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  markCompletedButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.text,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  markCompletedText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textAlign: 'center' as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalCardTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  modalCardBody: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center' as const,
    marginBottom: 24,
  },
  modalCardActions: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.text,
    alignItems: 'center' as const,
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
