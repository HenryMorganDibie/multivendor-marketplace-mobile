import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Shield } from 'lucide-react-native';
import { useVerification } from '@/contexts/VerificationContext';
import { Colors } from '@/constants/colors';
import EditScreenHeader from '@/components/EditScreenHeader';

export default function VerificationIntroScreen() {
  const router = useRouter();
  const { startVerification } = useVerification();

  const [isStarting, setIsStarting] = useState(false);

  const handleStartVerification = async () => {
    console.log('[VERIFICATION] Initializing identity verification SDK');
    setIsStarting(true);
    try {
      await startVerification('individual');
      console.log('[VERIFICATION] SDK session created, navigating to ID upload');
      router.push('/vendor/settings/verification-upload-id' as any);
    } catch (error) {
      console.error('[VERIFICATION] SDK initialization failed:', error);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Verify Your Business" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.shieldWrap}>
              <Shield size={32} color={Colors.primary} strokeWidth={2} />
            </View>
            <Text style={styles.title}>Verify your identity</Text>
            <Text style={styles.description}>
              Complete identity verification to unlock your storefront.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>What you&apos;ll need</Text>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>Government-issued ID</Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>Selfie for manual review</Text>
            </View>
          </View>

          <View style={styles.timeCard}>
            <Text style={styles.timeLabel}>Estimated time</Text>
            <Text style={styles.timeValue}>2 to 5 minutes</Text>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueButton, isStarting && styles.continueButtonDisabled]}
            onPress={handleStartVerification}
            activeOpacity={0.7}
            disabled={isStarting}
          >
            {isStarting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.continueButtonText}>Start Verification</Text>
            )}
          </TouchableOpacity>
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
  header: {
    marginTop: 24,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
  },
  cardTitle: {
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
  timeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  timeLabel: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  timeValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  shieldWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,140,66,0.1)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  bottomSpacer: {
    height: 100,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.surface,
  },
  continueButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
  },
  continueButtonDisabled: {
    opacity: 0.7,
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
