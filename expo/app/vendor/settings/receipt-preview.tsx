import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Download, Share2 } from 'lucide-react-native';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import { useOrders } from '@/contexts/OrdersContext';
import { getDocumentBranding } from '@/constants/documentBranding';
import { Colors } from '@/constants/colors';
import { formatPriceWithCommas, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';
import EditScreenHeader from '@/components/EditScreenHeader';

/**
 * Read-only receipt view. Receipts are automatic system documents attached to
 * completed orders — when opened with an orderId (from the vendor order detail
 * screen) it renders that order's data; otherwise it shows the sample layout.
 * Branding is applied automatically from the vendor's plan.
 */
export default function ReceiptPreviewScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const { plan } = useVendorPlan();
  const { getOrder } = useOrders();
  // Branding is applied automatically from the vendor's plan — never toggled manually.
  const branding = getDocumentBranding(plan);
  const order = orderId ? getOrder(orderId) : undefined;
  const currency: Currency = (mockVendor.currency as Currency) || getCurrencyFromCountryCode(mockVendor.countryCode);

  const handleDownload = () => {
    console.log('Download PDF');
  };

  const handleShare = () => {
    console.log('Share receipt');
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Receipt" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.receiptCard}>
            {branding.allowLogo && (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoText}>LOGO</Text>
              </View>
            )}

            <View style={styles.businessInfo}>
              <Text style={styles.businessName}>
                {branding.allowBrandedHeader ? 'Sanste Catering' : 'the platform Receipt'}
              </Text>
              {/* Business address deliberately not rendered here — kept out of the
                  invoice branding contract. Many vendors operate from home, and a
                  private/verification address must never appear on a public-facing
                  receipt by default. See constants/documentBranding.ts. */}
            </View>

            <View style={styles.divider} />

            {order ? (
              <>
                <View style={styles.orderHeader}>
                  <Text style={styles.label}>Order ID:</Text>
                  <Text style={styles.value}>#{order.publicOrderId.toUpperCase()}</Text>
                </View>

                <View style={styles.orderHeader}>
                  <Text style={styles.label}>Date:</Text>
                  <Text style={styles.value}>
                    {new Date(order.orderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>

                <View style={styles.divider} />

                <Text style={styles.sectionTitle}>ITEMS</Text>

                {order.items.map((item, index) => (
                  <View key={index} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemQty}>{item.quantity}x</Text>
                    </View>
                    <Text style={styles.itemPrice}>{formatPriceWithCommas(item.price, currency)}</Text>
                  </View>
                ))}

                <View style={styles.divider} />

                <View style={styles.totalRow}>
                  <Text style={styles.label}>Subtotal:</Text>
                  <Text style={styles.value}>{formatPriceWithCommas(order.subtotal, currency)}</Text>
                </View>

                {order.tax > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.label}>Tax:</Text>
                    <Text style={styles.value}>{formatPriceWithCommas(order.tax, currency)}</Text>
                  </View>
                )}

                {order.discount > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.label}>Discount:</Text>
                    <Text style={styles.discountValue}>-{formatPriceWithCommas(order.discount, currency)}</Text>
                  </View>
                )}

                <View style={styles.totalRow}>
                  <Text style={styles.grandTotalLabel}>Total:</Text>
                  <Text style={styles.grandTotalValue}>{formatPriceWithCommas(order.total, currency)}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.statusRow}>
                  <Text style={styles.label}>Payment Status:</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>
                      {order.paymentStatus === 'payment_received' ? 'Paid'
                        : order.paymentStatus === 'partially_received' ? 'Partially paid'
                        : 'Unpaid'}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <View style={styles.orderHeader}>
                  <Text style={styles.label}>Order ID:</Text>
                  <Text style={styles.value}>#ORD-1234</Text>
                </View>

                <View style={styles.orderHeader}>
                  <Text style={styles.label}>Date:</Text>
                  <Text style={styles.value}>Dec 29, 2025</Text>
                </View>

                <View style={styles.divider} />

                <Text style={styles.sectionTitle}>ITEMS</Text>

                <View style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>Jollof Rice</Text>
                    <Text style={styles.itemQty}>2x {formatPriceWithCommas(5000, currency)}</Text>
                  </View>
                  <Text style={styles.itemPrice}>{formatPriceWithCommas(10000, currency)}</Text>
                </View>

                <View style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>Grilled Chicken</Text>
                    <Text style={styles.itemQty}>1x {formatPriceWithCommas(3500, currency)}</Text>
                  </View>
                  <Text style={styles.itemPrice}>{formatPriceWithCommas(3500, currency)}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.totalRow}>
                  <Text style={styles.label}>Subtotal:</Text>
                  <Text style={styles.value}>{formatPriceWithCommas(13500, currency)}</Text>
                </View>

                <View style={styles.totalRow}>
                  <Text style={styles.label}>Discount (SANSTE10):</Text>
                  <Text style={styles.discountValue}>-{formatPriceWithCommas(1350, currency)}</Text>
                </View>

                <View style={styles.totalRow}>
                  <Text style={styles.grandTotalLabel}>Total:</Text>
                  <Text style={styles.grandTotalValue}>{formatPriceWithCommas(12150, currency)}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.statusRow}>
                  <Text style={styles.label}>Payment Status:</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>Paid</Text>
                  </View>
                </View>
              </>
            )}

            {branding.allowThankYouMessage && (
              <>
                <View style={styles.divider} />
                <Text style={styles.footerNote}>
                  Thank you for your order!{'\n'}
                  Questions? Contact us at support@sanste.com
                </Text>
              </>
            )}
          </View>

          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleDownload}
              activeOpacity={0.8}
            >
              <Download size={20} color={Colors.primary} />
              <Text style={styles.actionButtonText}>Download PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Share2 size={20} color={Colors.primary} />
              <Text style={styles.actionButtonText}>Share</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerSafe: {
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  receiptCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 24,
    marginTop: 20,
    ...Platform.select({
      ios: {
        shadowColor: Colors.text,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: Colors.cardBorder,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    alignSelf: 'center' as const,
    marginBottom: 16,
  },
  logoText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  businessInfo: {
    alignItems: 'center' as const,
    marginBottom: 20,
  },
  businessName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },
  orderHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 8,
  },
  label: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  value: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  itemQty: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  totalRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 8,
  },
  discountValue: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.success,
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  statusRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  statusBadge: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  footerNote: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row' as const,
    gap: 12,
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: 'transparent',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  bottomSpacer: {
    height: 40,
  },
});
