import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Lock, LockOpen, ChevronRight } from 'lucide-react-native';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import { useVendor } from '@/contexts/VendorContext';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';
import LaektivaModal from '@/components/LaektivaModal';

function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return phone || 'Not set';
  const last4 = phone.slice(-4);
  const prefix = phone.slice(0, phone.length - 7);
  return `${prefix} ••• ••• ${last4}`;
}

export default function ManageAccountScreen() {
  const router = useRouter();
  const { username, systemGeneratedUsername, plan, getUsernameChangeEligibility } = useVendorPlan();
  const { vendor } = useVendor();
  const { user } = useAuth();

  const displayUsername = username || systemGeneratedUsername || 'loading';
  const isSystemGenerated = plan === 'basic';
  const canEditUsername = plan !== 'basic';
  const eligibility = getUsernameChangeEligibility();

  const isVerified = vendor.isVerified === true;

  const businessName = vendor.name || 'Not set';
  const businessCategory = vendor.category || 'Not set';
  const businessArea = vendor.area || (vendor.state && vendor.city ? `${vendor.state}, ${vendor.city}` : vendor.region && vendor.city ? `${vendor.region}, ${vendor.city}` : 'Not set');
  const contactEmail = vendor.email || user?.identifier || 'Not set';
  const phoneNumber = vendor.phone ? maskPhone(vendor.phone) : 'Not set';

  const renderField = useCallback((label: string, value: string) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldValueRow}>
        <Text style={[styles.fieldValue, value === 'Not set' && styles.fieldValueEmpty]}>{value}</Text>
        {isVerified ? (
          <Lock size={16} color={Colors.textSecondary} />
        ) : (
          <LockOpen size={16} color={Colors.textMuted} />
        )}
      </View>
    </View>
  ), [isVerified]);

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleConfirmDelete = useCallback(() => {
    setShowDeleteModal(false);
    router.push('/vendor/settings/request-deletion' as any);
  }, [router]);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Manage Account',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.charcoal,
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            {renderField('Business Name', businessName)}
            {renderField('Business Category', businessCategory)}
            {renderField('Business Area', businessArea)}
            {renderField('Contact Email', contactEmail)}
            {renderField('Phone Number', phoneNumber)}
          </View>

          <View style={styles.usernameCard}>
            <View style={styles.usernameHeader}>
              <View style={styles.usernameLabelContainer}>
                <Text style={styles.usernameLabel}>Username</Text>
                <Text style={styles.usernameValue}>@{displayUsername}</Text>
                <Text style={styles.usernameSubtext}>
                  {isSystemGenerated 
                    ? 'System-generated • Editable on Standard and above'
                    : eligibility.canChange
                      ? `Custom username • ${eligibility.changesThisYear}/2 changes this year`
                      : eligibility.reason === 'cooldown_active'
                        ? `Next change available in ${eligibility.daysUntilNext} days`
                        : `${eligibility.changesThisYear}/2 changes used this year`}
                </Text>
              </View>
              {canEditUsername && (
                <TouchableOpacity 
                  style={styles.editButton}
                  activeOpacity={0.7}
                  onPress={() => router.push('/vendor/settings/change-username' as any)}
                >
                  <ChevronRight size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {isVerified ? (
            <Text style={styles.helperText}>
              These details are verified and cannot be edited directly.
            </Text>
          ) : (
            <Text style={styles.helperTextUnverified}>
              Complete verification to lock and protect your account details.
            </Text>
          )}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/vendor/settings/request-change' as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.primaryButtonText}>Request Account Detail Change</Text>
          </TouchableOpacity>

          <View style={styles.dangerZone}>
            <Text style={styles.dangerZoneTitle}>Danger Zone</Text>
            <TouchableOpacity
              style={styles.dangerButton}
              onPress={() => setShowDeleteModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.dangerButtonText}>Delete Account</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <LaektivaModal
        visible={showDeleteModal}
        title="Delete Account?"
        message="This will schedule your account for permanent deletion. You can undo this within 90 days."
        primaryButton={{
          label: 'Delete',
          onPress: handleConfirmDelete,
        }}
        secondaryButton={{
          label: 'Cancel',
          onPress: () => setShowDeleteModal(false),
        }}
        destructive
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  fieldValueRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  fieldValue: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '400' as const,
    flex: 1,
    marginRight: 12,
  },
  fieldValueEmpty: {
    color: Colors.textMuted,
    fontStyle: 'italic' as const,
  },
  helperText: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 16,
    lineHeight: 22,
    paddingHorizontal: 4,
  },
  helperTextUnverified: {
    fontSize: 15,
    color: Colors.primary,
    marginTop: 16,
    lineHeight: 22,
    paddingHorizontal: 4,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginTop: 24,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  dangerZone: {
    marginTop: 48,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  dangerZoneTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.error,
    marginBottom: 16,
    paddingHorizontal: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  dangerButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  dangerButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.error,
  },
  bottomSpacer: {
    height: 40,
  },
  usernameCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
  },
  usernameHeader: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
  },
  usernameLabelContainer: {
    flex: 1,
  },
  usernameLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  usernameValue: {
    fontSize: 17,
    color: Colors.primary,
    fontWeight: '600' as const,
    marginBottom: 6,
  },
  usernameSubtext: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  editButton: {
    padding: 4,
  },
});
