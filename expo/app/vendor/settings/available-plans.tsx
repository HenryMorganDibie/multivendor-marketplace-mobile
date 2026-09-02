import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Check, ChevronRight, Sparkles } from 'lucide-react-native';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import EditScreenHeader from '@/components/EditScreenHeader';
import { Colors } from '@/constants/colors';
import {
  buildVendorSubscription,
  resolveCatalogForCountry,
  getOrderedActivePlanIds,
  getHighlightFeatures,
  getFeatureDisplayValue,
  fromBackendPlanId,
  formatMinorUnits,
  type VendorSubscription,
} from '@/constants/planCatalog';
import { openVendorPortal } from '@/utils/openVendorPortal';

const MAX_CONTENT_WIDTH = 720;

export default function AvailablePlansScreen() {
  const router = useRouter();
  const {
    plan,
    businessCountry,
    founderPricingEligible,
    cancellationScheduled,
    cancellationDate,
    realPlanLimits,
  } = useVendorPlan();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 640;
  const contentMaxWidth = Math.min(screenWidth - 32, MAX_CONTENT_WIDTH);

  // Current subscription (for portal URL + current-plan detection).
  const currentSubscription = useMemo(
    () =>
      buildVendorSubscription({
        plan,
        businessCountry,
        founderPricingEligible,
        cancellationScheduled,
        cancellationDate,
        realLimits: realPlanLimits,
      }),
    [plan, businessCountry, founderPricingEligible, cancellationScheduled, cancellationDate, realPlanLimits],
  );

  // The full plan catalog, resolved for this vendor's country and launch
  // eligibility. Every price, name, tagline, and highlight below comes from
  // this catalog — nothing is hard-coded in the screen.
  const resolvedCatalog = useMemo(
    () => resolveCatalogForCountry(businessCountry, founderPricingEligible, realPlanLimits),
    [businessCountry, founderPricingEligible, realPlanLimits],
  );

  const orderedPlanIds = useMemo(() => getOrderedActivePlanIds(), []);
  const currentBackendPlanId = currentSubscription.planId;

  const handleChoosePlan = (planId: string) => {
    // Read-only on mobile. Plan selection happens securely on the vendor portal.
    const portalBase = currentSubscription.portalUrl.split('/subscription')[0];
    const portalPath =
      planId === 'basic' ? '/subscription' : `/subscription/choose?plan=${planId}`;
    void openVendorPortal(`${portalBase}${portalPath}`);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Available plans" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.scrollContent, isWide && { alignSelf: 'center', width: contentMaxWidth }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.introText}>
            Plans are managed securely on the platform Vendor Portal. Review what each plan includes, then
            continue on the web to subscribe or switch.
          </Text>

          {orderedPlanIds.map((planId) => {
            // Every field shown here is read from the resolved catalog.
            const resolved = resolvedCatalog.plans.find((p) => p.id === planId);
            if (!resolved) return null;

            const isCurrent = planId === currentBackendPlanId;
            const currentPlanInternal = fromBackendPlanId(planId);
            const standardPrice =
              resolved.pricingType === 'launch' &&
              resolved.standardPriceMinorUnits > resolved.monthlyPriceMinorUnits
                ? `${formatMinorUnits(resolved.standardPriceMinorUnits, resolvedCatalog.currencySymbol)}/month`
                : null;

            const priceLabel =
              planId === 'basic'
                ? 'Free'
                : `${formatMinorUnits(resolved.monthlyPriceMinorUnits, resolvedCatalog.currencySymbol)}/month`;

            // Snapshot highlights from the catalog's highlightFeatureIds.
            const highlights = getHighlightFeatures(resolved).slice(0, 4);

            return (
              <View
                key={planId}
                style={[styles.planCard, isCurrent && styles.planCardCurrent]}
              >
                <View style={styles.planCardHeader}>
                  <View style={styles.planNameRow}>
                    <Text style={styles.planName}>{resolved.name}</Text>
                    {isCurrent && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Current plan</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceText}>{priceLabel}</Text>
                    {standardPrice && (
                      <Text style={styles.standardPriceText}>
                        {standardPrice} after launch
                      </Text>
                    )}
                  </View>
                </View>

                <Text style={styles.tagline}>{resolved.tagline}</Text>

                <View style={styles.keyLimitsCard}>
                  {highlights.map((feature, index) => (
                    <View
                      key={feature.id}
                      style={[styles.keyLimitRow, index === highlights.length - 1 && styles.keyLimitRowLast]}
                    >
                      <View style={styles.keyLimitCheck}>
                        <Check size={11} color={Colors.success} strokeWidth={3} />
                      </View>
                      <Text style={styles.keyLimitText} numberOfLines={1}>
                        {getFeatureDisplayValue(feature)}
                        {feature.unit ? ` ${feature.unit}` : ''} {feature.label.toLowerCase()}
                      </Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.chooseButton, isCurrent && styles.chooseButtonCurrent]}
                  onPress={() => handleChoosePlan(planId)}
                  activeOpacity={0.85}
                  disabled={isCurrent}
                >
                  <Text style={[styles.chooseButtonText, isCurrent && styles.chooseButtonTextCurrent]}>
                    {isCurrent ? 'Current plan' : 'Choose on Vendor Portal'}
                  </Text>
                  {!isCurrent && <ChevronRight size={15} color={Colors.primary} />}
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Premium badge for Pro+ */}
          <View style={styles.premiumNote}>
            <Sparkles size={14} color={Colors.primary} />
            <Text style={styles.premiumNoteText}>
              Pro+ includes premium invoice templates, seasonal themes, and the full analytics suite.
            </Text>
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
    backgroundColor: Colors.backgroundCanvas,
  },
  headerSafe: {
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexGrow: 1,
  },
  introText: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 2,
  },

  planCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  planCardCurrent: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  planCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 6,
  },
  planNameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  planName: {
    fontSize: 19,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  currentBadge: {
    backgroundColor: Colors.primaryTint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  currentBadgeText: {
    fontSize: 10.5,
    fontWeight: '700' as const,
    color: Colors.primary,
    letterSpacing: 0.2,
  },
  priceRow: {
    alignItems: 'flex-end' as const,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  standardPriceText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  tagline: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },

  keyLimitsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  keyLimitRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 6,
  },
  keyLimitRowLast: {
    paddingBottom: 0,
  },
  keyLimitCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.successLight,
    marginRight: 8,
  },
  keyLimitText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
  },

  chooseButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 5,
    backgroundColor: Colors.primaryTint,
    paddingVertical: 12,
    borderRadius: 11,
  },
  chooseButtonCurrent: {
    backgroundColor: Colors.surface,
  },
  chooseButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  chooseButtonTextCurrent: {
    color: Colors.textMuted,
    fontWeight: '600' as const,
  },

  premiumNote: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.primaryTint,
    borderRadius: 12,
    padding: 14,
    marginTop: 6,
  },
  premiumNoteText: {
    flex: 1,
    fontSize: 12.5,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  bottomSpacer: {
    height: 40,
  },
});
