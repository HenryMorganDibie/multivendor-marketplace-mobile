import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { CheckCircle, Clock, AlertTriangle, XCircle, Ban } from 'lucide-react-native';
import { useVerification, type VerificationStatus } from '@/contexts/VerificationContext';
import { Colors } from '@/constants/colors';
import EditScreenHeader from '@/components/EditScreenHeader';

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

export default function VerificationScreen() {
  const router = useRouter();
  const { verificationData, isLoading } = useVerification();

  const handleStatusRedirect = useCallback(() => {
    const status = verificationData.status;
    if (status === 'pending_review') {
      router.push('/vendor/settings/verification-in-progress' as any);
    } else if (status === 'approved') {
      router.push('/vendor/settings/verification-approved' as any);
    } else if (status === 'rejected' || status === 'retry_required') {
      router.push('/vendor/settings/verification-rejected' as any);
    } else if (status === 'suspended' || status === 'deactivated') {
      // Stay on this hub — no redirect needed
    }
  }, [verificationData.status, router]);

  useEffect(() => {
    handleStatusRedirect();
  }, [handleStatusRedirect]);

  if (isLoading) {
    return (
      <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Verification" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      </View>
    );
  }

  const status = verificationData.status;
  const refId = verificationData.referenceId;

  const getStatusConfig = () => {
    switch (status) {
      case 'approved':
        return {
          icon: <CheckCircle size={48} color={Colors.success} />,
          label: 'Verified',
          color: Colors.success,
          backgroundColor: 'rgba(52, 199, 89, 0.15)',
          borderColor: 'rgba(52, 199, 89, 0.3)',
          explanation: 'Your account is fully verified and in good standing.',
          submissionDate: formatDate(verificationData.reviewedAt || verificationData.submittedAt),
          cta: null,
          secondaryCta: 'Contact Support',
          reason: null,
          requirements: null,
        };
      case 'not_started':
        return {
          icon: <AlertTriangle size={48} color={Colors.primary} />,
          label: 'Not verified',
          color: Colors.primary,
          backgroundColor: 'rgba(255, 149, 0, 0.15)',
          borderColor: 'rgba(255, 149, 0, 0.3)',
          explanation: 'Your storefront is not visible in Home, Explore, or Search while verification is pending. Customers with your direct storefront link may still view your store.',
          submissionDate: null,
          cta: 'Start Verification',
          secondaryCta: null,
          reason: null,
          requirements: {
            title: 'What you need',
            items: ['Government ID', 'Selfie check'],
            estimatedTime: '2–5 minutes',
          },
        };
      case 'retry_required':
        return {
          icon: <XCircle size={48} color={Colors.error} />,
          label: 'Action required',
          color: Colors.error,
          backgroundColor: 'rgba(255, 59, 48, 0.15)',
          borderColor: 'rgba(255, 59, 48, 0.3)',
          explanation: 'Your storefront is not visible in Home, Explore, or Search. Customers with your direct storefront link may still view your store.',
          submissionDate: null,
          cta: 'Retry Verification',
          secondaryCta: 'Contact Support',
          reason: verificationData.rejectionReason || 'Selfie did not match ID photo',
          requirements: {
            title: 'What to do',
            items: ['Please resubmit your verification.'],
            estimatedTime: null,
          },
        };
      case 'pending_review':
        return {
          icon: <Clock size={48} color={Colors.primary} />,
          label: 'Under review',
          color: Colors.primary,
          backgroundColor: 'rgba(255, 149, 0, 0.15)',
          borderColor: 'rgba(255, 149, 0, 0.3)',
          explanation: 'Your storefront is not visible in Home, Explore, or Search while verification is pending. Customers with your direct storefront link may still view your store.',
          submissionDate: formatDate(verificationData.submittedAt),
          cta: 'Contact Support',
          secondaryCta: null,
          reason: null,
          requirements: null,
        };
      case 'rejected':
        return {
          icon: <XCircle size={48} color={Colors.error} />,
          label: 'Verification unsuccessful',
          color: Colors.error,
          backgroundColor: 'rgba(255, 59, 48, 0.15)',
          borderColor: 'rgba(255, 59, 48, 0.3)',
          explanation: "We couldn't verify your identity. You can retry or contact support for help.",
          submissionDate: formatDate(verificationData.reviewedAt),
          cta: 'Retry Verification',
          secondaryCta: 'Contact Support',
          reason: verificationData.rejectionReason || 'Verification failed',
          requirements: {
            title: 'What to do',
            items: ['Ensure your documents are clear and valid.', 'Contact support if you believe this is an error.'],
            estimatedTime: null,
          },
        };
      case 'suspended':
        return {
          icon: <Ban size={48} color={Colors.error} />,
          label: 'Account suspended',
          color: Colors.error,
          backgroundColor: 'rgba(255, 59, 48, 0.15)',
          borderColor: 'rgba(255, 59, 48, 0.3)',
          explanation: 'Your account has been suspended. Your storefront is blocked and not accessible to customers.',
          submissionDate: null,
          cta: 'Contact Support',
          secondaryCta: null,
          reason: verificationData.rejectionReason || 'Account suspended by moderation',
          requirements: null,
        };
      case 'deactivated':
        return {
          icon: <Ban size={48} color="#6B7280" />,
          label: 'Account deactivated',
          color: '#6B7280',
          backgroundColor: 'rgba(107, 114, 128, 0.15)',
          borderColor: 'rgba(107, 114, 128, 0.3)',
          explanation: 'Your account has been deactivated and is no longer accessible on the platform.',
          submissionDate: null,
          cta: null,
          secondaryCta: 'Contact Support',
          reason: null,
          requirements: null,
        };
    }
  };

  const config = getStatusConfig();

  const handleCTAPress = () => {
    console.log('CTA pressed:', config.cta);
    if (config.cta === 'Start Verification') {
      router.push('/vendor/settings/verification-intro' as any);
    } else if (config.cta === 'View Submission') {
      router.push('/vendor/settings/verification-in-progress' as any);
    } else if (config.cta === 'Retry Verification') {
      router.push('/vendor/settings/verification-intro' as any);
    }
  };

  const handleSecondaryCTAPress = () => {
    console.log('Secondary CTA pressed:', config.secondaryCta);
    if (config.secondaryCta === 'Contact Support') {
      router.push('/vendor/settings/verification-support' as any);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Verification',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.charcoal,
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View
            style={[
              styles.statusCard,
              { backgroundColor: config.backgroundColor, borderColor: config.borderColor },
            ]}
          >
            {config.icon}
            <Text style={[styles.statusLabel, { color: config.color }]}>{config.label}</Text>
            <Text style={styles.statusExplanation}>{config.explanation}</Text>
            {config.submissionDate ? (
              <Text style={styles.submissionDate}>Submitted: {config.submissionDate}</Text>
            ) : null}
            {refId && config.submissionDate ? (
              <Text style={styles.referenceText}>Reference: {refId}</Text>
            ) : null}
            {refId && !config.submissionDate ? (
              <Text style={styles.referenceText}>Reference: {refId}</Text>
            ) : null}
          </View>

          {config.reason && (
            <View style={styles.reasonCard}>
              <Text style={styles.reasonTitle}>Reason</Text>
              <Text style={styles.reasonText}>{config.reason}</Text>
            </View>
          )}

          {config.requirements && (
            <View style={styles.requirementsCard}>
              <Text style={styles.requirementsTitle}>{config.requirements.title}</Text>
              {config.requirements.items.map((item, index) => (
                <Text key={index} style={styles.requirementItem}>• {item}</Text>
              ))}
              {config.requirements.estimatedTime && (
                <Text style={styles.estimatedTime}>Estimated time: {config.requirements.estimatedTime}</Text>
              )}
            </View>
          )}

          {config.cta && (
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleCTAPress}
              activeOpacity={0.7}
            >
              <Text style={styles.ctaButtonText}>{config.cta}</Text>
            </TouchableOpacity>
          )}

          {config.secondaryCta && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleSecondaryCTAPress}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>{config.secondaryCta}</Text>
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
  },
  statusLabel: {
    fontSize: 22,
    fontWeight: '700' as const,
    marginTop: 16,
    marginBottom: 12,
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
  reasonCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  reasonTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  reasonText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  requirementsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  requirementsTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  requirementItem: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 24,
  },
  estimatedTime: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 12,
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
  ctaButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginTop: 24,
  },
  ctaButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
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
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  infoItem: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 24,
  },
  bottomSpacer: {
    height: 40,
  },
});
