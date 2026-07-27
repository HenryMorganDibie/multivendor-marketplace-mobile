import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { AlertTriangle, Info } from 'lucide-react-native';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import { allowedPaymentProvidersByCountry } from '@/constants/paymentProviders';
import { Colors } from '@/constants/colors';

type PaymentStatus = 'Active' | 'Pending Approval' | 'Rejected' | 'Locked by Admin';
type PaymentMethodType = 'bank' | 'card' | 'wallet';

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { businessCountry } = useVendorPlan();
  const [primaryStatus] = useState<PaymentStatus>('Active');
  const [secondaryStatus] = useState<PaymentStatus | null>(null);
  const [requestsInLast30Days] = useState<number>(0);
  const maxAllowedIn30Days = 2;
  const [nextEligibleDate] = useState<string>('2026-02-08');

  const availableProviders = allowedPaymentProvidersByCountry[businessCountry];
  const mockPrimaryProvider = availableProviders[0];
  const mockPrimaryMethodType: PaymentMethodType = mockPrimaryProvider?.type || 'bank';
  const mockPrimaryProviderLabel = mockPrimaryProvider?.label || 'Interac e-Transfer';

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case 'Active':
        return Colors.success;
      case 'Pending Approval':
        return Colors.primary;
      case 'Rejected':
        return Colors.error;
      case 'Locked by Admin':
        return Colors.textSecondary;
      default:
        return Colors.textSecondary;
    }
  };

  const isLocked = primaryStatus === 'Locked by Admin';
  const isPending = primaryStatus === 'Pending Approval';
  const isCooldownActive = requestsInLast30Days >= maxAllowedIn30Days;
  const isRequestButtonDisabled = isLocked || isPending || isCooldownActive;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getMethodNotice = (type: PaymentMethodType) => {
    switch (type) {
      case 'bank':
        return 'Only share bank accounts you control.';
      case 'card':
        return "You'll be redirected to the vendor's payment provider. the platform does not process card payments.";
      case 'wallet':
        return 'Only share wallet handles you control.';
      default:
        return '';
    }
  };

  const getMethodTypeLabel = (type: PaymentMethodType) => {
    switch (type) {
      case 'bank':
        return 'Bank Transfer';
      case 'card':
        return 'External payment provider (vendor-managed)';
      case 'wallet':
        return 'Wallet / Handle';
      default:
        return 'Payment Method';
    }
  };

  const renderPaymentMethodCard = (
    title: string,
    status: PaymentStatus | null,
    methodType: PaymentMethodType = 'bank',
    providerLabel?: string,
    identifier?: string
  ) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.paymentCard}>
        {status ? (
          <>
            <View style={styles.methodRow}>
              <Text style={styles.methodLabel}>Method Type</Text>
              <Text style={styles.methodValue}>{getMethodTypeLabel(methodType)}</Text>
            </View>
            <View style={styles.methodDivider} />
            <View style={styles.methodRow}>
              <Text style={styles.methodLabel}>Provider</Text>
              <Text style={styles.methodValue}>{providerLabel || mockPrimaryProviderLabel}</Text>
            </View>
            <View style={styles.methodDivider} />
            <View style={styles.methodRow}>
              <Text style={styles.methodLabel}>
                {methodType === 'bank' ? 'Account' : methodType === 'wallet' ? 'Handle' : 'Details'}
              </Text>
              <Text style={styles.methodValue}>
                {methodType === 'bank' ? (identifier || '****4321') : identifier || '@user123'}
              </Text>
            </View>
            <View style={styles.methodDivider} />
            <View style={styles.statusRow}>
              <Text style={styles.methodLabel}>Status</Text>
              <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(status)}20` }]}>
                <Text style={[styles.statusText, { color: getStatusColor(status) }]}>{status}</Text>
              </View>
            </View>
            <View style={styles.methodNotice}>
              <Info size={14} color={Colors.textSecondary} />
              <Text style={styles.methodNoticeText}>{getMethodNotice(methodType)}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.noMethodText}>No secondary payment method added</Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Payment Methods',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.charcoal,
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderPaymentMethodCard(
            'Primary Payment Method',
            primaryStatus,
            mockPrimaryMethodType,
            mockPrimaryProviderLabel,
            mockPrimaryMethodType === 'bank' ? '****4321' : mockPrimaryMethodType === 'wallet' ? '@vendor123' : undefined
          )}
          {renderPaymentMethodCard('Secondary Payment Method (Optional)', secondaryStatus)}

          <View style={styles.securityNotice}>
            <View style={styles.noticeHeader}>
              <AlertTriangle size={16} color={Colors.primary} />
              <Text style={styles.noticeTitle}>Security Notice</Text>
            </View>
            <Text style={styles.noticeText}>
              Payment methods are protected. Changes require identity verification and admin approval.
              {"\n\n"}
              Frequent or misleading payment method changes may result in account review or suspension.
            </Text>
          </View>

          {isLocked && (
            <View style={styles.lockedCard}>
              <Text style={styles.lockedTitle}>Locked by Admin</Text>
              <Text style={styles.lockedText}>
                Payment method changes are temporarily disabled. Contact support for assistance.
              </Text>
            </View>
          )}

          {isPending && (
            <View style={styles.pendingCard}>
              <Text style={styles.pendingTitle}>Request Under Review</Text>
              <Text style={styles.pendingText}>
                Your request to change this payment method is under review. You&apos;ll be notified once approved.
              </Text>
            </View>
          )}

          {isCooldownActive && (
            <View style={styles.cooldownCard}>
              <Text style={styles.cooldownText}>
                You&apos;ve reached the monthly limit. Try again on {formatDate(nextEligibleDate)}.
              </Text>
              <TouchableOpacity
                style={styles.helpButton}
                onPress={() => console.log('Navigate to Help Center')}
                activeOpacity={0.7}
              >
                <Text style={styles.helpButtonText}>Report a payment issue</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, isRequestButtonDisabled && styles.disabledButton]}
            onPress={() => router.push('/vendor/settings/request-payment-change' as any)}
            activeOpacity={0.7}
            disabled={isRequestButtonDisabled}
          >
            <Text style={[styles.primaryButtonText, isRequestButtonDisabled && styles.disabledButtonText]}>
              Request Payment Method Change
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/vendor/settings/payment-change-history' as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>View Change History</Text>
          </TouchableOpacity>

          {isLocked && (
            <TouchableOpacity
              style={styles.supportButton}
              onPress={() => console.log('Contact support')}
              activeOpacity={0.7}
            >
              <Text style={styles.supportButtonText}>Contact Support</Text>
            </TouchableOpacity>
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
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  paymentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  methodRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 8,
  },
  methodLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  methodValue: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  methodDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  statusRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  noMethodText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    paddingVertical: 12,
  },
  methodNotice: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  methodNoticeText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  cooldownCard: {
    backgroundColor: 'rgba(142, 142, 147, 0.15)',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(142, 142, 147, 0.3)',
  },
  cooldownText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  helpButton: {
    backgroundColor: Colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start' as const,
  },
  helpButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  securityNotice: {
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  noticeHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 8,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  noticeText: {
    fontSize: 14,
    color: Colors.primary,
    lineHeight: 20,
  },
  lockedCard: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  lockedTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.error,
    marginBottom: 8,
  },
  lockedText: {
    fontSize: 14,
    color: Colors.error,
    lineHeight: 20,
  },
  pendingCard: {
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  pendingTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginBottom: 8,
  },
  pendingText: {
    fontSize: 14,
    color: Colors.primary,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginTop: 24,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  secondaryButton: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 12,
    borderWidth: 2,
    borderColor: Colors.charcoal,
    minHeight: 52,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.charcoal,
  },
  supportButton: {
    backgroundColor: Colors.error,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginTop: 12,
  },
  supportButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  disabledButton: {
    backgroundColor: Colors.disabled,
  },
  disabledButtonText: {
    color: Colors.disabledText,
  },
  bottomSpacer: {
    height: 40,
  },
});
