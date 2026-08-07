import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { CheckCircle2, Circle, Globe, EyeOff } from 'lucide-react-native';
import { useVendorOnboarding, ONBOARDING_STEP_ROUTES } from '@/contexts/VendorOnboardingContext';
import { useVendor } from '@/contexts/VendorContext';
import { Alert } from '@/utils/alert';
import { Colors } from '@/constants/colors';
import EditScreenHeader from '@/components/EditScreenHeader';
import { storefrontUrl, shareStorefront } from '@/lib/storefront/shareStorefront';

/**
 * The one screen the "Publish storefront" checklist step has always pointed
 * to but never had: setVendorPublishStatus (backend) and setPublished
 * (VendorOnboardingContext) both existed with nothing calling them. A vendor
 * could finish every required step, see "ready to publish", and have no
 * button anywhere that actually flips isPublished.
 */
export default function StorefrontPublishScreen() {
  const router = useRouter();
  const { vendor } = useVendor();
  const { steps, canPublish, blockedReasons, isPublished, setPublished, isLoading } = useVendorOnboarding();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const blockingSteps = steps.filter((s) => s.blocksPublication && !s.complete);

  const handlePublish = async () => {
    setIsSubmitting(true);
    try {
      await setPublished(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not publish your storefront.';
      Alert.alert('Could not publish', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnpublish = () => {
    Alert.alert(
      'Take storefront offline?',
      'Your link will stop working for customers until you publish again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Take offline',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              await setPublished(false);
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Could not update your storefront.';
              Alert.alert('Could not update', message);
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Storefront" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
          ) : isPublished ? (
            <>
              <View style={styles.header}>
                <View style={[styles.iconWrap, { backgroundColor: 'rgba(22,163,74,0.1)' }]}>
                  <Globe size={28} color="#16A34A" strokeWidth={2} />
                </View>
                <Text style={styles.title}>Your storefront is live</Text>
                <Text style={styles.description}>
                  Customers can open your link and place orders.
                </Text>
              </View>

              <View style={styles.linkCard}>
                <Text style={styles.linkText} numberOfLines={1}>{storefrontUrl(vendor.username)}</Text>
              </View>

              <TouchableOpacity
                style={styles.shareButton}
                activeOpacity={0.8}
                onPress={() => void shareStorefront(vendor)}
              >
                <Text style={styles.shareButtonText}>Share link</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.unpublishButton}
                activeOpacity={0.7}
                onPress={handleUnpublish}
                disabled={isSubmitting}
              >
                <EyeOff size={16} color={Colors.error} strokeWidth={2} />
                <Text style={styles.unpublishButtonText}>Take storefront offline</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.header}>
                <View style={styles.iconWrap}>
                  <Globe size={28} color={Colors.primary} strokeWidth={2} />
                </View>
                <Text style={styles.title}>Publish your storefront</Text>
                <Text style={styles.description}>
                  Once published, customers can open your storefront link and place orders directly —
                  even before verification is complete.
                </Text>
              </View>

              {blockingSteps.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Still needed</Text>
                  {blockingSteps.map((step) => (
                    <TouchableOpacity
                      key={step.id}
                      style={styles.stepRow}
                      activeOpacity={0.7}
                      onPress={() => router.push(ONBOARDING_STEP_ROUTES[step.id] as never)}
                    >
                      <Circle size={18} color={Colors.textMuted} strokeWidth={2} />
                      <Text style={styles.stepLabel}>{step.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {canPublish && blockedReasons.length === 0 && (
                <View style={styles.card}>
                  <View style={styles.stepRow}>
                    <CheckCircle2 size={18} color="#16A34A" strokeWidth={2} />
                    <Text style={styles.stepLabel}>Everything's ready</Text>
                  </View>
                </View>
              )}
            </>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {!isLoading && !isPublished && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.continueButton, (!canPublish || isSubmitting) && styles.continueButtonDisabled]}
              onPress={handlePublish}
              activeOpacity={0.7}
              disabled={!canPublish || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.continueButtonText}>Publish storefront</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerSafe: { backgroundColor: Colors.background },
  safeArea: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16 },
  header: { marginTop: 24, marginBottom: 8, alignItems: 'center' as const },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,140,66,0.1)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  description: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center' as const,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingVertical: 10,
  },
  stepLabel: { fontSize: 15.5, color: Colors.text },
  linkCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginTop: 24,
  },
  linkText: { fontSize: 14.5, color: Colors.textSecondary },
  shareButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginTop: 16,
  },
  shareButtonText: { fontSize: 16, fontWeight: '600' as const, color: Colors.white },
  unpublishButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 16,
    marginTop: 8,
  },
  unpublishButtonText: { fontSize: 15, fontWeight: '600' as const, color: Colors.error },
  bottomSpacer: { height: 100 },
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
  continueButtonDisabled: { opacity: 0.5 },
  continueButtonText: { fontSize: 17, fontWeight: '600' as const, color: Colors.white },
});
