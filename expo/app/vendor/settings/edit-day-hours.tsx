import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Plus, CircleAlert } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { TimeRange } from '@/mocks/vendorData';
import { setPendingDayEdit } from '@/utils/businessHoursDraft';
import * as Haptics from 'expo-haptics';
import EditScreenHeader from '@/components/EditScreenHeader';

type DayName = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

// Product rule: an open day may have at most 2 time ranges (e.g. a lunch
// split). Matches the backend's MAX_RANGES_PER_DAY in updateVendorSettings.ts.
const MAX_RANGES_PER_DAY = 2;

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

// Minutes-since-midnight, for range validation only -- not a display format.
const timeToMinutes = (timeStr: string): number => {
  const d = parseTime(timeStr);
  return d.getHours() * 60 + d.getMinutes();
};

const formatFromMinutes = (totalMinutes: number): string => {
  const date = new Date();
  date.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
  return formatTime(date);
};

const IMPOSSIBLE_START_MESSAGE = 'Start time must be earlier than 11:59 PM.';
const IMPOSSIBLE_END_MESSAGE = 'End time must be later than 12:00 AM.';

// 1439 = 11:59 PM, the day's last minute -- nothing same-day is later, so it
// can never be a valid Start. 0 = 12:00 AM, the day's first minute -- nothing
// same-day is earlier, so it can never be a valid End. Ranges are same-day
// only; there is no overnight/next-day representation.
function isImpossibleFinalValue(field: 'open' | 'close', minutesOfDay: number): boolean {
  return field === 'open' ? minutesOfDay === 1439 : minutesOfDay === 0;
}

/**
 * Shared across web, iOS, and Android: the one place a range's opposite
 * endpoint is ever adjusted. The endpoint the vendor just picked (`newValue`)
 * is always written back verbatim -- this function only ever computes the
 * *other* field, and only moves it when the vendor's pick would otherwise
 * make the pair invalid. Never called with a `newValue` that resolves to an
 * impossible minute for its field -- each platform's Done/confirm path gates
 * that separately (see isImpossibleFinalValue), so the two branches below
 * are always able to produce a strictly-valid same-day pair.
 */
function reconcileRange(field: 'open' | 'close', newValue: string, currentRange: TimeRange): TimeRange {
  if (field === 'open') {
    const newMin = timeToMinutes(newValue);
    const endMin = timeToMinutes(currentRange.close);
    if (newMin < endMin) return { open: newValue, close: currentRange.close };
    const advancedEndMin = Math.min(newMin + 5, 1439);
    return { open: newValue, close: formatFromMinutes(advancedEndMin) };
  }
  const newMin = timeToMinutes(newValue);
  const startMin = timeToMinutes(currentRange.open);
  if (newMin > startMin) return { open: currentRange.open, close: newValue };
  const retreatedStartMin = Math.max(newMin - 5, 0);
  return { open: formatFromMinutes(retreatedStartMin), close: newValue };
}

// The web wheel's normal minute choices stay 5-minute increments -- new
// selections are never finer-grained than this. BASE_WEB_WHEEL_MINUTES is
// the fixed list; buildWebMinuteOptions below only ever adds the one exact
// minute a persisted time already has, so an existing non-5-multiple value
// (the Always Open boundary's :59, or a time set via the native iOS spinner
// like 5:47 PM) can still be seen and preserved rather than appearing
// unselected.
const BASE_WEB_WHEEL_MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function buildWebMinuteOptions(minute: number): number[] {
  if (BASE_WEB_WHEEL_MINUTES.includes(minute)) return BASE_WEB_WHEEL_MINUTES;
  return [...BASE_WEB_WHEEL_MINUTES, minute].sort((a, b) => a - b);
}

const WEB_WHEEL_HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const WEB_WHEEL_PERIODS = ['AM', 'PM'] as const;

// Comfortable touch target (>= 44px is the standard minimum); also the wheel's
// row pitch, so a settled scroll offset is always an exact multiple of this.
const WHEEL_ITEM_HEIGHT = 44;
const WHEEL_VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS;
const WHEEL_PADDING = WHEEL_ITEM_HEIGHT * Math.floor(WHEEL_VISIBLE_ROWS / 2);
// react-native-web's ScrollView never fires onScrollEndDrag/onMomentumScrollEnd
// at all (verified against its source: ScrollViewBase only ever calls
// `onScroll`, once per tick and once more ~100ms after the last scroll event).
// snapToInterval and contentOffset are likewise no-ops there. So on web there
// is exactly one real signal available -- onScroll -- and this is the single
// place a settled value is ever committed: a scroll that produces no further
// onScroll for WHEEL_SETTLE_MS is treated as "stopped", the nearest row is
// computed once, and that's the only path that calls onSettle. A tap just
// asks the ScrollView to scroll to that row; the resulting settle goes through
// this exact same path, not a second one.
const WHEEL_SETTLE_MS = 120;

/**
 * One vertically drag-scrollable wheel column (hour, minute, or AM/PM).
 * Its parent (renderInlineWheels, below) only ever renders while its own
 * Start/End row is the one being edited, so switching fields, switching
 * ranges, or closing the picker unmounts this component -- it never carries
 * scroll position, live index, or a pending settle timer into the next
 * picker session.
 */
function InlineWheel<T extends string | number>({
  options,
  selectedValue,
  formatLabel,
  onSettle,
}: {
  options: readonly T[];
  selectedValue: T;
  formatLabel: (value: T) => string;
  onSettle: (value: T) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialIndex = Math.max(0, options.indexOf(selectedValue));
  const [centeredIndex, setCenteredIndex] = useState(initialIndex);

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ y: initialIndex * WHEEL_ITEM_HEIGHT, animated: false });
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
    // Mount-only: this component is force-remounted per picker session by its
    // parent's `key`, so re-seeding on prop changes would fight the user's
    // own in-progress scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = useCallback((e: any) => {
    const offsetY = e.nativeEvent.contentOffset.y as number;
    const nearest = Math.min(options.length - 1, Math.max(0, Math.round(offsetY / WHEEL_ITEM_HEIGHT)));
    setCenteredIndex(nearest);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: nearest * WHEEL_ITEM_HEIGHT, animated: true });
      onSettle(options[nearest]);
    }, WHEEL_SETTLE_MS);
  }, [options, onSettle]);

  return (
    <ScrollView
      ref={scrollRef}
      // `overscrollBehavior` is a web-only CSS property with no equivalent
      // in React Native's ViewStyle -- cast narrowly here rather than
      // widening the whole shared stylesheet's typing. It stops a wheel
      // that's hit its scroll limit from also dragging the outer page
      // ScrollView (scroll chaining), scoped to just this element.
      style={[styles.wheelColumn, { overscrollBehavior: 'contain' } as any]}
      contentContainerStyle={{ paddingVertical: WHEEL_PADDING }}
      showsVerticalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={16}
    >
      {options.map((option, index) => {
        const distance = Math.abs(index - centeredIndex);
        return (
          <TouchableOpacity
            key={String(option)}
            style={styles.wheelItem}
            activeOpacity={0.6}
            onPress={() => scrollRef.current?.scrollTo({ y: index * WHEEL_ITEM_HEIGHT, animated: true })}
          >
            <Text
              style={[
                styles.wheelItemText,
                distance === 1 && styles.wheelItemTextNear,
                distance >= 2 && styles.wheelItemTextFar,
                distance === 0 && styles.wheelItemTextSelected,
              ]}
            >
              {formatLabel(option)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/**
 * UX-only validation -- the backend (updateVendorSettings.ts) remains the
 * authoritative check and does not itself enforce ordering or duplicates,
 * only time-string format, structural shape, and the same MAX_RANGES_PER_DAY
 * cap. Business Hours are informational only and don't gate order
 * availability, so separate ranges are allowed to overlap or touch (e.g.
 * "9 AM-6 PM" + "5 PM-9 PM") -- this is intentionally not checked here.
 *
 * What remains is a safety net, not the primary interaction: normal picker
 * use (reconcileRange, above) already keeps every freshly-edited range's own
 * Start < End, so the order check below should rarely fire in practice --
 * it stays only to catch a range this session never touched (pre-existing
 * malformed/legacy data). Exact duplicates remain genuinely reachable
 * through normal use (e.g. editing Range 2 to coincidentally match Range 1)
 * and are still rejected, since a duplicate range adds no information.
 *
 * The length>MAX check also covers legacy data: a day persisted before this
 * cap existed could already have more than 2 ranges. Nothing here deletes or
 * truncates that data -- the vendor sees every existing range when they open
 * the day, and this message tells them to remove the extra one(s) themselves
 * before the draft can be applied. An untouched day's legacy data is never
 * read or rewritten by this screen at all.
 */
function validateRanges(ranges: TimeRange[]): string | null {
  if (ranges.length === 0) return 'Add at least one time range, or mark the day closed.';
  if (ranges.length > MAX_RANGES_PER_DAY) {
    return `Maximum ${MAX_RANGES_PER_DAY} time ranges per day. Remove one to continue.`;
  }
  const withMinutes = ranges.map((r) => ({ ...r, openMin: timeToMinutes(r.open), closeMin: timeToMinutes(r.close) }));
  for (const r of withMinutes) {
    if (r.closeMin <= r.openMin) {
      return 'End time must be after start time for every range.';
    }
  }
  for (let i = 0; i < withMinutes.length; i++) {
    for (let j = i + 1; j < withMinutes.length; j++) {
      const a = withMinutes[i];
      const b = withMinutes[j];
      if (a.open === b.open && a.close === b.close) {
        return 'Time ranges cannot be identical.';
      }
    }
  }
  return null;
}

export default function EditDayHoursScreen() {
  const router = useRouter();
  const { day, openTime, closeTime, closed, ranges: rangesParam, vendorId, sessionId } = useLocalSearchParams<{
    day: string;
    openTime: string;
    closeTime: string;
    closed: string;
    ranges: string;
    vendorId: string;
    sessionId: string;
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
  // @react-native-community/datetimepicker ships no web implementation (its
  // module resolution falls back to a stub that always renders null on any
  // platform other than ios/android/windows -- see the round-2 report for
  // the full root cause). Web/Safari instead gets this self-contained
  // hour/minute/AM-PM wheel, held entirely in local state until Done so
  // Cancel never has to touch timeRanges at all.
  const [webPickerValue, setWebPickerValue] = useState<{ hour: number; minute: number; period: 'AM' | 'PM' } | null>(null);
  // Snapshotted fresh in openPicker for every field/range tapped -- never
  // carries over from a previously opened picker.
  const [webMinuteOptions, setWebMinuteOptions] = useState<number[]>(BASE_WEB_WHEEL_MINUTES);
  // iOS's native spinner fires onChange continuously while it's moving. This
  // stages that in-progress value locally -- exactly like webPickerValue --
  // so timeRanges is only ever written once, atomically, on the sheet's own
  // Done. Unused on web/Android (Android's confirmation is already atomic;
  // it needs no staging at all).
  const [nativePickerValue, setNativePickerValue] = useState<Date | null>(null);
  // Android-only: its native OK button can't be disabled in advance, so an
  // impossible confirmation (Start 11:59 PM / End 12:00 AM) is rejected
  // after the fact -- timeRanges is left untouched and this message explains
  // why, right under the affected row. Scoped to the exact rangeIndex+field
  // that was rejected, so it can never render under -- or be cleared by --
  // a different range/endpoint. Persists across reopening that same picker;
  // only clears once that exact target is successfully reconfirmed with a
  // valid value (see handleAndroidTimeChange).
  const [pickerRejectionMessage, setPickerRejectionMessage] = useState<{ rangeIndex: number; field: 'open' | 'close'; text: string } | null>(null);

  const validationError = useMemo(
    () => (isOpen ? validateRanges(timeRanges) : null),
    [isOpen, timeRanges]
  );

  const navigation = useNavigation();
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (validationError) {
        // Rare safety net (duplicate ranges, or pre-existing malformed
        // data never touched this session) -- stay put, preserve every
        // local value, keep showing the existing validation message. No
        // confirmation dialog, no re-dispatch of the blocked action.
        e.preventDefault();
        return;
      }
      // Valid: commit to the parent's local draft via the existing relay
      // and let the original navigation action (chevron tap, iOS
      // swipe-back gesture, Android hardware Back, or -- in the web
      // preview only -- browser Back) proceed exactly as dispatched.
      setPendingDayEdit(vendorId, sessionId, dayName, {
        closed: !isOpen,
        ranges: isOpen ? timeRanges : [],
      });
    });
    return unsubscribe;
  }, [navigation, validationError, vendorId, sessionId, dayName, isOpen, timeRanges]);

  const handleOpenToggle = useCallback((value: boolean) => {
    setIsOpen(value);
    if (value && timeRanges.length === 0) {
      setTimeRanges([{ open: '9:00 AM', close: '6:00 PM' }]);
    }
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [timeRanges]);

  const handleAddRange = useCallback(() => {
    if (timeRanges.length >= MAX_RANGES_PER_DAY) return;
    const lastRange = timeRanges[timeRanges.length - 1];
    const newOpen = lastRange ? lastRange.close : '12:00 PM';
    setTimeRanges([...timeRanges, { open: newOpen, close: '9:00 PM' }]);
  }, [timeRanges]);

  const handleRemoveRange = useCallback((index: number) => {
    // An Open day must never end up with zero ranges. Removing the last
    // remaining range is a no-op rather than something the Done-time
    // validation has to catch after the fact -- the vendor's way to end up
    // with no hours for this day is to switch it to Closed instead.
    if (timeRanges.length <= 1) {
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      return;
    }
    setTimeRanges(timeRanges.filter((_, i) => i !== index));
  }, [timeRanges]);

  // iOS only: the spinner's onChange fires continuously while it's moving.
  // This only ever stages nativePickerValue -- timeRanges is untouched here.
  const handleNativeSpinnerChange = useCallback((event: any, selectedDate?: Date) => {
    if (selectedDate) setNativePickerValue(selectedDate);
  }, []);

  // Android only: the OS dialog's own onChange fires exactly once, already
  // finalized -- this is the single atomic confirmation point. The dialog
  // is already dismissed by the time this runs, so an impossible value
  // can only be rejected after the fact, never prevented in advance.
  const handleAndroidTimeChange = useCallback((event: any, selectedDate?: Date) => {
    setEditingPicker(null);
    if (!selectedDate || !editingPicker) return;
    const { rangeIndex, field } = editingPicker;
    const newValue = formatTime(selectedDate);
    const newMin = timeToMinutes(newValue);
    if (isImpossibleFinalValue(field, newMin)) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setPickerRejectionMessage({
        rangeIndex,
        field,
        text: field === 'open' ? IMPOSSIBLE_START_MESSAGE : IMPOSSIBLE_END_MESSAGE,
      });
      return;
    }
    // Clear only if this exact target (rangeIndex + field) is the one that
    // was rejected -- a rejection stored for a different range/field must
    // never be cleared by an unrelated successful confirmation.
    setPickerRejectionMessage((prev) => (prev && prev.rangeIndex === rangeIndex && prev.field === field ? null : prev));
    setTimeRanges((prev) => {
      const next = [...prev];
      if (next[rangeIndex]) next[rangeIndex] = reconcileRange(field, newValue, next[rangeIndex]);
      return next;
    });
  }, [editingPicker]);

  const openPicker = useCallback((rangeIndex: number, field: 'open' | 'close') => {
    const current = timeRanges[rangeIndex]?.[field] ?? null;
    // Opening a picker -- even reopening the same rejected target, or
    // opening a different one -- never clears an existing rejection on its
    // own. It only ever clears via a matching successful confirmation
    // above, so it stays visible until the vendor actually fixes it.
    if (Platform.OS === 'web' && current) {
      const d = parseTime(current);
      let hour = d.getHours() % 12;
      if (hour === 0) hour = 12;
      const minute = d.getMinutes();
      setWebPickerValue({ hour, minute, period: d.getHours() >= 12 ? 'PM' : 'AM' });
      setWebMinuteOptions(buildWebMinuteOptions(minute));
    }
    if (Platform.OS === 'ios' && current) {
      setNativePickerValue(parseTime(current));
    }
    setEditingPicker({ rangeIndex, field });
  }, [timeRanges]);

  // iOS only: nothing was ever written to timeRanges during scrolling, so
  // Cancel is now a pure no-op on data -- just close and drop the staged value.
  const handleNativeCancel = useCallback(() => {
    setEditingPicker(null);
    setNativePickerValue(null);
  }, []);

  // iOS only: the sheet's Done -- the single, atomic point nativePickerValue
  // is ever applied to timeRanges. Guarded defensively against the
  // impossible case even though the Done button is disabled for it (see
  // renderPickerSheet), so this can never silently apply that value.
  const handleNativeDone = useCallback(() => {
    if (editingPicker && nativePickerValue) {
      const { rangeIndex, field } = editingPicker;
      const newValue = formatTime(nativePickerValue);
      const newMin = timeToMinutes(newValue);
      if (!isImpossibleFinalValue(field, newMin)) {
        setTimeRanges((prev) => {
          const next = [...prev];
          if (next[rangeIndex]) next[rangeIndex] = reconcileRange(field, newValue, next[rangeIndex]);
          return next;
        });
      }
    }
    setEditingPicker(null);
    setNativePickerValue(null);
  }, [editingPicker, nativePickerValue]);

  const getPickerValue = (): Date => {
    if (!editingPicker) return new Date();
    const range = timeRanges[editingPicker.rangeIndex];
    if (!range) return new Date();
    return parseTime(range[editingPicker.field]);
  };

  const pickerTitle = editingPicker?.field === 'close' ? 'End Time' : 'Start Time';

  const handleWebPickerDone = useCallback(() => {
    if (editingPicker && webPickerValue) {
      const { rangeIndex, field } = editingPicker;
      let hour24 = webPickerValue.hour % 12;
      if (webPickerValue.period === 'PM') hour24 += 12;
      const newMin = hour24 * 60 + webPickerValue.minute;
      if (!isImpossibleFinalValue(field, newMin)) {
        const newValue = formatFromMinutes(newMin);
        setTimeRanges((prev) => {
          const next = [...prev];
          if (next[rangeIndex]) next[rangeIndex] = reconcileRange(field, newValue, next[rangeIndex]);
          return next;
        });
      }
    }
    setEditingPicker(null);
    setWebPickerValue(null);
    setWebMinuteOptions(BASE_WEB_WHEEL_MINUTES);
  }, [editingPicker, webPickerValue]);

  const handleWebPickerCancel = useCallback(() => {
    setEditingPicker(null);
    setWebPickerValue(null);
    setWebMinuteOptions(BASE_WEB_WHEEL_MINUTES);
  }, []);

  // Rendered inline, directly under whichever Start/End row is active -- see
  // the render call sites inside the ranges map below. Each call site only
  // renders this while its own row is the one in `editingPicker`, and since
  // `editingPicker`/`webPickerValue` are single shared state slots, switching
  // to a different field/range (or closing) always transitions the old call
  // site's condition to false before any other one can become true -- so the
  // three InlineWheel columns are naturally unmounted and freshly remounted
  // on every new picker session, never carrying over scroll position, live
  // index, or pending settle timers from a previous one.
  const renderInlineWheels = () => {
    if (!webPickerValue || !editingPicker) return null;
    const value = webPickerValue;
    const field = editingPicker.field;
    let hour24 = value.hour % 12;
    if (value.period === 'PM') hour24 += 12;
    const isImpossible = isImpossibleFinalValue(field, hour24 * 60 + value.minute);
    return (
      <View style={styles.inlineWheelWrap}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity onPress={handleWebPickerCancel} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.pickerCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.pickerTitle}>{pickerTitle}</Text>
          <TouchableOpacity onPress={isImpossible ? undefined : handleWebPickerDone} disabled={isImpossible} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[styles.pickerDone, isImpossible && styles.pickerDoneDisabled]}>Done</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.wheelRow}>
          <View pointerEvents="none" style={styles.wheelSelectionBand} />
          <InlineWheel
            options={WEB_WHEEL_HOURS}
            selectedValue={value.hour}
            formatLabel={(h) => String(h)}
            onSettle={(h) => setWebPickerValue((v) => (v ? { ...v, hour: h } : v))}
          />
          <InlineWheel
            options={webMinuteOptions}
            selectedValue={value.minute}
            formatLabel={(m) => m.toString().padStart(2, '0')}
            onSettle={(m) => setWebPickerValue((v) => (v ? { ...v, minute: m } : v))}
          />
          <InlineWheel
            options={WEB_WHEEL_PERIODS}
            selectedValue={value.period}
            formatLabel={(p) => p}
            onSettle={(p) => setWebPickerValue((v) => (v ? { ...v, period: p } : v))}
          />
        </View>
        {isImpossible && (
          <Text style={styles.pickerImpossibleHint}>
            {field === 'open' ? IMPOSSIBLE_START_MESSAGE : IMPOSSIBLE_END_MESSAGE}
          </Text>
        )}
      </View>
    );
  };

  const nativeImpossible = !!(
    editingPicker &&
    nativePickerValue &&
    isImpossibleFinalValue(editingPicker.field, timeToMinutes(formatTime(nativePickerValue)))
  );

  const renderPickerSheet = () => (
    <View style={styles.pickerOverlay}>
      <View style={styles.pickerContainer}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity onPress={handleNativeCancel} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.pickerCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.pickerTitle}>{pickerTitle}</Text>
          <TouchableOpacity onPress={nativeImpossible ? undefined : handleNativeDone} disabled={nativeImpossible} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.pickerDone, nativeImpossible && styles.pickerDoneDisabled]}>Done</Text>
          </TouchableOpacity>
        </View>
        <DateTimePicker
          value={nativePickerValue ?? getPickerValue()}
          mode="time"
          display="spinner"
          onChange={handleNativeSpinnerChange}
          style={styles.picker}
        />
        {nativeImpossible && (
          <Text style={styles.pickerImpossibleHint}>
            {editingPicker?.field === 'open' ? IMPOSSIBLE_START_MESSAGE : IMPOSSIBLE_END_MESSAGE}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader
          title={dayName}
          onBack={() => router.back()}
          showSave={false}
        />
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
                // react-native-web's Switch ignores `thumbColor` once the
                // value is true and falls back to its own default teal
                // (#009688) unless a separate `activeThumbColor` is passed --
                // a prop that doesn't exist in React Native's real Switch API
                // (confirmed against its type defs), so it's added only for
                // web via a spread rather than a plain prop, keeping it out
                // of the native TypeScript surface and native runtime alike.
                {...(Platform.OS === 'web' ? ({ activeThumbColor: Colors.white } as any) : {})}
              />
            </View>
          </View>

          {isOpen && (
            <>
              <Text style={styles.sectionTitle}>HOURS</Text>
              <View style={styles.rangesCard}>
                {timeRanges.map((range, index) => {
                  const isLastRange = timeRanges.length <= 1;
                  const isEditingStart = editingPicker?.rangeIndex === index && editingPicker.field === 'open';
                  const isEditingEnd = editingPicker?.rangeIndex === index && editingPicker.field === 'close';
                  return (
                    <React.Fragment key={index}>
                      {index > 0 && <View style={styles.rangeSeparator} />}
                      <TouchableOpacity
                        style={[styles.timeRow, isEditingStart && styles.timeRowActive]}
                        onPress={() => openPicker(index, 'open')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.timeLabel}>Start</Text>
                        <Text style={styles.timeValue}>{range.open}</Text>
                      </TouchableOpacity>
                      {Platform.OS === 'web' && isEditingStart && renderInlineWheels()}
                      {pickerRejectionMessage && pickerRejectionMessage.rangeIndex === index && pickerRejectionMessage.field === 'open' && (
                        <Text style={styles.pickerRejectionHint}>{pickerRejectionMessage.text}</Text>
                      )}
                      <View style={styles.divider} />
                      <TouchableOpacity
                        style={[styles.timeRow, isEditingEnd && styles.timeRowActive]}
                        onPress={() => openPicker(index, 'close')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.timeLabel}>End</Text>
                        <Text style={styles.timeValue}>{range.close}</Text>
                      </TouchableOpacity>
                      {Platform.OS === 'web' && isEditingEnd && renderInlineWheels()}
                      {pickerRejectionMessage && pickerRejectionMessage.rangeIndex === index && pickerRejectionMessage.field === 'close' && (
                        <Text style={styles.pickerRejectionHint}>{pickerRejectionMessage.text}</Text>
                      )}
                      <View style={styles.divider} />
                      <TouchableOpacity
                        style={styles.removeRow}
                        onPress={() => handleRemoveRange(index)}
                        activeOpacity={0.7}
                        disabled={isLastRange}
                        accessibilityState={{ disabled: isLastRange }}
                      >
                        <Text style={[styles.removeText, isLastRange && styles.removeTextDisabled]}>Remove</Text>
                      </TouchableOpacity>
                      {isLastRange && (
                        <Text style={styles.removeHint}>To remove all hours, mark {dayName} as closed.</Text>
                      )}
                    </React.Fragment>
                  );
                })}
              </View>

              {timeRanges.length < MAX_RANGES_PER_DAY && (
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleAddRange}
                  activeOpacity={0.6}
                >
                  <Plus size={14} color={Colors.primary} />
                  <Text style={styles.addButtonText}>Add another time range</Text>
                </TouchableOpacity>
              )}

              {validationError && (
                <View style={styles.validationCard}>
                  <CircleAlert size={16} color={Colors.warning} strokeWidth={2} />
                  <Text style={styles.validationText}>{validationError}</Text>
                </View>
              )}
            </>
          )}

          <View style={[styles.bottomSpacer, Platform.OS === 'web' && editingPicker ? styles.bottomSpacerExpanded : null]} />
        </ScrollView>

        {editingPicker && (
          <>
            {Platform.OS === 'ios' && renderPickerSheet()}
            {Platform.OS === 'android' && (
              <DateTimePicker
                value={getPickerValue()}
                mode="time"
                display="default"
                onChange={handleAndroidTimeChange}
              />
            )}
          </>
        )}
      </SafeAreaView>
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
    marginTop: 18,
    marginBottom: 7,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: Colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: 14,
    overflow: 'hidden' as const,
    marginTop: 14,
  },
  toggleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 11,
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
  // A cohesive "HOURS" section: all ranges live inside one rounded card.
  // Consecutive ranges are separated by a thin gap in the screen's own
  // background color rather than each range getting its own independent
  // card -- visually distinct, without the extra margin/border/shadow of a
  // second floating card.
  rangesCard: {
    backgroundColor: Colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: 14,
    overflow: 'hidden' as const,
  },
  rangeSeparator: {
    height: 7,
    backgroundColor: Colors.surface,
  },
  timeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  timeRowActive: {
    backgroundColor: Colors.primarySofter,
  },
  timeLabel: {
    fontSize: 15.5,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  timeValue: {
    fontSize: 15.5,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  removeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 9,
    paddingHorizontal: 16,
    gap: 6,
  },
  removeText: {
    fontSize: 13.5,
    color: Colors.error,
    fontWeight: '500' as const,
  },
  removeTextDisabled: {
    color: Colors.textMuted,
  },
  removeHint: {
    fontSize: 11.5,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  // Android only: shown under the specific Start/End row whose OS-confirmed
  // value was rejected as an impossible boundary (Start 11:59 PM / End
  // 12:00 AM) -- the field itself is left showing its previous value.
  pickerRejectionHint: {
    fontSize: 11.5,
    color: '#7A4B00',
    backgroundColor: Colors.warningLight,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  addButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    marginTop: 10,
    paddingVertical: 10,
  },
  addButtonText: {
    fontSize: 13.5,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  validationCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 9,
    marginTop: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: Colors.warningLight,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.18)',
  },
  validationText: {
    flex: 1,
    fontSize: 13,
    color: '#7A4B00',
    lineHeight: 18,
  },
  bottomSpacer: {
    height: 40,
  },
  // Web preview only: while the inline picker is expanded, the page needs
  // more scrollable room so the wheel and header can clear Safari's bottom
  // browser chrome (a separate concern from the OS-level safe-area inset,
  // which SafeAreaView already accounts for). Reverts to the normal 40px
  // the moment the picker closes.
  bottomSpacerExpanded: {
    height: WHEEL_HEIGHT + 60,
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
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  pickerCancel: {
    fontSize: 17,
    fontWeight: '400' as const,
    color: Colors.textSecondary,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  pickerDone: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  pickerDoneDisabled: {
    color: Colors.textMuted,
  },
  // Web/iOS: shown while the picker is sitting exactly on an impossible
  // boundary value (Start 11:59 PM / End 12:00 AM) and Done is disabled --
  // the existing value stays fully visible/scrollable for correction, it
  // just can't be confirmed as-is.
  pickerImpossibleHint: {
    fontSize: 12,
    color: '#7A4B00',
    backgroundColor: Colors.warningLight,
    textAlign: 'center' as const,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  picker: {
    height: 200,
  },
  // Inline web picker: a normal-flow child inserted directly under the
  // active Start/End row (see the ranges map above) -- not a Modal. It just
  // makes rangesCard taller; rangesCard's own overflow:hidden only clips
  // content that extends past its box, which a normal-flow child never does.
  inlineWheelWrap: {
    backgroundColor: Colors.surface,
  },
  wheelRow: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    height: WHEEL_HEIGHT,
  },
  wheelColumn: {
    flex: 1,
    height: WHEEL_HEIGHT,
  },
  wheelItem: {
    height: WHEEL_ITEM_HEIGHT,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  wheelItemText: {
    fontSize: 16,
    color: Colors.textMuted,
    fontWeight: '400' as const,
  },
  wheelItemTextNear: {
    opacity: 0.55,
  },
  wheelItemTextFar: {
    opacity: 0.28,
  },
  // Distinguishable by more than color alone: larger, bolder, and full
  // opacity -- not a subtle tint shift.
  wheelItemTextSelected: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.primary,
    opacity: 1,
  },
  wheelSelectionBand: {
    position: 'absolute' as const,
    left: 4,
    right: 4,
    top: WHEEL_PADDING,
    height: WHEEL_ITEM_HEIGHT,
    borderRadius: 10,
    backgroundColor: Colors.primarySofter,
  },
});
