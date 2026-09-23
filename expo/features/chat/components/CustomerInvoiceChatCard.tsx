import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { FileText, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';
import { formatTime } from '@/features/chat/selectors/chatSelectors';
import type { InvoiceData } from '@/mocks/chatData';
import { useInvoices, getAmountPaid, getBalanceDue } from '@/contexts/InvoiceContext';

/**
 * Customer-facing invoice card shown in chat when a vendor sends an invoice.
 *
 * Flow: vendor sends invoice → customer receives this card in chat →
 * customer taps "View Invoice" → sees the full branded invoice via
 * InvoiceRenderer on the /invoice-view/{shareCode}?viewer=customer route.
 *
 * Platform does NOT process payments in the MVP, so this card contains no
 * "Pay Now", "Pay", or any in-app payment action. The card is read-only:
 * it surfaces invoice metadata and a single "View Invoice" action that
 * opens the branded, read-only invoice screen.
 *
 * Status display:
 * - "Unpaid"   → outstanding invoice (not yet paid by the customer)
 * - "Overdue"  → unpaid AND the due date is in the past
 * - "Paid"     → vendor has marked the invoice as paid
 *
 * Mock data only. Backend integration note (Henry): the `issueDate`/`dueDate`
 * fields are read from the invoice document via `useInvoices()`. Until the
 * backend exposes these fields, the card falls back to the chat message
 * timestamp for display.
 */
type Props = {
  data: InvoiceData;
  timestamp: string;
  /** Order/thread id the invoice card lives in. Used to build a `returnTo`
   *  param so the invoice screen's Back button returns to this exact chat
   *  thread instead of falling back to Home. */
  orderId?: string;
};

type CardStatus = 'unpaid' | 'overdue' | 'partially_paid' | 'paid';

function resolveStatus(
  paymentStatus: InvoiceData['paymentStatus'],
  dueDate: string | undefined,
  nowMs: number,
): CardStatus {
  if (paymentStatus === 'paid') return 'paid';
  if (paymentStatus === 'partially_paid') return 'partially_paid';
  if (dueDate) {
    const dueMs = new Date(dueDate).getTime();
    if (!Number.isNaN(dueMs) && dueMs < nowMs) return 'overdue';
  }
  return 'unpaid';
}

const STATUS_CONFIG: Record<CardStatus, { label: string; color: string; bg: string }> = {
  unpaid: { label: 'Unpaid', color: Colors.textSecondary, bg: Colors.surface },
  partially_paid: { label: 'Partially Paid', color: Colors.warning, bg: Colors.warningLight },
  overdue: { label: 'Overdue', color: Colors.error, bg: Colors.errorLight },
  paid: { label: 'Paid', color: Colors.success, bg: Colors.successLight },
};

function formatDateShort(iso: string | undefined | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

export const CustomerInvoiceChatCard = React.memo(function CustomerInvoiceChatCard({
  data,
  timestamp,
  orderId,
}: Props) {
  const { getInvoiceById } = useInvoices();
  const invoice = data.invoiceId ? getInvoiceById(data.invoiceId) : undefined;

  const currency = (data.currency ?? invoice?.currency ?? 'NGN') as Currency;
  const vendorName = data.vendorName ?? invoice?.customerName ?? 'Vendor';
  const invoiceNumber = data.invoiceNumber ?? invoice?.invoiceNumber ?? 'Invoice';
  const itemCount = data.itemCount ?? invoice?.items?.length ?? 0;

  // Prefer the document's due/issue dates; fall back to the chat message
  // timestamp so the card always shows a date even before Henry wires the
  // backend issueDate/dueDate fields.
  const issueDate = invoice?.issueDate ?? timestamp;
  const dueDate = invoice?.dueDate;

  const nowMs = Date.now();
  const status = resolveStatus(data.paymentStatus ?? invoice?.paymentStatus, dueDate, nowMs);
  const statusConfig = STATUS_CONFIG[status];

  // Partially-paid + paid invoices show the confirmed amount paid and the
  // remaining balance. Read-only — never a Pay Now / Platform-payment action.
  const amountPaid = invoice ? getAmountPaid(invoice.payments) : 0;
  const balanceDue = invoice ? getBalanceDue(invoice.total, invoice.payments) : 0;

  const issueStr = formatDateShort(issueDate);
  const dueStr = formatDateShort(dueDate);

  const handleViewInvoice = () => {
    // Navigate to the internal customer invoice-detail screen using the
    // invoice's share code. Pass `viewer=customer` so the screen renders the
    // in-app experience (chat helper, no acquisition CTA) and `returnTo` so
    // the Back button returns to this exact chat thread instead of Home.
    // Fall back to looking up the share code by invoice id if the chat-card
    // payload doesn't carry one (older seed messages).
    const invoice = data.invoiceId ? getInvoiceById(data.invoiceId) : undefined;
    const shareCode = data.shareCode ?? invoice?.shareCode;
    if (!shareCode) return;
    const returnTo = orderId ? `/chat/order/${orderId}` : undefined;
    router.push({
      pathname: '/invoice-view/[shareCode]' as any,
      params: {
        shareCode,
        viewer: 'customer',
        ...(returnTo ? { returnTo } : {}),
      },
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.docIconWrap}>
            <FileText size={15} color={Colors.primary} />
          </View>
          <Text style={styles.headerLabel}>Invoice</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      <Text style={styles.vendorName} numberOfLines={1}>
        {vendorName}
      </Text>
      <Text style={styles.invoiceNumber}>{invoiceNumber}</Text>

      <View style={styles.amountRow}>
        <Text style={styles.amountLabel}>Total</Text>
        <Text style={styles.amountValue}>
          {formatPriceWithCommas(data.amountDue, currency)}
        </Text>
      </View>

      {amountPaid > 0 ? (
        <View style={styles.paidRow}>
          <Text style={styles.paidLabel}>Paid</Text>
          <Text style={[styles.paidValue, { color: Colors.success }]}>
            {formatPriceWithCommas(amountPaid, currency)}
          </Text>
          {balanceDue > 0 ? (
            <>
              <Text style={styles.paidDot}>·</Text>
              <Text style={styles.balanceText}>Balance {formatPriceWithCommas(balanceDue, currency)}</Text>
            </>
          ) : null}
        </View>
      ) : null}

      <View style={styles.metaRow}>
        {itemCount > 0 ? (
          <Text style={styles.metaText}>
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </Text>
        ) : null}
        {itemCount > 0 && issueStr ? <Text style={styles.metaDot}>·</Text> : null}
        {issueStr ? <Text style={styles.metaText}>Issued {issueStr}</Text> : null}
      </View>

      {dueStr ? (
        <Text style={styles.dueLine}>
          {status === 'overdue' ? 'Was due ' : 'Due '}
          {dueStr}
        </Text>
      ) : null}

      <View style={styles.divider} />

      <TouchableOpacity
        style={styles.viewButton}
        onPress={handleViewInvoice}
        activeOpacity={0.75}
        disabled={!data.shareCode && !(data.invoiceId && getInvoiceById(data.invoiceId)?.shareCode)}
      >
        <Text style={styles.viewButtonText}>View Invoice</Text>
        <ChevronRight size={14} color={Colors.primary} />
      </TouchableOpacity>

      <Text style={styles.timestamp}>{formatTime(timestamp)}</Text>
    </View>
  );
});

CustomerInvoiceChatCard.displayName = 'CustomerInvoiceChatCard';

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    width: '100%',
    maxWidth: 288,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  docIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.4,
  },
  vendorName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  invoiceNumber: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  amountRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 6,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -0.4,
  },
  paidRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: 5,
    marginBottom: 6,
    flexWrap: 'wrap' as const,
  },
  paidLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  paidValue: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  paidDot: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  balanceText: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginBottom: 3,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  metaDot: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  dueLine: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: 10,
  },
  viewButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.primaryTint,
  },
  viewButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  timestamp: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'right' as const,
    marginTop: 8,
  },
});
