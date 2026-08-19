import React, { useState } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal } from 'react-native';
import { Alert } from '@/utils/alert';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { ChevronLeft, MoreVertical, Check, Share2, Download } from 'lucide-react-native';
import { useOrders } from '@/contexts/OrdersContext';
import { formatCustomerNameFromFull } from '@/utils/formatCustomerName';
import { formatVendorOrderId } from '@/utils/formatOrderId';
import { formatPriceWithCommas, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';

export default function ReceiptScreen() {
  const { orderId } = useLocalSearchParams();
  const { orders } = useOrders();
  const order = orders.find(o => o.id === orderId);
  const [showMenu, setShowMenu] = useState(false);

  if (!order) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ChevronLeft size={24} color={Colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Receipt</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Order not found</Text>
        </View>
      </View>
    );
  }

  const handleShare = () => {
    setShowMenu(false);
    console.log('Share receipt');
  };

  const handleDownload = () => {
    setShowMenu(false);
    console.log('Download receipt');
  };

  const handleSend = () => {
    Alert.alert(
      'Send Receipt',
      `Send this receipt to ${order.customerName ? formatCustomerNameFromFull(order.customerName) : 'customer'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: () => {
            console.log('Sending receipt to customer');
            Alert.alert('Receipt Sent', 'The receipt has been sent to the customer.');
            router.back();
          },
        },
      ]
    );
  };

  const receiptNumber = formatVendorOrderId(order.publicOrderId);
  const paymentDate = new Date(order.orderDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const paymentTime = new Date(order.orderDate).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Receipt</Text>
          <TouchableOpacity onPress={() => setShowMenu(true)} style={styles.menuButton}>
            <MoreVertical size={22} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusRow}>
          <View style={styles.paidBadge}>
            <Check size={16} color={Colors.text} strokeWidth={3} />
            <Text style={styles.paidBadgeText}>PAID</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RECEIPT DETAILS</Text>
        </View>

        <View style={styles.settingsCard}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Vendor</Text>
            <Text style={styles.value}>{order.vendorName}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>Receipt Number</Text>
            <Text style={styles.value}>{receiptNumber}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>Payment Date</Text>
            <Text style={styles.value}>{paymentDate}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>Payment Time</Text>
            <Text style={styles.value}>{paymentTime}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>Customer</Text>
            <Text style={styles.value}>{order.customerName ? formatCustomerNameFromFull(order.customerName) : 'Customer'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ITEMS</Text>
        </View>

        <View style={styles.settingsCard}>
          {order.items.map((item, index) => (
            <React.Fragment key={index}>
              {index > 0 && <View style={styles.divider} />}
              <View style={styles.itemRow}>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName}>
                    {item.quantity}× {item.name}
                  </Text>
                  {item.addOns && item.addOns.length > 0 && (
                    <Text style={styles.itemAddOns}>
                      {item.addOns.map(a => a.name).join(', ')}
                    </Text>
                  )}
                </View>
                <Text style={styles.itemAmount}>
                  {formatPriceWithCommas(item.price * item.quantity, (mockVendor.currency as Currency) || 'NGN')}
                </Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TOTAL</Text>
        </View>

        <View style={styles.settingsCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatPriceWithCommas(order.subtotal, (mockVendor.currency as Currency) || 'NGN')}</Text>
          </View>
          {order.tax > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax</Text>
                <Text style={styles.totalValue}>{formatPriceWithCommas(order.tax, (mockVendor.currency as Currency) || 'NGN')}</Text>
              </View>
            </>
          )}
          {order.discount > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Discount</Text>
                <Text style={styles.totalValue}>-{formatPriceWithCommas(order.discount, (mockVendor.currency as Currency) || 'NGN')}</Text>
              </View>
            </>
          )}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.grandTotalLabel}>Total Paid</Text>
            <Text style={styles.grandTotalValue}>{formatPriceWithCommas(order.total, (mockVendor.currency as Currency) || 'NGN')}</Text>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

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
              <Share2 size={20} color={Colors.text} strokeWidth={2} />
              <Text style={styles.menuItemText}>Share</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleDownload}>
              <Download size={20} color={Colors.text} strokeWidth={2} />
              <Text style={styles.menuItemText}>Download</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity onPress={handleSend} style={styles.sendButtonFull}>
            <Text style={styles.sendButtonText}>Send</Text>
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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
  },
  headerSpacer: {
    width: 40,
  },
  menuButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  settingsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  statusRow: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  infoRow: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  paidBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.success,
    gap: 6,
  },
  paidBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: 1,
  },
  label: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  value: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '400' as const,
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
    paddingVertical: 16,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '400' as const,
    marginBottom: 2,
  },
  itemAddOns: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  itemAmount: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  totalRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  totalLabel: {
    fontSize: 17,
    color: Colors.text,
  },
  totalValue: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  grandTotalLabel: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  grandTotalValue: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-start' as const,
    alignItems: 'flex-end' as const,
    paddingTop: Platform.select({ ios: 100, android: 90, default: 70 }),
    paddingRight: 16,
  },
  menuContainer: {
    backgroundColor: Colors.border,
    borderRadius: 12,
    minWidth: 160,
  },
  menuItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 12,
  },
  bottomSpacer: {
    height: 100,
  },
  bottomBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  buttonContainer: {
    flexDirection: 'row' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  sendButtonFull: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.success,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
});
