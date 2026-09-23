import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useVendorPickup } from '@/contexts/VendorPickupContext';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import LaektivaModal from '@/components/LaektivaModal';
import { Colors } from '@/constants/colors';
import EditScreenHeader from '@/components/EditScreenHeader';

export default function AutoSendPickupScreen() {
  const { autoSendEnabled, setAutoSend, hasPickupDetails, isLoaded } = useVendorPickup();
  const { isLoading: isPlanLoading, planLimits } = useVendorPlan();
  const router = useRouter();
  const [showPickupModal, setShowPickupModal] = useState(false);

  // Reads the real PlanLimits.canAutoSendPickupDetails flag rather than
  // re-deriving "which plans get this" from the plan name — the exact
  // hardcoded-business-rule-in-the-client pattern already found and fixed
  // for catalog/photo limits elsewhere in this app, which drifts silently
  // the moment the backend's gating rule changes (e.g. a future plan
  // revision) without this screen being touched. While planLimits hasn't
  // loaded yet, default to gated rather than briefly showing the toggle as
  // available.
  const isPlanGated = !planLimits?.canAutoSendPickupDetails;
  const isToggleDisabled = !isLoaded || isPlanLoading || isPlanGated;

  const handleToggle = async (value: boolean) => {
    if (value && !hasPickupDetails()) {
      setShowPickupModal(true);
      return;
    }

    try {
      await setAutoSend(value);
    } catch {
      console.error('Failed to update auto-send setting');
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Auto-send Pickup Details" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.toggleSection}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeftContent}>
                <Text style={styles.toggleLabel}>Auto-send pickup details</Text>
                {isPlanGated && (
                  <View style={styles.lockBadge}>
                    <Lock size={12} color={Colors.textSecondary} strokeWidth={2.5} />
                  </View>
                )}
              </View>
              <Switch
                value={autoSendEnabled}
                onValueChange={handleToggle}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.white}
                ios_backgroundColor={Colors.border}
                disabled={isToggleDisabled}
              />
            </View>
          </View>

          <View style={styles.helperSection}>
            {isPlanGated ? (
              <Text style={styles.helperText}>
                Upgrade to Pro to enable this feature
              </Text>
            ) : (
              <Text style={styles.helperText}>
                When enabled, pickup address and instructions will automatically be sent to the customer chat after you mark the order as paid.{"\n\n"}
                This only applies to Pickup orders. You must have pickup details saved to enable this feature.
              </Text>
            )}
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <LaektivaModal
        visible={showPickupModal}
        title="Pickup details required"
        message="Add your pickup address and instructions before enabling this feature."
        primaryButton={{
          label: 'Add pickup details',
          onPress: () => {
            setShowPickupModal(false);
            router.push('/vendor/settings/pickup-details' as any);
          },
        }}
        secondaryButton={{
          label: 'Cancel',
          onPress: () => setShowPickupModal(false),
        }}
        onRequestClose={() => setShowPickupModal(false)}
      />
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
  toggleSection: {
    paddingTop: 16,
  },
  toggleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  toggleLeftContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  toggleLabel: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  lockBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  helperSection: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  helperText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  bottomSpacer: {
    height: 40,
  },
});
