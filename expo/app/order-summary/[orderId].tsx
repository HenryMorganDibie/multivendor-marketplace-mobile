import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import {
  Package,
  Truck,
  Calendar,
  Store,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useExternalOrders } from '@/contexts/ExternalOrdersContext';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';

function getPaymentStatusDisplay(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case 'payment_received':
      return { label: 'Paid', color: Colors.success, bg: Colors.successLight };
    case 'partially_received':
      return { label: 'Partially Paid', color: Colors.primary, bg: Colors.primarySoft };
    case 'payment_pending':
    default:
      return { label: 'Pending', color: Colors.error, bg: Colors.errorLight };
  }
}

function getFulfillmentIcon(type: string) {
  switch (type) {
    case 'Delivery':
      return Truck;
    default:
      return Package;
  }
}

function formatFulfillmentDateTime(date?: string, time?: string): string {
  if (!date) return '';
  const parts = date.split('-');
  if (parts.length !== 3) return date;
  const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formatted = `${days[dateObj.getDay()]}, ${months[dateObj.getMonth()]} ${dateObj.getDate()}`;
  if (time) {
    return `${formatted} \u2022 ${time}`;
  }
  return formatted;
}

export default function PublicOrderSummaryScreen() {
  const params = useLocalSearchParams();
  const orderId = params.orderId as string;
  const token = params.token as string;

  const { getExternalOrderByShareToken } = useExternalOrders();

  const order = useMemo(() => {
    if (!orderId || !token) return undefined;
    return getExternalOrderByShareToken(orderId, token);
  }, [orderId, token, getExternalOrderByShareToken]);

  const currency: Currency = 'NGN';
  const paymentDisplay = order ? getPaymentStatusDisplay(order.paymentStatus) : null;
  const FulfillmentIcon = order ? getFulfillmentIcon(order.fulfillmentType) : Package;
  const fulfillmentDateStr = order ? formatFulfillmentDateTime(order.fulfillmentDate, order.fulfillmentTime) : '';

  const handleVisitStorefront = () => {
    if (!order) return;
    const storeUrl = `https://theplatform.com/@${order.vendorSlug}`;
    console.log('[OrderSummary] Opening storefront:', storeUrl);
    Linking.openURL(storeUrl).catch((err) => {
      console.error('[OrderSummary] Failed to open storefront:', err);
    });
  };

  if (!order) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <ShieldCheck size={48} color={Colors.textMuted} />
            <Text style={styles.errorTitle}>Order not found</Text>
            <Text style={styles.errorMessage}>
              This order link may be invalid or has expired. Please contact the vendor for a new link.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.headerSection}>
            <View style={styles.vendorBadge}>
              <Store size={16} color={Colors.primary} />
              <Text style={styles.vendorBadgeText}>{order.vendorName}</Text>
            </View>
            <Text style={styles.orderIdLabel}>{order.externalOrderId}</Text>
            <Text style={styles.orderDateText}>
              {new Date(order.orderDate).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Items</Text>
            <View style={styles.itemsCard}>
              {order.items.map((item, index) => {
                const lineTotal = item.price * item.quantity;
                return (
                  <View
                    key={item.id || index}
                    style={[
                      styles.itemRow,
                      index < order.items.length - 1 && styles.itemRowBorder,
                    ]}
                  >
                    <View style={styles.itemLeft}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemMeta}>
                        {formatPriceWithCommas(item.price, currency)} \u00D7 {item.quantity}
                      </Text>
                    </View>
                    <Text style={styles.itemTotal}>
                      {formatPriceWithCommas(lineTotal, currency)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Summary</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>
                  {formatPriceWithCommas(order.subtotal, currency)}
                </Text>
              </View>

              {(order.deliveryFee ?? 0) > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery Fee</Text>
                  <Text style={styles.summaryValue}>
                    +{formatPriceWithCommas(order.deliveryFee!, currency)}
                  </Text>
                </View>
              )}

              {(order.serviceFee ?? 0) > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Service Fee</Text>
                  <Text style={styles.summaryValue}>
                    +{formatPriceWithCommas(order.serviceFee!, currency)}
                  </Text>
                </View>
              )}

              {(order.discountAmount ?? 0) > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, styles.discountLabel]}>Discount</Text>
                  <Text style={[styles.summaryValue, styles.discountValue]}>
                    -{formatPriceWithCommas(order.discountAmount!, currency)}
                  </Text>
                </View>
              )}

              {order.tax > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    Tax{order.taxPercentage ? ` (${order.taxPercentage}%)` : ''}
                  </Text>
                  <Text style={styles.summaryValue}>
                    +{formatPriceWithCommas(order.tax, currency)}
                  </Text>
                </View>
              )}

              <View style={styles.totalDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>
                  {formatPriceWithCommas(order.total, currency)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment</Text>
            <View style={styles.statusCard}>
              <View style={[styles.statusBadge, { backgroundColor: paymentDisplay!.bg }]}>
                <Text style={[styles.statusBadgeText, { color: paymentDisplay!.color }]}>
                  {paymentDisplay!.label}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fulfillment</Text>
            <View style={styles.fulfillmentCard}>
              <View style={styles.fulfillmentRow}>
                <FulfillmentIcon size={18} color={Colors.text} />
                <Text style={styles.fulfillmentType}>{order.fulfillmentType}</Text>
              </View>
              {fulfillmentDateStr !== '' && (
                <View style={styles.fulfillmentDateRow}>
                  <Calendar size={14} color={Colors.textSecondary} />
                  <Text style={styles.fulfillmentDate}>{fulfillmentDateStr}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.inviteSection}>
            <Text style={styles.inviteHeader}>Order from {order.vendorName}</Text>
            <Text style={styles.inviteMessage}>
              For future orders, you can order directly from {order.vendorName} on the the platform app.
            </Text>
            <TouchableOpacity
              style={styles.visitButton}
              onPress={handleVisitStorefront}
              activeOpacity={0.7}
            >
              <ExternalLink size={16} color={Colors.white} />
              <Text style={styles.visitButtonText}>
                Visit {order.vendorName} on the platform
              </Text>
            </TouchableOpacity>

            <View style={styles.storeButtons}>
              <TouchableOpacity
                style={styles.storeButton}
                onPress={() => {
                  Linking.openURL('https://apps.apple.com/app/platform/id000000000').catch(() => {});
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.storeButtonLabel}>Download on the</Text>
                <Text style={styles.storeButtonTitle}>App Store</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.storeButton}
                onPress={() => {
                  Linking.openURL('https://play.google.com/store/apps/details?id=com.platform.app').catch(() => {});
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.storeButtonLabel}>Get it on</Text>
                <Text style={styles.storeButtonTitle}>Google Play</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footerSection}>
            <Text style={styles.footerText}>Powered by the platform</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center' as const,
  },
  vendorBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  vendorBadgeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  orderIdLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: 1,
    marginBottom: 6,
  },
  orderDateText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 20,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    marginBottom: 12,
  },
  itemsCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemLeft: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  itemMeta: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  itemTotal: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  discountLabel: {
    color: Colors.success,
  },
  discountValue: {
    color: Colors.success,
  },
  totalDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 10,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  statusCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusBadge: {
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  fulfillmentCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fulfillmentRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: 8,
  },
  fulfillmentType: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  fulfillmentDateRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  fulfillmentDate: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  inviteSection: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 8,
    alignItems: 'center' as const,
  },
  inviteHeader: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  inviteMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 21,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  visitButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    width: '100%' as any,
    marginBottom: 24,
  },
  visitButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  storeButtons: {
    flexDirection: 'row' as const,
    gap: 12,
    width: '100%' as any,
  },
  storeButton: {
    flex: 1,
    backgroundColor: Colors.charcoal,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center' as const,
  },
  storeButtonLabel: {
    fontSize: 10,
    color: '#CCCCCC',
    marginBottom: 2,
  },
  storeButtonTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  footerSection: {
    paddingTop: 32,
    paddingBottom: 16,
    alignItems: 'center' as const,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
