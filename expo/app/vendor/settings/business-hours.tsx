// IMPORTANT:
// Operational settings are intentionally independent from
// subscription and verification.
// Do not couple these systems.
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronRight, AlertTriangle } from 'lucide-react-native';
import EditScreenHeader from '@/components/EditScreenHeader';
import DiscardChangesModal from '@/components/DiscardChangesModal';
import { useUnsavedChanges } from '@/utils/useUnsavedChanges';
import { Colors } from '@/constants/colors';
import { useVendor } from '@/contexts/VendorContext';

type HoursMode = 'always' | 'selected';
type DayHours = {
  open: string;
  close: string;
  closed: boolean;
};

type WeekHours = {
  Sunday: DayHours;
  Monday: DayHours;
  Tuesday: DayHours;
  Wednesday: DayHours;
  Thursday: DayHours;
  Friday: DayHours;
  Saturday: DayHours;
};

function formatWeekHoursToString(mode: HoursMode, weekHours: WeekHours): string {
  if (mode === 'always') return 'Open 24 hours';
  const dayKeys = Object.keys(weekHours) as (keyof WeekHours)[];
  return dayKeys
    .map(day => {
      const h = weekHours[day];
      if (h.closed) return `${day}: Closed`;
      return `${day}: ${h.open} – ${h.close}`;
    })
    .join('\n');
}

export default function BusinessHoursScreen() {
  const router = useRouter();
  const { updateVendor } = useVendor();
  const [hoursMode, setHoursMode] = useState<HoursMode>('selected');
  const [weekHours, setWeekHours] = useState<WeekHours>({
    Sunday: { open: '9:00 AM', close: '6:00 PM', closed: false },
    Monday: { open: '9:00 AM', close: '6:00 PM', closed: false },
    Tuesday: { open: '9:00 AM', close: '6:00 PM', closed: false },
    Wednesday: { open: '9:00 AM', close: '6:00 PM', closed: false },
    Thursday: { open: '9:00 AM', close: '6:00 PM', closed: false },
    Friday: { open: '9:00 AM', close: '6:00 PM', closed: false },
    Saturday: { open: '9:00 AM', close: '6:00 PM', closed: true },
  });

  const unsavedChanges = useUnsavedChanges(
    { hoursMode, weekHours },
    false
  );

  const handleSave = () => {
    const formattedHours = formatWeekHoursToString(hoursMode, weekHours);
    console.log('Business hours saved:', hoursMode, weekHours);
    console.log('[BusinessHours] Formatted hours string:', formattedHours);
    updateVendor({ businessHours: formattedHours });
    unsavedChanges.resetChanges();
    router.back();
  };

  const handleDayPress = (day: keyof WeekHours) => {
    const hours = weekHours[day];
    router.push({
      pathname: '/vendor/settings/edit-day-hours' as any,
      params: {
        day,
        openTime: hours.open,
        closeTime: hours.close,
        closed: hours.closed.toString(),
      },
    });
  };

  const renderRadioButton = (selected: boolean) => (
    <View style={styles.radioOuter}>
      {selected && <View style={styles.radioInner} />}
    </View>
  );

  const renderDayRow = (day: keyof WeekHours) => {
    const hours = weekHours[day];
    const displayText = hours.closed
      ? 'Closed'
      : hoursMode === 'always'
      ? 'Open 24 hours'
      : `${hours.open} – ${hours.close}`;

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
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => setHoursMode('always')}
              activeOpacity={0.7}
            >
              {renderRadioButton(hoursMode === 'always')}
              <Text style={styles.radioLabel}>Always open</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => setHoursMode('selected')}
              activeOpacity={0.7}
            >
              {renderRadioButton(hoursMode === 'selected')}
              <Text style={styles.radioLabel}>Open for selected hours</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.daysCard}>
            {renderDayRow('Sunday')}
            <View style={styles.divider} />
            {renderDayRow('Monday')}
            <View style={styles.divider} />
            {renderDayRow('Tuesday')}
            <View style={styles.divider} />
            {renderDayRow('Wednesday')}
            <View style={styles.divider} />
            {renderDayRow('Thursday')}
            <View style={styles.divider} />
            {renderDayRow('Friday')}
            <View style={styles.divider} />
            {renderDayRow('Saturday')}
          </View>

          {hoursMode === 'selected' && (
            <View style={styles.warningBox}>
              <AlertTriangle size={16} color={Colors.primary} />
              <Text style={styles.warningText}>
                These hours do not limit ordering. They are shown for reference only.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            activeOpacity={0.7}
          >
            <Text style={styles.saveButtonText}>Save</Text>
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
        message="If you leave now, your unsaved changes will be lost."
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
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  radioRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  radioLabel: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 16,
  },
  daysCard: {
    backgroundColor: Colors.surface,
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
    fontSize: 17,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  dayRightContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  dayHours: {
    fontSize: 17,
    color: Colors.textSecondary,
    fontWeight: '400' as const,
  },
  dayHoursDisabled: {
    color: Colors.textMuted,
  },
  warningBox: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: Colors.primary,
    lineHeight: 20,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginTop: 32,
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
