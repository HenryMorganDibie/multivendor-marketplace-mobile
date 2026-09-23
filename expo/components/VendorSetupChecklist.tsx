import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, AlertCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import {
  useVendorOnboarding,
  ONBOARDING_STEP_ROUTES,
  type OnboardingStepId,
} from '@/contexts/VendorOnboardingContext';

/**
 * Phase 1 — storefront setup progress for a new vendor.
 *
 * Deliberately a four-stage stepper rather than a flat list of every step.
 * Seven equally-weighted rows made an ordinary incomplete setup look like a
 * long list of problems, and gave no sense of how far along the vendor was.
 * Grouping into stages means the dashboard shows "2 of 4 stages" and only the
 * handful of actions that are actually next, instead of everything at once.
 *
 * All completion state comes from the backend (getVendorOnboardingStatus) —
 * never local storage — so a step can only look done when it really is.
 */

interface SetupStage {
  id: string;
  title: string;
  /** Backend step ids that roll up into this stage. */
  stepIds: OnboardingStepId[];
}

const SETUP_STAGES: SetupStage[] = [
  { id: 'business_profile', title: 'Business profile', stepIds: ['business_details', 'business_location'] },
  { id: 'store_setup', title: 'Store setup', stepIds: ['first_catalog_item', 'fulfillment', 'payment_method'] },
  { id: 'publish', title: 'Publish', stepIds: ['publish_storefront'] },
  { id: 'get_discovered', title: 'Get discovered', stepIds: ['verification'] },
];

/** How many outstanding actions to surface at once. Showing every remaining
 * step is what made the original list overwhelming. */
const MAX_VISIBLE_NEXT_ACTIONS = 3;

export default function VendorSetupChecklist() {
  const router = useRouter();
  const { steps, isSetupComplete, isPublished, countryOpen, isLoading, error, refresh } = useVendorOnboarding();

  /**
   * A vendor can finish every step this checklist tracks — including
   * verification — and still be invisible to customers, because
   * discoverability also needs Platform to be open for commerce in their
   * country, which isn't one of the tracked steps. Without this, the
   * checklist just disappeared once every step was done, and the dashboard
   * looked completely normal while the vendor was silently getting nothing.
   */
  const showCountryNotice = isPublished && !countryOpen;

  const stageState = useMemo(() => {
    const byId = new Map(steps.map((s) => [s.id, s]));
    return SETUP_STAGES.map((stage) => {
      const stageSteps = stage.stepIds.map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => !!s);
      return {
        ...stage,
        steps: stageSteps,
        // A stage counts as complete only when every step inside it is done,
        // so partial progress never reads as finished.
        complete: stageSteps.length > 0 && stageSteps.every((s) => s.complete),
      };
    });
  }, [steps]);

  const completedStages = stageState.filter((s) => s.complete).length;

  /** The next few outstanding actions, in stage order, so the vendor is guided
   * forward rather than shown the whole backlog. */
  const nextActions = useMemo(() => {
    const out: { id: OnboardingStepId; label: string; blocksPublication: boolean }[] = [];
    for (const stage of stageState) {
      for (const step of stage.steps) {
        if (!step.complete && out.length < MAX_VISIBLE_NEXT_ACTIONS) {
          out.push({ id: step.id, label: step.label, blocksPublication: step.blocksPublication });
        }
      }
    }
    return out;
  }, [stageState]);

  if (isSetupComplete && !showCountryNotice) return null;

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

  return (
    <View style={styles.card} testID="setup-checklist">
      <Text style={styles.title}>Storefront setup</Text>
      <Text style={styles.subtitle}>
        {completedStages} of {SETUP_STAGES.length} stages complete
      </Text>

      {/* Stage rail — compact enough for a phone at four items, which is why
          the steps are grouped rather than listed individually. */}
      <View style={styles.rail} testID="setup-stage-rail">
        {stageState.map((stage, index) => (
          <View key={stage.id} style={styles.railItem}>
            <View style={styles.railTop}>
              <View style={[styles.railDot, stage.complete && styles.railDotDone]}>
                {stage.complete && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
              </View>
              {index < stageState.length - 1 && (
                <View style={[styles.railLine, stage.complete && styles.railLineDone]} />
              )}
            </View>
            <Text
              style={[styles.railLabel, stage.complete && styles.railLabelDone]}
              numberOfLines={2}
              testID={`setup-stage-${stage.id}`}
            >
              {stage.title}
            </Text>
          </View>
        ))}
      </View>

      {showCountryNotice && (
        <View style={styles.countryNotice} testID="setup-country-notice">
          <AlertCircle size={16} color={Colors.textSecondary} strokeWidth={2} />
          <View style={styles.countryNoticeTextWrap}>
            <Text style={styles.countryNoticeTitle}>Not visible to customers yet</Text>
            <Text style={styles.countryNoticeBody}>
              Your storefront is set up, but Platform isn't open for orders in your country yet.
              You'll appear in Home, Search and Explore as soon as it is — nothing more to do on
              your end.
            </Text>
          </View>
        </View>
      )}

      {nextActions.length > 0 && (
        <View style={styles.nextBlock}>
          <Text style={styles.nextHeading}>Next steps</Text>
          {nextActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => router.push(ONBOARDING_STEP_ROUTES[action.id] as never)}
              testID={`setup-step-${action.id}`}
            >
              <Text style={styles.actionLabel} numberOfLines={1}>{action.label}</Text>
              {/* Only the steps that genuinely block publishing are marked, so
                  the optional ones don't read as mandatory. */}
              {action.blocksPublication && (
                <Text style={styles.requiredTag}>Required to publish</Text>
              )}
              <ChevronRight size={16} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Verification is explained here, in the final stage, rather than as a
          separate dashboard banner — otherwise the same requirement appears
          twice on one screen. */}
      {!stageState[3]?.complete && (
        <View style={styles.discoveryNote}>
          <Text style={styles.discoveryTitle}>Get discovered on Platform</Text>
          <Text style={styles.discoveryBody}>
            Complete verification to appear in Home, Search and Explore. You can still publish and
            share your storefront before verification.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: { fontSize: 16.5, fontWeight: '700' as const, color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 3 },

  rail: { flexDirection: 'row' as const, marginTop: 16 },
  railItem: { flex: 1 },
  railTop: { flexDirection: 'row' as const, alignItems: 'center' as const },
  railDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  railDotDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  railLine: { flex: 1, height: 2, backgroundColor: Colors.border, marginHorizontal: 4 },
  railLineDone: { backgroundColor: Colors.primary },
  railLabel: { fontSize: 11.5, color: Colors.textSecondary, marginTop: 7, paddingRight: 8, lineHeight: 15 },
  railLabelDone: { color: Colors.text, fontWeight: '600' as const },

  nextBlock: { marginTop: 18 },
  nextHeading: {
    fontSize: 11.5,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  },
  actionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  actionLabel: { flex: 1, fontSize: 14.5, color: Colors.text },
  requiredTag: { fontSize: 11, fontWeight: '600' as const, color: Colors.primary },

  countryNotice: {
    flexDirection: 'row' as const,
    gap: 8,
    marginTop: 18,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.surfaceMuted ?? '#F8F9FA',
  },
  countryNoticeTextWrap: { flex: 1 },
  countryNoticeTitle: { fontSize: 13.5, fontWeight: '700' as const, color: Colors.text },
  countryNoticeBody: { fontSize: 12.5, lineHeight: 18, color: Colors.textSecondary, marginTop: 3 },

  discoveryNote: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.surfaceMuted ?? '#F8F9FA',
  },
  discoveryTitle: { fontSize: 13.5, fontWeight: '700' as const, color: Colors.text },
  discoveryBody: { fontSize: 12.5, lineHeight: 18, color: Colors.textSecondary, marginTop: 3 },

  errorRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  errorText: { flex: 1, fontSize: 13.5, color: Colors.textSecondary },
  retryText: { fontSize: 13.5, fontWeight: '600' as const, color: Colors.primary, marginTop: 8 },
});
