import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  Share,
  TextInput,
  Clipboard,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Pressable,
} from 'react-native';
import { Alert } from '@/utils/alert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  ArrowLeft,
  MoreVertical,
  Share2,
  Download,
  CheckCircle2,
  MessageCircle,
  Clock,
  XCircle,
  Eye,
  Pencil,
  TimerOff,
  Plus,
  Trash2,
  X,
  Copy,
  Ban,
  History,
  ChevronRight,
  Link2,
  AlertTriangle,
  Calendar,
  ChevronDown,
} from 'lucide-react-native';
import * as Print from 'expo-print';
import {
  useInvoices,
  canEditInvoice,
  getInvoiceShareUrl,
  getAmountPaid,
  getBalanceDue,
  resolvePaymentStatus,
  INVOICE_PAYMENT_METHOD_LABELS,
  INVOICE_PAYMENT_TERMS_LABELS,
  type InvoicePaymentMethod,
  type InvoicePaymentTerms,
} from '@/contexts/InvoiceContext';
import type { Invoice, InvoiceStatus } from '@/contexts/InvoiceContext';
import { useInvoiceBranding } from '@/contexts/InvoiceBrandingContext';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import { useVendor } from '@/contexts/VendorContext';
import { formatInvoiceCustomerName } from '@/utils/internalCustomerName';
import { formatPriceWithCommas as formatPrice, type Currency } from '@/utils/formatPrice';
import InvoiceRenderer, { type InvoiceRendererData } from '@/components/InvoiceRenderer';
import { Colors } from '@/constants/colors';

/**
 * Vendor invoice-detail screen.
 *
 * Two distinct sections:
 *   A. The branded invoice document — rendered through the shared
 *      InvoiceRenderer, exactly what the customer sees (vendor branding,
 *      invoice number, customer name, dates, items, totals, fulfilment,
 *      notes, thank-you message, footer, "Powered by the platform").
 *   B. Vendor management panel — payment status, amount paid, balance due,
 *      Record Payment, Share, Copy link (external), Open chat (internal),
 *      Download PDF, and a status-aware More menu.
 *
 * The vendor never sees a generic data card in place of the branded invoice.
 * VENDOR placeholder is never used — the actual vendor business name is
 * resolved via vendor.name (Henry: vendor.displayName → vendor.businessName
 * → "Business" fallback).
 *
 * MVP status rules (derived, not manually toggled except Record Payment):
 *   Draft         — created, not yet issued. Editable + deletable.
 *   Unpaid        — issued; amount paid is 0; due date not passed or absent.
 *   Partially paid — vendor recorded an amount > 0 but < total.
 *   Paid          — recorded payments equal the invoice total.
 *   Overdue       — DERIVED: issued AND balance > 0 AND due date in the past.
 *                   Never manually selected. If no due date, cannot be overdue.
 *   Void          — keeps the financial record; blocks further payment recording.
 *                   Issued/paid invoices are never deleted.
 */
export default function VendorInvoiceDetailScreen() {
  const { orderId } = useLocalSearchParams();
  const {
    getInvoiceById,
    updateInvoice,
    recordPayment,
    deletePayment,
    deleteInvoice,
    duplicateInvoiceById,
    markInvoiceSharedExternally,
  } = useInvoices();
  // The signed-in vendor. The contact block, share text and PDF header all
  // read from here; they used the demo fixture, so a real vendor's invoice
  // carried somebody else's business name, phone and address.
  const { vendor } = useVendor();
  const { effectiveBranding } = useInvoiceBranding();
  const { plan } = useVendorPlan();

  const invoice = getInvoiceById(orderId as string);

  const [showMenu, setShowMenu] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState<Date>(() => new Date());
  const [showPaymentDatePicker, setShowPaymentDatePicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<InvoicePaymentMethod | ''>('');
  const [paymentNote, setPaymentNote] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // ─── Not-found state ────────────────────────────────────────────────────
  if (!invoice) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
              <ArrowLeft size={20} color={Colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Invoice</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Invoice not found</Text>
        </View>
      </View>
    );
  }

  // ─── Derived state ──────────────────────────────────────────────────────
  const currency: Currency = (invoice.currency as Currency) || 'NGN';
  const amountPaid = getAmountPaid(invoice.payments);
  const balanceDue = getBalanceDue(invoice.total, invoice.payments);
  const effectivePaymentStatus = resolvePaymentStatus(
    invoice.total,
    invoice.payments,
    invoice.paymentStatus,
  );
  const isInternal = invoice.customerSource !== 'external';

  // Derived overdue: issued AND balance > 0 AND due date in the past.
  // Never manually set by the vendor.
  const isOverdue = useMemo(() => {
    if (invoice.status === 'paid' || invoice.status === 'cancelled' || invoice.status === 'expired' || invoice.status === 'void') {
      return false;
    }
    if (invoice.status === 'draft') return false;
    if (balanceDue <= 0) return false;
    if (!invoice.dueDate) return false;
    const dueMs = new Date(invoice.dueDate).getTime();
    if (Number.isNaN(dueMs)) return false;
    return dueMs < Date.now();
  }, [invoice.status, invoice.dueDate, balanceDue]);

  // Effective display status — the label the vendor sees.
  type EffectiveDisplayStatus = InvoiceStatus | 'overdue' | 'partially_paid';
  const effectiveDisplayStatus: EffectiveDisplayStatus =
    invoice.status === 'void'
      ? 'void'
      : invoice.status === 'cancelled'
        ? 'cancelled'
        : invoice.status === 'draft'
          ? 'draft'
          : effectivePaymentStatus === 'paid'
            ? 'paid'
            : isOverdue
              ? 'overdue'
              : effectivePaymentStatus === 'partially_paid'
                ? 'partially_paid'
                : 'sent_in_chat';

  const statusConfig = getStatusConfig(effectiveDisplayStatus);
  const canRecordPayment =
    invoice.status !== 'paid' &&
    invoice.status !== 'cancelled' &&
    invoice.status !== 'expired' &&
    invoice.status !== 'void' &&
    invoice.status !== 'draft';

  // Privacy: internal customer → "First L."; external → vendor-typed name.
  const displayCustomerName = formatInvoiceCustomerName(invoice.customerName, invoice.customerSource);

  // Vendor name fallback: displayName → businessName → "Business".
  // Never "VENDOR". Mock uses vendor.name ("Spicy Restaurant").
  const vendorName = vendor.name || vendor.fullName || 'Business';

  const issueDateStr = invoice.issueDate
    ? new Date(invoice.issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : new Date(invoice.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const dueDateStr = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  const paymentTermsLabel = invoice.paymentTerms && invoice.paymentTerms !== 'none'
    ? INVOICE_PAYMENT_TERMS_LABELS[invoice.paymentTerms]
    : null;

  const lastUpdated = new Date(invoice.updatedAt ?? invoice.createdAt).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  // ─── Actions ────────────────────────────────────────────────────────────
  const handleShare = async () => {
    setShowMenu(false);
    const shareUrl = invoice.shareCode ? getInvoiceShareUrl(invoice.shareCode) : undefined;
    const message =
      `Invoice ${invoice.invoiceNumber} from ${vendorName}\n` +
      `Total: ${formatPrice(invoice.total, currency)}` +
      (shareUrl ? `\n\nView invoice: ${shareUrl}` : '');
    try {
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({ title: `Invoice ${invoice.invoiceNumber}`, text: message });
        } else {
          await navigator.clipboard.writeText(message);
          Alert.alert('Copied', 'Invoice details copied to clipboard');
        }
      } else {
        await Share.share({ message, title: `Invoice ${invoice.invoiceNumber}` });
      }
      if (invoice.customerSource === 'external') {
        await markInvoiceSharedExternally(invoice.id);
      }
    } catch (error) {
      console.error('Error sharing invoice:', error);
    }
  };

  const handleCopyLink = async () => {
    setShowMenu(false);
    if (!invoice.shareCode) return;
    const url = getInvoiceShareUrl(invoice.shareCode);
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(url);
      } else {
        await Clipboard.setString(url);
      }
      Alert.alert('Link copied', 'Secure invoice link copied to clipboard.');
    } catch (e) {
      console.error('Copy link failed', e);
      Alert.alert('Error', 'Could not copy the link.');
    }
  };

  const handleOpenChat = () => {
    setShowMenu(false);
    if (invoice.chatId) {
      router.push(`/vendor/chats/${invoice.chatId}` as any);
    } else if (invoice.conversationId) {
      router.push(`/vendor/chats/${invoice.conversationId}` as any);
    } else {
      Alert.alert('Chat unavailable', 'No conversation is linked to this invoice.');
    }
  };

  const handleDownload = async () => {
    setShowMenu(false);
    setIsDownloading(true);
    try {
      const html = generateInvoiceHTML({
        invoiceNumber: invoice.invoiceNumber,
        vendorName,
        vendorPhone: vendor.phone,
        vendorEmail: vendor.email,
        vendorAddress: vendor.fullAddress,
        vendorWebsite: vendor.contactLinks?.website,
        customerName: displayCustomerName,
        customerPhone: invoice.customerSource === 'external' ? invoice.customerPhone : undefined,
        customerEmail: invoice.customerSource === 'external' ? invoice.customerEmail : undefined,
        customerAddress: invoice.customerSource === 'external' ? invoice.customerAddress : undefined,
        issueDate: issueDateStr,
        dueDate: dueDateStr ?? undefined,
        items: invoice.items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total, description: i.description })),
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        discount: invoice.discount,
        total: invoice.total,
        amountPaid,
        balanceDue,
        statusLabel: statusConfig.label,
        notes: invoice.notes,
        currency,
      });
      const { uri } = await Print.printToFileAsync({ html });
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = uri;
        link.download = `Invoice-${invoice.invoiceNumber}.pdf`;
        link.click();
      } else {
        await Share.share({ url: uri, title: `Invoice ${invoice.invoiceNumber}` });
      }
    } catch (err) {
      console.error('PDF generation failed:', err);
      Alert.alert('Error', 'Could not generate PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleEdit = () => {
    setShowMenu(false);
    if (invoice.status === 'paid' || invoice.status === 'void') {
      Alert.alert('Invoice locked', 'This invoice can no longer be edited. Create a new invoice or adjustment.');
      return;
    }
    if (!canEditInvoice(invoice.status)) {
      Alert.alert('Cannot edit', 'This invoice can no longer be edited.');
      return;
    }
    router.push(`/vendor/settings/create-invoice?invoiceId=${invoice.id}` as any);
  };

  /**
   * Duplicate opens the copy for editing, because the reason to duplicate is
   * almost always "same customer, same items, different month" — landing on a
   * read-only copy would just mean tapping Edit immediately.
   *
   * The plan refusal comes from the server. Its message names the limit, so it
   * is shown as-is rather than replaced with a generic one.
   */
  const handleDuplicate = async () => {
    setShowMenu(false);
    try {
      const newId = await duplicateInvoiceById(invoice.id);
      if (newId) router.replace(`/vendor/invoice/${newId}` as any);
    } catch (error: any) {
      Alert.alert(
        'Could not duplicate',
        error?.message ?? 'Something went wrong duplicating this invoice.',
      );
    }
  };

  const handleDeleteDraft = () => {
    setShowMenu(false);
    if (invoice.status !== 'draft') return;
    Alert.alert(
      'Delete draft invoice?',
      `${invoice.invoiceNumber} will be permanently removed. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Draft',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteInvoice(invoice.id);
              router.back();
            } catch (e) {
              console.error('Delete draft failed', e);
              Alert.alert('Error', 'Could not delete the draft.');
            }
          },
        },
      ],
    );
  };

  const handleVoid = () => {
    setShowMenu(false);
    if (invoice.status === 'void' || invoice.status === 'cancelled') return;
    Alert.alert(
      'Void this invoice?',
      'Voiding keeps the financial record but prevents further payment recording. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Void invoice',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateInvoice(invoice.id, {
                status: 'void',
                voidedAt: new Date().toISOString(),
              });
            } catch (e) {
              console.error('Void failed', e);
              Alert.alert('Error', 'Could not void the invoice.');
            }
          },
        },
      ],
    );
  };

  const openRecordPayment = () => {
    setPaymentAmount(balanceDue > 0 ? String(balanceDue) : String(invoice.total));
    setPaymentDate(new Date());
    setPaymentMethod('');
    setPaymentNote('');
    setShowRecordPayment(true);
  };

  const fillFullBalance = () => {
    setPaymentAmount(String(balanceDue > 0 ? balanceDue : invoice.total));
  };

  // Format the amount input as it is typed: digits and a single decimal only,
  // with thousands separators. Keeps the currency symbol out of the editable
  // value (it is rendered as a fixed prefix).
  const handleAmountChange = (raw: string) => {
    // Strip anything that isn't a digit or dot, keep at most one dot.
    let cleaned = raw.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = `${parts.slice(0, -1).join('')}.${parts[parts.length - 1]}`;
    }
    // Limit to two decimal places.
    const dotIdx = cleaned.indexOf('.');
    if (dotIdx !== -1 && cleaned.length - dotIdx - 1 > 2) {
      cleaned = cleaned.slice(0, dotIdx + 3);
    }
    setPaymentAmount(cleaned);
  };

  const parsedAmount = parseFloat(paymentAmount);
  const isAmountInvalid =
    !paymentAmount ||
    Number.isNaN(parsedAmount) ||
    parsedAmount <= 0 ||
    parsedAmount > balanceDue + 0.01;

  const handlePaymentDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (selected) setPaymentDate(selected);
    // Android fires a change event on dismiss too; only close the picker on
    // iOS via the toggle below.
  };

  const handleConfirmPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter the amount you received.');
      return;
    }
    if (amount > balanceDue + 0.01) {
      Alert.alert(
        'Amount exceeds balance',
        `The remaining balance is ${formatPrice(balanceDue, currency)}.`,
      );
      return;
    }
    setIsRecording(true);
    try {
      const isoDate = new Date(
        paymentDate.getFullYear(),
        paymentDate.getMonth(),
        paymentDate.getDate(),
        12, 0, 0,
      ).toISOString();
      await recordPayment(invoice.id, {
        amount,
        date: isoDate,
        method: paymentMethod || undefined,
        note: paymentNote.trim() || undefined,
      });
      Keyboard.dismiss();
      setShowRecordPayment(false);
    } catch (e) {
      console.error('Record payment failed', e);
      Alert.alert('Error', 'Could not record payment.');
    } finally {
      setIsRecording(false);
    }
  };

  const handleDeletePayment = (paymentId: string) => {
    Alert.alert(
      'Delete payment record?',
      'This will recompute the invoice balance and may reopen it as unpaid.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePayment(invoice.id, paymentId);
            } catch (e) {
              console.error('Delete payment failed', e);
              Alert.alert('Error', 'Could not delete payment.');
            }
          },
        },
      ],
    );
  };

  // ─── Renderer data ──────────────────────────────────────────────────────
  const invoiceData: InvoiceRendererData = {
    invoiceNumber: invoice.invoiceNumber,
    vendorName,
    customerName: displayCustomerName,
    statusLabel: statusConfig.label,
    statusColor: statusConfig.color,
    statusBg: statusConfig.bg,
    items: invoice.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
      description: item.description,
    })),
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    discount: invoice.discount,
    total: invoice.total,
    notes: invoice.notes,
    currency,
    lastUpdated,
    issueDate: invoice.issueDate ?? invoice.createdAt,
    dueDate: invoice.dueDate,
    amountPaid,
    balanceDue,
    fulfilmentMethod: invoice.fulfilmentMethod,
    fulfilmentDetails: invoice.fulfilmentDetails,
    deliveryFee:
      invoice.fulfilmentMethod === 'delivery' && invoice.fulfilmentDetails?.deliveryFee
        ? invoice.fulfilmentDetails.deliveryFee
        : 0,
    vendorPhone: vendor.phone,
    vendorEmail: vendor.email,
    vendorAddress: vendor.fullAddress,
    vendorWebsite: vendor.contactLinks?.website,
  };

  const rendererBranding = {
    logoUri: effectiveBranding.logoUri,
    brandColor: effectiveBranding.brandColor,
    thankYouMessage: effectiveBranding.thankYouMessage,
    footerText: effectiveBranding.footerText,
    templateId: effectiveBranding.templateId,
    poweredBySubtle: effectiveBranding.capabilities.poweredBythe platform === 'subtle',
    showLogo: effectiveBranding.capabilities.allowLogo,
    showThankYou: effectiveBranding.capabilities.allowThankYouMessage,
    showFooter: effectiveBranding.capabilities.allowCustomFooter,
    showBrandedHeader: effectiveBranding.capabilities.allowBrandedHeader,
  };

  // ─── Menu actions by status ─────────────────────────────────────────────
  const isDraft = invoice.status === 'draft';
  const isPaid = invoice.status === 'paid' || effectivePaymentStatus === 'paid';
  const isVoid = invoice.status === 'void';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
            <ArrowLeft size={20} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>Invoice</Text>
          <TouchableOpacity onPress={() => setShowMenu(true)} style={styles.menuButton} activeOpacity={0.7}>
            <MoreVertical size={22} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* ── A. BRANDED INVOICE DOCUMENT ─────────────────────────────── */}
          <InvoiceRenderer
            data={invoiceData}
            branding={rendererBranding}
            mode="page"
            seasonalTheme={effectiveBranding.seasonalTheme}
            style={styles.invoiceRenderer}
          />

          <Text style={styles.lastUpdated}>Last updated {lastUpdated}</Text>

          {/* ── B. VENDOR MANAGEMENT PANEL ──────────────────────────────── */}
          <View style={styles.managementPanel}>

            {/* Payment status + amount summary */}
            <View style={styles.statusRow}>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                {statusConfig.icon}
                <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
                  {statusConfig.label}
                </Text>
              </View>
              <View style={styles.invoiceNumberWrap}>
                <Text style={styles.invoiceNumberLabel}>{invoice.invoiceNumber}</Text>
                <Text style={styles.issueDateLabel}>Issued {issueDateStr}</Text>
              </View>
            </View>

            {/* Payment summary block */}
            <View style={styles.paymentSummaryCard}>
              <View style={styles.paymentSummaryRow}>
                <Text style={styles.paymentSummaryLabel}>Invoice total</Text>
                <Text style={styles.paymentSummaryValue}>{formatPrice(invoice.total, currency)}</Text>
              </View>
              <View style={styles.paymentSummaryRow}>
                <Text style={styles.paymentSummaryLabel}>Amount paid</Text>
                <Text style={[styles.paymentSummaryValue, { color: Colors.success }]}>
                  {formatPrice(amountPaid, currency)}
                </Text>
              </View>
              <View style={styles.paymentSummaryRow}>
                <Text style={styles.paymentSummaryLabel}>Balance due</Text>
                <Text style={[styles.paymentSummaryValue, { fontWeight: '700' as const }]}>
                  {formatPrice(balanceDue, currency)}
                </Text>
              </View>
              {dueDateStr ? (
                <View style={styles.paymentSummaryRow}>
                  <Text style={styles.paymentSummaryLabel}>Due date</Text>
                  <Text style={[styles.paymentSummaryValue, isOverdue && { color: Colors.error }]}>
                    {dueDateStr}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Payment history link */}
            {(invoice.payments ?? []).length > 0 ? (
              <TouchableOpacity
                style={styles.historyRow}
                onPress={() => setShowPaymentHistory(true)}
                activeOpacity={0.7}
              >
                <History size={16} color={Colors.textSecondary} />
                <Text style={styles.historyRowText}>
                  Payment history ({(invoice.payments ?? []).length})
                </Text>
                <ChevronRight size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : null}

            {/* Sharing status — internal vs external */}
            <View style={styles.sharingCard}>
              {isInternal ? (
                <>
                  <View style={styles.sharingHeaderRow}>
                    <MessageCircle size={16} color={Colors.primary} />
                    <Text style={styles.sharingHeader}>Sent in the platform chat</Text>
                  </View>
                  <Text style={styles.sharingBody}>
                    Sent to {displayCustomerName} in the platform chat.
                  </Text>
                  {invoice.chatId ? (
                    <TouchableOpacity
                      style={styles.sharingAction}
                      onPress={handleOpenChat}
                      activeOpacity={0.7}
                    >
                      <MessageCircle size={15} color={Colors.primary} />
                      <Text style={styles.sharingActionText}>Open chat</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : (
                <>
                  <View style={styles.sharingHeaderRow}>
                    <Link2 size={16} color={Colors.primary} />
                    <Text style={styles.sharingHeader}>Shared using a secure invoice link</Text>
                  </View>
                  <Text style={styles.sharingBody}>
                    Share the secure link with your customer outside the platform.
                  </Text>
                  <View style={styles.sharingActionsRow}>
                    <TouchableOpacity
                      style={[styles.sharingAction, { flex: 1 }]}
                      onPress={handleCopyLink}
                      activeOpacity={0.7}
                    >
                      <Copy size={15} color={Colors.primary} />
                      <Text style={styles.sharingActionText}>Copy link</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.sharingAction, { flex: 1 }]}
                      onPress={handleShare}
                      activeOpacity={0.7}
                    >
                      <Share2 size={15} color={Colors.primary} />
                      <Text style={styles.sharingActionText}>Share</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>

            {/* Quick actions row — only actions that are NOT in the ellipsis menu.
                Share and PDF live in the ellipsis menu only (per MVP spec), so
                we only surface chat / copy link here when applicable. */}
            <View style={styles.quickActionsRow}>
              {isInternal && invoice.chatId ? (
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={handleOpenChat}
                  activeOpacity={0.7}
                >
                  <MessageCircle size={18} color={Colors.text} />
                  <Text style={styles.quickActionLabel}>Chat</Text>
                </TouchableOpacity>
              ) : null}
              {!isInternal && invoice.shareCode ? (
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={handleCopyLink}
                  activeOpacity={0.7}
                >
                  <Link2 size={18} color={Colors.text} />
                  <Text style={styles.quickActionLabel}>Copy link</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      {/* ─── Record Payment bottom bar ──────────────────────────────────── */}
      {canRecordPayment && (
        <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={openRecordPayment}
              style={styles.recordPaymentButton}
              activeOpacity={0.8}
            >
              <Plus size={18} color={Colors.white} />
              <Text style={styles.recordPaymentButtonText}>Record Payment</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}

      {/* ─── More menu (status-aware, MVP) ───────────────────────────── */}
      {/*  Draft:           Edit draft / Delete draft
          Issued unpaid:   Share / PDF (Record payment is the bottom bar)
          Partially paid:  View payment history / Share / PDF (Record payment bottom bar)
          Paid:            View payment history / Share / PDF
          Void:            Share / PDF

          Duplicate is shown on every issued invoice. It was hidden behind a
          "post-MVP" note while its backend callable was finished, quota-gated
          and part of the agreed scope, so a working feature was unreachable.
          The plan check stays on the server: it already knows and refuses with
          a message worth showing, and a client deciding its own gates is what
          put Standard-only widgets in front of Basic vendors. */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuContainer}>
            {isDraft ? (
              <>
                <MenuRow icon={<Pencil size={18} color={Colors.text} />} label="Edit draft" onPress={handleEdit} />
                <MenuDivider />
                <MenuRow
                  icon={<Trash2 size={18} color={Colors.error} />}
                  label="Delete draft"
                  labelColor={Colors.error}
                  onPress={handleDeleteDraft}
                />
              </>
            ) : isVoid ? (
              <>
                <MenuRow icon={<Share2 size={18} color={Colors.text} />} label="Share invoice" onPress={handleShare} />
                <MenuDivider />
                <MenuRow icon={<Download size={18} color={Colors.text} />} label="Download PDF" onPress={handleDownload} />
                <MenuDivider />
                <MenuRow icon={<Copy size={18} color={Colors.text} />} label="Duplicate invoice" onPress={handleDuplicate} />
              </>
            ) : isPaid ? (
              <>
                <MenuRow icon={<History size={18} color={Colors.text} />} label="View payment history" onPress={() => { setShowMenu(false); setShowPaymentHistory(true); }} />
                <MenuDivider />
                <MenuRow icon={<Share2 size={18} color={Colors.text} />} label="Share invoice" onPress={handleShare} />
                <MenuDivider />
                <MenuRow icon={<Download size={18} color={Colors.text} />} label="Download PDF" onPress={handleDownload} />
                <MenuDivider />
                <MenuRow icon={<Copy size={18} color={Colors.text} />} label="Duplicate invoice" onPress={handleDuplicate} />
              </>
            ) : (
              <>
                {/* Issued & unpaid OR partially paid: payment history appears
                    only when there is at least one recorded payment (i.e.
                    partially paid). Record payment lives in the bottom bar. */}
                {(invoice.payments ?? []).length > 0 ? (
                  <>
                    <MenuRow icon={<History size={18} color={Colors.text} />} label="View payment history" onPress={() => { setShowMenu(false); setShowPaymentHistory(true); }} />
                    <MenuDivider />
                  </>
                ) : null}
                <MenuRow icon={<Share2 size={18} color={Colors.text} />} label="Share invoice" onPress={handleShare} />
                <MenuDivider />
                <MenuRow icon={<Download size={18} color={Colors.text} />} label="Download PDF" onPress={handleDownload} />
                <MenuDivider />
                <MenuRow icon={<Copy size={18} color={Colors.text} />} label="Duplicate invoice" onPress={handleDuplicate} />
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Record Payment sheet (keyboard-safe) ─────────────────────── */}
      <Modal
        visible={showRecordPayment}
        transparent
        animationType="slide"
        onRequestClose={() => { Keyboard.dismiss(); setShowRecordPayment(false); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.paymentModalKav}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <TouchableWithoutFeedback
            onPress={() => { Keyboard.dismiss(); setShowRecordPayment(false); }}
            accessible={false}
          >
            <View style={styles.paymentModalOverlay}>
              <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()} accessible={false}>
                <View style={styles.paymentModalSheet}>
                  <View style={styles.paymentModalHeader}>
                    <Text style={styles.paymentModalTitle}>Record payment</Text>
                    <TouchableOpacity
                      onPress={() => { Keyboard.dismiss(); setShowRecordPayment(false); }}
                      style={styles.paymentModalClose}
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <X size={20} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    style={styles.paymentModalScroll}
                    contentContainerStyle={styles.paymentModalScrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    <View style={styles.paymentModalSummary}>
                      <View style={styles.paymentModalSummaryRow}>
                        <Text style={styles.paymentModalSummaryLabel}>Invoice total</Text>
                        <Text style={styles.paymentModalSummaryValue}>{formatPrice(invoice.total, currency)}</Text>
                      </View>
                      <View style={styles.paymentModalSummaryRow}>
                        <Text style={styles.paymentModalSummaryLabel}>Previously recorded</Text>
                        <Text style={[styles.paymentModalSummaryValue, { color: Colors.success }]}>
                          {formatPrice(amountPaid, currency)}
                        </Text>
                      </View>
                      <View style={styles.paymentModalSummaryRow}>
                        <Text style={styles.paymentModalSummaryLabel}>Balance due</Text>
                        <Text style={[styles.paymentModalSummaryValue, { fontWeight: '700' as const }]}>
                          {formatPrice(balanceDue, currency)}
                        </Text>
                      </View>
                    </View>

                    {/* AMOUNT RECEIVED — numeric keyboard, fixed currency prefix, comma-formatted. */}
                    <Text style={styles.paymentModalLabel}>Amount received <Text style={styles.required}>*</Text></Text>
                    <View style={styles.paymentModalInputWrap}>
                      <Text style={styles.paymentModalCurrency}>{getCurrencySymbol(currency)}</Text>
                      <TextInput
                        style={styles.paymentModalInput}
                        value={paymentAmount}
                        onChangeText={handleAmountChange}
                        placeholder="0.00"
                        placeholderTextColor={Colors.inputPlaceholder}
                        keyboardType="decimal-pad"
                        returnKeyType="done"
                      />
                      <TouchableOpacity
                        onPress={fillFullBalance}
                        style={styles.fullBalanceChip}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.fullBalanceChipText}>Use full balance</Text>
                      </TouchableOpacity>
                    </View>

                    {/* PAYMENT DATE — tappable date field, not free-form text. */}
                    <Text style={styles.paymentModalLabel}>Payment date</Text>
                    <TouchableOpacity
                      style={styles.paymentDateField}
                      onPress={() => { Keyboard.dismiss(); setShowPaymentDatePicker(true); }}
                      activeOpacity={0.7}
                    >
                      <Calendar size={16} color={Colors.textMuted} />
                      <Text style={styles.paymentDateValue}>
                        {paymentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                      <ChevronDown size={14} color={Colors.textMuted} />
                    </TouchableOpacity>

                    {/* PAYMENT METHOD (optional) */}
                    <Text style={styles.paymentModalLabel}>Payment method <Text style={styles.optional}>(optional)</Text></Text>
                    <View style={styles.paymentMethodRow}>
                      {PAYMENT_METHODS.map((m) => (
                        <TouchableOpacity
                          key={m.id}
                          style={[
                            styles.paymentMethodChip,
                            paymentMethod === m.id && styles.paymentMethodChipActive,
                          ]}
                          onPress={() => setPaymentMethod(paymentMethod === m.id ? '' : m.id)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.paymentMethodChipText,
                              paymentMethod === m.id && styles.paymentMethodChipTextActive,
                            ]}
                          >
                            {m.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* REFERENCE / NOTE (optional) — internal only, never on the customer invoice. */}
                    <Text style={styles.paymentModalLabel}>Reference or note <Text style={styles.optional}>(optional)</Text></Text>
                    <View style={styles.paymentModalInputWrap}>
                      <TextInput
                        style={[styles.paymentModalInput, styles.paymentModalNoteInput]}
                        value={paymentNote}
                        onChangeText={setPaymentNote}
                        placeholder="Add a short internal note..."
                        placeholderTextColor={Colors.inputPlaceholder}
                        multiline
                        returnKeyType="default"
                      />
                    </View>
                  </ScrollView>

                  {/* Sticky bottom action area — always above the keyboard. */}
                  <View style={styles.paymentModalFooter}>
                    <TouchableOpacity
                      style={styles.paymentModalCancel}
                      onPress={() => { Keyboard.dismiss(); setShowRecordPayment(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.paymentModalCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.paymentModalConfirm,
                        (isRecording || isAmountInvalid) && styles.paymentModalConfirmDisabled,
                      ]}
                      onPress={handleConfirmPayment}
                      disabled={isRecording || isAmountInvalid}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.paymentModalConfirmText}>
                        {isRecording ? 'Saving...' : 'Record payment'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>

        {/* Native date picker — iOS renders as a sheet, Android as a spinner. */}
        {showPaymentDatePicker && (
          <DateTimePicker
            value={paymentDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={handlePaymentDateChange}
          />
        )}
        {showPaymentDatePicker && Platform.OS === 'ios' && (
          <View style={styles.datePickerToolbar}>
            <TouchableOpacity
              style={styles.datePickerDoneBtn}
              onPress={() => setShowPaymentDatePicker(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.datePickerDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>

      {/* ─── Payment history sheet ──────────────────────────────────────── */}
      <Modal
        visible={showPaymentHistory}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentHistory(false)}
      >
        <TouchableOpacity
          style={styles.paymentModalOverlay}
          activeOpacity={1}
          onPress={() => setShowPaymentHistory(false)}
        >
          <TouchableOpacity style={styles.paymentModalSheet} activeOpacity={1}>
            <View style={styles.paymentModalHeader}>
              <Text style={styles.paymentModalTitle}>Payment history</Text>
              <TouchableOpacity
                onPress={() => setShowPaymentHistory(false)}
                style={styles.paymentModalClose}
                activeOpacity={0.7}
              >
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.paymentModalSummary}>
              <View style={styles.paymentModalSummaryRow}>
                <Text style={styles.paymentModalSummaryLabel}>Invoice total</Text>
                <Text style={styles.paymentModalSummaryValue}>{formatPrice(invoice.total, currency)}</Text>
              </View>
              <View style={styles.paymentModalSummaryRow}>
                <Text style={styles.paymentModalSummaryLabel}>Total recorded</Text>
                <Text style={[styles.paymentModalSummaryValue, { color: Colors.success }]}>
                  {formatPrice(amountPaid, currency)}
                </Text>
              </View>
              <View style={styles.paymentModalSummaryRow}>
                <Text style={styles.paymentModalSummaryLabel}>Balance due</Text>
                <Text style={[styles.paymentModalSummaryValue, { fontWeight: '700' as const }]}>
                  {formatPrice(balanceDue, currency)}
                </Text>
              </View>
            </View>

            <Text style={styles.historyListLabel}>RECORDED PAYMENTS</Text>
            {(invoice.payments ?? []).length === 0 ? (
              <Text style={styles.historyEmpty}>No payments recorded yet.</Text>
            ) : (
              (invoice.payments ?? []).map((p) => (
                <View key={p.id} style={styles.historyItem}>
                  <View style={styles.historyItemLeft}>
                    <Text style={styles.historyItemAmount}>{formatPrice(p.amount, currency)}</Text>
                    <Text style={styles.historyItemMeta}>
                      {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {p.method ? `  ·  ${INVOICE_PAYMENT_METHOD_LABELS[p.method]}` : ''}
                    </Text>
                    {p.note ? (
                      <Text style={styles.historyItemNote} numberOfLines={2}>{p.note}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeletePayment(p.id)}
                    style={styles.historyItemDelete}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.6}
                  >
                    <Trash2 size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getStatusConfig(status: InvoiceStatus | 'overdue' | 'partially_paid'): {
  label: string;
  color: string;
  bg: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case 'draft':
      return { label: 'Draft', color: Colors.textMuted, bg: Colors.surface, icon: <Clock size={12} color={Colors.textMuted} /> };
    case 'shared_externally':
    case 'sent_in_chat':
      return { label: 'Unpaid', color: Colors.warning, bg: Colors.warningLight, icon: <Clock size={12} color={Colors.warning} /> };
    case 'viewed':
      return { label: 'Unpaid', color: Colors.warning, bg: Colors.warningLight, icon: <Eye size={12} color={Colors.warning} /> };
    case 'partially_paid':
      return { label: 'Partially paid', color: Colors.warning, bg: Colors.warningLight, icon: <CheckCircle2 size={12} color={Colors.warning} /> };
    case 'paid':
      return { label: 'Paid', color: Colors.success, bg: Colors.successLight, icon: <CheckCircle2 size={12} color={Colors.success} /> };
    case 'overdue':
      return { label: 'Overdue', color: Colors.error, bg: Colors.errorLight, icon: <AlertTriangle size={12} color={Colors.error} /> };
    case 'cancelled':
      return { label: 'Cancelled', color: Colors.textMuted, bg: Colors.surface, icon: <XCircle size={12} color={Colors.textMuted} /> };
    case 'expired':
      return { label: 'Expired', color: Colors.textMuted, bg: Colors.surface, icon: <TimerOff size={12} color={Colors.textMuted} /> };
    case 'void':
      return { label: 'Void', color: Colors.textMuted, bg: Colors.surface, icon: <Ban size={12} color={Colors.textMuted} /> };
    default:
      return { label: 'Draft', color: Colors.textMuted, bg: Colors.surface, icon: <Clock size={12} color={Colors.textMuted} /> };
  }
}

function getCurrencySymbol(currency: Currency): string {
  switch (currency) {
    case 'NGN': return '\u20A6';
    case 'USD': return 'US$';
    case 'GBP': return '\u00A3';
    case 'EUR': return '\u20AC';
    case 'CAD': return 'CA$';
    case 'GHS': return 'GH\u20B5';
    case 'KES': return 'KSh';
    case 'ZAR': return 'R';
    case 'AED': return '\u062F.\u0625';
    case 'AUD': return 'A$';
    case 'INR': return '\u20B9';
    case 'BRL': return 'R$';
    case 'MXN': return 'MX$';
    case 'JPY': return '\u00A5';
    case 'KRW': return '\u20A9';
    case 'VND': return '\u20AB';
    default: return '\u20A6';
  }
}

const PAYMENT_METHODS: { id: InvoicePaymentMethod; label: string }[] = [
  { id: 'bank_transfer', label: 'Bank transfer' },
  { id: 'cash', label: 'Cash' },
  { id: 'card_direct', label: 'Card paid directly to vendor' },
  { id: 'mobile_money', label: 'Mobile money' },
  { id: 'other', label: 'Other' },
];

function MenuRow({
  icon,
  label,
  onPress,
  labelColor,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  labelColor?: string;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      {icon}
      <Text style={[styles.menuItemText, labelColor ? { color: labelColor } : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

function MenuDivider() {
  return <View style={styles.menuDivider} />;
}

/** Print/PDF invoice HTML — uses comma-formatted currency, vendor name, due date. */
function generateInvoiceHTML(params: {
  invoiceNumber: string;
  vendorName: string;
  vendorPhone?: string;
  vendorEmail?: string;
  vendorAddress?: string;
  vendorWebsite?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  issueDate: string;
  dueDate?: string;
  items: { name: string; quantity: number; unitPrice: number; total: number; description?: string }[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  statusLabel: string;
  notes?: string;
  currency: Currency;
}): string {
  const {
    invoiceNumber, vendorName, vendorPhone, vendorEmail, vendorAddress, vendorWebsite,
    customerName, customerPhone, customerEmail, customerAddress,
    issueDate, dueDate, items, subtotal, tax, discount, total,
    amountPaid, balanceDue, statusLabel, notes, currency,
  } = params;
  const sym = getCurrencySymbol(currency);
  const money = (n: number) => `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const vendorContact = [vendorPhone, vendorEmail, vendorAddress].filter(Boolean).map((v) => `<div>${v}</div>`).join('');
  const customerContact = [customerPhone, customerEmail, customerAddress].filter(Boolean).map((v) => `<div>${v}</div>`).join('');

  const itemRows = items.map((item) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;">
        <div style="font-weight:500;">${item.name}</div>
        ${item.description ? `<div style="font-size:12px;color:#6B7280;margin-top:2px;">${item.description}</div>` : ''}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;text-align:center;">${item.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;text-align:right;">${money(item.unitPrice)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:500;">${money(item.total)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#111827;padding:48px 56px;font-size:14px;line-height:1.6;}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;}
    .brand h1{font-size:20px;font-weight:700;color:#111827;margin-bottom:6px;}
    .brand .contact{font-size:12px;color:#6B7280;line-height:1.5;}
    .invoice-meta{text-align:right;}
    .invoice-meta h2{font-size:26px;font-weight:800;color:#111827;}
    .inv-num{font-size:13px;color:#6B7280;margin-top:4px;}
    .billing{display:flex;gap:40px;margin-bottom:32px;padding:20px;background:#F9FAFB;border-radius:12px;}
    .billing-block{flex:1;}
    .billing-block h3{font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;}
    .billing-block p{font-size:15px;font-weight:600;color:#111827;}
    .billing-block .contact{font-size:12px;color:#6B7280;margin-top:4px;line-height:1.5;}
    table{width:100%;border-collapse:collapse;margin-bottom:24px;}
    thead th{font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.6px;padding-bottom:10px;border-bottom:2px solid #F3F4F6;}
    thead th:not(:first-child){text-align:right;}
    thead th:nth-child(2){text-align:center;}
    .totals{margin-left:auto;width:280px;}
    .totals-row{display:flex;justify-content:space-between;padding:7px 0;font-size:14px;color:#6B7280;}
    .totals-row.grand{padding-top:10px;border-top:2px solid #111827;font-size:17px;font-weight:700;color:#111827;margin-top:4px;}
    .payment-status{display:inline-block;padding:5px 12px;border-radius:6px;font-size:12px;font-weight:700;letter-spacing:0.5px;background:#F9FAFB;color:#111827;margin-top:20px;}
    .notes{margin-top:16px;padding:14px;background:#F9FAFB;border-radius:10px;font-size:13px;color:#374151;}
    .footer{margin-top:40px;padding-top:16px;border-top:1px solid #F3F4F6;text-align:center;font-size:12px;color:#9CA3AF;line-height:1.7;}
  </style></head><body>
    <div class="header">
      <div class="brand">
        <h1>${vendorName}</h1>
        <div class="contact">${vendorContact}${vendorWebsite ? `<div>${vendorWebsite}</div>` : ''}</div>
      </div>
      <div class="invoice-meta">
        <h2>Invoice</h2>
        <div class="inv-num">${invoiceNumber}</div>
        <div class="inv-num">Issued ${issueDate}</div>
        ${dueDate ? `<div class="inv-num">Due ${dueDate}</div>` : ''}
      </div>
    </div>
    <div class="billing">
      <div class="billing-block"><h3>From</h3><p>${vendorName}</p><div class="contact">${vendorContact}</div></div>
      <div class="billing-block"><h3>Billed To</h3><p>${customerName}</p><div class="contact">${customerContact}</div></div>
    </div>
    <table>
      <thead><tr><th style="text-align:left;">Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div class="totals">
      <div class="totals-row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
      ${tax > 0 ? `<div class="totals-row"><span>Tax</span><span>${money(tax)}</span></div>` : ''}
      ${discount > 0 ? `<div class="totals-row"><span>Discount</span><span>-${money(discount)}</span></div>` : ''}
      <div class="totals-row grand"><span>Total</span><span>${money(total)}</span></div>
      ${amountPaid > 0 ? `<div class="totals-row"><span>Amount paid</span><span>${money(amountPaid)}</span></div>` : ''}
      ${balanceDue > 0 ? `<div class="totals-row"><span>Balance due</span><span>${money(balanceDue)}</span></div>` : ''}
    </div>
    <div class="payment-status">${statusLabel}</div>
    ${notes ? `<div class="notes">${notes}</div>` : ''}
    <div class="footer">
      <p>Powered by the platform</p>
      <p>the platform does not process payments. Payments are handled directly between customer and vendor.</p>
    </div>
  </body></html>`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundCanvas,
  },
  headerSafe: {
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  menuButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerSpacer: {
    width: 38,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  invoiceRenderer: {
    width: '100%',
  },
  lastUpdated: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginTop: 12,
    marginBottom: 20,
  },

  // Management panel
  managementPanel: {
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexShrink: 0,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  invoiceNumberWrap: {
    flex: 1,
  },
  invoiceNumberLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  issueDateLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // Payment summary
  paymentSummaryCard: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  paymentSummaryRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 6,
  },
  paymentSummaryLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  paymentSummaryValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    fontVariant: ['tabular-nums'] as any,
  },

  // History row
  historyRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  historyRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },

  // Sharing card
  sharingCard: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  sharingHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 6,
  },
  sharingHeader: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  sharingBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  sharingActionsRow: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  sharingAction: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: Colors.primaryTint,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  sharingActionText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.primary,
  },

  // Quick actions
  quickActionsRow: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  quickActionDisabled: {
    opacity: 0.5,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text,
  },

  // Bottom bar
  bottomBar: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  recordPaymentButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.success,
  },
  recordPaymentButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },

  // Menu
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start' as const,
    alignItems: 'flex-end' as const,
    paddingTop: Platform.select({ ios: 100, android: 90, default: 70 }),
    paddingRight: 16,
  },
  menuContainer: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    minWidth: 200,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 10,
  },
  menuItemText: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 12,
  },

  // Record Payment modal — keyboard-safe bottom sheet
  paymentModalKav: {
    flex: 1,
  },
  paymentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end' as const,
  },
  paymentModalSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 14,
    // paddingBottom is dynamic via safe-area insets + KeyboardAvoidingView.
    maxHeight: '92%' as any,
    overflow: 'hidden' as const,
  },
  paymentModalScroll: {
    flexGrow: 0,
  },
  paymentModalScrollContent: {
    paddingBottom: 8,
  },
  paymentModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 14,
  },
  paymentModalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  paymentModalClose: {
    padding: 4,
  },
  paymentModalSummary: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  paymentModalSummaryRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 4,
  },
  paymentModalSummaryLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  paymentModalSummaryValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    fontVariant: ['tabular-nums'] as any,
  },
  paymentModalLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 7,
    marginTop: 16,
  },
  // Payment date — tappable field, not free-form text.
  paymentDateField: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 13,
    backgroundColor: Colors.surface,
  },
  paymentDateValue: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  datePickerToolbar: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'flex-end' as const,
  },
  datePickerDoneBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  datePickerDoneText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  required: {
    color: Colors.error,
  },
  optional: {
    color: Colors.textMuted,
    fontWeight: '400' as const,
    textTransform: 'none' as const,
  },
  paymentModalInputWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.surface,
  },
  paymentModalCurrency: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginRight: 6,
  },
  paymentModalInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    paddingVertical: 12,
  },
  fullBalanceChip: {
    backgroundColor: Colors.primaryTint,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  fullBalanceChipText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  paymentModalFooter: {
    flexDirection: 'row' as const,
    gap: 10,
    paddingTop: 14,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
    backgroundColor: Colors.background,
  },
  paymentMethodRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  paymentMethodChip: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  paymentMethodChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  paymentMethodChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  paymentMethodChipTextActive: {
    color: Colors.primary,
  },
  paymentModalNoteInput: {
    minHeight: 60,
    textAlignVertical: 'top' as const,
  },
  paymentModalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center' as const,
  },
  paymentModalCancelText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  paymentModalConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.success,
    alignItems: 'center' as const,
  },
  paymentModalConfirmDisabled: {
    opacity: 0.6,
  },
  paymentModalConfirmText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },

  // Payment history
  historyListLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  historyEmpty: {
    fontSize: 13,
    color: Colors.textMuted,
    paddingVertical: 14,
  },
  historyItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  historyItemLeft: {
    flex: 1,
  },
  historyItemAmount: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 2,
    fontVariant: ['tabular-nums'] as any,
  },
  historyItemMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  historyItemNote: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  historyItemDelete: {
    padding: 6,
  },

  bottomSpacer: {
    height: 40,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  errorText: {
    fontSize: 15,
    color: Colors.textMuted,
  },
});
