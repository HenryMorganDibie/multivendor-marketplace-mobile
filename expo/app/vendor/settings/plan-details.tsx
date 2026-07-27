import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Check, Minus } from 'lucide-react-native';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import EditScreenHeader from '@/components/EditScreenHeader';
import { Colors } from '@/constants/colors';
import {
  buildVendorSubscription,
  formatMinorUnits,
  getFeaturesByCategory,
  getFeatureDisplayValue,
  isFeatureAvailable,
  CATEGORY_TITLES,
  CATEGORY_ORDER,
  type ResolvedFeature,
} from '@/constants/planCatalog';

const MAX_CONTENT_WIDTH = 720;

export default function PlanDetailsScreen() {
  const router = useRouter();
  const {
    plan,
    businessCountry,
    founderPricingEligible,
    cancellationScheduled,
    cancellationDate,
  } = useVendorPlan();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 640;
  const contentMaxWidth = Math.min(screenWidth - 32, MAX_CONTENT_WIDTH);

  const subscription = useMemo(
    () =>
      buildVendorSubscription({
        plan,
        businessCountry,
        founderPricingEligible,
        cancellationScheduled,
        cancellationDate,
      }),
    [plan, businessCountry, founderPricingEligible, cancellationScheduled, cancellationDate],
  );

  // Price label and every feature line below come from the catalog — nothing
  // is hard-coded in this screen.
  const priceLabel =
    plan === 'basic'
      ? 'Free'
      : `${formatMinorUnits(subscription.currentPriceMinorUnits, subscription.currencySymbol)}/month`;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Plan features" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.scrollContent, isWide && { alignSelf: 'center', width: contentMaxWidth }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Plan header */}
          <View style={styles.planHeaderCard}>
            <View style={styles.planHeaderRow}>
              <Text style={styles.planHeaderName}>{subscription.planName}</Text>
              <Text style={styles.planHeaderPrice}>{priceLabel}</Text>
            </View>
            <Text style={styles.planHeaderTagline}>{subscription.tagline}</Text>
          </View>

          {/* Categorized entitlements, all rendered from subscription.features */}
          {CATEGORY_ORDER.map((categoryId) => {
            const lines = getFeaturesByCategory(subscription.features, categoryId);
            if (lines.length === 0) return null;
            return (
              <View key={categoryId} style={styles.categorySection}>
                <Text style={styles.categoryTitle}>{CATEGORY_TITLES[categoryId]}</Text>
                <View style={styles.categoryCard}>
                  {lines.map((line, index) => (
                    <EntitlementLineRow
                      key={line.id}
                      line={line}
                      isLast={index === lines.length - 1}
                    />
                  ))}
                </View>
              </View>
            );
          })}

          {/* Removed features note */}
          <View style={styles.removedNote}>
            <Text style={styles.removedNoteText}>
              Print/PDF formatting applies automatically when an invoice is downloaded or printed.
            </Text>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function EntitlementLineRow({ line, isLast }: { line: ResolvedFeature; isLast: boolean }) {
  const isIncluded = isFeatureAvailable(line);
  const displayValue = getFeatureDisplayValue(line);
  return (
    <View style={[styles.lineRow, isLast && styles.lineRowLast]}>
      <View style={[styles.lineCheck, !isIncluded && styles.lineCheckUnavailable]}>
        {isIncluded ? (
          <Check size={12} color={Colors.success} strokeWidth={3} />
        ) : (
          <Minus size={12} color={Colors.textMuted} strokeWidth={2.5} />
        )}
      </View>
      <Text style={[styles.lineLabel, !isIncluded && styles.lineLabelUnavailable]}>{line.label}</Text>
      <Text style={[styles.lineValue, !isIncluded && styles.lineValueUnavailable]} numberOfLines={2}>
        {displayValue}
        {line.unit ? ` ${line.unit}` : ''}
      </Text>
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

  planHeaderCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  planHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 6,
  },
  planHeaderName: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  planHeaderPrice: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  planHeaderTagline: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    lineHeight: 19,
  },

  categorySection: {
    marginTop: 22,
  },
  categoryTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  categoryCard: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  lineRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSoft,
    gap: 10,
  },
  lineRowLast: {
    borderBottomWidth: 0,
  },
  lineCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.successLight,
  },
  lineCheckUnavailable: {
    backgroundColor: Colors.surface,
  },
  lineLabel: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  lineLabelUnavailable: {
    color: Colors.textMuted,
  },
  lineValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'right' as const,
    flexShrink: 1,
  },
  lineValueUnavailable: {
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },

  removedNote: {
    marginTop: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: 10,
  },
  removedNoteText: {
    fontSize: 12.5,
    color: Colors.textMuted,
    lineHeight: 18,
    textAlign: 'center' as const,
  },

  bottomSpacer: {
    height: 40,
  },
});
