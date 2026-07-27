import React, { useState, useCallback } from 'react';
import Toast from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { Copy, Clock, ChevronDown, ChevronUp, CheckCircle2, ArrowUpRight } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { PaymentRequestData, CatalogItemData } from '@/mocks/chatData';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface PaymentRequestCardProps {
  vendorName: string;
  vendorInitial?: string;
  orderId: string;
  paymentData: PaymentRequestData;
  catalogItem?: CatalogItemData;
  timestamp: string;
  role: 'customer' | 'vendor';
  onViewOrderDetails?: () => void;
  statusMessage?: string;
  currency?: Currency;
}

export const PaymentRequestCard = React.memo(function PaymentRequestCard({
  orderId,
  paymentData,
  timestamp,
  role,
  onViewOrderDetails,
  statusMessage,
  currency = 'NGN',
}: PaymentRequestCardProps) {
  const router = useRouter();
  const { toastVisible, showToast } = useToast();
  const [expanded, setExpanded] = useState<boolean>(false);

  const handleCopy = useCallback(
    async (text: string) => {
      await Clipboard.setStringAsync(text);
      showToast();
    },
    [showToast],
  );

  const formatTime = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }, []);

  const isConfirmed = paymentData.status === 'confirmed';
  const isPartial = paymentData.status === 'partial_received' || paymentData.isPartialPayment;

  const statusLabel = isConfirmed
    ? 'Paid'
    : isPartial
      ? role === 'vendor'
        ? 'Partial received'
        : 'Partial paid'
      : role === 'vendor'
        ? 'Awaiting payment'
        : 'Awaiting your payment';

  const accentColor = isConfirmed ? '#16A34A' : isPartial ? '#F59E0B' : Colors.primary;

  const hasBankDetails =
    paymentData.paymentMethod === 'Bank Transfer' ||
    paymentData.paymentMethod === 'E-Transfer' ||
    paymentData.paymentMethod === 'Mobile Wallet' ||
    paymentData.paymentMethod === 'Cash App' ||
    paymentData.paymentMethod === 'Phone Payment';

  const recipientLabel =
    paymentData.paymentMethod === 'E-Transfer'
      ? 'RECIPIENT'
      : paymentData.paymentMethod === 'Bank Transfer'
        ? 'ACCOUNT NUMBER'
        : 'PHONE NUMBER';

  const renderStatusBadge = () => (
    <View style={[styles.statusBadge, { backgroundColor: `${accentColor}1A` }]}>
      {isConfirmed ? (
        <CheckCircle2 size={12} color={accentColor} />
      ) : (
        <Clock size={12} color={accentColor} />
      )}
      <Text style={[styles.statusBadgeText, { color: accentColor }]}>{statusLabel}</Text>
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        {/* Compact summary row — always visible */}
        <TouchableOpacity
          style={styles.summaryRow}
          onPress={toggleExpanded}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse payment details' : 'Expand payment details'}
        >
          <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
          <View style={styles.summaryContent}>
            <View style={styles.summaryTopRow}>
              <Text style={styles.eyebrow}>
                {role === 'vendor' ? 'PAYMENT' : 'PAYMENT REQUEST'}
              </Text>
              {renderStatusBadge()}
            </View>
            <Text style={styles.amountValue}>
              {formatPriceWithCommas(paymentData.amount, currency)}
            </Text>
            <Text style={styles.orderIdLine} numberOfLines={1}>
              Order #{orderId.toUpperCase()}
            </Text>
          </View>
          {expanded ? (
            <ChevronUp size={18} color={Colors.textMuted} />
          ) : (
            <ChevronDown size={18} color={Colors.textMuted} />
          )}
        </TouchableOpacity>

        {expanded && (
          <View style={styles.expandedSection}>
            <View style={styles.divider} />

            {role === 'vendor' ? (
              /* Vendor: status-focused, no banking info repeated */
              <View style={styles.vendorBody}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Method</Text>
                  <Text style={styles.metaValue}>{paymentData.paymentMethod}</Text>
                </View>
                {hasBankDetails && (
                  <Text style={styles.vendorInstructionNote}>
                    Payment instructions were sent to the customer.
                  </Text>
                )}
                {isConfirmed ? (
                  <Text style={styles.vendorActionHint}>
                    Payment confirmed. You can fulfil this order.
                  </Text>
                ) : isPartial ? (
                  <Text style={styles.vendorActionHint}>
                    Partial payment received. Awaiting the remaining balance.
                  </Text>
                ) : (
                  <Text style={styles.vendorActionHint}>
                    Waiting for the customer to pay. You will be notified when proof is submitted.
                  </Text>
                )}
              </View>
            ) : (
              /* Customer: amount + payment instructions + path to details */
              <View style={styles.customerBody}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Method</Text>
                  <Text style={styles.metaValue}>{paymentData.paymentMethod}</Text>
                </View>

                {hasBankDetails && (
                  <View style={styles.bankSection}>
                    {paymentData.bankName && (
                      <View style={styles.bankRow}>
                        <Text style={styles.bankLabel}>BANK</Text>
                        <Text style={styles.bankValue}>{paymentData.bankName}</Text>
                      </View>
                    )}
                    {paymentData.accountName && (
                      <View style={styles.bankRow}>
                        <Text style={styles.bankLabel}>ACCOUNT NAME</Text>
                        <Text style={styles.bankValue}>{paymentData.accountName}</Text>
                      </View>
                    )}
                    {paymentData.accountNumber && (
                      <View style={styles.bankRow}>
                        <View style={styles.bankLabelRow}>
                          <Text style={styles.bankLabel}>{recipientLabel}</Text>
                          <TouchableOpacity
                            onPress={() => handleCopy(paymentData.accountNumber!)}
                            style={styles.copyBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={0.7}
                          >
                            <Copy size={14} color={Colors.primary} />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.bankValue}>{paymentData.accountNumber}</Text>
                      </View>
                    )}
                  </View>
                )}

                {paymentData.message && (
                  <View style={styles.messageSection}>
                    <Text style={styles.messageLabel}>Note from vendor</Text>
                    <Text style={styles.messageText}>{paymentData.message}</Text>
                  </View>
                )}

                <Text style={styles.nonEscrowDisclaimer}>
                  Payments are made directly to the vendor. the platform does not process payments.
                </Text>
              </View>
            )}
          </View>
        )}

        {onViewOrderDetails && (
          <TouchableOpacity
            style={styles.detailsLink}
            onPress={onViewOrderDetails}
            activeOpacity={0.7}
          >
            <Text style={styles.detailsLinkText}>
              {role === 'vendor' ? 'View order' : 'View payment details'}
            </Text>
            <ArrowUpRight size={14} color={Colors.primary} />
          </TouchableOpacity>
        )}

        <Text style={styles.timestamp}>{formatTime(timestamp)}</Text>
      </View>

      {statusMessage && <Text style={styles.statusMessage}>{statusMessage}</Text>}
      <Toast visible={toastVisible} />
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center' as const,
    marginBottom: 4,
    paddingHorizontal: 0,
    width: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: '90%',
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
      web: {},
    }),
  },
  summaryRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  accentBar: {
    width: 3,
    alignSelf: 'stretch' as const,
    borderRadius: 2,
    minHeight: 38,
  },
  summaryContent: {
    flex: 1,
    gap: 1,
  },
  summaryTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#6B7280',
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  amountValue: {
    fontSize: 19,
    fontWeight: '700' as const,
    color: '#2B2B2B',
    letterSpacing: -0.4,
  },
  orderIdLine: {
    fontSize: 11.5,
    color: '#6B7280',
    fontWeight: '500' as const,
    letterSpacing: 0.3,
  },
  expandedSection: {
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 9,
  },
  vendorBody: {
    gap: 8,
  },
  customerBody: {
    gap: 10,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#6B7280',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  metaValue: {
    fontSize: 14,
    color: '#2B2B2B',
    fontWeight: '500' as const,
  },
  vendorInstructionNote: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  vendorActionHint: {
    fontSize: 13,
    color: '#2B2B2B',
    lineHeight: 19,
    fontWeight: '500' as const,
  },
  bankSection: {
    gap: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 10,
  },
  bankRow: {
    gap: 2,
  },
  bankLabelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  bankLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#6B7280',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  bankValue: {
    fontSize: 15,
    color: '#2B2B2B',
    fontWeight: '500' as const,
  },
  copyBtn: {
    padding: 4,
  },
  messageSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 10,
  },
  messageLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#6B7280',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#2B2B2B',
    lineHeight: 20,
    fontStyle: 'italic' as const,
  },
  nonEscrowDisclaimer: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  detailsLink: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginTop: 8,
    alignSelf: 'flex-start' as const,
  },
  detailsLinkText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  timestamp: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 6,
    textAlign: 'right' as const,
  },
  statusMessage: {
    fontSize: 12,
    color: '#4B5563',
    textAlign: 'center' as const,
    marginTop: 6,
  },
});
