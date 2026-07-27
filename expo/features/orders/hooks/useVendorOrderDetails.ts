import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Alert } from '@/utils/alert';
import { useOrders } from '@/contexts/OrdersContext';
import { useExternalOrders } from '@/contexts/ExternalOrdersContext';
import { useVendorAutoAccept } from '@/contexts/VendorAutoAcceptContext';
import { useAuditLog } from '@/contexts/AuditLogContext';
import { useChangeRequests } from '@/contexts/ChangeRequestsContext';
import type { ChangeRequestIssueType, ChangeRequestChange } from '@/contexts/ChangeRequestsContext';
import {
  useAcceptOrder,
  useRejectOrder,
  useMarkOrderPaid,
  useMarkInProgress,
  useCompleteOrder,
  useCancelOrder,
} from '@/data/hooks';
import { getVendorEventMessage } from '@/utils/systemMessages';
import { formatRequestedDateTime } from '@/utils/orderDateFormatting';
import { isExternalOrder } from '@/utils/orderHelpers';
import {
  selectOrderDisplayFlags,
  selectOrderFinancials,
  selectPaymentDisplayState,
  selectIsPaymentSufficient,
} from '@/features/orders/selectors/orderSelectors';
import { buildCancelPayload, buildPaymentUpdate } from '@/features/orders/actions/orderActions';
import { useAuth } from '@/contexts/AuthContext';
import { useAppRating } from '@/contexts/AppRatingContext';

export function useVendorOrderDetails(orderId: string, openedFromChat: boolean) {
  const router = useRouter();
  const { getOrder, addVendorEvent, updateOrderStatus } = useOrders();
  const { externalOrders } = useExternalOrders();
  const { autoAcceptEnabled } = useVendorAutoAccept();
  const { logEvent } = useAuditLog();
  const { createChangeRequest, getRequestForOrder } = useChangeRequests();
  const { user } = useAuth();
  const { triggerAppRating } = useAppRating();
  const appRatingTriggered = useRef(false);

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

  const [showAcceptModal, setShowAcceptModal] = useState<boolean>(false);
  const [showDeclineModal, setShowDeclineModal] = useState<boolean>(false);
  const [declineReasonCode, setDeclineReasonCode] = useState<string>('');
  const [declineReasonText, setDeclineReasonText] = useState<string>('');
  const [showDeclineDropdown, setShowDeclineDropdown] = useState<boolean>(false);
  const [showInProgressModal, setShowInProgressModal] = useState<boolean>(false);
  const [showCompletedModal, setShowCompletedModal] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [showCancelDropdown, setShowCancelDropdown] = useState<boolean>(false);
  const [cancelReasonCode, setCancelReasonCode] = useState<string>('');
  const [cancelReasonText, setCancelReasonText] = useState<string>('');

  const [showRequestChangesSheet, setShowRequestChangesSheet] = useState<boolean>(false);

  const [customEventMessage, setCustomEventMessage] = useState<string>('');
  const [showNotifyUpdateModal, setShowNotifyUpdateModal] = useState<boolean>(false);
  const [notifyUpdateMode, setNotifyUpdateMode] = useState<'menu' | 'custom'>('menu');

  const [showUndoBanner, setShowUndoBanner] = useState<boolean>(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoBannerOpacity = useRef(new Animated.Value(0)).current;

  const [showAdjustTotalModal, setShowAdjustTotalModal] = useState<boolean>(false);
  const [adjustmentLabel, setAdjustmentLabel] = useState<string>('');
  const [adjustmentAmount, setAdjustmentAmount] = useState<string>('');
  const [appliedAdjustments, setAppliedAdjustments] = useState<{ label: string; amount: number }[]>([]);

  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState<boolean>(false);
  const [paymentType, setPaymentType] = useState<'full' | 'partial' | null>(null);
  const [partialPaymentAmount, setPartialPaymentAmount] = useState<string>('');
  const [partialAmountError, setPartialAmountError] = useState<string>('');
  const [paymentHistory, setPaymentHistory] = useState<{ amount: number; timestamp: string }[]>([]);
  const [showPaymentNotRecordedModal, setShowPaymentNotRecordedModal] = useState<boolean>(false);

  useEffect(() => {
    if (order?.paymentHistory) {
      setPaymentHistory(order.paymentHistory);
    }
  }, [order?.paymentHistory]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const displayFlags = order
    ? selectOrderDisplayFlags(order, autoAcceptEnabled)
    : null;

  const financials = order
    ? selectOrderFinancials(order, appliedAdjustments)
    : null;

  const paymentState = order && financials
    ? selectPaymentDisplayState(order, financials.calculatedTotal, financials.balanceDue)
    : null;

  const requestedDateTime = order
    ? formatRequestedDateTime(
        isExternalOrder(order) && 'fulfillmentDate' in order ? (order as any).fulfillmentDate : undefined,
        isExternalOrder(order) && 'fulfillmentTime' in order ? (order as any).fulfillmentTime : undefined,
        order.scheduledDate,
        order.scheduledTime,
        isExternalOrder(order)
      )
    : null;

  const externalOrderData = order ? externalOrders.find(o => o.id === orderId) : null;

  const handleRequestChanges = useCallback(() => {
    console.log('[VendorOrders] Opening request changes sheet for order:', orderId);
    setShowRequestChangesSheet(true);
  }, [orderId]);

  const handleSendChangeRequest = useCallback((params: {
    issueType: ChangeRequestIssueType;
    changes: ChangeRequestChange[];
    vendorMessage?: string;
  }) => {
    if (!order) return;
    console.log('[VendorOrders] Sending change request:', params.issueType);

    const originalTotal = order.items.reduce((sum, item) => {
      const addOnTotal = item.addOns?.reduce((s, a) => s + a.price, 0) ?? 0;
      return sum + (item.price + addOnTotal) * item.quantity;
    }, 0);

    let proposedTotal = originalTotal;
    for (const change of params.changes) {
      const origLineTotal = change.originalItem.price * change.originalItem.quantity;
      if (change.action === 'remove') {
        proposedTotal -= origLineTotal;
      } else if (change.action === 'adjust_quantity' && change.newQuantity !== undefined) {
        proposedTotal += (change.newQuantity - change.originalItem.quantity) * change.originalItem.price;
      } else if (change.action === 'replace' && change.replacementItem && change.newQuantity !== undefined) {
        proposedTotal = proposedTotal - origLineTotal + change.replacementItem.price * change.newQuantity;
      }
    }

    createChangeRequest({
      orderId,
      vendorName: order.vendorName,
      issueType: params.issueType,
      vendorMessage: params.vendorMessage,
      changes: params.changes,
      originalTotal,
      proposedTotal: Math.max(0, proposedTotal),
    });
    updateOrderStatus(orderId, 'awaiting_customer_update');
    void logEvent({
      eventType: 'order_status_changed',
      orderId: order.id,
      vendorId: 'vendor_mock',
      customerId: order.customerId || 'customer_mock',
      previousState: order.status,
      newState: 'awaiting_customer_update',
    });
    setShowRequestChangesSheet(false);
  }, [order, orderId, createChangeRequest, updateOrderStatus, logEvent]);

  const pendingChangeRequest = order ? getRequestForOrder(orderId) : undefined;

  const handleAcceptOrder = () => setShowAcceptModal(true);

  const confirmAcceptOrder = () => {
    if (!order) return;
    setShowAcceptModal(false);
    acceptOrderMutation.mutate(orderId, {
      onSuccess: () => {
        void logEvent({
          eventType: 'order_status_changed',
          orderId: order.id,
          vendorId: 'vendor_mock',
          customerId: order.customerId || 'customer_mock',
          previousState: order.status,
          newState: 'accepted',
        });
        if (user && !appRatingTriggered.current) {
          appRatingTriggered.current = true;
          console.log('[VendorOrders] Triggering app rating prompt: vendor_first_order');
          setTimeout(() => {
            void triggerAppRating(user.id, 'vendor', 'vendor_first_order');
          }, 3000);
        }
        setTimeout(() => router.back(), 600);
      },
      onError: () => Alert.alert('Error', 'Unable to accept order. Please try again.'),
    });
  };

  const handleDeclineOrder = () => {
    setDeclineReasonCode('');
    setDeclineReasonText('');
    setShowDeclineDropdown(false);
    setShowDeclineModal(true);
  };

  const confirmDeclineOrder = () => {
    if (!order) return;
    setShowDeclineModal(false);
    rejectOrderMutation.mutate({ orderId }, {
      onSuccess: () => {
        void logEvent({
          eventType: 'order_status_changed',
          orderId: order.id,
          vendorId: 'vendor_mock',
          customerId: order.customerId || 'customer_mock',
          previousState: order.status,
          newState: 'rejected',
        });
        setTimeout(() => router.back(), 600);
      },
      onError: () => Alert.alert('Error', 'Unable to decline order. Please try again.'),
    });
  };

  const handleMarkInProgress = () => {
    if (!order) return;
    const isPaymentSufficient = selectIsPaymentSufficient(order.paymentStatus);
    if (!isPaymentSufficient) {
      setShowPaymentNotRecordedModal(true);
      return;
    }
    setShowInProgressModal(true);
  };

  const confirmMarkInProgress = () => {
    if (!order) return;
    setShowInProgressModal(false);
    markInProgressMutation.mutate(orderId, {
      onSuccess: () => {
        void logEvent({
          eventType: 'order_status_changed',
          orderId: order.id,
          vendorId: 'vendor_mock',
          customerId: order.customerId || 'customer_mock',
          previousState: order.status,
          newState: 'in_progress',
        });
        setTimeout(() => router.back(), 600);
      },
      onError: () => Alert.alert('Error', 'Unable to mark in progress. Please try again.'),
    });
  };

  const handleMarkCompleted = () => setShowCompletedModal(true);

  const confirmMarkCompleted = () => {
    if (!order) return;
    setShowCompletedModal(false);
    completeOrderMutation.mutate(orderId, {
      onSuccess: () => {
        void logEvent({
          eventType: 'order_status_changed',
          orderId: order.id,
          vendorId: 'vendor_mock',
          customerId: order.customerId || 'customer_mock',
          previousState: order.status,
          newState: 'completed',
        });
        if (user && !appRatingTriggered.current) {
          appRatingTriggered.current = true;
          console.log('[VendorOrders] Triggering app rating prompt: vendor_order_completed');
          setTimeout(() => {
            void triggerAppRating(user.id, 'vendor', 'vendor_order_completed');
          }, 3000);
        }
        setTimeout(() => router.back(), 600);
      },
      onError: () => Alert.alert('Error', 'Unable to complete order. Please try again.'),
    });
  };

  const handleCancelOrder = () => {
    setCancelReasonCode('');
    setCancelReasonText('');
    setShowCancelModal(true);
  };

  const confirmCancelOrder = () => {
    if (!order) return;
    const payload = buildCancelPayload(orderId, cancelReasonCode, cancelReasonText);
    if (!payload) {
      if (!cancelReasonCode) {
        Alert.alert('Reason required', 'Please select a reason for cancelling this order.');
      } else {
        Alert.alert('Details required', 'Please provide details for the cancellation reason.');
      }
      return;
    }
    setShowCancelModal(false);
    cancelOrderMutation.mutate(payload, {
      onSuccess: () => {
        setCancelReasonCode('');
        setCancelReasonText('');
        void logEvent({
          eventType: 'order_status_changed',
          orderId: order.id,
          vendorId: 'vendor_mock',
          customerId: order.customerId || 'customer_mock',
          previousState: order.status,
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
    if (!order) return;
    const message = getVendorEventMessage(eventType, order.vendorName, msg);
    const success = addVendorEvent(orderId, {
      eventType,
      actor: { type: 'vendor', name: order.vendorName },
      message,
    });
    if (success) {
      console.log('[VendorOrders] Event sent:', eventType, message);
      if (eventType !== 'ready') {
        Alert.alert('Update sent', 'Customer has been notified.');
      }
    }
  }, [orderId, order, addVendorEvent]);

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

  const confirmPaymentReceived = () => {
    if (!order || !paymentType || !financials) return;
    const result = buildPaymentUpdate(
      paymentType,
      partialPaymentAmount,
      financials.balanceDue,
      order.amountPaid || 0,
      financials.calculatedTotal
    );
    if (!result.valid) {
      setPartialAmountError(result.error ?? 'Invalid amount.');
      return;
    }
    setShowPaymentConfirmModal(false);
    const timestamp = new Date().toISOString();
    const newRecord = { amount: result.amountReceived, timestamp };
    setPaymentHistory(prev => [...prev, newRecord]);
    void logEvent({
      eventType: paymentType === 'full' ? 'full_payment_marked' : 'partial_payment_marked',
      orderId: order.id,
      vendorId: 'vendor_mock',
      customerId: order.customerId || 'customer_mock',
      metadata: {
        amountReceived: result.amountReceived / 100,
        totalPaid: result.newTotalPaid / 100,
        balanceDue: result.newBalanceDue / 100,
        timestamp,
      },
    });
    setTimeout(() => router.back(), 600);
  };

  const openPaymentModal = () => {
    setPaymentType(null);
    setPartialPaymentAmount('');
    setPartialAmountError('');
    setShowPaymentConfirmModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentConfirmModal(false);
    setPaymentType(null);
    setPartialPaymentAmount('');
    setPartialAmountError('');
  };

  const applyAdjustment = () => {
    const amountInCents = Math.round(parseFloat(adjustmentAmount) * 100);
    if (amountInCents > 0) {
      setAppliedAdjustments(prev => [
        ...prev,
        { label: adjustmentLabel.trim(), amount: amountInCents },
      ]);
    }
    setShowAdjustTotalModal(false);
    setAdjustmentLabel('');
    setAdjustmentAmount('');
  };

  const handleOpenChat = () => {
    router.push({
      pathname: '/vendor/chats/[orderId]' as any,
      params: { orderId },
    });
  };

  return {
    order,
    openedFromChat,
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
    declineReasonCode,
    setDeclineReasonCode,
    declineReasonText,
    setDeclineReasonText,
    showDeclineDropdown,
    setShowDeclineDropdown,
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
    showRequestChangesSheet,
    setShowRequestChangesSheet,
    handleRequestChanges,
    handleSendChangeRequest,
    pendingChangeRequest,
  };
}
