import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Download, Share2 } from 'lucide-react-native';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import { Colors } from '@/constants/colors';
import { formatPriceWithCommas, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';

export default function ReceiptPreviewScreen() {
  const { brandingEnabled } = useVendorPlan();

  const handleDownload = () => {
    console.log('Download PDF');
  };

  const handleShare = () => {
    console.log('Share receipt');
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Receipt Preview',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.charcoal,
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.receiptCard}>
            {brandingEnabled && (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoText}>LOGO</Text>
              </View>
            )}

            <View style={styles.businessInfo}>
              <Text style={styles.businessName}>
                {brandingEnabled ? 'Sanste Catering' : 'the platform Receipt'}
              </Text>
              {brandingEnabled && (
                <Text style={styles.businessAddress}>
                  123 Business Street{'\n'}
                  Lekki, Lagos
                </Text>
              )}
            </View>

            <View style={styles.divider} />

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
                <Text style={styles.itemQty}>2x {formatPriceWithCommas(5000, (mockVendor.currency as Currency) || getCurrencyFromCountryCode(mockVendor.countryCode))}</Text>
              </View>
              <Text style={styles.itemPrice}>{formatPriceWithCommas(10000, (mockVendor.currency as Currency) || getCurrencyFromCountryCode(mockVendor.countryCode))}</Text>
            </View>

            <View style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>Grilled Chicken</Text>
                <Text style={styles.itemQty}>1x {formatPriceWithCommas(3500, (mockVendor.currency as Currency) || getCurrencyFromCountryCode(mockVendor.countryCode))}</Text>
              </View>
              <Text style={styles.itemPrice}>{formatPriceWithCommas(3500, (mockVendor.currency as Currency) || getCurrencyFromCountryCode(mockVendor.countryCode))}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <Text style={styles.label}>Subtotal:</Text>
              <Text style={styles.value}>{formatPriceWithCommas(13500, (mockVendor.currency as Currency) || getCurrencyFromCountryCode(mockVendor.countryCode))}</Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.label}>Discount (SANSTE10):</Text>
              <Text style={styles.discountValue}>-{formatPriceWithCommas(1350, (mockVendor.currency as Currency) || getCurrencyFromCountryCode(mockVendor.countryCode))}</Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.grandTotalLabel}>Total:</Text>
              <Text style={styles.grandTotalValue}>{formatPriceWithCommas(12150, (mockVendor.currency as Currency) || getCurrencyFromCountryCode(mockVendor.countryCode))}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.statusRow}>
              <Text style={styles.label}>Payment Status:</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>Paid</Text>
              </View>
            </View>

            {brandingEnabled && (
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
  businessAddress: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
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
