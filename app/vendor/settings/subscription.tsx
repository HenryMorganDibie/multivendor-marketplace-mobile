import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import LaektivaModal from '@/components/LaektivaModal';
import { getPricingForCountry, formatPrice } from '@/constants/vendorPricing';
import { Colors } from '@/constants/colors';

const PLAN_FEATURES: Record<string, string[]> = {
  basic: [
    'System-generated @username (read-only)',
    'Vendor storefront',
    'Menu creation',
    'Order requests',
    'Manual order acceptance',
    'Manual payment confirmation',
    'Chat (if enabled)',
  ],
  standard: [
    'Everything in Basic',
    'Custom @username (one-time)',
    'Receipts (non-branded)',
    'Order status management',
    'Manual payment requests',
    'Monthly reports (read-only)',
  ],
  pro: [
    'Everything in Standard',
    'Invoices (non-branded)',
    'Auto-accept orders (pickup only)',
    'Auto-send pickup details',
    'Partial payment support',
    'Order automation (basic rules)',
    'Advanced order controls',
  ],
  'pro+': [
    'Everything in Pro',
    'Advanced rule-based automation',
    'Inventory-aware automation',
    'Time-based automation windows',
    'Priority support',
    'Early access to future features',
  ],
};

const PLAN_NAMES: Record<string, string> = {
  basic: 'Basic',
  standard: 'Standard',
  pro: 'Pro',
  'pro+': 'Pro+',
};

export default function SubscriptionPlanScreen() {
  const { plan, businessCountry, founderPricingEligible: launchSaleEligible, isLoading, cancellationScheduled, cancellationDate, scheduleCancellation, cancelScheduledCancellation } = useVendorPlan();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatDate = (daysFromNow: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

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

  const countryPricing = getPricingForCountry(businessCountry);
  
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Manage Subscription',
            headerTitleAlign: 'center',
            headerStyle: { backgroundColor: Colors.background },
            headerTintColor: Colors.charcoal,
            headerShadowVisible: false,
          }}
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }
  
  if (!countryPricing) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Manage Subscription',
            headerTitleAlign: 'center',
            headerStyle: { backgroundColor: Colors.background },
            headerTintColor: Colors.charcoal,
            headerShadowVisible: false,
          }}
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Pricing not available for your country</Text>
        </View>
      </View>
    );
  }

  const planFeatures = PLAN_FEATURES[plan] || PLAN_FEATURES.basic;
  const planName = PLAN_NAMES[plan] || 'Basic';
  
  const getPlanPrice = () => {
    if (plan === 'basic') return null;
    
    const pricing = plan === 'standard' 
      ? countryPricing.standard 
      : plan === 'pro' 
      ? countryPricing.pro 
      : countryPricing.proPlus;
    
    const price = launchSaleEligible ? pricing.founder : pricing.regular;
    return formatPrice(price, countryPricing.currencySymbol);
  };
  
  const currentPrice = getPlanPrice();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Manage Subscription',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.charcoal,
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <View style={styles.glassCard}>
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{planName}</Text>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeText}>Active</Text>
                </View>
              </View>

              {plan !== 'basic' && currentPrice && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Price:</Text>
                  <View style={styles.priceContainer}>
                    <Text style={styles.infoValue}>{currentPrice}/month</Text>
                    {launchSaleEligible && (
                      <View style={styles.launchBadge}>
                        <Text style={styles.launchText}>LAUNCH SALE</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
              
              {plan !== 'basic' && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Next billing date:</Text>
                  <Text style={styles.infoValue}>{formatDate(30)}</Text>
                </View>
              )}
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Business Area:</Text>
                <Text style={styles.infoValue}>{businessCountry}</Text>
              </View>
            </View>
          </View>

          {cancellationScheduled && cancellationDate && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>
                Subscription will end on {new Date(cancellationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.
              </Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>INCLUDED FEATURES</Text>
            <View style={styles.glassCard}>
              {planFeatures.map((feature, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.featureRow,
                    index === planFeatures.length - 1 && styles.featureRowLast
                  ]}
                >
                  <View style={styles.featureBullet} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>

          {launchSaleEligible && plan !== 'basic' && (
            <View style={styles.launchNotice}>
              <Text style={styles.launchNoticeText}>
                You have launch sale pricing. Subscriptions renew at standard pricing once the launch period ends.
              </Text>
            </View>
          )}
          
          {(plan === 'basic' || (plan !== 'pro+' && !cancellationScheduled)) && (
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => router.push('/vendor/settings/upgrade-plan' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.upgradeButtonText}>
                {plan === 'basic' ? 'View Paid Plans' : 'Upgrade Plan'}
              </Text>
            </TouchableOpacity>
          )}

          {plan !== 'basic' && (
            cancellationScheduled ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={async () => {
                  try {
                    setIsSubmitting(true);
                    await cancelScheduledCancellation();
                  } catch (error) {
                    console.error('Failed to reactivate subscription:', error);
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                activeOpacity={0.8}
                disabled={isSubmitting}
              >
                <Text style={styles.secondaryButtonText}>
                  {isSubmitting ? 'Processing...' : 'Keep Subscription'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setShowCancelModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryButtonText}>Cancel Subscription</Text>
              </TouchableOpacity>
            )
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <LaektivaModal
        visible={showCancelModal}
        title="Cancel Subscription?"
        message="Your subscription will remain active until the end of your current billing period. After that, paid features will be disabled and your account will move to the Basic plan. Your custom @username will remain unchanged."
        customContent={
          <View style={styles.modalInfo}>
            <Text style={styles.modalInfoText}>• Your @username remains permanent</Text>
            <Text style={styles.modalInfoText}>• No refunds for unused time</Text>
            <Text style={styles.modalInfoText}>• Existing orders remain accessible</Text>
            <Text style={styles.modalInfoText}>• You can upgrade again at any time</Text>
          </View>
        }
        primaryButton={{
          label: 'Keep Subscription',
          onPress: () => setShowCancelModal(false),
        }}
        secondaryButton={{
          label: isSubmitting ? 'Processing...' : 'Schedule Cancellation',
          onPress: handleScheduleCancellation,
        }}
        onRequestClose={() => setShowCancelModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  glassCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
  },
  planHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 20,
  },
  planName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  activeBadge: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  activeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  infoRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  priceContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  launchBadge: {
    backgroundColor: 'rgba(255, 204, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  launchText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.star,
    letterSpacing: 0.5,
  },
  infoLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  warningBanner: {
    backgroundColor: 'rgba(255, 159, 10, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 10, 0.3)',
  },
  warningText: {
    fontSize: 15,
    color: Colors.primary,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  featureRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  featureRowLast: {
    marginBottom: 0,
  },
  featureBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginRight: 12,
  },
  featureText: {
    fontSize: 15,
    color: Colors.text,
  },
  upgradeButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
    marginTop: 32,
  },
  upgradeButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  secondaryButton: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 16,
    borderWidth: 2,
    borderColor: Colors.charcoal,
    minHeight: 52,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.charcoal,
  },
  modalInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  modalInfoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  launchNotice: {
    backgroundColor: 'rgba(255, 204, 0, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 204, 0, 0.3)',
  },
  launchNoticeText: {
    fontSize: 14,
    color: Colors.border,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 40,
  },
});
