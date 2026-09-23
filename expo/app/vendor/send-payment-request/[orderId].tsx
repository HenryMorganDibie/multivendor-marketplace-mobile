import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '@/utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Package, ChevronDown, Check } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import type { Order } from '@/mocks/ordersData';
import { useOrders } from '@/contexts/OrdersContext';
import { useVendor } from '@/contexts/VendorContext';
import { callable } from '@/lib/firebase';
import { useCurrentPaymentInstructions } from '@/hooks/useCurrentPaymentInstructions';
import { generateIdempotencyKey } from '@/utils/idempotencyKey';
import { maskPaymentIdentifier } from '@/utils/maskPaymentIdentifier';
import { formatPriceWithCommas, formatAmountForInput, getCurrencySymbol, getCurrencyDecimals, type Currency } from '@/utils/formatPrice';

/**
 * functions/unavailable and functions/deadline-exceeded, and any error with
 * no .code at all, leave the server's receipt of this attempt unknown.
 * Every other coded FunctionsError means the callable ran and returned a
 * structured rejection. Kept local to this screen (not shared with
 * payment-instructions.tsx) since only two call sites exist so far.
 */
function classifyCallableFailure(err: unknown): 'ambiguous' | 'definitive-rejection' {
  const code = (err as { code?: unknown } | null)?.code;
  if (code === 'functions/unavailable' || code === 'functions/deadline-exceeded') return 'ambiguous';
  if (typeof code === 'string' && code.length > 0) return 'definitive-rejection';
  return 'ambiguous';
}

function computeCanonicalPayloadJson(orderId: string, chatId: string, amount: number, message: string | null): string {
  return JSON.stringify({ orderId, chatId, amount, message });
}

type PaymentType = 'full' | 'partial';

const getOutstandingBalance = (o: Order): number => {
  const total = (o.adjustedTotal || o.total);
  const paid = (o.amountPaid || 0);
  return total - paid;
};

export default function SendPaymentRequestScreen() {
  const router = useRouter();
  const { orderId, fromOrder, chatId } = useLocalSearchParams<{ orderId: string; fromOrder?: string; chatId?: string }>();
  const { vendor } = useVendor();
  const { orders } = useOrders();
  const order = orders.find((o) => o.id === orderId);
  const vendorCurrency: Currency = (vendor.currency as Currency) || 'NGN';
  const currencySymbol = getCurrencySymbol(vendorCurrency);
  const currencyDecimals = getCurrencyDecimals(vendorCurrency);

  const unpaidOrders = useMemo(() => {
    if (!order) return [];
    return orders
      .filter(
        (o) =>
          o.customerName === order.customerName &&
          o.vendorId === order.vendorId &&
          o.status !== 'requested' &&
          o.status !== 'cancelled' &&
          o.status !== 'completed' &&
          o.status !== 'rejected' &&
          o.status !== 'expired' &&
          getOutstandingBalance(o) > 0
      )
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }, [order, orders]);

  const openedFromSpecificOrder = !!fromOrder;
  const showOrderSelection = !openedFromSpecificOrder && unpaidOrders.length > 1;

  const getDefaultSelectedId = (): string => {
    if (openedFromSpecificOrder) {
      const match = unpaidOrders.find((o) => o.id === fromOrder);
      if (match) return match.id;
    }
    if (unpaidOrders.length > 0) return unpaidOrders[0].id;
    return '';
  };

  const [selectedOrderId, setSelectedOrderId] = useState<string>(getDefaultSelectedId);
  const [paymentType, setPaymentType] = useState<PaymentType>('full');
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [showOrderDropdown, setShowOrderDropdown] = useState<boolean>(false);

  // Canonical Batch 2C.2 source -- the backend remains the final authority
  // on whether this vendor is actually configured; this is UX only.
  const {
    data: currentInstructions,
    loading: paymentInstructionsLoading,
    error: paymentInstructionsError,
  } = useCurrentPaymentInstructions(vendor.id);
  const hasPaymentInstructions = !paymentInstructionsLoading && !paymentInstructionsError && currentInstructions !== null;

  const idempotencyKeyRef = useRef<string | null>(null);
  const lastAttemptedPayloadJsonRef = useRef<string | null>(null);
  const pendingAmbiguousAttemptRef = useRef<boolean>(false);
  const isSendingRef = useRef<boolean>(false);

  function resolveIdempotencyKeyForAttempt(canonicalPayloadJson: string): string {
    const reuseExistingKey =
      pendingAmbiguousAttemptRef.current &&
      idempotencyKeyRef.current !== null &&
      lastAttemptedPayloadJsonRef.current === canonicalPayloadJson;

    const key = reuseExistingKey ? idempotencyKeyRef.current! : generateIdempotencyKey();
    idempotencyKeyRef.current = key;
    lastAttemptedPayloadJsonRef.current = canonicalPayloadJson;
    pendingAmbiguousAttemptRef.current = false;
    return key;
  }

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  const amountPaid = selectedOrder?.amountPaid || 0;
  const orderTotal = selectedOrder ? (selectedOrder.adjustedTotal || selectedOrder.total) : 0;
  const totalAmount = orderTotal;
  const remainingBalance = totalAmount - amountPaid;
  const requestedAmount = parseFloat(amount) || 0;
  const balanceAfterRequest = remainingBalance - requestedAmount;

  useEffect(() => {
    if (selectedOrderId && selectedOrder) {
      const balance = getOutstandingBalance(selectedOrder);
      if (paymentType === 'full') {
        setAmount(formatAmountForInput(balance, vendorCurrency));
      } else {
        setAmount('');
      }
    }
  }, [selectedOrderId, selectedOrder, paymentType, vendorCurrency]);

  const handleSendRequest = async () => {
    if (!selectedOrderId) {
      Alert.alert('Order Required', 'Please select an order for this payment request.');
      return;
    }

    if (!selectedOrder) {
      Alert.alert('Order Error', 'The selected order could not be loaded. Please try again.');
      return;
    }

    if (!chatId) {
      Alert.alert('Conversation Required', 'Open this from the order chat to send a payment request.');
      return;
    }

    if (paymentInstructionsLoading) {
      Alert.alert('Please wait', 'Still loading your payment setup — try again in a moment.');
      return;
    }

    if (paymentInstructionsError) {
      Alert.alert('Could not load payment setup', 'Please try again.');
      return;
    }

    if (!hasPaymentInstructions) {
      Alert.alert(
        'Payment Instructions Required',
        'Set up your payment instructions before sending a payment request — that is what the customer will see.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Set Up Now', onPress: () => router.push('/vendor/settings/payment-instructions' as any) },
        ]
      );
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    const requestAmount = parseFloat(amount);
    const orderOutstandingBalance = getOutstandingBalance(selectedOrder);
    if (requestAmount > orderOutstandingBalance) {
      Alert.alert('Invalid Amount', `Amount cannot exceed outstanding balance of ${formatPriceWithCommas(orderOutstandingBalance, vendorCurrency)}`);
      return;
    }

    if (isSendingRef.current) return;
    isSendingRef.current = true;

    try {
      const normalizedMessage = note.trim() || null;
      const canonicalPayloadJson = computeCanonicalPayloadJson(selectedOrderId, chatId, requestAmount, normalizedMessage);
      const idempotencyKey = resolveIdempotencyKeyForAttempt(canonicalPayloadJson);

      setIsSending(true);
      try {
        const send = callable<
          { orderId: string; chatId: string; amount: number; message?: string; idempotencyKey: string },
          { success: true; requestId: string; chatId: string; messageId: string }
        >('sendPaymentRequestInChat');
        await send({
          orderId: selectedOrderId,
          chatId,
          amount: requestAmount,
          message: normalizedMessage || undefined,
          idempotencyKey,
        });

        idempotencyKeyRef.current = null;
        lastAttemptedPayloadJsonRef.current = null;
        pendingAmbiguousAttemptRef.current = false;

        Alert.alert(
          'Payment Request Sent',
          `Payment request for ${currencySymbol}${amount} has been sent to the customer.`,
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      } catch (err) {
        const classification = classifyCallableFailure(err);
        if (classification === 'ambiguous') {
          pendingAmbiguousAttemptRef.current = true;
        } else {
          idempotencyKeyRef.current = null;
          lastAttemptedPayloadJsonRef.current = null;
          pendingAmbiguousAttemptRef.current = false;
        }
        console.error('[SendPaymentRequest] sendPaymentRequestInChat rejected:', err);
        const message = err instanceof Error ? err.message : 'Could not send the payment request. Please try again.';
        Alert.alert('Payment Request Failed', message);
      } finally {
        setIsSending(false);
      }
    } finally {
      isSendingRef.current = false;
    }
  };

  if (!order) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <ChevronLeft size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Send Payment Request</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Order not found</Text>
        </View>
      </View>
    );
  }

  if (unpaidOrders.length === 0) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <ChevronLeft size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Send Payment Request</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No unpaid orders</Text>
          <Text style={styles.errorSubtext}>All active orders have been fully paid</Text>
        </View>
      </View>
    );
  }

  const isButtonDisabled = !selectedOrderId || !selectedOrder || !amount || parseFloat(amount) <= 0 || isSending;

  const renderOrderCard = (activeOrder: Order) => {
    const isSelected = selectedOrderId === activeOrder.id;
    const oTotal = (activeOrder.adjustedTotal || activeOrder.total) / 100;
    const oBalance = getOutstandingBalance(activeOrder);
    const totalItemCount = activeOrder.items.reduce((sum, item) => sum + item.quantity, 0);

    return (
      <TouchableOpacity
        key={activeOrder.id}
        style={[
          styles.orderCard,
          isSelected && styles.orderCardSelected,
        ]}
        onPress={() => {
          setSelectedOrderId(activeOrder.id);
          setShowOrderDropdown(false);
        }}
        activeOpacity={0.7}
        testID={`order-card-${activeOrder.id}`}
      >
        <View style={styles.orderCardHeader}>
          <View style={styles.orderCardIconRow}>
            <Package size={14} color={isSelected ? Colors.primary : Colors.textSecondary} />
            <Text style={[styles.orderCardId, isSelected && styles.orderCardIdSelected]}>
              {activeOrder.publicOrderId.toUpperCase()}
            </Text>
          </View>
          {isSelected && (
            <View style={styles.orderCardCheck}>
              <Check size={16} color={Colors.primary} strokeWidth={3} />
            </View>
          )}
        </View>
        <View style={styles.orderCardDetails}>
          <View style={styles.orderCardDetailRow}>
            <Text style={styles.orderCardDetailLabel}>Items</Text>
            <Text style={styles.orderCardDetailValue}>{totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}</Text>
          </View>
          <View style={styles.orderCardDetailRow}>
            <Text style={styles.orderCardDetailLabel}>Order total</Text>
            <Text style={styles.orderCardDetailValue}>{formatPriceWithCommas(oTotal, vendorCurrency)}</Text>
          </View>
          <View style={styles.orderCardDetailRow}>
            <Text style={styles.orderCardDetailLabel}>Outstanding</Text>
            <Text style={styles.orderCardOutstanding}>{formatPriceWithCommas(oBalance, vendorCurrency)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Send Payment Request</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {showOrderSelection && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ORDER</Text>
            <TouchableOpacity
              style={styles.dropdownTrigger}
              onPress={() => setShowOrderDropdown(!showOrderDropdown)}
              activeOpacity={0.7}
              testID="order-dropdown-trigger"
            >
              <View style={styles.dropdownTriggerContent}>
                <Package size={16} color={Colors.primary} />
                <Text style={styles.dropdownTriggerText}>
                  {selectedOrder ? selectedOrder.publicOrderId.toUpperCase() : 'Select an order'}
                </Text>
              </View>
              <ChevronDown
                size={20}
                color={Colors.textSecondary}
                style={showOrderDropdown ? { transform: [{ rotate: '180deg' }] } : undefined}
              />
            </TouchableOpacity>

            {showOrderDropdown && (
              <View style={styles.orderCardsContainer}>
                {unpaidOrders.map((o) => renderOrderCard(o))}
              </View>
            )}

            {!showOrderDropdown && selectedOrder && (
              <View style={styles.selectedOrderSummary}>
                {renderOrderCard(selectedOrder)}
              </View>
            )}
          </View>
        )}

        {!showOrderSelection && selectedOrder && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ORDER</Text>
            {renderOrderCard(selectedOrder)}
          </View>
        )}

        {selectedOrder && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ORDER BREAKDOWN</Text>
              <View key={selectedOrderId} style={styles.breakdownCard}>
                {selectedOrder.items.map((item, index) => (
                  <View key={index} style={styles.breakdownItem}>
                    <View style={styles.breakdownItemInfo}>
                      <Text style={styles.breakdownItemName}>{item.name}</Text>
                      <Text style={styles.breakdownItemQuantity}>Qty: {item.quantity}</Text>
                    </View>
                    <Text style={styles.breakdownItemPrice}>{formatPriceWithCommas((item.price * item.quantity) / 100, vendorCurrency)}</Text>
                  </View>
                ))}
                <View style={styles.breakdownDivider} />
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Subtotal</Text>
                  <Text style={styles.breakdownValue}>{formatPriceWithCommas((selectedOrder.subtotal || selectedOrder.total) / 100, vendorCurrency)}</Text>
                </View>
                {selectedOrder.tax > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Tax</Text>
                    <Text style={styles.breakdownValue}>{formatPriceWithCommas(selectedOrder.tax / 100, vendorCurrency)}</Text>
                  </View>
                )}
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabelTotal}>Total</Text>
                  <Text style={styles.breakdownValueTotal}>{formatPriceWithCommas(totalAmount, vendorCurrency)}</Text>
                </View>
                {amountPaid > 0 && (
                  <>
                    <View style={styles.breakdownDivider} />
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Previously Paid</Text>
                      <Text style={styles.breakdownValuePaid}>{formatPriceWithCommas(amountPaid / 100, vendorCurrency)}</Text>
                    </View>
                  </>
                )}
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabelTotal}>Outstanding</Text>
                  <Text style={styles.breakdownValueOutstanding}>{formatPriceWithCommas(remainingBalance, vendorCurrency)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PAYMENT TYPE</Text>
              <View style={styles.paymentTypeContainer}>
                <TouchableOpacity
                  style={styles.paymentTypeButton}
                  onPress={() => {
                    setPaymentType('full');
                    setAmount(formatAmountForInput(remainingBalance, vendorCurrency));
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.methodRadio, paymentType === 'full' && styles.methodRadioActive]}>
                    {paymentType === 'full' && <View style={styles.methodRadioSelected} />}
                  </View>
                  <Text style={styles.paymentTypeText}>Full Payment</Text>
                </TouchableOpacity>
                <View style={styles.rowDivider} />
                <TouchableOpacity
                  style={styles.paymentTypeButton}
                  onPress={() => {
                    setPaymentType('partial');
                    setAmount('');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.methodRadio, paymentType === 'partial' && styles.methodRadioActive]}>
                    {paymentType === 'partial' && <View style={styles.methodRadioSelected} />}
                  </View>
                  <Text style={styles.paymentTypeText}>Partial Payment</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>AMOUNT</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>{currencySymbol}</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={(text) => {
                    const inputAmount = parseFloat(text) || 0;
                    if (paymentType === 'partial' && inputAmount > remainingBalance) {
                      setAmount(formatAmountForInput(remainingBalance, vendorCurrency));
                    } else {
                      setAmount(text);
                    }
                  }}
                  keyboardType={currencyDecimals === 0 ? 'number-pad' : 'decimal-pad'}
                  placeholder={currencyDecimals === 0 ? '0' : '0.00'}
                  placeholderTextColor={Colors.textMuted}
                  editable={paymentType === 'partial'}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PAYMENT INSTRUCTIONS</Text>
              {paymentInstructionsLoading ? (
                <View style={styles.instructionsPreview}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.instructionsPreviewText}>Loading your payment setup…</Text>
                </View>
              ) : paymentInstructionsError ? (
                <View style={styles.instructionsMissingCard}>
                  <Text style={styles.instructionsMissingText}>Couldn&apos;t load your payment setup. Please try again.</Text>
                </View>
              ) : hasPaymentInstructions ? (
                <View style={styles.instructionsPreview}>
                  <Text style={styles.instructionsPreviewLabel}>This is what the customer will see</Text>
                  {currentInstructions!.paymentDestination === null ? (
                    <Text style={styles.instructionsPreviewText}>Cash</Text>
                  ) : (
                    <Text style={styles.instructionsPreviewText}>
                      {currentInstructions!.paymentDestination.type === 'bank_transfer' ? 'Bank Transfer' : 'Contact Transfer'}
                      {'  ·  '}
                      {maskPaymentIdentifier(currentInstructions!.paymentDestination.identifier)}
                      {currentInstructions!.acceptCash ? '  ·  + Cash accepted' : ''}
                    </Text>
                  )}
                </View>
              ) : (
                <View style={styles.instructionsMissingCard}>
                  <Text style={styles.instructionsMissingText}>
                    You haven&apos;t set up payment instructions yet. Add them so the customer knows how to pay you.
                  </Text>
                  <TouchableOpacity
                    style={styles.instructionsMissingButton}
                    onPress={() => router.push('/vendor/settings/payment-instructions' as any)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.instructionsMissingButtonText}>Set Up Payment Instructions</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>NOTE TO CUSTOMER (OPTIONAL)</Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={(text) => {
                  if (text.length <= 200) {
                    setNote(text);
                  }
                }}
                placeholder="e.g., Please include your order ID in the transfer narration"
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={200}
              />
              <Text style={styles.characterCount}>{note.length}/200</Text>
            </View>
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.actionsContainer}>
        {selectedOrder && paymentType === 'partial' && requestedAmount > 0 && requestedAmount < remainingBalance && (
          <View style={styles.balanceRemainingContainer}>
            <Text style={styles.balanceRemainingLabel}>Balance remaining:</Text>
            <Text style={styles.balanceRemainingValue}>{formatPriceWithCommas(balanceAfterRequest, vendorCurrency)}</Text>
          </View>
        )}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sendButton,
              isButtonDisabled && styles.sendButtonDisabled,
            ]}
            onPress={handleSendRequest}
            disabled={isButtonDisabled}
            activeOpacity={0.7}
            testID="send-payment-request-button"
          >
            {isSending ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={[styles.sendButtonText, isButtonDisabled && styles.sendButtonTextDisabled]}>Send Request</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
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
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  dropdownTrigger: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dropdownTriggerContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  dropdownTriggerText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  orderCardsContainer: {
    marginTop: 10,
    gap: 8,
  },
  selectedOrderSummary: {
    marginTop: 10,
  },
  orderCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  orderCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(255, 140, 66, 0.06)',
  },
  orderCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 10,
  },
  orderCardIconRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  orderCardId: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  orderCardIdSelected: {
    color: Colors.primary,
  },
  orderCardCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 140, 66, 0.15)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  orderCardDetails: {
    gap: 6,
  },
  orderCardDetailRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  orderCardDetailLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  orderCardDetailValue: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  orderCardOutstanding: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.error,
  },
  breakdownCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  breakdownItem: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    marginBottom: 12,
  },
  breakdownItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  breakdownItemName: {
    fontSize: 16,
    fontWeight: '400' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  breakdownItemQuantity: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  breakdownItemPrice: {
    fontSize: 16,
    fontWeight: '400' as const,
    color: Colors.text,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 10,
  },
  breakdownRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 6,
  },
  breakdownLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '400' as const,
  },
  breakdownValue: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: Colors.text,
  },
  breakdownValuePaid: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.success,
  },
  breakdownLabelTotal: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  breakdownValueTotal: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  breakdownValueOutstanding: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.error,
  },
  paymentTypeContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden' as const,
  },
  paymentTypeButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  paymentTypeText: {
    fontSize: 16,
    fontWeight: '400' as const,
    color: Colors.text,
    marginLeft: 12,
  },
  methodsContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden' as const,
  },
  methodCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  methodRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 12,
  },
  methodRadioActive: {
    borderColor: Colors.primary,
  },
  methodRadioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  methodDetail: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  amountInputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: Colors.text,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600' as const,
    color: Colors.text,
    paddingVertical: 12,
  },
  noteInput: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    minHeight: 100,
    textAlignVertical: 'top' as const,
  },
  characterCount: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'right' as const,
  },
  instructionsPreview: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  instructionsPreviewLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  instructionsPreviewText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  instructionsMissingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  instructionsMissingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  instructionsMissingButton: {
    alignSelf: 'flex-start' as const,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  instructionsMissingButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  bottomSpacer: {
    height: 40,
  },
  balanceRemainingContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: Colors.background,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  balanceRemainingLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  balanceRemainingValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  actionsContainer: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actions: {
    flexDirection: 'row' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.white,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.charcoal,
    minHeight: 48,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.charcoal,
  },
  sendButton: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.disabled,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  sendButtonTextDisabled: {
    color: Colors.disabledText,
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
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  errorSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginTop: 8,
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 16,
  },
});
