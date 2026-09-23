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
  ActivityIndicator,
} from 'react-native';
import {
  Copy,
  Clock,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ArrowUpRight,
  Banknote,
  AlertTriangle,
  RefreshCw,
  WifiOff,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { PaymentRequestData, CatalogItemData, PaymentRequestSnapshot } from '@/mocks/chatData';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';
import type { RoutingCodeType } from '@/types/paymentInstructions';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ROUTING_FIELD_LABELS: Record<RoutingCodeType, string> = {
  transit_number: 'TRANSIT NUMBER',
  institution_number: 'INSTITUTION NUMBER',
  routing_number: 'ROUTING NUMBER (ABA)',
  sort_code: 'SORT CODE',
  bsb: 'BSB',
  ifsc: 'IFSC CODE',
  swift_bic: 'SWIFT/BIC',
};

type StructuredFetchState =
  | 'idle'
  | 'loading'
  | 'success'
  | 'error-notfound'
  | 'error-permission'
  | 'error-offline'
  | 'error-unknown';

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
  const [structuredFetchState, setStructuredFetchState] = useState<StructuredFetchState>('idle');
  const [structuredSnapshot, setStructuredSnapshot] = useState<PaymentRequestSnapshot | null>(null);

  const isStructured = paymentData.schemaVersion === 2;
  const isUnsupportedVersion = paymentData.schemaVersion !== undefined && paymentData.schemaVersion !== 2;

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

  // One-time getDoc, only for a card the customer/vendor actually expands --
  // never a live listener. requestId comes only from paymentData.requestId,
  // itself read from an already access-controlled chatThreads/{chatId}/
  // messages/{messageId} document, never arbitrary input. Firestore rules
  // on paymentRequests/{requestId} remain the real authority regardless.
  const fetchStructuredSnapshot = useCallback(async () => {
    if (!paymentData.requestId) {
      setStructuredFetchState('error-unknown');
      return;
    }
    setStructuredFetchState('loading');
    try {
      const snap = await getDoc(doc(db, 'paymentRequests', paymentData.requestId));
      if (!snap.exists()) {
        setStructuredFetchState('error-notfound');
        return;
      }
      setStructuredSnapshot(snap.data() as PaymentRequestSnapshot);
      setStructuredFetchState('success');
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === 'permission-denied') {
        setStructuredFetchState('error-permission');
      } else if (code === 'unavailable') {
        setStructuredFetchState('error-offline');
      } else {
        setStructuredFetchState('error-unknown');
      }
    }
  }, [paymentData.requestId]);

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => {
      const next = !prev;
      if (next && isStructured && structuredFetchState === 'idle') {
        void fetchStructuredSnapshot();
      }
      return next;
    });
  }, [isStructured, structuredFetchState, fetchStructuredSnapshot]);

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

  // Legacy-only: schemaVersion is absent for these messages, and paymentMethod
  // is only ever populated on that legacy shape.
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

  const renderStructuredLoadOrError = () => {
    if (structuredFetchState === 'loading') {
      return (
        <View style={styles.structuredStatusRow}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.structuredStatusText}>Loading payment details…</Text>
        </View>
      );
    }
    if (structuredFetchState === 'error-offline') {
      return (
        <View style={styles.structuredStatusRow}>
          <WifiOff size={16} color={Colors.textMuted} />
          <View style={styles.structuredStatusCopy}>
            <Text style={styles.structuredStatusText}>Couldn&apos;t load payment details — check your connection.</Text>
            <TouchableOpacity onPress={() => void fetchStructuredSnapshot()} style={styles.structuredRetryButton} activeOpacity={0.75}>
              <RefreshCw size={13} color={Colors.text} />
              <Text style={styles.structuredRetryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    // error-notfound / error-permission / error-unknown: fail safe, never
    // fall back to any other data source (never live vendor settings, never
    // fabricated details).
    return (
      <View style={styles.structuredStatusRow}>
        <AlertTriangle size={16} color={Colors.error} />
        <Text style={styles.structuredStatusText}>Couldn&apos;t load payment details.</Text>
      </View>
    );
  };

  const renderStructuredDestination = (snapshot: PaymentRequestSnapshot) => {
    const { paymentDestination, acceptCash } = snapshot.paymentDestinationSnapshot;

    if (role === 'vendor') {
      const methodLabel =
        paymentDestination === null
          ? 'Cash'
          : paymentDestination.type === 'bank_transfer'
            ? 'Bank Transfer'
            : 'Contact Transfer';
      return (
        <View style={styles.vendorBody}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Method</Text>
            <Text style={styles.metaValue}>
              {methodLabel}
              {paymentDestination !== null && acceptCash ? ' + Cash' : ''}
            </Text>
          </View>
          <Text style={styles.vendorInstructionNote}>Payment instructions were sent to the customer.</Text>
          {isConfirmed ? (
            <Text style={styles.vendorActionHint}>Payment confirmed. You can fulfil this order.</Text>
          ) : isPartial ? (
            <Text style={styles.vendorActionHint}>Partial payment received. Awaiting the remaining balance.</Text>
          ) : (
            <Text style={styles.vendorActionHint}>Waiting for the customer to pay. You will be notified when proof is submitted.</Text>
          )}
        </View>
      );
    }

    // Customer: the authorized transaction participant needs the real,
    // usable, unmasked destination -- vendor-view masking does not apply here.
    return (
      <View style={styles.customerBody}>
        {paymentDestination?.type === 'bank_transfer' && (
          <View style={styles.bankSection}>
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>METHOD</Text>
              <Text style={styles.bankValue}>Bank Transfer</Text>
            </View>
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>RECIPIENT</Text>
              <Text style={styles.bankValue}>{paymentDestination.recipientName}</Text>
            </View>
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>INSTITUTION</Text>
              <Text style={styles.bankValue}>{paymentDestination.institutionName}</Text>
            </View>
            {paymentDestination.identifier.type === 'account_number' ? (
              <>
                <View style={styles.bankRow}>
                  <View style={styles.bankLabelRow}>
                    <Text style={styles.bankLabel}>ACCOUNT NUMBER</Text>
                    <TouchableOpacity
                      onPress={() => handleCopy(paymentDestination.identifier.value)}
                      style={styles.copyBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <Copy size={14} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.bankValue}>{paymentDestination.identifier.value}</Text>
                </View>
                {(paymentDestination.identifier.routing ?? []).map((code) => (
                  <View key={code.type} style={styles.bankRow}>
                    <Text style={styles.bankLabel}>{ROUTING_FIELD_LABELS[code.type]}</Text>
                    <Text style={styles.bankValue}>{code.value}</Text>
                  </View>
                ))}
              </>
            ) : (
              <>
                <View style={styles.bankRow}>
                  <View style={styles.bankLabelRow}>
                    <Text style={styles.bankLabel}>IBAN</Text>
                    <TouchableOpacity
                      onPress={() => handleCopy(paymentDestination.identifier.value)}
                      style={styles.copyBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <Copy size={14} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.bankValue}>{paymentDestination.identifier.value}</Text>
                </View>
                {paymentDestination.identifier.swiftBic && (
                  <View style={styles.bankRow}>
                    <Text style={styles.bankLabel}>SWIFT/BIC</Text>
                    <Text style={styles.bankValue}>{paymentDestination.identifier.swiftBic}</Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {paymentDestination?.type === 'contact_transfer' && (
          <View style={styles.bankSection}>
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>METHOD</Text>
              <Text style={styles.bankValue}>Contact Transfer</Text>
            </View>
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>RECIPIENT</Text>
              <Text style={styles.bankValue}>{paymentDestination.recipientName}</Text>
            </View>
            <View style={styles.bankRow}>
              <View style={styles.bankLabelRow}>
                <Text style={styles.bankLabel}>{paymentDestination.identifier.type === 'email' ? 'EMAIL' : 'PHONE'}</Text>
                <TouchableOpacity
                  onPress={() => handleCopy(paymentDestination.identifier.value)}
                  style={styles.copyBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <Copy size={14} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.bankValue}>{paymentDestination.identifier.value}</Text>
            </View>
          </View>
        )}

        {paymentDestination === null && (
          <View style={styles.cashOnlyRow}>
            <Banknote size={16} color={Colors.success} />
            <Text style={styles.cashOnlyText}>Cash accepted</Text>
          </View>
        )}

        {paymentDestination !== null && acceptCash && (
          <View style={styles.cashAlsoRow}>
            <Banknote size={14} color={Colors.success} />
            <Text style={styles.cashAlsoText}>Cash also accepted</Text>
          </View>
        )}

        {snapshot.message && (
          <View style={styles.messageSection}>
            <Text style={styles.messageLabel}>Note from vendor</Text>
            <Text style={styles.messageText}>{snapshot.message}</Text>
          </View>
        )}

        <Text style={styles.nonEscrowDisclaimer}>
          Payments are made directly to the vendor. Platform does not process payments.
        </Text>
      </View>
    );
  };

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

            {isUnsupportedVersion ? (
              <View style={styles.structuredStatusRow}>
                <AlertTriangle size={16} color={Colors.warning} />
                <Text style={styles.structuredStatusText}>
                  This payment request can&apos;t be shown in this version of the app — please update.
                </Text>
              </View>
            ) : isStructured ? (
              structuredFetchState === 'success' && structuredSnapshot ? (
                renderStructuredDestination(structuredSnapshot)
              ) : (
                renderStructuredLoadOrError()
              )
            ) : role === 'vendor' ? (
              /* Legacy, vendor: status-focused, no banking info repeated */
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
              /* Legacy, customer: amount + payment instructions + path to details */
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
                  Payments are made directly to the vendor. Platform does not process payments.
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
  structuredBody: {
    gap: 10,
  },
  structuredStatusRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
  },
  structuredStatusCopy: {
    flex: 1,
    gap: 8,
  },
  structuredStatusText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  structuredRetryButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  structuredRetryText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#2B2B2B',
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
  cashOnlyRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 10,
  },
  cashOnlyText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2B2B2B',
  },
  cashAlsoRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  cashAlsoText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#2B2B2B',
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
