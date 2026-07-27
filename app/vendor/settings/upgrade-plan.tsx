import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Check, Zap, Star, Info } from 'lucide-react-native';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import { getPricingForCountry, formatPrice } from '@/constants/vendorPricing';

const ORANGE = '#FF8C42';
const CHARCOAL = '#2B2B2B';
const PAGE_BG = '#F8F9FA';
const CARD_BG = '#FFFFFF';
const SECONDARY_TEXT = '#555555';
const BORDER = '#E8E8E8';
const ORANGE_SOFT = 'rgba(255,140,66,0.10)';
const ORANGE_BORDER = 'rgba(255,140,66,0.25)';

interface PlanConfig {
  id: 'basic' | 'standard' | 'pro' | 'pro+';
  name: string;
  isPopular: boolean;
  features: string[];
}

const PLAN_CONFIGS: PlanConfig[] = [
  {
    id: 'basic',
    name: 'Basic',
    isPopular: false,
    features: [
      'System-generated @username',
      'Vendor storefront',
      'Menu creation',
      'Order requests',
      'Manual order acceptance',
      'Manual payment confirmation',
      'Customer order chat',
      'Optional inquiry chat',
    ],
  },
  {
    id: 'standard',
    name: 'Standard',
    isPopular: false,
    features: [
      'Everything in Basic',
      'Custom @username',
      'Basic order receipts',
      'Order status management',
      'Manual payment requests',
      'Inventory tracking',
      'Basic monthly sales reports',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    isPopular: true,
    features: [
      'Everything in Standard',
      'Invoice generation',
      'Auto-accept pickup orders',
      'Auto-send pickup details',
      'Partial payment support',
      'Basic order automation rules',
      'Advanced order management tools',
    ],
  },
  {
    id: 'pro+',
    name: 'Pro+',
    isPopular: false,
    features: [
      'Everything in Pro',
      'Advanced rule-based automation',
      'Inventory-aware automation',
      'Time-based automation rules',
      'Priority support',
      'Early access to new features',
    ],
  },
];

export default function UpgradePlanScreen() {
  const { plan, businessCountry, founderPricingEligible: launchSaleEligible, updatePlan } = useVendorPlan();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const countryPricing = getPricingForCountry(businessCountry);

  const handleUpgrade = useCallback(async (newPlan: 'standard' | 'pro' | 'pro+') => {
    try {
      console.log('[UpgradePlan] Upgrading to:', newPlan);
      const wasBasic = plan === 'basic';
      await updatePlan(newPlan);
      if (wasBasic) {
        console.log('[UpgradePlan] Upgraded from Basic, redirecting to username selection');
        router.replace('/vendor/settings/select-username');
      } else {
        router.back();
      }
    } catch (error) {
      console.error('[UpgradePlan] Failed to upgrade plan:', error);
    }
  }, [plan, updatePlan]);

  const getPlanStatus = useCallback((planId: 'basic' | 'standard' | 'pro' | 'pro+') => {
    if (planId === plan) return 'current';
    const planOrder = ['basic', 'standard', 'pro', 'pro+'];
    const currentIndex = planOrder.indexOf(plan);
    const targetIndex = planOrder.indexOf(planId);
    return targetIndex > currentIndex ? 'upgrade' : 'downgrade';
  }, [plan]);

  const getPlanPrice = useCallback((planId: 'basic' | 'standard' | 'pro' | 'pro+') => {
    if (!countryPricing || planId === 'basic') return null;
    const pricing =
      planId === 'standard'
        ? countryPricing.standard
        : planId === 'pro'
        ? countryPricing.pro
        : countryPricing.proPlus;
    const salePrice = launchSaleEligible ? pricing.founder : pricing.regular;
    const regularPrice = pricing.regular;
    return {
      sale: formatPrice(salePrice, countryPricing.currencySymbol),
      regular: formatPrice(regularPrice, countryPricing.currencySymbol),
      isLaunchSale: launchSaleEligible && salePrice < regularPrice,
    };
  }, [countryPricing, launchSaleEligible]);

  if (!countryPricing) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Upgrade Plan', headerTitleAlign: 'center', headerStyle: { backgroundColor: PAGE_BG }, headerTintColor: CHARCOAL, headerShadowVisible: false }} />
        <View style={styles.errorState}>
          <Text style={styles.errorText}>Pricing is not available for your country yet.</Text>
        </View>
      </View>
    );
  }

  const cardWidth = isTablet ? (width - 64) / 2 : '100%' as const;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Upgrade Plan',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: PAGE_BG },
          headerTintColor: CHARCOAL,
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
          showsVerticalScrollIndicator={false}
        >
          {launchSaleEligible && (
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
                  You&apos;re eligible for launch pricing. Only available for the first 300 vendors in {businessCountry}.
                </Text>
              </View>
            </View>
          )}

          <Text style={styles.sectionLabel}>Choose your plan</Text>

          <View style={[styles.cardsGrid, isTablet && styles.cardsGridTablet]}>
            {PLAN_CONFIGS.map((config) => {
              const status = getPlanStatus(config.id);
              const isCurrent = status === 'current';
              const canUpgrade = status === 'upgrade';
              const priceInfo = getPlanPrice(config.id);

              return (
                <View
                  key={config.id}
                  testID={`plan-card-${config.id}`}
                  style={[
                    styles.planCard,
                    { width: cardWidth as any },
                    isCurrent && styles.planCardCurrent,
                    config.isPopular && !isCurrent && styles.planCardPopular,
                  ]}
                >
                  {config.isPopular && (
                    <View style={styles.popularBanner}>
                      <Star size={11} color="#fff" fill="#fff" strokeWidth={0} />
                      <Text style={styles.popularBannerText}>MOST POPULAR</Text>
                    </View>
                  )}

                  <View style={styles.planHeaderRow}>
                    <Text style={[styles.planName, config.isPopular && !isCurrent && styles.planNamePopular]}>
                      {config.name}
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
                        <Text style={[styles.priceMain, config.isPopular && !isCurrent && styles.priceMainPopular]}>
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
                    {config.features.map((feature, idx) => (
                      <View key={idx} style={styles.featureRow}>
                        <View style={[styles.checkCircle, config.isPopular && !isCurrent && styles.checkCirclePopular]}>
                          <Check size={11} color="#fff" strokeWidth={3} />
                        </View>
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>

                  {isCurrent ? (
                    <View style={styles.disabledBtn} testID={`btn-current-${config.id}`}>
                      <Text style={styles.disabledBtnText}>Your current plan</Text>
                    </View>
                  ) : canUpgrade ? (
                    <TouchableOpacity
                      style={[styles.upgradeBtn, config.isPopular && styles.upgradeBtnPopular]}
                      onPress={() => handleUpgrade(config.id as 'standard' | 'pro' | 'pro+')}
                      activeOpacity={0.8}
                      testID={`btn-upgrade-${config.id}`}
                    >
                      <Text style={styles.upgradeBtnText}>Upgrade to {config.name}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View style={styles.footerNotice}>
            <Info size={15} color={SECONDARY_TEXT} />
            <Text style={styles.footerNoticeText}>
              Pricing shown is for {businessCountry}. Changes apply immediately. Unused time is prorated.
            </Text>
          </View>

          {launchSaleEligible && (
            <View style={styles.launchDisclaimer}>
              <Text style={styles.launchDisclaimerText}>
                Launch pricing is temporary. Subscriptions renew at standard pricing once the launch period ends.
              </Text>
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: SECONDARY_TEXT,
    textAlign: 'center',
    lineHeight: 24,
  },

  launchCard: {
    backgroundColor: ORANGE_SOFT,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: ORANGE_BORDER,
    padding: 18,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 28,
  },
  launchCardLeft: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,140,66,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
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
    alignSelf: 'flex-start',
  },
  launchBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.8,
  },
  launchCardTitle: {
    fontSize: 17,
    fontWeight: '700',
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
    fontWeight: '600',
    color: SECONDARY_TEXT,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },

  cardsGrid: {
    gap: 16,
  },
  cardsGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },

  planCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BORDER,
    padding: 22,
    overflow: 'hidden',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  popularBannerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.7,
  },

  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
    flexWrap: 'wrap',
    gap: 8,
  },
  planName: {
    fontSize: 22,
    fontWeight: '800',
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
    fontWeight: '800',
    color: ORANGE,
    letterSpacing: 0.5,
  },

  priceBlock: {
    marginBottom: 4,
  },
  priceMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  priceMain: {
    fontSize: 26,
    fontWeight: '800',
    color: CHARCOAL,
  },
  priceMainPopular: {
    color: ORANGE,
  },
  pricePerMonth: {
    fontSize: 15,
    fontWeight: '500',
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
    fontWeight: '700',
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
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
    alignItems: 'center',
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
    fontWeight: '700',
    color: '#fff',
  },
  disabledBtn: {
    backgroundColor: 'transparent',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  disabledBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9CA3AF',
  },

  footerNotice: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 14,
    marginTop: 24,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'flex-start',
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
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 48,
  },
});
