import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useVerification } from '@/contexts/VerificationContext';
import { ShieldCheck, AlertCircle, LogOut, Clock } from 'lucide-react-native';
import { useCountryStatus } from '@/contexts/CountryStatusContext';
import { Colors } from '@/constants/colors';

export default function VendorPendingScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { verificationData } = useVerification();
  const countryStatus = useCountryStatus();
  const isWaitlisted = countryStatus.isWaitlistOnly;

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
    console.log('[VENDOR PENDING] Starting verification flow');
    router.push('/vendor/settings/verification-intro' as any);
  };

  if (isWaitlisted) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
          <View style={styles.content}>
            <View style={[styles.iconContainer, styles.waitlistIconContainer]}>
              <Clock size={64} color={Colors.primary} strokeWidth={1.5} />
            </View>

            <Text style={styles.title}>You&apos;re on the waitlist</Text>
            <Text style={styles.description}>
              the platform is currently in limited availability in your country. You can verify your account, but storefront features aren&apos;t available yet.
            </Text>

            <View style={styles.waitlistBox}>
              <Text style={styles.waitlistBoxTitle}>What you can do now:</Text>
              <Text style={styles.waitlistBoxItem}>• Complete identity verification</Text>
              <Text style={styles.waitlistBoxItem}>• Set up your business profile</Text>
              <Text style={styles.waitlistBoxItem}>• Get ready for launch</Text>
            </View>

            <View style={styles.waitlistBox}>
              <Text style={styles.waitlistBoxTitle}>Not available yet:</Text>
              <Text style={styles.waitlistBoxItem}>• Catalog publishing</Text>
              <Text style={styles.waitlistBoxItem}>• Storefront visibility</Text>
              <Text style={styles.waitlistBoxItem}>• Customer orders</Text>
            </View>

            <TouchableOpacity
              style={styles.verifyButton}
              activeOpacity={0.8}
              onPress={handleStartVerification}
            >
              <Text style={styles.verifyButtonText}>Start Verification</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.logoutButton}
                activeOpacity={0.8}
                onPress={logout}
              >
                <LogOut size={20} color={Colors.error} strokeWidth={2} />
                <Text style={styles.logoutText}>Log out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <ShieldCheck size={64} color={Colors.primary} strokeWidth={1.5} />
          </View>

          <Text style={styles.title}>Identity Verification Required</Text>
          <Text style={styles.description}>
            To activate your vendor account and start selling, you need to complete identity verification.
          </Text>

          <View style={styles.infoBox}>
            <AlertCircle size={20} color={Colors.textMuted} strokeWidth={2} />
            <Text style={styles.infoText}>
              Your storefront is not visible in Home, Explore, or Search while verification is pending. Customers with your direct storefront link may still view your store.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.verifyButton}
            activeOpacity={0.8}
            onPress={handleStartVerification}
          >
            <Text style={styles.verifyButtonText}>Start Verification</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.logoutButton}
              activeOpacity={0.8}
              onPress={logout}
            >
              <LogOut size={20} color={Colors.error} strokeWidth={2} />
              <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.surface,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 32,
    borderWidth: 2,
    borderColor: Colors.charcoal,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 24,
    marginBottom: 32,
  },
  infoBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.charcoal,
    marginBottom: 32,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textMuted,
    marginLeft: 12,
    flex: 1,
  },
  verifyButton: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginBottom: 32,
  },
  verifyButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  footer: {
    width: '100%',
    alignItems: 'center' as const,
  },
  logoutButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.charcoal,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.error,
    marginLeft: 8,
  },
  waitlistIconContainer: {
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    borderColor: 'rgba(255, 165, 0, 0.3)',
  },
  waitlistBox: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.charcoal,
  },
  waitlistBoxTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  waitlistBoxItem: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 22,
    marginBottom: 4,
  },
});
