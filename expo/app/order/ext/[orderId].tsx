import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Package, Clock, Store, ShieldCheck, Download } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useExternalOrders } from '@/contexts/ExternalOrdersContext';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';

export default function PublicExternalOrderScreen() {
  const params = useLocalSearchParams();
  const orderId = params.orderId as string;
  const token = params.token as string;
  const { getExternalOrderByShareToken } = useExternalOrders();

  const order = useMemo(() => {
    if (!orderId || !token) return undefined;
    return getExternalOrderByShareToken(orderId, token);
  }, [orderId, token, getExternalOrderByShareToken]);

  const vendorCurrency: Currency = 'NGN';

  const handleOpenInApp = () => {
    if (!order) return;
    const deepLink = `the platform://store/${order.vendorSlug}`;
    console.log('Opening deep link:', deepLink);
    if (Platform.OS === 'web') {
      window.location.href = deepLink;
    } else {
      Linking.openURL(deepLink).catch((err) => {
        console.error('Failed to open deep link:', err);
      });
    }
  };

  const handleDownloadApp = () => {
    console.log('Download app tapped');
    Linking.openURL('https://the platform.com/download').catch((err) => {
      console.error('Failed to open download link:', err);
    });
  };

  if (!order) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
          <View style={styles.centeredContent}>
            <View style={styles.invalidCard}>
              <ShieldCheck size={48} color={Colors.textMuted} />
              <Text style={styles.invalidTitle}>Order Not Found</Text>
              <Text style={styles.invalidText}>
                This order link is invalid or has expired. Please contact the vendor for updated order details.
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const formatDate = (dateStr: string, timeStr?: string): string => {
    const date = new Date(dateStr);
    const formatted = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return timeStr ? `${formatted} at ${timeStr}` : formatted;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <Store size={20} color={Colors.primary} />
          <Text style={styles.headerTitle}>the platform</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.vendorSection}>
          <View style={styles.vendorIconWrap}>
            <Store size={24} color={Colors.primary} />
          </View>
          <Text style={styles.vendorName}>{order.vendorName}</Text>
          <Text style={styles.orderRef}>Order {order.externalOrderId}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Package size={16} color={Colors.textSecondary} />
              <Text style={styles.cardHeaderText}>Order Details</Text>
            </View>

            <View style={styles.fulfillmentRow}>
              <Clock size={14} color={Colors.textSecondary} />
              <Text style={styles.fulfillmentText}>
                {order.fulfillmentType} \u2022 {formatDate(order.fulfillmentDate, order.fulfillmentTime)}
              </Text>
            </View>

            <View style={styles.itemsDivider} />

            {order.items.map((item, index) => {
              const lineTotal = item.price * item.quantity;
              const isLast = index === order.items.length - 1;
              return (
                <View key={item.id} style={[styles.itemRow, isLast && styles.itemRowLast]}>
                  <View style={styles.itemQuantityBadge}>
                    <Text style={styles.itemQuantityText}>{item.quantity}x</Text>
                  </View>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemPrice}>{formatPriceWithCommas(lineTotal, vendorCurrency)}</Text>
                </View>
              );
            })}

            <View style={styles.totalDivider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPriceWithCommas(order.total, vendorCurrency)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.ctaSection}>
          <Text style={styles.ctaMessage}>
            Order again from {order.vendorName} for a faster experience.
          </Text>

          <TouchableOpacity style={styles.primaryButton} onPress={handleOpenInApp} activeOpacity={0.8}>
            <Store size={18} color={Colors.white} />
            <Text style={styles.primaryButtonText}>Open in the platform App</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleDownloadApp} activeOpacity={0.8}>
            <Download size={18} color={Colors.text} />
            <Text style={styles.secondaryButtonText}>Download the platform App</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footerSection}>
          <Text style={styles.footerText}>Powered by the platform</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  centeredContent: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 32,
  },
  invalidCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center' as const,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    width: '100%',
    maxWidth: 400,
  },
  invalidTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 4,
  },
  invalidText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
  },

  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },

  content: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  vendorSection: {
    alignItems: 'center' as const,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  vendorIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 12,
  },
  vendorName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
  },
  orderRef: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
  },

  section: { paddingHorizontal: 20, marginBottom: 20 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  cardHeaderText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  fulfillmentRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  fulfillmentText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  itemsDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  itemRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemRowLast: { borderBottomWidth: 0 },
  itemQuantityBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 10,
  },
  itemQuantityText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  itemName: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
    flex: 1,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginLeft: 12,
  },
  totalDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  totalRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 16,
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

  ctaSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  ctaMessage: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 4,
  },
  primaryButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  secondaryButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: Colors.white,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },

  footerSection: {
    alignItems: 'center' as const,
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});
