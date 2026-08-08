import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useRouter } from 'expo-router';
import { Check, Zap, Star, Info } from 'lucide-react-native';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import EditScreenHeader from '@/components/EditScreenHeader';
import { Colors } from '@/constants/colors';
import { callable } from '@/lib/firebase';
import { Alert } from '@/utils/alert';
import {
  resolveCatalogForCountry,
  getOrderedActivePlanIds,
  fromBackendPlanId,
  formatMinorUnits,
  isFeatureAvailable,
  getFeatureDisplayValue,
  type PlanId,
  type ResolvedPlan,
} from '@/constants/planCatalog';

const ORANGE = '#FF8C42';
const CHARCOAL = '#2B2B2B';
const PAGE_BG = '#F8F9FA';
const CARD_BG = '#FFFFFF';
const SECONDARY_TEXT = '#555555';
const BORDER = '#E8E8E8';
const ORANGE_SOFT = 'rgba(255,140,66,0.10)';
const ORANGE_BORDER = 'rgba(255,140,66,0.25)';

/** Plan ids the CMS flags as "popular" in the upgrade card grid. */
const POPULAR_PLAN_IDS: PlanId[] = ['pro'];

export default function UpgradePlanScreen() {
  const router = useRouter();
  const {
    plan,
    businessCountry,
    founderPricingEligible: launchSaleEligible,
    refreshSubscriptionStatus,
  } = useVendorPlan();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [checkingOutPlan, setCheckingOutPlan] = useState<PlanId | null>(null);

  // The entire catalog, resolved for this vendor's country + launch eligibility.
  // Every plan name, price, tagline, and feature below comes from this —
  // nothing is hard-coded in this screen.
  const resolvedCatalog = useMemo(
    () => resolveCatalogForCountry(businessCountry, launchSaleEligible),
    [businessCountry, launchSaleEligible],
  );

  const orderedPlanIds = useMemo(() => getOrderedActivePlanIds(), []);
  const currentPlanId: PlanId = plan === 'pro+' ? 'pro_plus' : (plan as PlanId);

  /**
   * This used to call the local-only updatePlan() and grant the plan
   * instantly with zero payment — see frontend-subscription-alignment-scope.md
   * Section 8. Real checkout now goes through createSubscriptionCheckout,
   * which resolves the vendor's country/provider server-side and returns a
   * hosted payment page. The plan does not change here: it only changes once
   * refreshSubscriptionStatus sees the webhook-confirmed result, which is why
   * this deliberately does not navigate to username selection immediately.
   *
   * Picking a custom username is left to Manage Account (available on
   * Standard and above) rather than being force-prompted after checkout —
   * inferring "just upgraded" from a plan change is what made every
   * cold-cache sign-in redirect a paying vendor to /select-username. See the
   * note in VendorPlanContext.refreshSubscriptionStatus.
   */
  const handleUpgrade = useCallback(async (backendPlanId: PlanId) => {
    if (backendPlanId === 'basic') return;
    setCheckingOutPlan(backendPlanId);
    try {
      const planForCheckout = backendPlanId === 'pro_plus' ? 'pro_plus' : backendPlanId;
      const checkout = callable<
        { plan: string },
        { success: true; authorizationUrl: string; reference: string }
      >('createSubscriptionCheckout');
      const res = await checkout({ plan: planForCheckout });
      await Linking.openURL(res.data.authorizationUrl);
      Alert.alert(
        'Complete your payment',
        'Finish payment in the page that just opened, then come back here — your plan updates automatically once payment is confirmed.',
      );
      // Best-effort immediate check in case the webhook already landed
      // (fast providers/sandbox); otherwise the vendor's next visit to any
      // plan-gated screen picks up the real status regardless.
      await refreshSubscriptionStatus();
    } catch (error) {
      console.error('[UpgradePlan] Failed to start checkout:', error);
      const message = error instanceof Error ? error.message : 'Could not start checkout. Please try again.';
      Alert.alert('Could not start checkout', message);
    } finally {
      setCheckingOutPlan(null);
    }
  }, [refreshSubscriptionStatus]);

  const getPlanStatus = useCallback((planId: PlanId): 'current' | 'upgrade' | 'downgrade' => {
    if (planId === currentPlanId) return 'current';
    const currentIndex = orderedPlanIds.indexOf(currentPlanId);
    const targetIndex = orderedPlanIds.indexOf(planId);
    if (currentIndex === -1 || targetIndex === -1) return 'upgrade';
    return targetIndex > currentIndex ? 'upgrade' : 'downgrade';
  }, [currentPlanId, orderedPlanIds]);

  const getPlanPrice = useCallback((resolved: ResolvedPlan) => {
    if (resolved.id === 'basic') return null;
    const current = formatMinorUnits(resolved.monthlyPriceMinorUnits, resolvedCatalog.currencySymbol);
    const standard = formatMinorUnits(resolved.standardPriceMinorUnits, resolvedCatalog.currencySymbol);
    const isLaunchSale =
      resolved.pricingType === 'launch' &&
      resolved.standardPriceMinorUnits > resolved.monthlyPriceMinorUnits;
    return {
      sale: current,
      regular: standard,
      isLaunchSale,
    };
  }, [resolvedCatalog.currencySymbol]);

  const cardWidth = isTablet ? (width - 64) / 2 : '100%' as const;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Upgrade Plan" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
          showsVerticalScrollIndicator={false}
        >
          {launchSaleEligible && resolvedCatalog.launchSale.active && (
            <View style={styles.launchCard}>
              <View style={styles.launchCardLeft}>
                <Zap size={20} color={ORANGE} strokeWidth={2.5} />
              </View>
              <View style={styles.launchCardBody}>
                <View style={styles.launchBadgeRow}>
                  <View style={styles.launchBadge}>
                    <Text style={styles.launchBadgeText}>LAUNCH SALE</Text>
                  </View>
                </View>
                <Text style={styles.launchCardTitle}>Limited Time Offer</Text>
                <Text style={styles.launchCardDesc}>
                  You&apos;re eligible for launch pricing. Only available for the first{' '}
                  {resolvedCatalog.launchSale.founderCapPerCountry} vendors in{' '}
                  {resolvedCatalog.countryName}.
                </Text>
              </View>
            </View>
          )}

          <Text style={styles.sectionLabel}>Choose your plan</Text>

          <View style={[styles.cardsGrid, isTablet && styles.cardsGridTablet]}>
            {/* Every card is rendered from the resolved catalog. */}
            {orderedPlanIds.map((planId) => {
              const resolved = resolvedCatalog.plans.find((p) => p.id === planId);
              if (!resolved) return null;

              const status = getPlanStatus(planId);
              const isCurrent = status === 'current';
              const canUpgrade = status === 'upgrade';
              const isPopular = POPULAR_PLAN_IDS.includes(planId);
              const priceInfo = getPlanPrice(resolved);
              const internalPlan = fromBackendPlanId(planId);

              // Feature rows: render all available features from the catalog.
              const availableFeatures = resolved.features.filter(isFeatureAvailable);

              return (
                <View
                  key={planId}
                  testID={`plan-card-${planId}`}
                  style={[
                    styles.planCard,
                    { width: cardWidth as any },
                    isCurrent && styles.planCardCurrent,
                    isPopular && !isCurrent && styles.planCardPopular,
                  ]}
                >
                  {isPopular && (
                    <View style={styles.popularBanner}>
                      <Star size={11} color="#fff" fill="#fff" strokeWidth={0} />
                      <Text style={styles.popularBannerText}>MOST POPULAR</Text>
                    </View>
                  )}

                  <View style={styles.planHeaderRow}>
                    <Text style={[styles.planName, isPopular && !isCurrent && styles.planNamePopular]}>
                      {resolved.name}
                    </Text>
                    {isCurrent && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>CURRENT PLAN</Text>
                      </View>
                    )}
                  </View>

                  {priceInfo === null ? (
                    <Text style={styles.priceMain}>Free</Text>
                  ) : (
                    <View style={styles.priceBlock}>
                      <View style={styles.priceMainRow}>
                        <Text style={[styles.priceMain, isPopular && !isCurrent && styles.priceMainPopular]}>
                          {priceInfo.sale}
                          <Text style={styles.pricePerMonth}>/month</Text>
                        </Text>
                        {priceInfo.isLaunchSale && (
                          <View style={styles.salePill}>
                            <Text style={styles.salePillText}>Launch Sale</Text>
                          </View>
                        )}
                      </View>
                      {priceInfo.isLaunchSale && (
                        <Text style={styles.regularPrice}>
                          Regular: {priceInfo.regular}/month
                        </Text>
                      )}
                    </View>
                  )}

                  <View style={styles.divider} />

                  <View style={styles.featureList}>
                    {/* First line: "Everything in {previous plan}" — derived from catalog order. */}
                    {planId !== 'basic' && (
                      <View style={styles.featureRow}>
                        <View style={[styles.checkCircle, isPopular && !isCurrent && styles.checkCirclePopular]}>
                          <Check size={11} color="#fff" strokeWidth={3} />
                        </View>
                        <Text style={styles.featureText}>Everything in {previousPlanName(planId, resolvedCatalog.plans)}</Text>
                      </View>
                    )}
                    {availableFeatures.map((feature) => (
                      <View key={feature.id} style={styles.featureRow}>
                        <View style={[styles.checkCircle, isPopular && !isCurrent && styles.checkCirclePopular]}>
                          <Check size={11} color="#fff" strokeWidth={3} />
                        </View>
                        <Text style={styles.featureText}>
                          {getFeatureDisplayValue(feature)}
                          {feature.unit ? ` ${feature.unit}` : ''} {feature.label.toLowerCase()}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {isCurrent ? (
                    <View style={styles.disabledBtn} testID={`btn-current-${planId}`}>
                      <Text style={styles.disabledBtnText}>Your current plan</Text>
                    </View>
                  ) : canUpgrade ? (
                    <TouchableOpacity
                      style={[styles.upgradeBtn, isPopular && styles.upgradeBtnPopular, checkingOutPlan !== null && styles.upgradeBtnDisabled]}
                      onPress={() => handleUpgrade(planId)}
                      activeOpacity={0.8}
                      disabled={checkingOutPlan !== null}
                      testID={`btn-upgrade-${planId}`}
                    >
                      {checkingOutPlan === planId ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.upgradeBtnText}>Upgrade to {resolved.name}</Text>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View style={styles.footerNotice}>
            <Info size={15} color={SECONDARY_TEXT} />
            <Text style={styles.footerNoticeText}>
              Pricing shown is for {resolvedCatalog.countryName}. Changes apply immediately. Unused time is prorated.
            </Text>
          </View>

          {launchSaleEligible && resolvedCatalog.launchSale.active && (
            <View style={styles.launchDisclaimer}>
              <Text style={styles.launchDisclaimerText}>
                {resolvedCatalog.launchSale.renewsAtStandardPrice
                  ? 'Launch pricing is temporary. Subscriptions renew at standard pricing once the launch period ends.'
                  : 'Launch pricing is temporary and available for a limited time.'}
              </Text>
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** Derive the previous plan's display name from the catalog order. */
function previousPlanName(planId: PlanId, plans: ResolvedPlan[]): string {
  const order = getOrderedActivePlanIds();
  const idx = order.indexOf(planId);
  if (idx <= 0) return '';
  const prevId = order[idx - 1];
  return plans.find((p) => p.id === prevId)?.name ?? '';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  headerSafe: {
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  scrollContentTablet: {
    paddingHorizontal: 24,
  },
  errorState: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: SECONDARY_TEXT,
    textAlign: 'center' as const,
    lineHeight: 24,
  },

  launchCard: {
    backgroundColor: ORANGE_SOFT,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: ORANGE_BORDER,
    padding: 18,
    flexDirection: 'row' as const,
    gap: 14,
    marginBottom: 28,
  },
  launchCardLeft: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,140,66,0.15)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  launchCardBody: {
    flex: 1,
  },
  launchBadgeRow: {
    marginBottom: 6,
  },
  launchBadge: {
    backgroundColor: ORANGE,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    alignSelf: 'flex-start' as const,
  },
  launchBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#fff',
    letterSpacing: 0.8,
  },
  launchCardTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: CHARCOAL,
    marginBottom: 4,
  },
  launchCardDesc: {
    fontSize: 14,
    color: SECONDARY_TEXT,
    lineHeight: 20,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: SECONDARY_TEXT,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },

  cardsGrid: {
    gap: 16,
  },
  cardsGridTablet: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap',
    gap: 16,
  },

  planCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BORDER,
    padding: 22,
    overflow: 'hidden' as const,
  },
  planCardCurrent: {
    borderColor: ORANGE,
    backgroundColor: '#FFFBF7',
  },
  planCardPopular: {
    borderColor: ORANGE,
    borderWidth: 2,
  },

  popularBanner: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: ORANGE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomLeftRadius: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  popularBannerText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#fff',
    letterSpacing: 0.7,
  },

  planHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 12,
    marginTop: 4,
    flexWrap: 'wrap',
    gap: 8,
  },
  planName: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: CHARCOAL,
  },
  planNamePopular: {
    color: ORANGE,
  },

  currentBadge: {
    backgroundColor: 'rgba(255,140,66,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: ORANGE,
    letterSpacing: 0.5,
  },

  priceBlock: {
    marginBottom: 4,
  },
  priceMainRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    flexWrap: 'wrap',
  },
  priceMain: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: CHARCOAL,
  },
  priceMainPopular: {
    color: ORANGE,
  },
  pricePerMonth: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: SECONDARY_TEXT,
  },
  salePill: {
    backgroundColor: ORANGE_SOFT,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ORANGE_BORDER,
  },
  salePillText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: ORANGE,
  },
  regularPrice: {
    fontSize: 13,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginTop: 4,
  },

  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 18,
  },

  featureList: {
    gap: 11,
    marginBottom: 22,
  },
  featureRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: ORANGE,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
    marginTop: 1,
  },
  checkCirclePopular: {
    backgroundColor: ORANGE,
  },
  featureText: {
    fontSize: 14,
    color: CHARCOAL,
    flex: 1,
    lineHeight: 20,
  },

  upgradeBtn: {
    backgroundColor: ORANGE,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center' as const,
  },
  upgradeBtnDisabled: {
    opacity: 0.6,
  },
  upgradeBtnPopular: {
    backgroundColor: ORANGE,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  upgradeBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  disabledBtn: {
    backgroundColor: 'transparent',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center' as const,
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  disabledBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#9CA3AF',
  },

  footerNotice: {
    flexDirection: 'row' as const,
    gap: 10,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
    marginTop: 24,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'flex-start' as const,
  },
  footerNoticeText: {
    flex: 1,
    fontSize: 13,
    color: SECONDARY_TEXT,
    lineHeight: 20,
  },
  launchDisclaimer: {
    marginTop: 12,
    paddingHorizontal: 4,
  },
  launchDisclaimerText: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 18,
    textAlign: 'center' as const,
  },
  bottomSpacer: {
    height: 48,
  },
});
