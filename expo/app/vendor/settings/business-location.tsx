import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Colors } from '@/constants/colors';
import EditScreenHeader from '@/components/EditScreenHeader';
import LocationCascadeFields, { type LocationValue } from '@/components/LocationCascadeFields';
import { useVendor } from '@/contexts/VendorContext';
import { useVendorOnboarding } from '@/contexts/VendorOnboardingContext';
import { callable } from '@/lib/firebase';
import { Alert } from '@/utils/alert';

const AREA_CHANGE_COOLDOWN_DAYS = 90;

/**
 * The state/area half of a vendor's business location — the step signup
 * deliberately defers ("Country only at signup... State and area move to
 * onboarding").
 *
 * The previous version of this screen could never complete that step. It
 * offered an "Area" picker filtered from a hardcoded three-country table
 * (Canada / Nigeria / US) by `currentLocation.state` — but state was blank
 * for every real vendor, because signup never captures it and this screen had
 * no way to set it. The filter therefore always produced an empty list, and
 * confirming a selection only wrote local component state anyway, so nothing
 * survived a reload. Every vendor saw "State / Province: Not set" with no
 * route to fixing it.
 *
 * Now it uses the same location catalogue and cascade as signup, with country
 * locked (currency and pricing were resolved from it at signup), and persists
 * through updateVendorLocation.
 */
export default function BusinessLocationScreen() {
  const router = useRouter();
  const { vendor, isRealVendor } = useVendor();
  const { refresh: refreshOnboarding } = useVendorOnboarding();

  const [location, setLocation] = useState<LocationValue | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Seeded from the vendor's real record once it arrives — before that,
  // `vendor` is the mockVendor placeholder and would seed someone else's
  // location as if it were this vendor's.
  useEffect(() => {
    if (!isRealVendor) return;
    setLocation({
      countryCode: vendor.countryCode ?? '',
      countryName: vendor.country ?? '',
      stateCode: (vendor as { stateId?: string }).stateId ?? '',
      stateName: vendor.state ?? '',
      areaId: (vendor as { areaId?: string }).areaId ?? '',
      areaName: vendor.area ?? vendor.city ?? '',
    });
  }, [isRealVendor, vendor.countryCode, vendor.country, vendor.state, vendor.area, vendor.city]);

  const savedState = vendor.state ?? '';
  const hasSavedLocation = Boolean(savedState.trim());
  const isDirty = Boolean(
    location?.stateName && (location.stateName !== savedState || (location.areaName ?? '') !== (vendor.area ?? ''))
  );

  const handleSave = async () => {
    if (!location?.stateName) {
      Alert.alert('Choose a state', 'Select your state or province before saving.');
      return;
    }
    setIsSaving(true);
    try {
      const update = callable<
        { state: string; area: string; stateId?: string; areaId?: string },
        { success: true }
      >('updateVendorLocation');
      await update({
        state: location.stateName,
        area: location.areaName ?? '',
        stateId: location.stateCode || undefined,
        areaId: location.areaId || undefined,
      });
      // The dashboard checklist reads business_location from the backend, so
      // it has to be re-fetched for the step to tick over immediately.
      await refreshOnboarding();
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save your business location.';
      Alert.alert('Could not save', message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader
          title="Business Location"
          onBack={() => router.back()}
          onSave={handleSave}
          saveEnabled={isDirty && !isSaving}
          showSave
        />
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {!isRealVendor ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
          ) : (
            <>
              <Text style={styles.intro}>
                {hasSavedLocation
                  ? 'This is where customers see your business based. Your country was set when you created your account and cannot be changed here.'
                  : 'Finish setting up your location so customers know where you are based. Your country was set when you created your account.'}
              </Text>

              <LocationCascadeFields
                value={location}
                onChange={setLocation}
                disabled={isSaving}
                testIDPrefix="vendor-business-location"
                lockCountry
              />

              <Text style={styles.helperText}>
                {hasSavedLocation
                  ? `You can change your area once every ${AREA_CHANGE_COOLDOWN_DAYS} days.`
                  : 'Setting your location for the first time does not count as a change.'}
              </Text>

              <TouchableOpacity
                style={[styles.saveButton, (!isDirty || isSaving) && styles.saveButtonDisabled]}
                onPress={handleSave}
                activeOpacity={0.8}
                disabled={!isDirty || isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save location</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerSafe: { backgroundColor: Colors.background },
  safeArea: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  intro: {
    fontSize: 14.5,
    lineHeight: 21,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  helperText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 12,
    lineHeight: 18,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginTop: 24,
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { fontSize: 16, fontWeight: '600' as const, color: '#FFFFFF' },
  bottomSpacer: { height: 60 },
});
