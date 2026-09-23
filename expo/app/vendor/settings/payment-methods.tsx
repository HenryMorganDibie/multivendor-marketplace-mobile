import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { AlertTriangle, ShieldCheck } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import EditScreenHeader from '@/components/EditScreenHeader';
import { useVendor } from '@/contexts/VendorContext';

type PaymentMethodStatus = 'active' | 'pending_review' | 'disabled' | 'needs_action';

type PaymentMethod = {
  id: string;
  type: string;
  label: string;
  provider: string;
  maskedIdentifier: string;
  status: PaymentMethodStatus;
  updatedAt?: string;
};

function formatDateTime(value?: string): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getStatusLabel(status: PaymentMethodStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'pending_review':
      return 'Pending review';
    case 'needs_action':
      return 'Needs action';
    case 'disabled':
      return 'Disabled';
    default:
      return 'Not configured';
  }
}

function getStatusColors(status: PaymentMethodStatus): { bg: string; border: string; text: string } {
  switch (status) {
    case 'active':
      return { bg: Colors.successLight, border: Colors.successBorder, text: Colors.success };
    case 'pending_review':
      return { bg: Colors.warningLight, border: Colors.warningBorder, text: Colors.warning };
    case 'needs_action':
      return { bg: Colors.errorLight, border: Colors.errorBorder, text: Colors.error };
    case 'disabled':
      return { bg: Colors.surface, border: Colors.borderDark, text: Colors.textSecondary };
    default:
      return { bg: Colors.surface, border: Colors.border, text: Colors.textSecondary };
  }
}

function normalizeMethod(source: unknown, fallbackId: string): PaymentMethod | null {
  if (!source || typeof source !== 'object') return null;
  const method = source as {
    id?: string;
    type?: string;
    label?: string;
    name?: string;
    provider?: string;
    maskedIdentifier?: string;
    status?: PaymentMethodStatus;
    updatedAt?: string;
    details?: { bankName?: string; accountNumber?: string; accountName?: string; instruction?: string };
  };

  const accountNumber = method.details?.accountNumber;
  return {
    id: method.id ?? fallbackId,
    type: method.type ?? 'bank_transfer',
    label: method.label ?? method.name ?? 'Payment method',
    provider: method.provider ?? method.details?.bankName ?? method.name ?? 'Vendor-managed',
    maskedIdentifier: method.maskedIdentifier ?? (accountNumber ? `•••• ${accountNumber.slice(-4)}` : method.details?.instruction ?? 'Protected details'),
    status: method.status ?? 'active',
    updatedAt: method.updatedAt,
  };
}

function PaymentMethodCard({ title, method }: { title: string; method: PaymentMethod | null }) {
  const status = method?.status ?? 'disabled';
  const statusColors = getStatusColors(status);

  return (
    <View style={styles.methodCard}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardEyebrow}>{title}</Text>
          <Text style={styles.cardTitle}>{method?.label ?? 'Not configured'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg, borderColor: statusColors.border }]}>
          <Text style={[styles.statusBadgeText, { color: statusColors.text }]}>{method ? getStatusLabel(status) : 'Not configured'}</Text>
        </View>
      </View>

      {method ? (
        <>
          <View style={styles.detailGrid}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Provider</Text>
              <Text style={styles.detailValue} numberOfLines={1}>{method.provider}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Details</Text>
              <Text style={styles.detailValue}>{method.maskedIdentifier}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Last updated</Text>
              <Text style={styles.detailValue}>{formatDateTime(method.updatedAt)}</Text>
            </View>
          </View>
          <Text style={styles.protectedNote}>Protected payment details. Changes require admin approval before customers see them.</Text>
        </>
      ) : (
        <Text style={styles.emptyMethodText}>Add a secondary method later if your business needs an alternate payment route.</Text>
      )}
    </View>
  );
}

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { vendor } = useVendor();

  const backendReadyState = useMemo(() => {
    const paymentMethods = (vendor.paymentMethods ?? [
      normalizeMethod(vendor.primaryPaymentMethod, 'primary'),
      normalizeMethod(vendor.secondaryPaymentMethod, 'secondary'),
    ].filter(Boolean)) as PaymentMethod[];

    return {
      paymentMethods,
      primaryPaymentMethodId: vendor.primaryPaymentMethodId ?? paymentMethods[0]?.id,
      secondaryPaymentMethodId: vendor.secondaryPaymentMethodId ?? paymentMethods[1]?.id,
      paymentMethodChangeRequests: vendor.paymentMethodChangeRequests ?? [],
      paymentMethodChangeHistory: vendor.paymentMethodChangeHistory ?? [],
    };
  }, [vendor.paymentMethodChangeHistory, vendor.paymentMethodChangeRequests, vendor.paymentMethods, vendor.primaryPaymentMethod, vendor.primaryPaymentMethodId, vendor.secondaryPaymentMethod, vendor.secondaryPaymentMethodId]);

  const primaryMethod = backendReadyState.paymentMethods.find((method) => method.id === backendReadyState.primaryPaymentMethodId) ?? backendReadyState.paymentMethods[0] ?? null;
  const secondaryMethod = backendReadyState.paymentMethods.find((method) => method.id === backendReadyState.secondaryPaymentMethodId) ?? backendReadyState.paymentMethods[1] ?? null;
  const hasPendingRequest = backendReadyState.paymentMethodChangeRequests.some((request: any) => request?.status === 'pending_review');

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Payment Methods" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <ShieldCheck size={19} color={Colors.success} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Payment methods are protected</Text>
              <Text style={styles.heroText}>Customers can view approved payment options, but any change requires verification and admin approval.</Text>
            </View>
          </View>

          <PaymentMethodCard title="Primary payment method" method={primaryMethod} />
          <PaymentMethodCard title="Secondary payment method" method={secondaryMethod} />

          <View style={styles.securityNotice}>
            <View style={styles.noticeHeader}>
              <AlertTriangle size={15} color={Colors.warning} />
              <Text style={styles.noticeTitle}>Security notice</Text>
            </View>
            <Text style={styles.noticeText}>Frequent or misleading payment method changes may trigger account review. Platform does not process payments or hold escrow.</Text>
          </View>

          {hasPendingRequest && (
            <View style={styles.pendingCard}>
              <Text style={styles.pendingTitle}>Pending review</Text>
              <Text style={styles.pendingText}>A payment method change request is already being reviewed. You’ll be notified when it is approved or rejected.</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, hasPendingRequest && styles.disabledButton]}
            onPress={() => router.push('/vendor/settings/request-payment-change' as any)}
            activeOpacity={0.72}
            disabled={hasPendingRequest}
          >
            <Text style={[styles.primaryButtonText, hasPendingRequest && styles.disabledButtonText]}>Request Payment Method Change</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/vendor/settings/payment-change-history' as any)}
            activeOpacity={0.72}
          >
            <Text style={styles.secondaryButtonText}>View Change History</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerSafe: { backgroundColor: Colors.background },
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 44, gap: 12 },
  heroCard: {
    flexDirection: 'row' as const,
    gap: 12,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 20,
    padding: 15,
  },
  heroIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.successLight,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.text, marginBottom: 4 },
  heroText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  methodCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    gap: 12,
    marginBottom: 13,
  },
  cardTitleBlock: { flex: 1, minWidth: 0 },
  cardEyebrow: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.55,
    marginBottom: 5,
  },
  cardTitle: { fontSize: 17, fontWeight: '700' as const, color: Colors.text, lineHeight: 22 },
  statusBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, flexShrink: 0 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' as const },
  detailGrid: { borderTopWidth: 1, borderTopColor: Colors.borderSoft, paddingTop: 4 },
  detailRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 12,
    paddingVertical: 9,
  },
  detailLabel: { fontSize: 13, color: Colors.textSecondary, flexShrink: 0 },
  detailValue: { fontSize: 14, color: Colors.text, fontWeight: '600' as const, flex: 1, textAlign: 'right' as const },
  protectedNote: { fontSize: 12, color: Colors.textTertiary, lineHeight: 17, marginTop: 8 },
  emptyMethodText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  securityNotice: {
    backgroundColor: Colors.warningLight,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    padding: 14,
  },
  noticeHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 7 },
  noticeTitle: { fontSize: 14, fontWeight: '700' as const, color: Colors.text },
  noticeText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  pendingCard: { backgroundColor: Colors.primaryTint, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(255,122,40,0.22)' },
  pendingTitle: { fontSize: 14, fontWeight: '700' as const, color: Colors.text, marginBottom: 4 },
  pendingText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  primaryButton: { minHeight: 50, borderRadius: 16, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: Colors.charcoal, marginTop: 4 },
  primaryButtonText: { fontSize: 15, fontWeight: '700' as const, color: Colors.white },
  secondaryButton: { minHeight: 50, borderRadius: 16, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: Colors.cardBackground, borderWidth: 1, borderColor: Colors.border },
  secondaryButtonText: { fontSize: 15, fontWeight: '700' as const, color: Colors.text },
  disabledButton: { backgroundColor: Colors.disabled },
  disabledButtonText: { color: Colors.disabledText },
});
