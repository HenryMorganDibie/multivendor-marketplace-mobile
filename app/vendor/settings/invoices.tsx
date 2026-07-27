import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { FileText, Plus, Clock, Send, CheckCircle2, XCircle, ChevronRight, Sparkles } from 'lucide-react-native';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import { useInvoices } from '@/contexts/InvoiceContext';
import type { Invoice } from '@/contexts/InvoiceContext';
import { formatPrice } from '@/utils/formatPrice';
import EditScreenHeader from '@/components/EditScreenHeader';
import { Colors } from '@/constants/colors';

export default function InvoicesAndReceiptsScreen() {
  const { plan } = useVendorPlan();
  const isPro = plan === 'pro';
  const { invoices } = useInvoices();

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'paid': return Colors.success;
      case 'sent': return Colors.primary;
      case 'draft': return Colors.textMuted;
      case 'cancelled': return Colors.error;
      default: return Colors.textMuted;
    }
  };

  const getStatusBg = (status: Invoice['status']) => {
    switch (status) {
      case 'paid': return Colors.successLight;
      case 'sent': return Colors.primarySoft;
      case 'draft': return Colors.surface;
      case 'cancelled': return Colors.errorLight;
      default: return Colors.surface;
    }
  };

  const getStatusIcon = (status: Invoice['status']) => {
    const color = getStatusColor(status);
    switch (status) {
      case 'paid': return <CheckCircle2 size={12} color={color} />;
      case 'sent': return <Send size={12} color={color} />;
      case 'draft': return <Clock size={12} color={color} />;
      case 'cancelled': return <XCircle size={12} color={color} />;
      default: return <Clock size={12} color={color} />;
    }
  };

  const renderInvoice = ({ item }: { item: Invoice }) => (
    <TouchableOpacity
      style={styles.invoiceCard}
      onPress={() => router.push(`/vendor/invoice/${item.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.invoiceLeft}>
        <Text style={styles.invoiceNumber}>{item.invoiceNumber}</Text>
        <Text style={styles.customerName}>{item.customerName}</Text>
      </View>
      <View style={styles.invoiceRight}>
        <Text style={styles.invoiceAmount}>{formatPrice(item.total, item.currency)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusBg(item.status) }]}>
          {getStatusIcon(item.status)}
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>
      <ChevronRight size={16} color={Colors.textMuted} style={styles.chevron} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Invoices & Receipts" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* MY INVOICES */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>MY INVOICES</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/vendor/settings/create-invoice' as any)}
              activeOpacity={0.7}
            >
              <Plus size={14} color={Colors.primary} />
              <Text style={styles.createButtonText}>Create</Text>
            </TouchableOpacity>
          </View>

          {invoices.length > 0 ? (
            <View style={styles.card}>
              <FlatList
                data={invoices}
                renderItem={renderInvoice}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <FileText size={28} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No invoices yet</Text>
              <Text style={styles.emptyDescription}>
                Create manual invoices and send them via chat or externally.
              </Text>
              <TouchableOpacity
                style={styles.emptyAction}
                onPress={() => router.push('/vendor/settings/create-invoice' as any)}
                activeOpacity={0.7}
              >
                <Plus size={14} color={Colors.primary} />
                <Text style={styles.emptyActionText}>Create Invoice</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* SYSTEM RECEIPTS */}
          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>SYSTEM RECEIPTS</Text>
          <View style={styles.card}>
            <Text style={styles.cardDescription}>
              Automatically generated for every completed order.
            </Text>
            <View style={styles.featureGrid}>
              {['Order ID', 'Items & totals', 'Discounts', 'Payment status'].map((feat) => (
                <View key={feat} style={styles.featurePill}>
                  <View style={styles.featureDot} />
                  <Text style={styles.featureText}>{feat}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.outlineButton}
              onPress={() => router.push('/vendor/settings/receipt-preview' as any)}
              activeOpacity={0.8}
            >
              <FileText size={15} color={Colors.primary} />
              <Text style={styles.outlineButtonText}>View Sample Receipt</Text>
            </TouchableOpacity>
          </View>

          {/* PRO: BRANDED DOCUMENTS */}
          {isPro && (
            <>
              <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>BRANDED DOCUMENTS</Text>
              <View style={styles.card}>
                <View style={styles.proRow}>
                  <View style={styles.proBadge}>
                    <Text style={styles.proLabel}>PRO</Text>
                  </View>
                  <Text style={styles.cardDescription} numberOfLines={1}>
                    Custom receipts with your branding
                  </Text>
                </View>
                <View style={styles.featureGrid}>
                  {['Logo upload', 'Business details', 'Footer note', 'Template selector'].map((feat) => (
                    <View key={feat} style={styles.featurePill}>
                      <View style={styles.featureDot} />
                      <Text style={styles.featureText}>{feat}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => router.push('/vendor/settings/receipt-branding' as any)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>Manage Branding</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* FREE: UPGRADE CARD */}
          {!isPro && (
            <>
              <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>BRANDED RECEIPTS</Text>
              <View style={styles.upgradeCard}>
                <View style={styles.upgradeIconWrap}>
                  <Sparkles size={20} color={Colors.primary} />
                </View>
                <View style={styles.upgradeBody}>
                  <Text style={styles.upgradeTitle}>Upgrade to Pro</Text>
                  <Text style={styles.upgradeDescription}>
                    Add your logo, business name, and custom templates to every receipt.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={() => console.log('Navigate to subscription')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.upgradeButtonText}>Upgrade</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
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
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  sectionTitleSpaced: {
    marginTop: 24,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  createButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: Colors.primarySoft,
    borderRadius: 8,
  },
  createButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
  },
  // Invoice rows
  invoiceCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
  },
  invoiceLeft: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  customerName: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  invoiceRight: {
    alignItems: 'flex-end' as const,
    marginRight: 8,
  },
  invoiceAmount: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  chevron: {
    opacity: 0.4,
  },
  // Empty state
  emptyCard: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center' as const,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 5,
  },
  emptyDescription: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 19,
    marginBottom: 16,
  },
  emptyAction: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.primarySoft,
    borderRadius: 9,
  },
  emptyActionText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  // System Receipts
  cardDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  featureGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 16,
  },
  featurePill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: Colors.surface,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  featureDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.primary,
  },
  featureText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  outlineButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  outlineButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  // Pro section
  proRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: 12,
  },
  proBadge: {
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  proLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center' as const,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  // Upgrade card
  upgradeCard: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.primarySoft,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  upgradeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  upgradeBody: {
    flex: 1,
  },
  upgradeTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  upgradeDescription: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
  },
  upgradeButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 9,
    flexShrink: 0,
  },
  upgradeButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  bottomSpacer: {
    height: 40,
  },
});
