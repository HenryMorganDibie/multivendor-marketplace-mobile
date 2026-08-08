import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ChevronRight, Lock, Check, MapPin } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import LaektivaModal from '@/components/LaektivaModal';
import EditScreenHeader from '@/components/EditScreenHeader';
import { useVendor } from '@/contexts/VendorContext';
import { callable } from '@/lib/firebase';
import { Alert } from '@/utils/alert';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const AREA_CHANGE_COOLDOWN_DAYS = 90;

interface AreaOption {
  name: string;
  state: string;
}

const AREAS_BY_COUNTRY: Record<string, AreaOption[]> = {
  Canada: [
    { name: 'Toronto', state: 'Ontario' },
    { name: 'Ottawa', state: 'Ontario' },
    { name: 'Mississauga', state: 'Ontario' },
    { name: 'Brampton', state: 'Ontario' },
    { name: 'Hamilton', state: 'Ontario' },
    { name: 'Vancouver', state: 'British Columbia' },
    { name: 'Victoria', state: 'British Columbia' },
    { name: 'Calgary', state: 'Alberta' },
    { name: 'Edmonton', state: 'Alberta' },
    { name: 'Montreal', state: 'Quebec' },
  ],
  Nigeria: [
    { name: 'Lagos Island', state: 'Lagos' },
    { name: 'Ikeja', state: 'Lagos' },
    { name: 'Victoria Island', state: 'Lagos' },
    { name: 'Abuja Central', state: 'FCT' },
    { name: 'Garki', state: 'FCT' },
    { name: 'Port Harcourt', state: 'Rivers' },
    { name: 'Ibadan', state: 'Oyo' },
  ],
  'United States': [
    { name: 'Manhattan', state: 'New York' },
    { name: 'Brooklyn', state: 'New York' },
    { name: 'Los Angeles', state: 'California' },
    { name: 'San Francisco', state: 'California' },
    { name: 'Chicago', state: 'Illinois' },
    { name: 'Houston', state: 'Texas' },
    { name: 'Miami', state: 'Florida' },
  ],
};

export default function BusinessLocationScreen() {
  const router = useRouter();
  const [showChangeAreaModal, setShowChangeAreaModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  /**
   * The vendor's real location, not a placeholder.
   *
   * This was hardcoded to Canada/Ontario/Toronto and never read the vendor's
   * actual record, so every vendor saw the same fake Canadian address on this
   * screen regardless of what they registered with — a Nigeria/Lagos vendor
   * saw "Toronto, Ontario, Canada" here after signing up.
   *
   * The fallback is deliberately blank now, not another hardcoded place. A
   * fake-but-plausible country is worse than an honest blank one: it looks
   * like real data and can go unnoticed, where an empty field is visibly
   * something to fix. Vendor registration only collects country at signup —
   * state and area are filled in later through onboarding — so a freshly
   * registered vendor legitimately having no state/area yet is expected, and
   * should read as "not set", not as a real-looking Canadian city.
   */
  const { vendor } = useVendor();
  const [currentLocation, setCurrentLocation] = useState({
    country: vendor.country || '',
    state: vendor.state || '',
    area: vendor.area || vendor.city || '',
  });

  // The vendor doc arrives from a Firestore listener after this screen's first
  // render, so the useState initializer above sees stale/fallback data on the
  // very first frame. This syncs once the real doc lands, so the display never
  // stays stuck on someone else's placeholder location.
  useEffect(() => {
    setCurrentLocation({
      country: vendor.country || '',
      state: vendor.state || '',
      area: vendor.area || vendor.city || '',
    });
  }, [vendor.country, vendor.state, vendor.area, vendor.city]);
  const [selectedArea, setSelectedArea] = useState<AreaOption | null>(null);
  const [lastAreaChange, setLastAreaChange] = useState<Date | null>(null);

  /** Only show areas/cities that belong to the currently selected province */
  const availableAreas = useMemo(() => {
    const allAreas = AREAS_BY_COUNTRY[currentLocation.country] || [];
    return allAreas.filter(area => area.state === currentLocation.state);
  }, [currentLocation.country, currentLocation.state]);

  const canChangeArea = () => {
    if (!lastAreaChange) return true;
    const daysSinceChange = Math.floor(
      (Date.now() - lastAreaChange.getTime()) / (1000 * 60 * 60 * 24),
    );
    return daysSinceChange >= AREA_CHANGE_COOLDOWN_DAYS;
  };

  const handleChangeArea = () => {
    if (!canChangeArea()) return;
    setShowChangeAreaModal(true);
  };

  const handleAreaSelect = (area: AreaOption) => {
    if (area.name === currentLocation.area) return;
    setSelectedArea(area);
    setShowChangeAreaModal(false);
    setShowConfirmModal(true);
  };

  const [isSavingArea, setIsSavingArea] = useState(false);

  const confirmAreaChange = async () => {
    if (!selectedArea) return;
    setIsSavingArea(true);
    try {
      const update = callable<
        { country: string; state: string; area: string },
        { success: true }
      >('updateVendorLocation');
      await update({ country: currentLocation.country, state: selectedArea.state, area: selectedArea.name });
      setCurrentLocation(prev => ({
        ...prev,
        area: selectedArea.name,
        state: selectedArea.state,
      }));
      setShowConfirmModal(false);
      setLastAreaChange(new Date());
      setSelectedArea(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update your business area.';
      Alert.alert('Could not save', message);
    } finally {
      setIsSavingArea(false);
    }
  };

  const getDaysUntilAreaChange = () => {
    if (!lastAreaChange) return 0;
    const daysSinceChange = Math.floor(
      (Date.now() - lastAreaChange.getTime()) / (1000 * 60 * 60 * 24),
    );
    return Math.max(0, AREA_CHANGE_COOLDOWN_DAYS - daysSinceChange);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Business Location" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.locationRow}>
            <View style={styles.locationLabelContainer}>
              <Text style={styles.locationLabel}>Country</Text>
              <Lock size={13} color={Colors.textMuted} style={styles.lockIcon} />
            </View>
            <Text style={styles.locationValue}>{currentLocation.country || 'Not set'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.locationRow}>
            <Text style={styles.locationLabel}>State / Province</Text>
            <Text style={styles.locationValue}>{currentLocation.state || 'Not set'}</Text>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.locationRow}
            onPress={handleChangeArea}
            activeOpacity={canChangeArea() ? 0.6 : 1}
            disabled={!canChangeArea()}
          >
            <Text style={[styles.locationLabel, !canChangeArea() && styles.locationLabelDisabled]}>
              Area
            </Text>
            <View style={styles.areaValueRow}>
              <Text style={styles.locationValue}>{currentLocation.area || 'Not set'}</Text>
              {canChangeArea() && (
                <ChevronRight size={16} color={Colors.textMuted} style={styles.chevronIcon} />
              )}
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.areaHelperText}>
          {canChangeArea()
            ? 'You can change your area once every 90 days'
            : `You can change your area again in ${getDaysUntilAreaChange()} days`}
        </Text>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Change Business Area — bottom sheet */}
      <Modal
        visible={showChangeAreaModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChangeAreaModal(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={styles.sheetBackdrop}
            activeOpacity={1}
            onPress={() => setShowChangeAreaModal(false)}
          />
          <View style={styles.sheetContainer}>
            {/* Handle */}
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Change Business Area</Text>
              <Text style={styles.sheetSubtitle}>
                Showing areas in{' '}
                <Text style={styles.sheetSubtitleBold}>{currentLocation.state}, {currentLocation.country}.</Text>
                {' '}90-day cooldown applies.
              </Text>
            </View>

            {/* Flat city list — filtered to current province only */}
            <ScrollView
              style={styles.sheetScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetScrollContent}
            >
              <View style={styles.cityGroup}>
                {availableAreas.map((area, index) => {
                  const isCurrent = area.name === currentLocation.area;
                  return (
                    <View key={area.name}>
                      <TouchableOpacity
                        style={[styles.cityRow, isCurrent && styles.cityRowCurrent]}
                        onPress={() => handleAreaSelect(area)}
                        activeOpacity={isCurrent ? 1 : 0.65}
                      >
                        <View style={styles.cityRowLeft}>
                          {isCurrent ? (
                            <View style={styles.cityIconCurrent}>
                              <MapPin size={12} color={Colors.primary} />
                            </View>
                          ) : (
                            <View style={styles.cityIconEmpty} />
                          )}
                          <Text style={[styles.cityName, isCurrent && styles.cityNameCurrent]}>
                            {area.name}
                          </Text>
                        </View>
                        {isCurrent && (
                          <View style={styles.currentPill}>
                            <Check size={10} color={Colors.primary} strokeWidth={2.5} />
                            <Text style={styles.currentPillText}>Current</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      {index < availableAreas.length - 1 && (
                        <View style={styles.cityDivider} />
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            {/* Cancel */}
            <SafeAreaView edges={['bottom']} style={styles.sheetFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowChangeAreaModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </SafeAreaView>
          </View>
        </View>
      </Modal>

      <LaektivaModal
        visible={showConfirmModal}
        title="Change Business Area?"
        message={`You're changing your business area to ${selectedArea?.name ?? ''} within ${currentLocation.state}. This affects which customers can find your store. A 90-day cooldown will apply.`}
        primaryButton={{
          label: 'Confirm Change',
          onPress: confirmAreaChange,
        }}
        secondaryButton={{
          label: 'Cancel',
          onPress: () => setShowConfirmModal(false),
        }}
      />
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden' as const,
  },
  locationRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  locationLabelContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  lockIcon: {
    marginLeft: 5,
  },
  locationLabel: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  locationLabelDisabled: {
    color: Colors.textMuted,
  },
  locationValue: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '400' as const,
  },
  areaValueRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  chevronIcon: {
    marginLeft: 3,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 16,
  },
  areaHelperText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 8,
    marginLeft: 4,
    lineHeight: 17,
  },
  bottomSpacer: {
    height: 40,
  },

  // ── Bottom Sheet ──────────────────────────────────────────
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end' as const,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlayHeavy,
  },
  sheetContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: SCREEN_HEIGHT * 0.78,
    paddingTop: 10,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderDark,
    alignSelf: 'center' as const,
    marginBottom: 16,
  },
  sheetHeader: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 5,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  sheetSubtitleBold: {
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  sheetScroll: {
    maxHeight: SCREEN_HEIGHT * 0.48,
    flexGrow: 1,
  },
  sheetScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },

  cityGroup: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden' as const,
  },
  cityRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
  },
  cityRowCurrent: {
    backgroundColor: Colors.primaryTint,
  },
  cityRowLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flex: 1,
  },
  cityIconCurrent: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 10,
  },
  cityIconEmpty: {
    width: 22,
    height: 22,
    marginRight: 10,
  },
  cityName: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  cityNameCurrent: {
    fontWeight: '600' as const,
    color: Colors.primaryDark,
  },
  cityDivider: {
    height: 1,
    backgroundColor: Colors.borderSoft,
    marginLeft: 46,
  },

  // Current pill — soft, elegant
  currentPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 3,
  },
  currentPillText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.primary,
    letterSpacing: 0.1,
  },

  // Footer
  sheetFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
  },
  cancelButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center' as const,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
});
