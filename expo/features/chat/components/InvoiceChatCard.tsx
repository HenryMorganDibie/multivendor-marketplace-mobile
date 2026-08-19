import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
  Share,
} from 'react-native';
import { router } from 'expo-router';
import { Eye, Download, CheckCircle2, X, ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { formatPriceWithCommas as formatPrice, type Currency } from '@/utils/formatPrice';
import { formatTime } from '@/features/chat/selectors/chatSelectors';
import { useInvoices } from '@/contexts/InvoiceContext';
import { useVendor } from '@/contexts/VendorContext';
import type { InvoiceData } from '@/mocks/chatData';
import { File, Paths } from 'expo-file-system';
import { Alert } from '@/utils/alert';
import type { InvoicePaymentMethod, InvoicePaymentStatus } from '@/contexts/InvoiceContext';
import { getAmountPaid, getBalanceDue } from '@/contexts/InvoiceContext';

function generateInvoiceHTMLMini(params: {
  invoiceNumber: string;
  vendorName: string;
  customerName: string;
  issueDate: string;
  items: { name: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentStatus: InvoicePaymentStatus;
  notes?: string;
  currency: Currency;
}): string {
  const { invoiceNumber, vendorName, customerName, issueDate, items, subtotal, tax, discount, total, paymentStatus, notes, currency } = params;

  const statusLabel = paymentStatus === 'paid' ? 'PAID' : paymentStatus === 'partially_paid' ? 'PARTIAL' : 'UNPAID';
  const statusColor = paymentStatus === 'paid' ? '#16A34A' : paymentStatus === 'partially_paid' ? '#F59E0B' : '#6B7280';
  const statusBg = paymentStatus === 'paid' ? '#F0FDF4' : paymentStatus === 'partially_paid' ? '#FFFBEB' : '#F9FAFB';

  const itemRows = items.map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;">${item.name}</td>
      <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;text-align:center;">${item.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;text-align:right;">${formatPrice(item.unitPrice, currency)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:500;">${formatPrice(item.total, currency)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#111827;padding:48px 56px;font-size:14px;line-height:1.6;}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;}
    .brand h1{font-size:20px;font-weight:700;color:#111827;}
    .invoice-meta{text-align:right;}
    .invoice-meta h2{font-size:26px;font-weight:800;color:#111827;}
    .inv-num{font-size:13px;color:#6B7280;margin-top:4px;}
    .billing{display:flex;gap:40px;margin-bottom:32px;padding:20px;background:#F9FAFB;border-radius:12px;}
    .billing-block h3{font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;}
    .billing-block p{font-size:15px;font-weight:600;color:#111827;}
    table{width:100%;border-collapse:collapse;margin-bottom:24px;}
    thead th{font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.6px;padding-bottom:10px;border-bottom:2px solid #F3F4F6;}
    thead th:not(:first-child){text-align:right;}
    thead th:nth-child(2){text-align:center;}
    .totals{margin-left:auto;width:240px;}
    .totals-row{display:flex;justify-content:space-between;padding:7px 0;font-size:14px;color:#6B7280;}
    .totals-row.grand{padding-top:10px;border-top:2px solid #111827;font-size:17px;font-weight:700;color:#111827;margin-top:4px;}
    .status-badge{display:inline-block;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:700;letter-spacing:0.8px;background:${statusBg};color:${statusColor};margin-top:20px;}
    .status-note{font-size:12px;color:#9CA3AF;margin-top:4px;display:block;}
    .footer{margin-top:36px;padding-top:16px;border-top:1px solid #F3F4F6;text-align:center;font-size:12px;color:#9CA3AF;line-height:1.7;}
  </style></head><body>
    <div class="header">
      <div class="brand"><h1>${vendorName}</h1></div>
      <div class="invoice-meta">
        <h2>Invoice</h2>
        <div class="inv-num"># ${invoiceNumber}</div>
        <div class="inv-num">Issued ${issueDate}</div>
      </div>
    </div>
    <div class="billing">
      <div class="billing-block"><h3>From</h3><p>${vendorName}</p></div>
      <div class="billing-block"><h3>Billed To</h3><p>${customerName}</p></div>
    </div>
    <table>
      <thead><tr><th style="text-align:left;">Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div class="totals">
      <div class="totals-row"><span>Subtotal</span><span>${formatPrice(subtotal, currency)}</span></div>
      ${tax > 0 ? `<div class="totals-row"><span>Tax</span><span>${formatPrice(tax, currency)}</span></div>` : ''}
      ${discount > 0 ? `<div class="totals-row"><span>Discount</span><span>-${formatPrice(discount, currency)}</span></div>` : ''}
      <div class="totals-row grand"><span>Total</span><span>${formatPrice(total, currency)}</span></div>
    </div>
    <div class="status-badge">${statusLabel}</div>
    <span class="status-note">Payment status recorded by vendor</span>
    ${notes ? `<div style="margin-top:16px;padding:14px;background:#F9FAFB;border-radius:10px;"><p style="font-size:13px;color:#374151;">${notes}</p></div>` : ''}
    <div class="footer">
      <p>the platform does not process payments. Payments are handled directly between customer and vendor.</p>
    </div>
  </body></html>`;
}

type Props = {
  data: InvoiceData;
  timestamp: string;
  role?: 'vendor' | 'customer';
};

const STATUS_CONFIG = {
  paid: { label: 'Paid', bg: Colors.successLight, color: Colors.success },
  partially_paid: { label: 'Partial', bg: Colors.warningLight, color: Colors.warning },
  unpaid: { label: 'Unpaid', bg: Colors.surface, color: Colors.textMuted },
};

const PAYMENT_METHODS: { id: InvoicePaymentMethod; label: string }[] = [
  { id: 'bank_transfer', label: 'Bank transfer' },
  { id: 'cash', label: 'Cash' },
  { id: 'card_direct', label: 'Card' },
  { id: 'mobile_money', label: 'Mobile money' },
  { id: 'other', label: 'Other' },
];

export const InvoiceChatCard = React.memo(function InvoiceChatCard({ data, timestamp, role = 'vendor' }: Props) {
  const { getInvoiceById, recordPayment, downloadInvoicePdf } = useInvoices();
  // The real signed-in vendor. This card used mockVendor for the business name
  // and currency, so a card in a live chat showed the demo business to whoever
  // was reading it.
  const { vendor } = useVendor();
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<InvoicePaymentMethod | ''>('');
  const [paymentNote, setPaymentNote] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  /**
   * The live invoice wins over the card's snapshot.
   *
   * `data` is the figures as they stood when the card was posted into the chat.
   * Every field below read that first, so an invoice the vendor revised — a
   * customer asking for three instead of two — kept showing the original amount
   * in the conversation while the invoice itself had changed. The customer was
   * looking at a stale demand for money and had no way to know.
   *
   * The snapshot is still the fallback: a card can outlive access to the
   * invoice, and showing what was sent beats showing nothing.
   */
  const invoice = getInvoiceById(data.invoiceId);
  const currency = (invoice?.currency ?? data.currency ?? vendor.currency ?? 'NGN') as Currency;
  const amountPaid = invoice ? getAmountPaid(invoice.payments) : 0;
  const balanceDue = invoice ? getBalanceDue(invoice.total, invoice.payments) : (data.amountDue ?? 0);
  const currentStatus = invoice?.paymentStatus ?? data.paymentStatus ?? 'unpaid';
  const statusConfig = STATUS_CONFIG[currentStatus] ?? STATUS_CONFIG.unpaid;
  const isPaid = currentStatus === 'paid';

  // Revised after it was sent: the customer is told rather than left to notice
  // the number moved.
  const wasRevised = Boolean((invoice as { revisionCount?: number } | undefined)?.revisionCount);

  const itemCount = invoice?.items?.length ?? data.itemCount ?? 0;
  const customerName = invoice?.customerName ?? data.customerName ?? '';
  const vendorName = data.vendorName ?? vendor.name;

  const dateStr = (() => {
    try {
      const d = new Date(timestamp);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  })();

  const handleViewDetails = () => {
    router.push(`/vendor/invoice/${data.invoiceId}` as any);
  };

  const handleDownload = async () => {
    if (!invoice) {
      router.push(`/vendor/invoice/${data.invoiceId}` as any);
      return;
    }
    setIsDownloading(true);
    try {
      // Same entitlement-bypass fix as app/vendor/invoice/[orderId].tsx:
      // local HTML generation never checked canDownloadInvoicePdf. This is
      // the backend-gated equivalent, same PDF the detail screen produces.
      const result = await downloadInvoicePdf(invoice.id);
      if (!result) {
        Alert.alert('Error', 'Could not generate PDF');
        return;
      }
      const { pdfBase64, fileName } = result;
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${pdfBase64}`;
        link.download = fileName;
        link.click();
      } else {
        const pdfFile = new File(Paths.cache, fileName);
        pdfFile.write(pdfBase64, { encoding: 'base64' });
        await Share.share({ url: pdfFile.uri, title: `Invoice ${invoice.invoiceNumber}` });
      }
    } catch (err: any) {
      console.error('PDF download failed:', err);
      const message = err?.message ?? 'Could not download PDF';
      Alert.alert(
        /permission-denied|not available on your current plan/i.test(message) ? 'Upgrade required' : 'Error',
        /permission-denied|not available on your current plan/i.test(message)
          ? 'Downloading invoice PDFs is available on Standard and above.'
          : 'Could not generate PDF'
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleConfirmRecordPayment = async () => {
    if (!invoice) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter the amount you received.');
      return;
    }
    if (amount > balanceDue + 0.01) {
      Alert.alert('Amount exceeds balance', `The remaining balance is ${formatPrice(balanceDue, currency)}.`);
      return;
    }
    setIsRecording(true);
    try {
      const isoDate = new Date(`${paymentDate}T12:00:00`).toISOString();
      await recordPayment(invoice.id, {
        amount,
        date: isoDate,
        method: paymentMethod || undefined,
        note: paymentNote.trim() || undefined,
      });
      setShowRecordPayment(false);
    } catch (err) {
      console.error('Error recording payment:', err);
      Alert.alert('Error', 'Failed to record payment.');
    } finally {
      setIsRecording(false);
    }
  };

  const openRecordPayment = () => {
    if (!invoice) return;
    setPaymentAmount(balanceDue > 0 ? String(balanceDue) : String(invoice.total));
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod('');
    setPaymentNote('');
    setShowRecordPayment(true);
  };

  return (
    <>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.headerLabel}>
            {wasRevised ? 'Invoice · Updated' : 'Invoice'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.amount}>
          {formatPrice(data.amountDue, currency)}
        </Text>

        <View style={styles.metaRow}>
          {itemCount > 0 && (
            <Text style={styles.metaText}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
          )}
          {itemCount > 0 && dateStr ? <Text style={styles.metaDot}>·</Text> : null}
          {dateStr ? <Text style={styles.metaText}>{dateStr}</Text> : null}
        </View>

        {customerName ? (
          <View style={styles.customerRow}>
            <Text style={styles.customerLabel}>To</Text>
            <Text style={styles.customerName}>{customerName}</Text>
          </View>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleViewDetails} activeOpacity={0.7}>
            <Eye size={14} color={Colors.primary} />
            <Text style={[styles.actionText, { color: Colors.primary }]}>View Details</Text>
            <ChevronRight size={12} color={Colors.primary} />
          </TouchableOpacity>

          <View style={styles.actionSep} />

          <TouchableOpacity
            style={[styles.actionBtn, isDownloading && styles.actionBtnDisabled]}
            onPress={handleDownload}
            activeOpacity={0.7}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ActivityIndicator size="small" color={Colors.textSecondary} />
            ) : (
              <Download size={14} color={Colors.textSecondary} />
            )}
            <Text style={styles.actionText}>Download</Text>
          </TouchableOpacity>

          {role === 'vendor' && !isPaid && (
            <>
              <View style={styles.actionSep} />
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={openRecordPayment}
                activeOpacity={0.7}
              >
                <CheckCircle2 size={14} color={Colors.success} />
                <Text style={[styles.actionText, { color: Colors.success }]}>Record Payment</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Balance line for partially-paid invoices */}
        {currentStatus === 'partially_paid' && amountPaid > 0 ? (
          <Text style={styles.balanceLine}>
            {formatPrice(amountPaid, currency)} paid · {formatPrice(balanceDue, currency)} due
          </Text>
        ) : null}

        <Text style={styles.timestamp}>{formatTime(timestamp)}</Text>
      </View>

      <Modal
        visible={showRecordPayment}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRecordPayment(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Payment</Text>
              <TouchableOpacity onPress={() => setShowRecordPayment(false)} style={styles.modalClose} activeOpacity={0.7}>
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.paymentSummaryBox}>
              <View style={styles.paymentSummaryLine}>
                <Text style={styles.paymentSummaryKey}>Invoice total</Text>
                <Text style={styles.paymentSummaryVal}>{formatPrice(invoice?.total ?? data.amountDue, currency)}</Text>
              </View>
              <View style={styles.paymentSummaryLine}>
                <Text style={styles.paymentSummaryKey}>Amount paid</Text>
                <Text style={[styles.paymentSummaryVal, { color: Colors.success }]}>{formatPrice(amountPaid, currency)}</Text>
              </View>
              <View style={styles.paymentSummaryLine}>
                <Text style={styles.paymentSummaryKey}>Remaining balance</Text>
                <Text style={[styles.paymentSummaryVal, { fontWeight: '700' as const }]}>{formatPrice(balanceDue, currency)}</Text>
              </View>
            </View>

            <Text style={styles.modalFieldLabel}>Amount received <Text style={styles.modalRequired}>*</Text></Text>
            <View style={styles.partialInputWrap}>
              <Text style={styles.currencySymbol}>₦</Text>
              <TextInput
                style={styles.partialInput}
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                placeholderTextColor={Colors.textMuted}
                autoFocus
              />
            </View>

            <Text style={styles.modalFieldLabel}>Payment date</Text>
            <View style={styles.dateInputWrap}>
              <TextInput
                style={styles.dateInput}
                placeholder="YYYY-MM-DD"
                value={paymentDate}
                onChangeText={setPaymentDate}
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <Text style={styles.modalFieldLabel}>Method <Text style={styles.modalOptional}>(optional)</Text></Text>
            <View style={styles.methodRow}>
              {PAYMENT_METHODS.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.methodChip, paymentMethod === m.id && styles.methodChipActive]}
                  onPress={() => setPaymentMethod(paymentMethod === m.id ? '' : m.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.methodChipText, paymentMethod === m.id && styles.methodChipTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalFieldLabel}>Note <Text style={styles.modalOptional}>(optional)</Text></Text>
            <View style={styles.noteInputWrap}>
              <TextInput
                style={styles.noteInput}
                placeholder="e.g. Cash on pickup"
                value={paymentNote}
                onChangeText={setPaymentNote}
                placeholderTextColor={Colors.textMuted}
                multiline
              />
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, isRecording && styles.confirmBtnDisabled]}
              onPress={handleConfirmRecordPayment}
              disabled={isRecording}
              activeOpacity={0.85}
            >
              {isRecording ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.confirmBtnText}>Record Payment</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
});

InvoiceChatCard.displayName = 'InvoiceChatCard';

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 10,
    width: '100%',
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 10,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  amount: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  metaDot: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  customerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 14,
  },
  customerLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  customerName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginBottom: 10,
  },
  actions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  actionBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingVertical: 6,
    flex: 1,
    justifyContent: 'center' as const,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  actionSep: {
    width: 1,
    height: 16,
    backgroundColor: Colors.border,
  },
  timestamp: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'right' as const,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end' as const,
  },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  modalClose: {
    padding: 4,
  },
  paymentSummaryBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  paymentSummaryLine: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 4,
  },
  paymentSummaryKey: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  paymentSummaryVal: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  modalFieldLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
    marginBottom: 6,
    marginTop: 10,
  },
  modalRequired: {
    color: Colors.error,
  },
  modalOptional: {
    color: Colors.textMuted,
    fontWeight: '400' as const,
    textTransform: 'none' as const,
  },
  dateInputWrap: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: Colors.white,
  },
  dateInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    paddingVertical: 14,
  },
  methodRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 12,
  },
  methodChip: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  methodChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  methodChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  methodChipTextActive: {
    color: Colors.primary,
  },
  noteInputWrap: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    backgroundColor: Colors.white,
  },
  noteInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 12,
    minHeight: 52,
    textAlignVertical: 'top' as const,
  },
  balanceLine: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  partialInputWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: Colors.white,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginRight: 6,
  },
  partialInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '600' as const,
    color: Colors.text,
    paddingVertical: 14,
  },
  confirmBtn: {
    backgroundColor: Colors.success,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});
