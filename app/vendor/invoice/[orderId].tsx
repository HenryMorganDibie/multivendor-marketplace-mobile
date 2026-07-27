import React, { useState } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  Share,
} from 'react-native';
import { Alert } from '@/utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, MoreVertical, Share2, Download, CheckCircle2, MessageCircle, Clock, XCircle, Eye } from 'lucide-react-native';
import { mockOrders } from '@/mocks/ordersData';
import { useInvoices } from '@/contexts/InvoiceContext';
import type { InvoiceStatus } from '@/contexts/InvoiceContext';
import { formatCustomerNameFromFull } from '@/utils/formatCustomerName';
import { formatVendorOrderId } from '@/utils/formatOrderId';
import { formatPrice } from '@/utils/formatPrice';

function getStatusConfig(status: InvoiceStatus): { label: string; color: string; bg: string; icon: React.ReactNode } {
  switch (status) {
    case 'draft':
      return { label: 'Draft', color: Colors.textMuted, bg: Colors.surface, icon: <Clock size={12} color={Colors.textMuted} /> };
    case 'shared_externally':
      return { label: 'Shared', color: Colors.success, bg: Colors.successLight, icon: <Share2 size={12} color={Colors.success} /> };
    case 'sent_in_chat':
      return { label: 'Sent in Chat', color: Colors.primary, bg: Colors.primarySoft, icon: <MessageCircle size={12} color={Colors.primary} /> };
    case 'viewed':
      return { label: 'Viewed', color: '#7C3AED', bg: '#EDE9FE', icon: <Eye size={12} color="#7C3AED" /> };
    case 'paid':
      return { label: 'Paid', color: Colors.success, bg: Colors.successLight, icon: <CheckCircle2 size={12} color={Colors.success} /> };
    case 'cancelled':
      return { label: 'Cancelled', color: Colors.error, bg: Colors.errorLight, icon: <XCircle size={12} color={Colors.error} /> };
    default:
      return { label: 'Draft', color: Colors.textMuted, bg: Colors.surface, icon: <Clock size={12} color={Colors.textMuted} /> };
  }
}

export default function InvoiceScreen() {
  const { orderId } = useLocalSearchParams();
  const [showMenu, setShowMenu] = useState(false);
  const { getInvoiceById, updateInvoice } = useInvoices();

  const invoice = getInvoiceById(orderId as string);
  const order = !invoice ? mockOrders.find(o => o.id === orderId) : null;

  if (!invoice && !order) {
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

  const handleShare = async () => {
    setShowMenu(false);
    if (invoice) {
      const message =
        `Invoice ${invoice.invoiceNumber}\n` +
        `Customer: ${invoice.customerName}\n` +
        `Total: ${formatPrice(invoice.total, invoice.currency)}\n\n` +
        `Items:\n${invoice.items.map(item => `- ${item.name} ×${item.quantity}: ${formatPrice(item.total, invoice.currency)}`).join('\n')}` +
        (invoice.notes ? `\n\nNotes: ${invoice.notes}` : '');
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
      } catch (error) {
        console.error('Error sharing invoice:', error);
      }
    }
  };

  const handleDownload = () => {
    setShowMenu(false);
    console.log('Download invoice — PDF export not yet implemented');
  };

  const handleMarkAsPaid = async () => {
    if (!invoice) return;
    try {
      await updateInvoice(invoice.id, {
        status: 'paid',
        paidAt: new Date().toISOString(),
      });
      Alert.alert('Invoice marked as paid');
    } catch (error) {
      console.error('Error updating invoice:', error);
      Alert.alert('Error', 'Failed to update invoice');
    }
  };

  // Only show Mark as Paid when invoice is unpaid and not cancelled
  const canMarkPaid = invoice && invoice.status !== 'paid' && invoice.status !== 'cancelled';

  const invoiceNumber = invoice
    ? invoice.invoiceNumber
    : (order ? formatVendorOrderId(order.publicOrderId) : '');
  const customerName = invoice
    ? invoice.customerName
    : (order?.customerName ? formatCustomerNameFromFull(order.customerName) : 'Customer');
  const vendorName = order?.vendorName.toUpperCase() || 'VENDOR';
  const issueDate = invoice
    ? new Date(invoice.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : (order ? new Date(order.orderDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');

  const items = invoice ? invoice.items : (order?.items || []);
  const subtotal = invoice ? invoice.subtotal : (order?.subtotal || 0);
  const tax = invoice ? invoice.tax : (order?.tax || 0);
  const discount = invoice ? invoice.discount : (order?.discount || 0);
  const total = invoice ? invoice.total : (order?.total || 0);
  const currency = invoice ? invoice.currency : 'NGN';

  // Status for the pill — manual invoice vs order-based
  const invoiceStatus: InvoiceStatus | null = invoice ? invoice.status : null;
  const orderIsPaid = order?.status === 'completed';
  const statusConfig = invoiceStatus
    ? getStatusConfig(invoiceStatus)
    : orderIsPaid
      ? getStatusConfig('paid')
      : getStatusConfig('draft');

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
            <ArrowLeft size={20} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Invoice</Text>
          <TouchableOpacity onPress={() => setShowMenu(true)} style={styles.menuButton} activeOpacity={0.7}>
            <MoreVertical size={22} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Status pill */}
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
          {statusConfig.icon}
          <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>

        {/* Invoice details */}
        <Text style={styles.sectionTitle}>INVOICE DETAILS</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Vendor</Text>
            <Text style={styles.value}>{vendorName}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.label}>Bill To</Text>
            <Text style={styles.value}>{customerName}</Text>
          </View>
          {invoice?.customerPhone ? (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.label}>Phone</Text>
                <Text style={styles.value}>{invoice.customerPhone}</Text>
              </View>
            </>
          ) : null}
          {invoice?.customerEmail ? (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.value}>{invoice.customerEmail}</Text>
              </View>
            </>
          ) : null}
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.label}>Invoice Number</Text>
            <Text style={styles.value}>{invoiceNumber}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.label}>Issue Date</Text>
            <Text style={styles.value}>{issueDate}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.label}>Due</Text>
            <Text style={styles.value}>As agreed</Text>
          </View>
        </View>

        {/* Items */}
        <Text style={styles.sectionTitle}>ITEMS</Text>
        <View style={styles.card}>
          {items.map((item: any, index: number) => (
            <React.Fragment key={index}>
              {index > 0 && <View style={styles.divider} />}
              <View style={styles.itemRow}>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName}>{item.quantity}× {item.name}</Text>
                  {item.addOns && item.addOns.length > 0 && (
                    <Text style={styles.itemAddOns}>{item.addOns.map((a: any) => a.name).join(', ')}</Text>
                  )}
                </View>
                <Text style={styles.itemAmount}>
                  {formatPrice(invoice ? item.total : (item.price * item.quantity), currency)}
                </Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Totals */}
        <Text style={styles.sectionTitle}>TOTAL</Text>
        <View style={styles.card}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatPrice(subtotal, currency)}</Text>
          </View>
          {tax > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax</Text>
                <Text style={styles.totalValue}>{formatPrice(tax, currency)}</Text>
              </View>
            </>
          )}
          {discount > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Discount</Text>
                <Text style={[styles.totalValue, { color: Colors.success }]}>-{formatPrice(discount, currency)}</Text>
              </View>
            </>
          )}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{formatPrice(total, currency)}</Text>
          </View>
        </View>

        {invoice?.notes ? (
          <>
            <Text style={styles.sectionTitle}>NOTES</Text>
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Text style={styles.notesText}>{invoice.notes}</Text>
              </View>
            </View>
          </>
        ) : null}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Context menu */}
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
            <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
              <Share2 size={18} color={Colors.text} strokeWidth={2} />
              <Text style={styles.menuItemText}>Share</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleDownload}>
              <Download size={18} color={Colors.text} strokeWidth={2} />
              <Text style={styles.menuItemText}>Download PDF</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Mark as Paid — only when invoice is unpaid and not cancelled */}
      {canMarkPaid && (
        <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={handleMarkAsPaid} style={styles.markPaidButton} activeOpacity={0.8}>
              <CheckCircle2 size={18} color={Colors.white} />
              <Text style={styles.markPaidButtonText}>Mark as Paid</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundCanvas,
  },
  headerSafe: {
    backgroundColor: Colors.background,
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
  // Status pill
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 20,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    marginBottom: 10,
    paddingHorizontal: 2,
    marginTop: 20,
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    overflow: 'hidden' as const,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  infoRow: {
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  label: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500' as const,
    marginBottom: 3,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  value: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 16,
  },
  itemRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: 'flex-start' as const,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
    marginBottom: 2,
  },
  itemAddOns: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  itemAmount: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  totalRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  totalLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  totalValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  grandTotalValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  notesText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  // Menu
  menuOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-start' as const,
    alignItems: 'flex-end' as const,
    paddingTop: Platform.select({ ios: 100, android: 90, default: 70 }),
    paddingRight: 16,
  },
  menuContainer: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    minWidth: 170,
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
  markPaidButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.success,
  },
  markPaidButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
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
