import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { XCircle } from 'lucide-react-native';
import { useVerification } from '@/contexts/VerificationContext';
import { Colors } from '@/constants/colors';
import EditScreenHeader from '@/components/EditScreenHeader';

function formatDate(isoString?: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function VerificationRejectedScreen() {
  const router = useRouter();
  const { verificationData, retryVerification } = useVerification();

  // submitVendorVerification only accepts resubmission from the backend's
  // own not_started/retry_required states, never from "rejected" - a real
  // admin decision, not an incomplete-documents request. This screen
  // previously showed the same "Retry verification" button for both, so a
  // hard-rejected vendor could re-upload everything and still fail at the
  // final submit step with no way to know why in advance.
  const canRetry = verificationData.status === 'retry_required';

  const handleRetry = async () => {
    console.log('[VERIFICATION] Retrying verification');
    await retryVerification();
    router.push('/vendor/settings/verification-intro' as any);
  };

  const handleContactSupport = () => {
    console.log('[VERIFICATION] Contact support');
    router.push('/vendor/settings/verification-support' as any);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Verification" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconContainer}>
            <XCircle size={80} color={Colors.error} strokeWidth={2} />
          </View>

          <Text style={styles.title}>
            {canRetry ? 'Verification unsuccessful' : 'Verification declined'}
          </Text>

          <Text style={styles.body}>
            {canRetry
              ? "We couldn't verify your identity. Please retry using valid documents."
              : 'Your verification was reviewed and declined. This decision is final and cannot be resubmitted. Contact support if you believe this was a mistake.'}
          </Text>

          {verificationData.referenceId ? (
            <View style={styles.referenceCard}>
              <Text style={styles.referenceLabel}>Reference</Text>
              <Text style={styles.referenceValue}>{verificationData.referenceId}</Text>
            </View>
          ) : null}

          {verificationData.rejectionReason && (
            <View style={styles.reasonCard}>
              <Text style={styles.reasonTitle}>Reason</Text>
              <Text style={styles.reasonText}>{verificationData.rejectionReason}</Text>
            </View>
          )}

          {verificationData.reviewedAt ? (
            <Text style={styles.reviewedDate}>
              Reviewed: {formatDate(verificationData.reviewedAt)}
            </Text>
          ) : null}

          {canRetry && (
            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>Tips for successful verification</Text>
              <View style={styles.listItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.listText}>Use valid, unexpired ID</Text>
              </View>
              <View style={styles.listItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.listText}>Good lighting</Text>
              </View>
              <View style={styles.listItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.listText}>Selfie clearly shows your face</Text>
              </View>
            </View>
          )}

          {canRetry && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetry}
              activeOpacity={0.8}
            >
              <Text style={styles.retryButtonText}>Retry verification</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.supportButton}
            onPress={handleContactSupport}
            activeOpacity={0.8}
          >
            <Text style={styles.supportButtonText}>Contact support</Text>
          </TouchableOpacity>

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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center' as const,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 32,
    borderWidth: 2,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 24,
    marginBottom: 32,
  },
  referenceCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  referenceLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  referenceValue: {
    fontSize: 14,
    color: Colors.text,
    fontFamily: 'monospace',
  },
  reasonCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  reasonTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.error,
    marginBottom: 8,
  },
  reasonText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  reviewedDate: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  tipsCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tipsTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  listItem: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    marginBottom: 12,
  },
  bullet: {
    fontSize: 16,
    color: Colors.text,
    marginRight: 8,
    width: 20,
  },
  listText: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
    flex: 1,
  },
  retryButton: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  retryButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  supportButton: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: Colors.charcoal,
    minHeight: 52,
  },
  supportButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.charcoal,
  },
  bottomSpacer: {
    height: 40,
  },
});
