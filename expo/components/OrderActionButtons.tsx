import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { CreditCard, Clock, MessageCircle, XCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { Order } from '@/mocks/ordersData';
import type { PaymentState } from '@/constants/paymentStates';

export type OrderActionSource = 'chat' | 'orders';

interface OrderActionButtonsProps {
  order: Order;
  source: OrderActionSource;
  hasPendingChanges?: boolean;
  onIvePaid?: () => void;
  onMessageVendor?: () => void;
  onCancelOrder?: () => void;
}

function getPaymentStatus(order: Order): 'UNPAID' | 'PAYMENT_SUBMITTED' | 'PAID_CONFIRMED' {
  const ps = order.paymentState;
  if (ps === 'CUSTOMER_MARKED_PAID' || ps === 'PAYMENT_UNDER_REVIEW') {
    return 'PAYMENT_SUBMITTED';
  }
  if (
    ps === 'VENDOR_PAYMENT_CONFIRMED' ||
    ps === 'ORDER_READY' ||
    ps === 'ORDER_COMPLETED'
  ) {
    return 'PAID_CONFIRMED';
  }
  return 'UNPAID';
}

export default function OrderActionButtons({
  order,
  source,
  hasPendingChanges = false,
  onIvePaid,
  onMessageVendor,
  onCancelOrder,
}: OrderActionButtonsProps) {
  const paymentStatus = useMemo(() => getPaymentStatus(order), [order]);

  const buttons = useMemo(() => {
    const result: {
      showMessageVendor: boolean;
      showIvePaid: boolean;
      showPaymentSubmitted: boolean;
      showCancelOrder: boolean;
    } = {
      showMessageVendor: false,
      showIvePaid: false,
      showPaymentSubmitted: false,
      showCancelOrder: false,
    };

    switch (order.status) {
      case 'requested':
        if (source === 'orders') {
          result.showMessageVendor = true;
        }
        result.showCancelOrder = true;
        break;

      case 'accepted':
        if (paymentStatus === 'UNPAID') {
          if (source === 'chat') {
            if (!hasPendingChanges) result.showIvePaid = true;
          } else {
            result.showMessageVendor = true;
            if (!hasPendingChanges) result.showIvePaid = true;
          }
        } else if (paymentStatus === 'PAYMENT_SUBMITTED') {
          if (source === 'chat') {
            result.showPaymentSubmitted = true;
          } else {
            result.showMessageVendor = true;
            result.showPaymentSubmitted = true;
          }
        }
        break;

      case 'confirmed':
        if (source === 'orders') {
          result.showMessageVendor = true;
        }
        break;

      case 'in_progress':
        if (source === 'orders') {
          result.showMessageVendor = true;
        }
        break;

      case 'completed':
      case 'rejected':
      case 'cancelled':
      case 'expired':
        break;
    }

    return result;
  }, [order.status, paymentStatus, source, hasPendingChanges]);

  const hasAny =
    buttons.showMessageVendor ||
    buttons.showIvePaid ||
    buttons.showPaymentSubmitted ||
    buttons.showCancelOrder;

  if (!hasAny) return null;

  const hasTwoMainButtons =
    (buttons.showMessageVendor && buttons.showIvePaid) ||
    (buttons.showMessageVendor && buttons.showPaymentSubmitted);

  return (
    <View style={styles.container}>
      {buttons.showCancelOrder && !hasTwoMainButtons && (
        <TouchableOpacity
          style={[styles.btn, styles.cancelBtn]}
          onPress={onCancelOrder}
          activeOpacity={0.8}
          testID="order-action-cancel"
        >
          <XCircle size={17} color={Colors.error} strokeWidth={2} />
          <Text style={styles.cancelBtnText}>Cancel Order</Text>
        </TouchableOpacity>
      )}

      {buttons.showMessageVendor && (
        <TouchableOpacity
          style={[styles.btn, styles.messageBtn, hasTwoMainButtons && styles.btnHalf]}
          onPress={onMessageVendor}
          activeOpacity={0.8}
          testID="order-action-message"
        >
          <MessageCircle size={17} color={Colors.text} strokeWidth={2} />
          <Text style={styles.messageBtnText}>Message Vendor</Text>
        </TouchableOpacity>
      )}

      {buttons.showIvePaid && (
        <TouchableOpacity
          style={[styles.btn, styles.paidBtn, hasTwoMainButtons && styles.btnHalf]}
          onPress={onIvePaid}
          activeOpacity={0.8}
          testID="order-action-ive-paid"
        >
          <CreditCard size={17} color={Colors.white} strokeWidth={2} />
          <Text style={styles.paidBtnText}>I've Paid</Text>
        </TouchableOpacity>
      )}

      {buttons.showPaymentSubmitted && (
        <View
          style={[styles.btn, styles.waitingBtn, hasTwoMainButtons && styles.btnHalf]}
          testID="order-action-payment-submitted"
        >
          <Clock size={17} color={Colors.textMuted} strokeWidth={2} />
          <Text style={styles.waitingBtnText}>Payment Submitted</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row' as const,
    gap: 10,
    flex: 1,
  },
  btn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 7,
    flex: 1,
  },
  btnHalf: {
    flex: 1,
  },
  paidBtn: {
    backgroundColor: Colors.primary,
  },
  paidBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  waitingBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    opacity: 0.7,
  },
  waitingBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  messageBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  cancelBtn: {
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.error,
  },
});
