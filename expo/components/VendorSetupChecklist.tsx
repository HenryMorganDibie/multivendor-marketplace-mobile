import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, AlertCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import {
  useVendorOnboarding,
  ONBOARDING_STEP_ROUTES,
} from '@/contexts/VendorOnboardingContext';

/**
 * Phase 1 — the storefront setup checklist shown on a new vendor's dashboard.
 *
 * A vendor can now reach the dashboard before their business profile exists,
 * so without this the first thing they'd see is an empty screen with no
 * indication of what to do. Progress is read from real stored values, never a
 * hardcoded count, and the whole block disappears once setup is finished.
 */
export default function VendorSetupChecklist() {
  const router = useRouter();
  const {
    steps,
    completedCount,
    totalCount,
    isSetupComplete,
    isLoading,
    error,
    refresh,
  } = useVendorOnboarding();

  if (isSetupComplete) return null;

  if (isLoading) {
    return (
      <View style={styles.card} testID="setup-checklist-loading">
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.card} testID="setup-checklist-error">
        <View style={styles.errorRow}>
          <AlertCircle size={16} color={Colors.error} strokeWidth={2} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
        <TouchableOpacity onPress={() => void refresh()} activeOpacity={0.7} testID="setup-checklist-retry">
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (steps.length === 0) return null;

  const progressRatio = totalCount > 0 ? completedCount / totalCount : 0;

  return (
    <View style={styles.card} testID="setup-checklist">
      <Text style={styles.title}>Get your storefront ready</Text>
      <Text style={styles.subtitle}>
        {completedCount} of {totalCount} completed
      </Text>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progressRatio * 100)}%` }]} />
      </View>

      {steps.map((step) => (
        <TouchableOpacity
          key={step.id}
          style={styles.stepRow}
          activeOpacity={step.complete ? 1 : 0.7}
          disabled={step.complete}
          onPress={() => router.push(ONBOARDING_STEP_ROUTES[step.id] as never)}
          testID={`setup-step-${step.id}`}
        >
          <View style={[styles.checkCircle, step.complete && styles.checkCircleDone]}>
            {step.complete && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
          </View>

          <Text style={[styles.stepLabel, step.complete && styles.stepLabelDone]}>
            {step.label}
          </Text>

          {/* Only steps that actually block going live are marked — otherwise
              every row looks equally urgent and the label stops meaning
              anything. */}
          {!step.complete && step.blocksPublication && (
            <Text style={styles.requiredTag}>Required to publish</Text>
          )}

          {!step.complete && <ChevronRight size={16} color={Colors.textMuted} strokeWidth={2} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    padding: 16,
    marginBottom: 16,
  },
  title: { fontSize: 16, fontWeight: '700' as const, color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 3 },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#F0F0F0',
    marginTop: 12,
    marginBottom: 6,
    overflow: 'hidden' as const,
  },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: Colors.primary },
  stepRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F2F2',
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D6D6D6',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  checkCircleDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepLabel: { flex: 1, fontSize: 14.5, color: Colors.text },
  stepLabelDone: { color: Colors.textMuted, textDecorationLine: 'line-through' as const },
  requiredTag: { fontSize: 11, fontWeight: '600' as const, color: Colors.primary },
  errorRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  errorText: { flex: 1, fontSize: 13.5, color: Colors.error },
  retryText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
});
