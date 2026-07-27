import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ChevronLeft, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

type StatusType = 'pending' | 'approved' | 'rejected' | 'under_review';

export default function CountryChangeStatusScreen() {
  const router = useRouter();
  const [status] = useState<StatusType>('pending');
  const [submittedDate] = useState('Dec 28, 2025 at 2:30 PM');
  const [rejectionReason] = useState('The provided documents did not clearly show business presence in the new country.');

  const renderStatusCard = () => {
    switch (status) {
      case 'pending':
        return (
          <View style={[styles.statusCard, styles.statusCardPending]}>
            <Clock size={32} color={Colors.star} />
            <Text style={styles.statusTitle}>Verification in progress</Text>
            <Text style={styles.statusMessage}>
              We&apos;re reviewing your submission. You can continue using the app, but customers cannot view your store yet.
            </Text>
            <Text style={styles.statusDate}>Submitted: {submittedDate}</Text>
          </View>
        );

      case 'under_review':
        return (
          <View style={[styles.statusCard, styles.statusCardPending]}>
            <AlertCircle size={32} color={Colors.star} />
            <Text style={styles.statusTitle}>Under review</Text>
            <Text style={styles.statusMessage}>
              Your verification requires manual review. This may take 24–48 hours.
            </Text>
            <Text style={styles.statusDate}>Submitted: {submittedDate}</Text>
          </View>
        );

      case 'approved':
        return (
          <View style={[styles.statusCard, styles.statusCardApproved]}>
            <CheckCircle size={32} color={Colors.success} />
            <Text style={styles.statusTitle}>Country Change Approved</Text>
            <Text style={styles.statusMessage}>
              Your country has been updated. Please review your menu before reopening your store.
            </Text>
            <Text style={styles.statusDate}>Approved: {submittedDate}</Text>
          </View>
        );

      case 'rejected':
        return (
          <View style={[styles.statusCard, styles.statusCardRejected]}>
            <XCircle size={32} color={Colors.error} />
            <Text style={styles.statusTitle}>Request Rejected</Text>
            <Text style={styles.statusMessage}>
              Your request to change country was rejected.
            </Text>
            {rejectionReason && (
              <View style={styles.reasonCard}>
                <Text style={styles.reasonLabel}>Reason:</Text>
                <Text style={styles.reasonText}>{rejectionReason}</Text>
              </View>
            )}
          </View>
        );
    }
  };

  const renderActions = () => {
    switch (status) {
      case 'pending':
      case 'under_review':
        return (
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => console.log('Contact support')}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Contact Support</Text>
          </TouchableOpacity>
        );

      case 'approved':
        return (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonText}>Continue</Text>
          </TouchableOpacity>
        );

      case 'rejected':
        return (
          <>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/vendor/settings/request-country-change' as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.actionButtonText}>Request New Change</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={() => console.log('Contact support')}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>Contact Support</Text>
            </TouchableOpacity>
          </>
        );
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={28} color={Colors.charcoal} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Country Change Status</Text>
          <View style={styles.placeholder} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderStatusCard()}

        {(status === 'pending' || status === 'under_review') && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>What happens next?</Text>
            <Text style={styles.infoText}>
              Our team is reviewing your documents. You&apos;ll receive a notification once the review is complete.
            </Text>
          </View>
        )}

        {status === 'approved' && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Next steps</Text>
            <Text style={styles.infoText}>
              • Review your menu items and pricing{`
`}
              • Update your business hours if needed{`
`}
              • Verify payment methods are correct{`
`}
              • Reopen your store when ready
            </Text>
          </View>
        )}

        <View style={styles.actionsContainer}>
          {renderActions()}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.background,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  statusCard: {
    borderRadius: 16,
    padding: 24,
    marginTop: 24,
    alignItems: 'center' as const,
  },
  statusCardPending: {
    backgroundColor: 'rgba(255, 214, 10, 0.15)',
  },
  statusCardApproved: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
  },
  statusCardRejected: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 16,
    textAlign: 'center' as const,
  },
  statusMessage: {
    fontSize: 15,
    color: Colors.textMuted,
    lineHeight: 22,
    textAlign: 'center' as const,
    marginTop: 12,
  },
  statusDate: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  reasonCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    width: '100%',
  },
  reasonLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  reasonText: {
    fontSize: 15,
    color: Colors.textMuted,
    lineHeight: 22,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 15,
    color: Colors.textMuted,
    lineHeight: 22,
  },
  actionsContainer: {
    marginTop: 32,
  },
  actionButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginTop: 12,
  },
  actionButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  secondaryButton: {
    backgroundColor: Colors.surface,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  bottomSpacer: {
    height: 40,
  },
});
