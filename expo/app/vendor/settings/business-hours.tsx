// IMPORTANT:
// Operational settings are intentionally independent from
// subscription and verification.
// Do not couple these systems.
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, ChevronDown, Check, Info } from 'lucide-react-native';
import EditScreenHeader from '@/components/EditScreenHeader';
import DiscardChangesModal from '@/components/DiscardChangesModal';
import { useUnsavedChanges } from '@/utils/useUnsavedChanges';
import { Colors } from '@/constants/colors';
import { useVendor } from '@/contexts/VendorContext';
import { callable } from '@/lib/firebase';
import { Alert } from '@/utils/alert';
import type { DayHoursConfig } from '@/mocks/vendorData';
import { takePendingDayEdit } from '@/utils/businessHoursDraft';

type HoursMode = 'always' | 'selected';
type DayName = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

const DAYS: DayName[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Matches store-status.tsx's own default -- one full-week fallback shape
// used consistently wherever a vendor has no weeklyHours configured yet.
const DEFAULT_WEEKLY_HOURS: Record<DayName, DayHoursConfig> = {
  Sunday: { closed: true, ranges: [] },
  Monday: { closed: false, ranges: [{ open: '9:00 AM', close: '6:00 PM' }] },
  Tuesday: { closed: false, ranges: [{ open: '9:00 AM', close: '6:00 PM' }] },
  Wednesday: { closed: false, ranges: [{ open: '9:00 AM', close: '6:00 PM' }] },
  Thursday: { closed: false, ranges: [{ open: '9:00 AM', close: '6:00 PM' }] },
  Friday: { closed: false, ranges: [{ open: '9:00 AM', close: '6:00 PM' }] },
  Saturday: { closed: false, ranges: [{ open: '9:00 AM', close: '6:00 PM' }] },
};

const ALWAYS_OPEN_RANGE = { open: '12:00 AM', close: '11:59 PM' };

function isAlwaysOpenSchedule(weekly: Record<DayName, DayHoursConfig>): boolean {
  return DAYS.every((d) => {
    const cfg = weekly[d];
    return !!cfg && !cfg.closed && cfg.ranges.length === 1
      && cfg.ranges[0].open === ALWAYS_OPEN_RANGE.open && cfg.ranges[0].close === ALWAYS_OPEN_RANGE.close;
  });
}

/**
 * Seeds the screen's local draft from the authoritative vendors/{vendorId}.weeklyHours
 * once, at mount. Every subsequent change lives only in this draft until the
 * vendor taps Save -- see the useFocusEffect below for how a day edited on
 * edit-day-hours.tsx is folded back into this same draft rather than
 * overwriting it wholesale.
 */
function seedFromVendor(weeklyHours: Record<string, DayHoursConfig> | undefined): { mode: HoursMode; hours: Record<DayName, DayHoursConfig> } {
  if (!weeklyHours || Object.keys(weeklyHours).length === 0) {
    return { mode: 'selected', hours: DEFAULT_WEEKLY_HOURS };
  }
  const hours = { ...DEFAULT_WEEKLY_HOURS };
  for (const day of DAYS) {
    const cfg = weeklyHours[day];
    if (cfg) hours[day] = cfg;
  }
  return { mode: isAlwaysOpenSchedule(hours) ? 'always' : 'selected', hours };
}

function formatDayHours(config: DayHoursConfig): string {
  if (config.closed || config.ranges.length === 0) return 'Closed';
  // One line per range so a split (lunch-break) schedule reads cleanly
  // instead of running two ranges together on one line.
  return config.ranges.map((r) => `${r.open} – ${r.close}`).join('\n');
}

export default function BusinessHoursScreen() {
  const router = useRouter();
  const { vendor, updateVendor } = useVendor();
  const [seed] = useState(() => seedFromVendor(vendor.weeklyHours as Record<string, DayHoursConfig> | undefined));
  const [hoursMode, setHoursMode] = useState<HoursMode>(seed.mode);
  const [weeklyHours, setWeeklyHours] = useState<Record<DayName, DayHoursConfig>>(seed.hours);
  const [isSaving, setIsSaving] = useState(false);
  // Identifies this specific mounted instance of this screen to the draft
  // relay (businessHoursDraft.ts), alongside vendor.id -- see that file for
  // why a plain module-global value needs both to stay safe across account
  // switches and abandoned/reopened screens.
  const [sessionId] = useState(() => `${Date.now()}_${Math.random().toString(36).slice(2)}`);

  // Compact "Hours" dropdown (replaces the old two-pill segmented control).
  // Anchored under the trigger row via measureInWindow rather than plain
  // CSS-style absolute positioning, since that's what actually renders
  // reliably across native and react-native-web -- see edit-day-hours.tsx's
  // picker fix for why a fixed/absolute box nested in normal layout can't be
  // trusted to escape its surrounding container on web.
  const hoursRowRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const [hoursDropdownVisible, setHoursDropdownVisible] = useState(false);
  const [hoursDropdownAnchor, setHoursDropdownAnchor] = useState<{ top: number; left: number; width: number } | null>(null);

  const openHoursDropdown = useCallback(() => {
    hoursRowRef.current?.measureInWindow((x, y, width, height) => {
      setHoursDropdownAnchor({ top: y + height + 6, left: x, width });
      setHoursDropdownVisible(true);
    });
  }, []);

  const selectHoursMode = useCallback((mode: HoursMode) => {
    setHoursMode(mode);
    setHoursDropdownVisible(false);
  }, []);

  const unsavedChanges = useUnsavedChanges(
    { hoursMode, weeklyHours },
    false
  );

  // Applies a day's edited draft (Edit Hours -> Done) into this screen's own
  // draft without touching the network. Fires when this screen regains focus,
  // i.e. exactly when the vendor returns from editing a day -- so editing
  // Monday then Friday in sequence keeps both edits, and nothing is
  // persisted until the vendor explicitly taps Save below.
  useFocusEffect(
    useCallback(() => {
      const pending = takePendingDayEdit(vendor.id, sessionId);
      if (pending) {
        setWeeklyHours((prev) => ({ ...prev, [pending.day]: pending.config }));
      }
    }, [vendor.id, sessionId])
  );

  const handleSave = async () => {
    if (isSaving) return;
    const payload: Record<DayName, DayHoursConfig> = hoursMode === 'always'
      ? DAYS.reduce((acc, day) => {
          acc[day] = { closed: false, ranges: [ALWAYS_OPEN_RANGE] };
          return acc;
        }, {} as Record<DayName, DayHoursConfig>)
      : weeklyHours;

    setIsSaving(true);
    try {
      const update = callable<{ weeklyHours: Record<string, DayHoursConfig> }, { success: true }>('updateVendorSettings');
      await update({ weeklyHours: payload });
      updateVendor({ weeklyHours: payload as any });
      // Keep the local draft in sync with exactly what was persisted --
      // in "always open" mode, payload is computed fresh from hoursMode
      // rather than read from the weeklyHours draft state itself, so
      // without this the draft could silently drift from the authoritative
      // value resetChanges() is about to capture as the new baseline.
      setWeeklyHours(payload);
      unsavedChanges.resetChanges();
      router.back();
    } catch (err) {
      // A rejected save must never look like it succeeded, and the vendor's
      // draft must not be discarded -- they should be able to retry
      // immediately without re-entering everything.
      console.error('[BusinessHours] updateVendorSettings failed:', err);
      Alert.alert("Couldn't save business hours", 'Your changes are still here. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDayPress = (day: DayName) => {
    const config = weeklyHours[day];
    router.push({
      pathname: '/vendor/settings/edit-day-hours' as any,
      params: {
        day,
        closed: config.closed.toString(),
        ranges: JSON.stringify(config.ranges),
        vendorId: vendor.id,
        sessionId,
      },
    });
  };

  const renderDayRow = (day: DayName) => {
    const config = weeklyHours[day];
    const displayText = hoursMode === 'always' ? 'Open 24 hours' : formatDayHours(config);

    return (
      <TouchableOpacity
        key={day}
        style={styles.dayRow}
        onPress={() => handleDayPress(day)}
        activeOpacity={0.7}
        disabled={hoursMode === 'always'}
      >
        <Text style={styles.dayName}>{day}</Text>
        <View style={styles.dayRightContent}>
          <Text style={[styles.dayHours, hoursMode === 'always' && styles.dayHoursDisabled]}>
            {displayText}
          </Text>
          {hoursMode === 'selected' && <ChevronRight size={20} color={Colors.textSecondary} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader
          title="Business Hours"
          onBack={() => {
            if (!unsavedChanges.handleExitAttempt()) return;
            router.back();
          }}
          showSave={false}
        />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>HOURS</Text>
          <TouchableOpacity
            ref={hoursRowRef}
            style={styles.hoursRow}
            onPress={openHoursDropdown}
            activeOpacity={0.7}
          >
            <Text style={styles.hoursRowLabel}>Hours</Text>
            <View style={styles.hoursRowRight}>
              <Text style={styles.hoursRowValue}>
                {hoursMode === 'always' ? 'Always Open' : 'Selected Hours'}
              </Text>
              <ChevronDown size={18} color={Colors.primary} />
            </View>
          </TouchableOpacity>

          <View style={styles.daysCard}>
            {DAYS.map((day, index) => (
              <React.Fragment key={day}>
                {index > 0 && <View style={styles.divider} />}
                {renderDayRow(day)}
              </React.Fragment>
            ))}
          </View>

          {hoursMode === 'selected' && (
            <View style={styles.infoNote}>
              <Info size={13} color={Colors.textMuted} />
              <Text style={styles.infoNoteText}>
                Business hours are shown to customers for reference and do not affect order availability.
              </Text>
            </View>
          )}

          <Modal
            visible={hoursDropdownVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setHoursDropdownVisible(false)}
          >
            <TouchableOpacity
              style={styles.dropdownBackdrop}
              activeOpacity={1}
              onPress={() => setHoursDropdownVisible(false)}
            >
              {hoursDropdownAnchor && (
                <View
                  style={[
                    styles.dropdownMenu,
                    { top: hoursDropdownAnchor.top, left: hoursDropdownAnchor.left, width: hoursDropdownAnchor.width },
                  ]}
                >
                  {(['selected', 'always'] as HoursMode[]).map((mode, index) => (
                    <React.Fragment key={mode}>
                      {index > 0 && <View style={styles.dropdownDivider} />}
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => selectHoursMode(mode)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.dropdownItemText, hoursMode === mode && styles.dropdownItemTextActive]}>
                          {mode === 'always' ? 'Always Open' : 'Selected Hours'}
                        </Text>
                        {hoursMode === mode && <Check size={16} color={Colors.primary} />}
                      </TouchableOpacity>
                    </React.Fragment>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          </Modal>

          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            activeOpacity={0.7}
            disabled={isSaving}
          >
            <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <DiscardChangesModal
        visible={unsavedChanges.showDiscardModal}
        onKeepEditing={unsavedChanges.handleKeepEditing}
        onDiscard={() => {
          unsavedChanges.handleDiscard();
          router.back();
        }}
        message="You have unsaved changes to your business hours."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerSafe: {
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textTertiary,
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  hoursRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  hoursRowLabel: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  hoursRowRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  hoursRowValue: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  dropdownBackdrop: {
    flex: 1,
  },
  dropdownMenu: {
    position: 'absolute' as const,
    backgroundColor: Colors.white,
    borderRadius: 14,
    overflow: 'hidden' as const,
    shadowColor: Colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  dropdownItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dropdownItemText: {
    fontSize: 15.5,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  dropdownItemTextActive: {
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  dropdownDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: 16,
  },
  daysCard: {
    backgroundColor: Colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  dayRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  dayName: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  dayRightContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  dayHours: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '400' as const,
    textAlign: 'right' as const,
  },
  dayHoursDisabled: {
    color: Colors.textMuted,
  },
  infoNote: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  infoNoteText: {
    flex: 1,
    fontSize: 12.5,
    color: Colors.textMuted,
    lineHeight: 17,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginTop: 32,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  bottomSpacer: {
    height: 40,
  },
});
