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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Plus, Trash2 } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useVendor } from '@/contexts/VendorContext';
import { TimeRange, DayHoursConfig } from '@/mocks/vendorData';
import { callable } from '@/lib/firebase';
import * as Haptics from 'expo-haptics';
import EditScreenHeader from '@/components/EditScreenHeader';

type DayName = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

const parseTime = (timeStr: string): Date => {
  const [time, period] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const formatTime = (date: Date): string => {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  if (hours > 12) hours -= 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

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

export default function EditDayHoursScreen() {
  const router = useRouter();
  const { vendor, updateVendor } = useVendor();
  const { day, openTime, closeTime, closed, ranges: rangesParam } = useLocalSearchParams<{
    day: string;
    openTime: string;
    closeTime: string;
    closed: string;
    ranges: string;
  }>();

  const dayName = (day ?? 'Monday') as DayName;

  const initialRanges = (): TimeRange[] => {
    if (rangesParam) {
      try {
        const parsed = JSON.parse(rangesParam) as TimeRange[];
        if (parsed.length > 0) return parsed;
      } catch {
        console.log('[EditDayHours] Failed to parse ranges param');
      }
    }
    return [{ open: openTime ?? '9:00 AM', close: closeTime ?? '6:00 PM' }];
  };

  const [isOpen, setIsOpen] = useState<boolean>(closed !== 'true');
  const [timeRanges, setTimeRanges] = useState<TimeRange[]>(initialRanges);
  const [editingPicker, setEditingPicker] = useState<{ rangeIndex: number; field: 'open' | 'close' } | null>(null);
  const [toastKey, setToastKey] = useState<number>(0);
  const [showToast, setShowToast] = useState<boolean>(false);
  const hasAutoSaved = useRef<boolean>(false);

  const showSavedToast = useCallback(() => {
    setShowToast(false);
    setTimeout(() => {
      setToastKey(prev => prev + 1);
      setShowToast(true);
    }, 50);
    setTimeout(() => setShowToast(false), 2200);
  }, []);

  const autoSave = useCallback(async (open: boolean, ranges: TimeRange[]) => {
    const currentHours = vendor.weeklyHours ?? {};
    const updatedConfig: DayHoursConfig = {
      closed: !open,
      ranges: open ? ranges : [],
    };

    const updatedHours = {
      ...currentHours,
      [dayName]: updatedConfig,
    };

    console.log('[EditDayHours] Auto-saving:', dayName, updatedConfig);
    try {
      // weeklyHours is already an accepted field on the real
      // updateVendorSettings callable (Store Status & Availability) — this
      // screen was the one caller still writing it to AsyncStorage only via
      // updateVendor(), so a saved day's hours never reached the backend and
      // were never seen by customers or the vendor on another device.
      const update = callable<{ weeklyHours: Record<string, DayHoursConfig> }, { success: true }>('updateVendorSettings');
      await update({ weeklyHours: updatedHours });
      // Optimistic local merge — the live vendor listener will confirm this
      // with the real document moments later, so this never fights it.
      updateVendor({ weeklyHours: updatedHours as any });
      hasAutoSaved.current = true;
      showSavedToast();
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (err) {
      console.error('[EditDayHours] updateVendorSettings failed:', err);
    }
  }, [dayName, vendor.weeklyHours, updateVendor, showSavedToast]);

  const handleOpenToggle = useCallback((value: boolean) => {
    setIsOpen(value);
    if (value && timeRanges.length === 0) {
      const defaultRanges = [{ open: '9:00 AM', close: '6:00 PM' }];
      setTimeRanges(defaultRanges);
      autoSave(value, defaultRanges);
    } else {
      autoSave(value, timeRanges);
    }
  }, [timeRanges, autoSave]);

  const handleAddRange = useCallback(() => {
    const lastRange = timeRanges[timeRanges.length - 1];
    const newOpen = lastRange ? lastRange.close : '12:00 PM';
    const newRanges = [...timeRanges, { open: newOpen, close: '9:00 PM' }];
    setTimeRanges(newRanges);
    autoSave(isOpen, newRanges);
  }, [timeRanges, isOpen, autoSave]);

  const handleRemoveRange = useCallback((index: number) => {
    const newRanges = timeRanges.filter((_, i) => i !== index);
    setTimeRanges(newRanges);
    autoSave(isOpen, newRanges);
  }, [timeRanges, isOpen, autoSave]);

  const handleTimeChange = useCallback((event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setEditingPicker(null);
    }
    if (selectedDate && editingPicker) {
      const { rangeIndex, field } = editingPicker;
      const newRanges = [...timeRanges];
      newRanges[rangeIndex] = {
        ...newRanges[rangeIndex],
        [field]: formatTime(selectedDate),
      };
      setTimeRanges(newRanges);
      autoSave(isOpen, newRanges);
    }
  }, [editingPicker, timeRanges, isOpen, autoSave]);

  const getPickerValue = (): Date => {
    if (!editingPicker) return new Date();
    const range = timeRanges[editingPicker.rangeIndex];
    if (!range) return new Date();
    return parseTime(range[editingPicker.field]);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Edit Hours" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.toggleLabel}>Open</Text>
                <Text style={styles.toggleSub}>{isOpen ? `${dayName} is open for business` : `${dayName} is marked closed`}</Text>
              </View>
              <Switch
                value={isOpen}
                onValueChange={handleOpenToggle}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          </View>

          {isOpen && (
            <>
              <Text style={styles.sectionTitle}>HOURS</Text>
              {timeRanges.map((range, index) => (
                <View key={index} style={[styles.card, index > 0 && styles.cardSpaced]}>
                  <TouchableOpacity
                    style={styles.timeRow}
                    onPress={() => setEditingPicker({ rangeIndex: index, field: 'open' })}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.timeLabel}>Start</Text>
                    <Text style={styles.timeValue}>{range.open}</Text>
                  </TouchableOpacity>
                  <View style={styles.divider} />
                  <TouchableOpacity
                    style={styles.timeRow}
                    onPress={() => setEditingPicker({ rangeIndex: index, field: 'close' })}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.timeLabel}>End</Text>
                    <Text style={styles.timeValue}>{range.close}</Text>
                  </TouchableOpacity>
                  {timeRanges.length > 1 && (
                    <>
                      <View style={styles.divider} />
                      <TouchableOpacity
                        style={styles.removeRow}
                        onPress={() => handleRemoveRange(index)}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={16} color={Colors.error} />
                        <Text style={styles.removeText}>Remove</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              ))}

              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddRange}
                activeOpacity={0.7}
              >
                <Plus size={16} color={Colors.primary} />
                <Text style={styles.addButtonText}>Add another time range</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {editingPicker && (
          <>
            {Platform.OS === 'ios' && (
              <View style={styles.pickerOverlay}>
                <View style={styles.pickerContainer}>
                  <View style={styles.pickerHeader}>
                    <TouchableOpacity
                      onPress={() => setEditingPicker(null)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.pickerDone}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={getPickerValue()}
                    mode="time"
                    display="spinner"
                    onChange={handleTimeChange}
                    style={styles.picker}
                  />
                </View>
              </View>
            )}
            {Platform.OS === 'android' && (
              <DateTimePicker
                value={getPickerValue()}
                mode="time"
                display="default"
                onChange={handleTimeChange}
              />
            )}
            {Platform.OS === 'web' && (
              <View style={styles.pickerOverlay}>
                <View style={styles.pickerContainer}>
                  <View style={styles.pickerHeader}>
                    <TouchableOpacity
                      onPress={() => setEditingPicker(null)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.pickerDone}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={getPickerValue()}
                    mode="time"
                    display="spinner"
                    onChange={handleTimeChange}
                  />
                </View>
              </View>
            )}
          </>
        )}
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
    marginTop: 16,
  },
  cardSpaced: {
    marginTop: 10,
  },
  toggleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  toggleTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 15.5,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  toggleSub: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    opacity: 0.7,
    marginLeft: 16,
  },
  timeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  timeLabel: {
    fontSize: 15.5,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  timeValue: {
    fontSize: 15.5,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  removeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
  },
  removeText: {
    fontSize: 13.5,
    color: Colors.error,
    fontWeight: '500' as const,
  },
  addButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    marginTop: 12,
    paddingVertical: 12,
    backgroundColor: Colors.primarySoft,
    borderRadius: 12,
  },
  addButtonText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  bottomSpacer: {
    height: 40,
  },
  pickerOverlay: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end' as const,
    flex: 1,
  },
  pickerContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  pickerHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  pickerDone: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  picker: {
    height: 200,
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
