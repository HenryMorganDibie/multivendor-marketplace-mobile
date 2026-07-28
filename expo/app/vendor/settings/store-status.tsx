import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import EditScreenHeader from '@/components/EditScreenHeader';
import { ChevronRight, Clock, Store } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useVendor } from '@/contexts/VendorContext';
import { DayHoursConfig } from '@/mocks/vendorData';
import * as Haptics from 'expo-haptics';

type StatusMode = 'follow_hours' | 'manual';
type DayName = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

const DAYS: DayName[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS: Record<DayName, string> = {
  Sunday: 'Sun',
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
};

const DEFAULT_HOURS: Record<DayName, DayHoursConfig> = {
  Sunday: { closed: true, ranges: [] },
  Monday: { closed: false, ranges: [{ open: '9:00 AM', close: '6:00 PM' }] },
  Tuesday: { closed: false, ranges: [{ open: '9:00 AM', close: '6:00 PM' }] },
  Wednesday: { closed: false, ranges: [{ open: '9:00 AM', close: '6:00 PM' }] },
  Thursday: { closed: false, ranges: [{ open: '9:00 AM', close: '6:00 PM' }] },
  Friday: { closed: false, ranges: [{ open: '9:00 AM', close: '6:00 PM' }] },
  Saturday: { closed: false, ranges: [{ open: '9:00 AM', close: '6:00 PM' }] },
};

function getStatusPreview(
  mode: StatusMode,
  closedForOrders: boolean,
  weeklyHours: Record<DayName, DayHoursConfig>,
): { label: string; isOpen: boolean } {
  if (mode === 'manual') {
    if (closedForOrders) {
      const now = new Date();
      const currentDay = DAYS[now.getDay()];
      const todayHours = weeklyHours[currentDay];

      if (!todayHours.closed && todayHours.ranges.length > 0) {
        return { label: 'Closed for orders', isOpen: false };
      }

      for (let i = 1; i <= 7; i++) {
        const nextDay = DAYS[(now.getDay() + i) % 7];
        const nextHours = weeklyHours[nextDay];
        if (!nextHours.closed && nextHours.ranges.length > 0) {
          const dayLabel = i === 1 ? 'tomorrow' : nextDay;
          return {
            label: `Closed · Opens ${dayLabel} at ${nextHours.ranges[0].open}`,
            isOpen: false,
          };
        }
      }
      return { label: 'Closed for orders', isOpen: false };
    }
    return { label: 'Open for orders', isOpen: true };
  }

  const now = new Date();
  const currentDay = DAYS[now.getDay()];
  const todayHours = weeklyHours[currentDay];

  if (todayHours.closed || todayHours.ranges.length === 0) {
    for (let i = 1; i <= 7; i++) {
      const nextDay = DAYS[(now.getDay() + i) % 7];
      const nextHours = weeklyHours[nextDay];
      if (!nextHours.closed && nextHours.ranges.length > 0) {
        const dayLabel = i === 1 ? 'tomorrow' : nextDay;
        return {
          label: `Closed · Opens ${dayLabel} at ${nextHours.ranges[0].open}`,
          isOpen: false,
        };
      }
    }
    return { label: 'Closed', isOpen: false };
  }

  const lastRange = todayHours.ranges[todayHours.ranges.length - 1];
  return {
    label: `Open · Closes at ${lastRange.close}`,
    isOpen: true,
  };
}

function SavedToast({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1500),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.toast, { opacity }]}>
      <Text style={styles.toastText}>✓ Saved</Text>
    </Animated.View>
  );
}

export default function StoreStatusScreen() {
  const router = useRouter();
  const { vendor, updateVendor } = useVendor();

  const [statusMode, setStatusMode] = useState<StatusMode>(
    vendor.storeStatusMode ?? 'follow_hours'
  );
  const [closedForOrders, setClosedForOrders] = useState<boolean>(
    vendor.closedForOrders ?? false
  );
  const weeklyHours = (vendor.weeklyHours ?? DEFAULT_HOURS) as Record<DayName, DayHoursConfig>;

  const [toastKey, setToastKey] = useState<number>(0);
  const [showToast, setShowToast] = useState<boolean>(false);

  const showSavedToast = useCallback(() => {
    setShowToast(false);
    setTimeout(() => {
      setToastKey(prev => prev + 1);
      setShowToast(true);
    }, 50);
    setTimeout(() => setShowToast(false), 2200);
  }, []);

  const handleModeChange = useCallback((mode: StatusMode) => {
    console.log('[StoreStatus] Mode changed to:', mode);
    setStatusMode(mode);
    updateVendor({ storeStatusMode: mode });
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    showSavedToast();
  }, [updateVendor, showSavedToast]);

  const handleClosedToggle = useCallback((value: boolean) => {
    console.log('[StoreStatus] Closed for orders:', value);
    setClosedForOrders(value);
    updateVendor({
      closedForOrders: value,
      storeStatus: value ? 'closed' : 'open',
    });
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    showSavedToast();
  }, [updateVendor, showSavedToast]);

  const handleDayPress = useCallback((day: DayName) => {
    const hours = weeklyHours[day];
    const firstRange = hours.ranges[0];
    router.push({
      pathname: '/vendor/settings/edit-day-hours' as any,
      params: {
        day,
        openTime: firstRange?.open ?? '9:00 AM',
        closeTime: firstRange?.close ?? '6:00 PM',
        closed: hours.closed.toString(),
        ranges: JSON.stringify(hours.ranges),
      },
    });
  }, [weeklyHours, router]);

  const statusPreview = getStatusPreview(statusMode, closedForOrders, weeklyHours);

  const formatDayHours = (config: DayHoursConfig): string => {
    if (config.closed || config.ranges.length === 0) return 'Closed';
    return config.ranges.map(r => `${r.open} to ${r.close}`).join(', ');
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Store Status" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.statusPreviewCard, statusPreview.isOpen ? styles.statusCardOpen : styles.statusCardClosed]}>
            <View style={[styles.statusDot, statusPreview.isOpen ? styles.statusDotOpen : styles.statusDotClosed]} />
            <Text style={[styles.statusPreviewText, statusPreview.isOpen ? styles.statusTextOpen : styles.statusTextClosed]}>{statusPreview.label}</Text>
          </View>

          <Text style={styles.sectionTitle}>STATUS MODE</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.modeRow}
              onPress={() => handleModeChange('follow_hours')}
              activeOpacity={0.7}
            >
              <View style={styles.modeRowLeft}>
                <Clock size={20} color={statusMode === 'follow_hours' ? Colors.primary : Colors.textSecondary} />
                <View style={styles.modeTextContainer}>
                  <Text style={[styles.modeLabel, statusMode === 'follow_hours' && styles.modeLabelActive]}>
                    Follow Business Hours
                  </Text>
                  <Text style={styles.modeDescription}>
                    Opens and closes automatically
                  </Text>
                </View>
              </View>
              <View style={[styles.radioOuter, statusMode === 'follow_hours' && styles.radioOuterActive]}>
                {statusMode === 'follow_hours' && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.modeRow}
              onPress={() => handleModeChange('manual')}
              activeOpacity={0.7}
            >
              <View style={styles.modeRowLeft}>
                <Store size={20} color={statusMode === 'manual' ? Colors.primary : Colors.textSecondary} />
                <View style={styles.modeTextContainer}>
                  <Text style={[styles.modeLabel, statusMode === 'manual' && styles.modeLabelActive]}>
                    Manually Control
                  </Text>
                  <Text style={styles.modeDescription}>
                    You decide when to open or close
                  </Text>
                </View>
              </View>
              <View style={[styles.radioOuter, statusMode === 'manual' && styles.radioOuterActive]}>
                {statusMode === 'manual' && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          </View>

          {statusMode === 'manual' && (
            <>
              <Text style={styles.sectionTitle}>STORE STATUS</Text>
              <View style={styles.card}>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleTextContainer}>
                    <Text style={styles.toggleLabel}>Closed for orders</Text>
                    <Text style={styles.toggleDescription}>
                      Customers can browse but not order
                    </Text>
                  </View>
                  <Switch
                    value={closedForOrders}
                    onValueChange={handleClosedToggle}
                    trackColor={{ false: Colors.border, true: Colors.primary }}
                    thumbColor={Colors.white}
                  />
                </View>
              </View>
            </>
          )}

          <Text style={styles.sectionTitle}>BUSINESS HOURS</Text>
          <View style={styles.card}>
            {DAYS.map((day, index) => {
              const config = weeklyHours[day];
              const hoursText = formatDayHours(config);
              const isClosed = config.closed || config.ranges.length === 0;
              const isToday = new Date().getDay() === index;

              return (
                <React.Fragment key={day}>
                  {index > 0 && <View style={styles.divider} />}
                  <TouchableOpacity
                    style={styles.dayRow}
                    onPress={() => handleDayPress(day)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dayLeft}>
                      {isToday && <View style={styles.todayIndicator} />}
                      <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
                        {Platform.OS === 'web' ? day : SHORT_DAYS[day]}
                      </Text>
                    </View>
                    <View style={styles.dayRight}>
                      <Text style={[styles.dayHours, isClosed && styles.dayHoursClosed]}>
                        {hoursText}
                      </Text>
                      <ChevronRight size={16} color={Colors.textMuted} />
                    </View>
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </View>

          <Text style={styles.footnote}>
            Business hours are shown for reference. Customers can still submit order requests outside these hours.
          </Text>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <SavedToast key={toastKey} visible={showToast} />
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
  statusPreviewCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 9,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 16,
  },
  statusCardOpen: {
    backgroundColor: Colors.successLight,
  },
  statusCardClosed: {
    backgroundColor: Colors.surface,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  statusDotOpen: {
    backgroundColor: Colors.success,
  },
  statusDotClosed: {
    backgroundColor: Colors.textMuted,
  },
  statusPreviewText: {
    fontSize: 14.5,
    fontWeight: '600' as const,
    flex: 1,
  },
  statusTextOpen: {
    color: Colors.success,
  },
  statusTextClosed: {
    color: Colors.text,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 0.6,
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden' as const,
  },
  modeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  modeRowLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    flex: 1,
  },
  modeTextContainer: {
    flex: 1,
  },
  modeLabel: {
    fontSize: 15.5,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  modeLabelActive: {
    fontWeight: '600' as const,
    color: Colors.text,
  },
  modeDescription: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  radioOuter: {
    width: 21,
    height: 21,
    borderRadius: 10.5,
    borderWidth: 2,
    borderColor: Colors.borderDark,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  radioOuterActive: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: Colors.primary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    opacity: 0.7,
    marginLeft: 16,
  },
  toggleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 15.5,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  toggleDescription: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  dayRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 11,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  dayLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  todayIndicator: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.primary,
  },
  dayName: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '400' as const,
    minWidth: 40,
  },
  dayNameToday: {
    fontWeight: '600' as const,
    color: Colors.text,
  },
  dayRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    flex: 1,
    justifyContent: 'flex-end' as const,
  },
  dayHours: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '400' as const,
    flexShrink: 1,
    textAlign: 'right' as const,
  },
  dayHoursClosed: {
    color: Colors.textMuted,
  },
  footnote: {
    fontSize: 12.5,
    color: Colors.textMuted,
    lineHeight: 17,
    marginTop: 14,
    paddingHorizontal: 4,
  },
  bottomSpacer: {
    height: 40,
  },
  toast: {
    position: 'absolute' as const,
    bottom: 100,
    alignSelf: 'center' as const,
    backgroundColor: Colors.charcoal,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.white,
  },
});
