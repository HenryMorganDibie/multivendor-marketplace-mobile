import React, { useEffect, useCallback } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useVerification } from '@/contexts/VerificationContext';
import { ShieldCheck, Camera, Clock } from 'lucide-react-native';

export default function VendorVerificationRequiredScreen() {
  const router = useRouter();
  const { verificationData } = useVerification();

  const handleStatusChange = useCallback(() => {
    if (verificationData.status === 'pending_review') {
      router.replace('/vendor/settings/verification-in-progress' as any);
    } else if (verificationData.status === 'approved') {
      router.replace('/vendor/settings/verification-approved' as any);
    } else if (verificationData.status === 'rejected' || verificationData.status === 'retry_required') {
      router.replace('/vendor/settings/verification-rejected' as any);
    } else if (verificationData.status === 'suspended' || verificationData.status === 'deactivated') {
      router.replace('/vendor/settings/verification' as any);
    }
  }, [verificationData.status, router]);

  useEffect(() => {
    handleStatusChange();
  }, [handleStatusChange]);

  const handleStartVerification = () => {
    console.log('[VENDOR] Start verification tapped');
    router.push('/vendor/settings/verification-intro' as any);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.iconCircle}>
              <ShieldCheck size={48} color={Colors.text} strokeWidth={2} />
            </View>

            <Text style={styles.title}>Identity verification required</Text>
            
            <Text style={styles.body}>
              To protect customers and vendors, the platform requires identity verification before selling. Verification is handled securely by a trusted third-party provider.
            </Text>

            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <View style={styles.detailIconCircle}>
                  <ShieldCheck size={20} color={Colors.text} strokeWidth={2} />
                </View>
                <Text style={styles.detailText}>Government-issued ID</Text>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailIconCircle}>
                  <Camera size={20} color={Colors.text} strokeWidth={2} />
                </View>
                <Text style={styles.detailText}>Quick selfie check</Text>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailIconCircle}>
                  <Clock size={20} color={Colors.text} strokeWidth={2} />
                </View>
                <Text style={styles.detailText}>Review takes 24 to 48 hours</Text>
              </View>
            </View>

            <Text style={styles.note}>
              Your storefront is not visible in Home, Explore, or Search while verification is pending. Customers with your direct storefront link may still view your store.
            </Text>

            <TouchableOpacity
              style={styles.startButton}
              onPress={handleStartVerification}
              activeOpacity={0.8}
            >
              <Text style={styles.startButtonText}>Start verification</Text>
            </TouchableOpacity>

            <Text style={styles.privacyNote}>
              Your information is processed securely and is never shared publicly.
            </Text>
          </View>
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
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: Colors.charcoal,
  },
  title: {
    fontSize: 28,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 24,
    marginBottom: 40,
  },
  detailsContainer: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    gap: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.charcoal,
  },
  detailRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  detailIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.charcoal,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 16,
  },
  detailText: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  note: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  startButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    width: '100%',
    marginBottom: 20,
    minHeight: 52,
  },
  startButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  privacyNote: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
});
