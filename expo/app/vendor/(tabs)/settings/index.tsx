import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import type { VendorPlan } from '@/contexts/VendorPlanContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import { useVendorFulfillment } from '@/contexts/VendorFulfillmentContext';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import { useVendorSupportChat } from '@/contexts/VendorSupportChatContext';
import { useVendor } from '@/contexts/VendorContext';
import { useVerification, type VerificationStatus } from '@/contexts/VerificationContext';
import { useCatalog } from '@/contexts/CatalogContext';
import VendorSettingsProfileCard from '@/components/VendorSettingsProfileCard';
import LaektivaModal from '@/components/LaektivaModal';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { getBottomOverlayPadding } from '@/lib/constants/layout';

export default function VendorSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { getFulfillmentLabel } = useVendorFulfillment();
  const vendorPlanActions = useVendorPlan();
  const { plan, username, systemGeneratedUsername } = vendorPlanActions;
  const { getUnreadCount: getSupportUnreadCount } = useVendorSupportChat();
  const { vendor } = useVendor();
  const { verificationData } = useVerification();
  const { items: catalogItems } = useCatalog();

  const supportUnread = getSupportUnreadCount();

  const displayUsername = username || systemGeneratedUsername || vendor.username || null;

  const profileVerificationStatus = vendor.verificationStatus ?? verificationData.status;
  const verificationStatus: VerificationStatus = vendor.accountState === 'suspended'
    ? 'suspended'
    : vendor.accountState === 'deactivated'
      ? 'deactivated'
      : profileVerificationStatus;

  const handleItemPress = async (item: string) => {
    console.log('Settings item pressed:', item);
    
    if (item === 'logout') {
      setShowLogoutModal(true);
      return;
    }



    const routeMap: Record<string, string> = {
      'manage-account': '/vendor/settings/manage-account',
      'storefront-appearance': '/vendor/settings/storefront-appearance',
      'business-location': '/vendor/settings/business-location',
      'security': '/vendor/settings/security',
      'verification': '/vendor/settings/verification',
      'ratings': '/vendor/settings/ratings',
      'store-status': '/vendor/settings/store-status',
      'business-policies': '/vendor/settings/business-policies',
      'quick-replies': '/vendor/settings/quick-replies',
      'greeting-message': '/vendor/settings/greeting-message',
      'away-message': '/vendor/settings/away-message',
      'fulfillment-method': '/vendor/settings/fulfillment-method',
      'auto-accept-orders': '/vendor/settings/auto-accept-orders',
      'auto-send-pickup': '/vendor/settings/auto-send-pickup',
      'pickup-details': '/vendor/settings/pickup-details',
      'minimum-order-amount': '/vendor/settings/minimum-order-amount',
      'payment-methods': '/vendor/settings/payment-methods',
      'payment-instructions': '/vendor/settings/payment-instructions',
      'tax': '/vendor/settings/tax-settings',
      'promotions': '/vendor/settings/promotions',
      'notification-settings': '/vendor/settings/notification-settings',
      'invoices': '/vendor/settings/invoices',
      'invoice-branding': '/vendor/settings/invoice-branding',
      'reports': '/vendor/settings/reports',
      'subscription': '/vendor/settings/subscription',
      'blocked-users': '/vendor/settings/blocked-users',
      'help-center': '/vendor/settings/help-center',
      'contact-support': '/vendor/settings/support-chat',
      'report-problem': '/vendor/settings/report-problem',
    };

    if (routeMap[item]) {
      router.push(routeMap[item] as any);
    }
  };

  const handleLogout = () => {
    console.log('Vendor logged out');
    setShowLogoutModal(false);
  };

  const renderSettingsRow = (label: string, onPress: () => void, isLast: boolean = false, subtitle?: string, showBadge: boolean = false) => (
    <>
      <TouchableOpacity
        style={styles.settingsRow}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.rowContent}>
          <Text style={styles.rowLabel}>{label}</Text>
          {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
        </View>
        <View style={styles.rowRight}>
          {showBadge && <View style={styles.unreadDot} />}
          <ChevronRight size={20} color={Colors.textMuted} />
        </View>
      </TouchableOpacity>
      {!isLast && <View style={styles.rowDivider} />}
    </>
  );


  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
      </SafeAreaView>
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: getBottomOverlayPadding(insets.bottom) }]}
      >
        <VendorSettingsProfileCard
          vendor={vendor}
          plan={plan}
          vendorHandle={displayUsername}
          verificationStatus={verificationStatus}
          catalogItemCount={catalogItems.length}
          onCompletionPress={() => router.push('/vendor/settings/storefront-appearance' as any)}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <View style={styles.glassCard}>
            {renderSettingsRow('Manage Account', () => handleItemPress('manage-account'), false)}
            {renderSettingsRow('Storefront Appearance', () => handleItemPress('storefront-appearance'), false)}
            {renderSettingsRow('Business Location', () => handleItemPress('business-location'), false)}
            {renderSettingsRow('Security', () => handleItemPress('security'), false)}
            {renderSettingsRow('Verification', () => handleItemPress('verification'), false)}
            {renderSettingsRow('Ratings', () => handleItemPress('ratings'), true)}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>STORE STATUS & AVAILABILITY</Text>
          <View style={styles.glassCard}>
            {renderSettingsRow('Store Status & Availability', () => handleItemPress('store-status'), true)}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BUSINESS POLICIES</Text>
          <View style={styles.glassCard}>
            {renderSettingsRow('Business Policies', () => handleItemPress('business-policies'), true)}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MESSAGES</Text>
          <View style={styles.glassCard}>
            {renderSettingsRow('Quick Replies', () => handleItemPress('quick-replies'), false)}
            {renderSettingsRow('Greeting Message', () => handleItemPress('greeting-message'), false, 'On')}
            {renderSettingsRow('Away Message', () => handleItemPress('away-message'), true, 'Off')}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ORDER FULFILLMENT</Text>
          <View style={styles.glassCard}>
            {renderSettingsRow('Fulfillment Method', () => handleItemPress('fulfillment-method'), false, getFulfillmentLabel() || undefined)}
            {renderSettingsRow('Auto-Accept Orders', () => handleItemPress('auto-accept-orders'), false)}
            {renderSettingsRow('Auto-send Pickup Details', () => handleItemPress('auto-send-pickup'), false)}
            {renderSettingsRow('Pickup Details', () => handleItemPress('pickup-details'), false)}
            {renderSettingsRow('Minimum Order Amount', () => handleItemPress('minimum-order-amount'), true)}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PAYMENTS</Text>
          <View style={styles.glassCard}>
            {renderSettingsRow('Payment Methods', () => handleItemPress('payment-methods'), false)}
            {renderSettingsRow('Payment Instructions', () => handleItemPress('payment-instructions'), false)}
            {renderSettingsRow('Tax', () => handleItemPress('tax'), false)}
            {renderSettingsRow('Promotions', () => handleItemPress('promotions'), true)}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DOCUMENTS</Text>
          <View style={styles.glassCard}>
            {renderSettingsRow('Invoices', () => handleItemPress('invoices'), false)}
            {renderSettingsRow('Invoice Branding', () => handleItemPress('invoice-branding'), true, 'Logo, colors, templates')}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRIVACY & DATA</Text>
          <View style={styles.glassCard}>
            {renderSettingsRow('Blocked Users', () => handleItemPress('blocked-users'), true)}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
          <View style={styles.glassCard}>
            {renderSettingsRow('Notifications', () => handleItemPress('notification-settings'), true)}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SUBSCRIPTION</Text>
          <View style={styles.glassCard}>
            {renderSettingsRow('Subscription Plan', () => handleItemPress('subscription'), true, plan.charAt(0).toUpperCase() + plan.slice(1))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SUPPORT</Text>
          <View style={styles.glassCard}>
            {renderSettingsRow('Help Center', () => handleItemPress('help-center'), false)}
            {renderSettingsRow('Contact Vendor Support', () => handleItemPress('contact-support'), false, undefined, supportUnread > 0)}
            {renderSettingsRow('Report a Problem', () => handleItemPress('report-problem'), true)}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GROWTH</Text>
          <View style={styles.glassCard}>
            {renderSettingsRow('Invite to the platform', () => router.push('/vendor/settings/invite-to-the platform' as any), true)}
          </View>
        </View>

        {__DEV__ && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DEV TOOLS</Text>
            <View style={styles.glassCard}>
              <View style={styles.devToolsRow}>
                <Text style={styles.devToolsLabel}>Subscription Plan</Text>
                <View style={styles.devToolsPills}>
                  {(['basic', 'pro', 'pro+'] as VendorPlan[]).map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.devPill,
                        plan === p && styles.devPillActive,
                      ]}
                      onPress={() => {
                        void vendorPlanActions.updatePlan(p);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.devPillText, plan === p && styles.devPillTextActive]}>
                        {p === 'pro+' ? 'Pro+' : p.charAt(0).toUpperCase() + p.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LEGAL</Text>
          <View style={styles.glassCard}>
            {renderSettingsRow('Terms of Use & Privacy Policy', () => handleItemPress('terms'), true)}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.glassCard}>
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => handleItemPress('logout')}
              activeOpacity={0.7}
            >
              <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      <LaektivaModal
        visible={showLogoutModal}
        title="Log out"
        message="Are you sure you want to log out?"
        primaryButton={{
          label: 'Log out',
          onPress: handleLogout,
        }}
        secondaryButton={{
          label: 'Cancel',
          onPress: () => setShowLogoutModal(false),
        }}
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
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: Colors.background,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: '#111111',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  contentContainer: {
    paddingTop: 8,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.6,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  glassCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  settingsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginRight: 12,
  },
  rowLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    flex: 1,
  },
  rowLabel: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  rowSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '400' as const,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: 16,
  },
  rowRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.badge,
  },
  logoutText: {
    fontSize: 17,
    fontWeight: '400' as const,
    color: Colors.error,
  },
  devToolsRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  devToolsLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  devToolsPills: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  devPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  devPillActive: {
    backgroundColor: Colors.primary,
  },
  devPillText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  devPillTextActive: {
    color: '#FFFFFF',
  },
});
