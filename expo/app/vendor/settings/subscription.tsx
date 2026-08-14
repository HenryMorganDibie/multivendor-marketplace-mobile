import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useRouter } from 'expo-router';
import {
  Check,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  CalendarClock,
  TrendingUp,
} from 'lucide-react-native';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import LaektivaModal from '@/components/LaektivaModal';
import EditScreenHeader from '@/components/EditScreenHeader';
import { Colors } from '@/constants/colors';
import {
  buildVendorSubscription,
  formatMinorUnits,
  formatSubscriptionDate,
  getHighlightFeatures,
  getFeatureDisplayValue,
  isFeatureAvailable,
  type PaymentStatus,
  type VendorSubscription,
} from '@/constants/planCatalog';
import { openVendorPortalHandoff } from '@/utils/openVendorPortal';

const MAX_CONTENT_WIDTH = 680;

export default function SubscriptionPlanScreen() {
  const routerNav = useRouter();
  const {
    plan,
    businessCountry,
    founderPricingEligible: launchSaleEligible,
    isLoading,
    cancellationScheduled,
    cancellationDate,
    scheduleCancellation,
    subscriptionReason,
  } = useVendorPlan();

  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 640;
  const contentMaxWidth = Math.min(screenWidth - 32, MAX_CONTENT_WIDTH);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Was a hardcoded 'ok' with no setter ever called — a vendor whose
  // subscription was genuinely in grace_period or past_due (real backend
  // reason from getSubscriptionStatus) would always see "payment status: ok"
  // here, hiding an actual billing problem from them.
  const paymentStatusOverride: PaymentStatus = useMemo(() => {
    if (subscriptionReason === 'grace_period') return 'grace';
    if (subscriptionReason === 'expired_or_other') return 'past_due';
    return 'ok';
  }, [subscriptionReason]);

  const subscription = useMemo(
    () =>
      buildVendorSubscription({
        plan,
        businessCountry,
        founderPricingEligible: launchSaleEligible,
        cancellationScheduled,
        cancellationDate,
        paymentStatusOverride,
      }),
    [plan, businessCountry, launchSaleEligible, cancellationScheduled, cancellationDate, paymentStatusOverride],
  );

  // Benefits snapshot comes entirely from the catalog's highlightFeatureIds —
  // no feature labels, prices, or limits are hard-coded in this screen.
  const highlightFeatures = useMemo(
    () => getHighlightFeatures(subscription),
    [subscription],
  );

  const isBasic = plan === 'basic';
  const isPaid = !isBasic;
  const isLaunchPricing = subscription.pricingType === 'launch';
  const showStandardTransition =
    isLaunchPricing && isPaid && subscription.standardPriceMinorUnits > subscription.currentPriceMinorUnits;

  const periodEndLabel = formatSubscriptionDate(subscription.currentPeriodEnd);
  // Basic already shows "Free plan" as its status badge (getStatusBadge
  // below) — repeating "Free" again as the price line under it read as a
  // mistake, not emphasis. Empty string here, guarded to not render at all,
  // rather than a second copy of the same word.
  const currentPriceLabel = isPaid
    ? `${formatMinorUnits(subscription.currentPriceMinorUnits, subscription.currencySymbol)}/month`
    : '';

  const handleScheduleCancellation = async () => {
    try {
      setIsSubmitting(true);
      await scheduleCancellation();
      setShowCancelModal(false);
    } catch (error) {
      console.error('Failed to schedule cancellation:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <EditScreenHeader title="Subscription" onBack={() => routerNav.back()} showSave={false} />
        </SafeAreaView>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Subscription" onBack={() => routerNav.back()} showSave={false} />
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.scrollContent, isWide && { alignSelf: 'center', width: contentMaxWidth }]}
          showsVerticalScrollIndicator={false}
        >
          {/* CURRENT PLAN CARD */}
          <CurrentPlanCard
            planName={subscription.planName}
            status={subscription.status}
            priceLabel={currentPriceLabel}
            isLaunchPricing={isLaunchPricing}
            periodEndLabel={isPaid ? periodEndLabel : undefined}
            businessArea={subscription.countryName}
          />

          {/* PAYMENT NEEDS ATTENTION (grace / failed) */}
          {(subscription.paymentStatus === 'grace' || subscription.paymentStatus === 'failed') && (
            <View style={styles.paymentAlert}>
              <View style={styles.paymentAlertHeader}>
                <AlertCircle size={16} color={Colors.error} />
                <Text style={styles.paymentAlertTitle}>Payment needs attention</Text>
              </View>
              <Text style={styles.paymentAlertBody}>
                {subscription.paymentStatus === 'grace'
                  ? 'Update your payment details before the grace period ends to avoid losing paid-plan features.'
                  : 'Your payment method could not be charged. Update your payment details to restore paid-plan features.'}
              </Text>
              <TouchableOpacity
                style={styles.paymentAlertButton}
                onPress={() => openVendorPortalHandoff('/subscription')}
                activeOpacity={0.8}
              >
                <Text style={styles.paymentAlertButtonText}>Fix payment on the web</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* CANCELLATION SCHEDULED */}
          {subscription.status === 'cancel_scheduled' && (
            <View style={styles.cancelScheduledBanner}>
              <View style={styles.cancelScheduledHeader}>
                <CalendarClock size={16} color={Colors.textSecondary} />
                <Text style={styles.cancelScheduledTitle}>Cancellation scheduled</Text>
              </View>
              <Text style={styles.cancelScheduledBody}>
                Your {subscription.planName} plan remains active until {periodEndLabel}. After that, your
                account will move to Basic unless you resume the subscription.
              </Text>
            </View>
          )}

          {/* PAST DUE / EXPIRED */}
          {(subscription.status === 'past_due' || subscription.status === 'expired') && (
            <View style={styles.cancelScheduledBanner}>
              <View style={styles.cancelScheduledHeader}>
                <AlertCircle size={16} color={Colors.warning} />
                <Text style={styles.cancelScheduledTitle}>
                  {subscription.status === 'expired' ? 'Subscription expired' : 'Payment past due'}
                </Text>
              </View>
              <Text style={styles.cancelScheduledBody}>
                You still have Basic-plan access. Renew or choose another plan to restore paid features.
              </Text>
            </View>
          )}

          {/* MANAGE BILLING ON THE WEB */}
          <View style={styles.portalSection}>
            <Text style={styles.portalTitle}>Manage billing on the web</Text>
            <Text style={styles.portalBody}>
              Subscription payments, plan changes and billing details are managed securely through the
              the platform Vendor Portal.
            </Text>
            <TouchableOpacity
              style={styles.portalPrimaryButton}
              onPress={() => openVendorPortalHandoff('/subscription')}
              activeOpacity={0.85}
            >
              <ExternalLink size={16} color={Colors.primaryText} />
              <Text style={styles.portalPrimaryButtonText}>
                {isBasic ? 'View plans on the web' : 'Open Vendor Portal'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.portalHint}>You'll leave the app to manage your subscription securely.</Text>
          </View>

          {/* SECONDARY ACTION — view other plans (paid only) */}
          {isPaid && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/vendor/settings/available-plans' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>View other plans</Text>
              <ChevronRight size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}

          {/* LAUNCH PRICING NOTICE — accessible contrast */}
          {isLaunchPricing && isPaid && (
            <View style={styles.launchNotice}>
              <Text style={styles.launchNoticeTitle}>Launch pricing active</Text>
              <Text style={styles.launchNoticeBody}>
                You are currently paying{' '}
                {formatMinorUnits(subscription.currentPriceMinorUnits, subscription.currencySymbol)}
                /month. Your next renewal is {periodEndLabel}.
                {showStandardTransition
                  ? ' This changes to the standard price after the launch period.'
                  : ''}
              </Text>
            </View>
          )}

          {/* PLAN USAGE — top 3–4 limits */}
          {subscription.usage.length > 0 && (
            <UsageSection subscription={subscription} />
          )}

          {/* YOUR PLAN BENEFITS — snapshot, rendered from the catalog */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your {subscription.planName} benefits</Text>
            <View style={styles.featuresCard}>
              {highlightFeatures.map((feature, index) => (
                <View
                  key={feature.id}
                  style={[styles.featureRow, index === highlightFeatures.length - 1 && styles.featureRowLast]}
                >
                  <View style={styles.featureCheck}>
                    <Check size={12} color={Colors.success} strokeWidth={3} />
                  </View>
                  <Text style={styles.featureText}>
                    {getFeatureDisplayValue(feature)}
                    {feature.unit ? ` ${feature.unit}` : ''} {feature.label.toLowerCase()}
                  </Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => router.push('/vendor/settings/plan-details' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.viewAllButtonText}>View all plan features</Text>
              <ChevronRight size={16} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {/* CANCEL SUBSCRIPTION — low-emphasis destructive, paid only */}
          {isPaid && subscription.status !== 'cancel_scheduled' && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowCancelModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel subscription</Text>
            </TouchableOpacity>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      {/* CANCEL CONFIRMATION — routes final cancellation to the vendor portal */}
      <LaektivaModal
        visible={showCancelModal}
        title={`Cancel ${subscription.planName} subscription?`}
        message={`Your plan will remain active until ${periodEndLabel}. After that date, your account will move to Basic and paid-plan limits will apply.`}
        customContent={
          <View style={styles.modalInfo}>
            <Text style={styles.modalInfoText}>• Paid features stay active until {periodEndLabel}.</Text>
            <Text style={styles.modalInfoText}>• Your account moves to the Basic plan afterward.</Text>
            <Text style={styles.modalInfoText}>• Historical data is subject to the new plan's history limits.</Text>
            <Text style={styles.modalInfoText}>• Any pending downgrade request is replaced by this cancellation.</Text>
            <Text style={styles.modalInfoText}>• Your @username remains unchanged.</Text>
          </View>
        }
        primaryButton={{
          label: 'Keep Pro+',
          onPress: () => setShowCancelModal(false),
        }}
        secondaryButton={{
          label: isSubmitting ? 'Opening…' : 'Continue to Vendor Portal',
          onPress: async () => {
            await handleScheduleCancellation();
            void openVendorPortalHandoff('/subscription');
          },
        }}
        destructive
        onRequestClose={() => setShowCancelModal(false)}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Current plan summary card                                                  */
/* -------------------------------------------------------------------------- */

function CurrentPlanCard({
  planName,
  status,
  priceLabel,
  isLaunchPricing,
  periodEndLabel,
  businessArea,
}: {
  planName: string;
  status: 'active' | 'cancel_scheduled' | 'past_due' | 'expired' | 'basic';
  priceLabel: string;
  isLaunchPricing: boolean;
  periodEndLabel?: string;
  businessArea: string;
}) {
  const statusBadge = getStatusBadge(status);
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTopRow}>
        <View style={styles.summaryLeft}>
          <View style={styles.planNameRow}>
            <Text style={styles.planName}>{planName}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
              {statusBadge.dot && <View style={[styles.statusDot, { backgroundColor: statusBadge.dot }]} />}
              <Text style={[styles.statusText, { color: statusBadge.color }]}>{statusBadge.label}</Text>
            </View>
          </View>
          {priceLabel !== '' && <Text style={styles.priceText}>{priceLabel}</Text>}
          {isLaunchPricing && (
            <View style={styles.launchPill}>
              <Text style={styles.launchPillText}>Launch price</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.summarySupporting}>
        {periodEndLabel && (
          <View style={styles.supportingRow}>
            <Text style={styles.supportingLabel}>Renews</Text>
            <Text style={styles.supportingValue}>{periodEndLabel}</Text>
          </View>
        )}
        <View style={styles.supportingRow}>
          <Text style={styles.supportingLabel}>Business area</Text>
          <Text style={styles.supportingValue}>{businessArea}</Text>
        </View>
      </View>
    </View>
  );
}

function getStatusBadge(status: 'active' | 'cancel_scheduled' | 'past_due' | 'expired' | 'basic'): {
  label: string;
  bg: string;
  color: string;
  dot?: string;
} {
  switch (status) {
    case 'active':
      return { label: 'Active', bg: Colors.successLight, color: Colors.success, dot: Colors.success };
    case 'cancel_scheduled':
      return { label: 'Cancellation scheduled', bg: Colors.surface, color: Colors.textSecondary };
    case 'past_due':
      return { label: 'Past due', bg: Colors.warningLight, color: Colors.warning, dot: Colors.warning };
    case 'expired':
      return { label: 'Expired', bg: Colors.errorLight, color: Colors.error, dot: Colors.error };
    case 'basic':
    default:
      return { label: 'Free plan', bg: Colors.surface, color: Colors.textSecondary };
  }
}

/* -------------------------------------------------------------------------- */
/* Usage section                                                              */
/* -------------------------------------------------------------------------- */

function UsageSection({ subscription }: { subscription: VendorSubscription }) {
  const topMetrics = subscription.usage.slice(0, 4);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Plan usage</Text>
        <TrendingUp size={14} color={Colors.textMuted} />
      </View>
      <View style={styles.usageCard}>
        {topMetrics.map((metric, index) => {
          const ratio = metric.limit > 0 ? metric.current / metric.limit : 0;
          const barColor = ratio >= 0.9 ? Colors.error : ratio >= 0.7 ? Colors.warning : Colors.primary;
          return (
            <View
              key={metric.featureId}
              style={[styles.usageRow, index === topMetrics.length - 1 && styles.usageRowLast]}
            >
              <View style={styles.usageLabelRow}>
                <Text style={styles.usageLabel}>{metric.label}</Text>
                <Text style={styles.usageValue}>
                  {metric.current} / {metric.limit}
                </Text>
              </View>
              <View style={styles.usageBarTrack}>
                <View
                  style={[styles.usageBarFill, { width: `${Math.min(ratio * 100, 100)}%`, backgroundColor: barColor }]}
                />
              </View>
            </View>
          );
        })}
      </View>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  loadingText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexGrow: 1,
  },

  /* Current plan card */
  summaryCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
  },
  summaryLeft: {
    flex: 1,
  },
  planNameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 6,
  },
  planName: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  priceText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  launchPill: {
    alignSelf: 'flex-start' as const,
    backgroundColor: Colors.primaryTint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  launchPillText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.primary,
    letterSpacing: 0.2,
  },
  summarySupporting: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    gap: 8,
  },
  supportingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  supportingLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  supportingValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
  },

  /* Payment alert */
  paymentAlert: {
    backgroundColor: Colors.errorLight,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  paymentAlertHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    marginBottom: 6,
  },
  paymentAlertTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.error,
  },
  paymentAlertBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  paymentAlertButton: {
    alignSelf: 'flex-start' as const,
    backgroundColor: Colors.error,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9,
  },
  paymentAlertButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.white,
  },

  /* Cancellation scheduled / past due banner */
  cancelScheduledBanner: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelScheduledHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    marginBottom: 6,
  },
  cancelScheduledTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  cancelScheduledBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  /* Portal section */
  portalSection: {
    marginTop: 20,
  },
  portalTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 5,
  },
  portalBody: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  portalPrimaryButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  portalPrimaryButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primaryText,
  },
  portalHint: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginTop: 9,
    lineHeight: 16,
  },

  secondaryButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    backgroundColor: Colors.background,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.borderDark,
  },
  secondaryButtonText: {
    fontSize: 14.5,
    fontWeight: '600' as const,
    color: Colors.text,
  },

  /* Launch pricing notice */
  launchNotice: {
    backgroundColor: Colors.primaryTint,
    borderRadius: 12,
    padding: 14,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#FFD9B8',
  },
  launchNoticeTitle: {
    fontSize: 13.5,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  launchNoticeBody: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  /* Sections */
  section: {
    marginTop: 22,
  },
  sectionHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 10,
    paddingHorizontal: 2,
  },

  /* Features card */
  featuresCard: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  featureRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 7,
  },
  featureRowLast: {
    paddingBottom: 0,
  },
  featureCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.successLight,
    marginRight: 10,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  viewAllButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 5,
    marginTop: 10,
    paddingVertical: 10,
  },
  viewAllButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },

  /* Usage */
  usageCard: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  usageRow: {
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSoft,
  },
  usageRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  usageLabelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 6,
  },
  usageLabel: {
    fontSize: 13.5,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  usageValue: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
    fontVariant: ['tabular-nums'] as const,
  },
  usageBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surface,
    overflow: 'hidden' as const,
  },
  usageBarFill: {
    height: '100%' as const,
    borderRadius: 2,
  },

  /* Cancel — low-emphasis destructive */
  cancelButton: {
    alignSelf: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 24,
    minHeight: 44,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.error,
  },

  /* Modal */
  modalInfo: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  modalInfoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 4,
  },

  bottomSpacer: {
    height: 40,
  },
});
