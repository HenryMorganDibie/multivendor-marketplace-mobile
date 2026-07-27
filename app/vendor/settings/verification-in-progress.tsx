import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { useVerification } from '@/contexts/VerificationContext';
import EditScreenHeader from '@/components/EditScreenHeader';
import { Colors } from '@/constants/colors';

function formatDate(isoString?: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function VerificationInProgressScreen() {
  const router = useRouter();
  const { verificationData } = useVerification();

  const handleStatusChange = useCallback(() => {
    if (verificationData.status === 'approved') {
      router.replace('/vendor/settings/verification-approved' as any);
    } else if (verificationData.status === 'rejected' || verificationData.status === 'retry_required') {
      router.replace('/vendor/settings/verification-rejected' as any);
    }
  }, [verificationData.status, router]);

  useEffect(() => {
    handleStatusChange();
  }, [handleStatusChange]);

  const handleViewSubmission = () => {
    console.log('[VERIFICATION] View submission pressed');
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Verification" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.statusCard}>
            <Clock size={48} color={Colors.primary} />
            <Text style={styles.statusLabel}>Verification in progress</Text>
            <Text style={styles.statusExplanation}>
              We&apos;re reviewing your submission. This may take up to 24–48 hours.
            </Text>
            {verificationData.submittedAt ? (
              <Text style={styles.submissionDate}>
                Submitted: {formatDate(verificationData.submittedAt)}
              </Text>
            ) : null}
            {verificationData.referenceId ? (
              <Text style={styles.referenceText}>
                Reference: {verificationData.referenceId}
              </Text>
            ) : null}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>What happens next</Text>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>Your storefront is not visible in Home, Explore, or Search while verification is pending.</Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>Customers with your direct storefront link may still view your store.</Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>You&apos;ll be notified once review is complete.</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.viewButton}
            onPress={handleViewSubmission}
            activeOpacity={0.7}
          >
            <Text style={styles.viewButtonText}>View Submission</Text>
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  statusCard: {
    borderRadius: 16,
    padding: 24,
    marginTop: 16,
    alignItems: 'center' as const,
    borderWidth: 1,
    backgroundColor: Colors.primaryTint,
    borderColor: 'rgba(255, 122, 40, 0.2)',
  },
  statusLabel: {
    fontSize: 22,
    fontWeight: '700' as const,
    marginTop: 16,
    marginBottom: 12,
    color: Colors.primary,
  },
  statusExplanation: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
    textAlign: 'center' as const,
  },
  submissionDate: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 12,
  },
  referenceText: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 6,
    fontFamily: 'monospace',
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
  },
  infoTitle: {
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
  viewButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginTop: 24,
  },
  viewButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  bottomSpacer: {
    height: 40,
  },
});
