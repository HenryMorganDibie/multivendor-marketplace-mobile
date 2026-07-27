import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import EditScreenHeader from '@/components/EditScreenHeader';
import { useVendorAutoAccept } from '@/contexts/VendorAutoAcceptContext';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import { Colors } from '@/constants/colors';

export default function AutoAcceptOrdersScreen() {
  const router = useRouter();
  const { autoAcceptEnabled, setAutoAccept, isLoaded } = useVendorAutoAccept();
  const { plan, isLoading: isPlanLoading } = useVendorPlan();

  const isPlanGated = plan === 'basic' || plan === 'standard';
  const isToggleDisabled = !isLoaded || isPlanLoading || isPlanGated;

  const handleToggle = async (value: boolean) => {
    try {
      await setAutoAccept(value);
    } catch {
      console.error('Failed to update auto-accept setting');
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Auto-Accept Orders" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.toggleSection}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeftContent}>
                <Text style={styles.toggleLabel}>Enable auto-accept orders</Text>
                {isPlanGated && (
                  <View style={styles.lockBadge}>
                    <Lock size={12} color={Colors.textSecondary} strokeWidth={2.5} />
                  </View>
                )}
              </View>
              <Switch
                value={autoAcceptEnabled}
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
                When enabled, eligible orders will automatically move from Pending to Accepted status without requiring manual review. You will still receive order notifications.{"\n\n"}
                Auto-accept will not override out-of-stock items, away mode, or account restrictions.
              </Text>
            )}
          </View>

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
