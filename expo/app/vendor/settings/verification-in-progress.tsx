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
            <View style={styles.iconCircle}>
              <Clock size={24} color={Colors.warning} strokeWidth={2.2} />
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>Under Review</Text>
            </View>
            <Text style={styles.statusLabel}>Under Review</Text>
            <Text style={styles.statusExplanation}>
              We’re reviewing your submission. This may take 24–48 hours.
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
              <Text style={styles.listText}>We’ll notify you as soon as review is complete.</Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>If anything needs attention, you’ll see exactly what to update.</Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>Your submission remains safely stored for admin review.</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.viewButton}
            onPress={handleViewSubmission}
            activeOpacity={0.7}
          >
            <Text style={styles.viewButtonText}>View Submission</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.supportButton}
            onPress={() => router.push('/vendor/settings/verification-support' as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.supportButtonText}>Contact Support</Text>
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
    paddingHorizontal: 20,
  },
  statusCard: {
    borderRadius: 20,
    padding: 20,
    marginTop: 14,
    alignItems: 'center' as const,
    borderWidth: 1,
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.warningLight,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: Colors.warningLight,
    borderColor: Colors.warningBorder,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.warning,
  },
  statusLabel: {
    fontSize: 21,
    fontWeight: '700' as const,
    marginBottom: 8,
    color: Colors.text,
  },
  statusExplanation: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
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
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: Colors.charcoal,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center' as const,
    marginTop: 18,
  },
  viewButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  supportButton: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center' as const,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  supportButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  bottomSpacer: {
    height: 40,
  },
});
