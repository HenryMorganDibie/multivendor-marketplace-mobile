import { useCallback, useMemo, useState } from 'react';

/**
 * Timing preference for the shared scheduling picker.
 *
 * - `'flexible'` — the vendor/customer is happy with any time. Stored as a
 *   fulfilment preference, not a concrete date.
 * - `'schedule'` — a concrete date + time has been picked.
 * - `'none'` — no preference set yet (all-optional invoice flow only).
 *
 * Checkout always uses `'flexible' | 'schedule'`. The Create Invoice flow also
 * uses `'none'` because fulfilment details are fully optional there.
 */
export type TimingPreference = 'flexible' | 'schedule' | 'none';

/**
 * Shared date/time picker state. Identical behaviour to the customer checkout
 * scheduling flow — same calendar, same time wheel, same "I'm flexible" /
 * "Schedule a time" toggle, same "Remove preference" action. Reused by the
 * Create Invoice fulfilment section so vendors see one consistent picker
 * across the app.
 */
export function useSchedulingPicker(initial?: {
  preference?: TimingPreference;
  date?: Date | null;
  time?: string;
}) {
  const [timingPreference, setTimingPreference] = useState<TimingPreference>(
    initial?.preference ?? 'none',
  );
  const [preferredDate, setPreferredDate] = useState<Date | null>(initial?.date ?? null);
  const [preferredTime, setPreferredTime] = useState<string>(initial?.time ?? '');
  const [isDateTimeModalVisible, setIsDateTimeModalVisible] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('PM');

  const hasScheduledDateTime = Boolean(preferredDate && preferredTime);

  const handleTimingPreferenceChange = useCallback((pref: TimingPreference) => {
    setTimingPreference(pref);
    if (pref !== 'schedule') {
      // 'flexible' and 'none' both discard any concrete date/time.
      setPreferredDate(null);
      setPreferredTime('');
    }
  }, []);

  const handleOpenDateTimePicker = useCallback(() => {
    setIsDateTimeModalVisible(true);
  }, []);

  const handleConfirmDateTime = useCallback(() => {
    if (preferredDate) {
      const now = new Date();
      const selectedDateTime = new Date(preferredDate);

      let hour24 = selectedHour;
      if (selectedPeriod === 'PM' && selectedHour !== 12) {
        hour24 = selectedHour + 12;
      } else if (selectedPeriod === 'AM' && selectedHour === 12) {
        hour24 = 0;
      }

      selectedDateTime.setHours(hour24, selectedMinute, 0, 0);

      const isToday = preferredDate.toDateString() === now.toDateString();
      if (isToday && selectedDateTime <= now) {
        // Mirror checkout: refuse past times for today only.
        return;
      }

      const formattedTime = `${selectedHour}:${selectedMinute
        .toString()
        .padStart(2, '0')} ${selectedPeriod}`;
      setPreferredTime(formattedTime);
    }
    setIsDateTimeModalVisible(false);
  }, [preferredDate, selectedHour, selectedMinute, selectedPeriod]);

  const handleRemoveDateTime = useCallback(() => {
    setPreferredDate(null);
    setPreferredTime('');
    setIsDateTimeModalVisible(false);
  }, []);

  const handleCancelDateTime = useCallback(() => {
    setIsDateTimeModalVisible(false);
  }, []);

  /**
   * Human-readable summary of the selected date + time, e.g.
   * "Fri, Jul 24 · 2:30 PM". Returns null when nothing is scheduled.
   */
  const formatPreferredDateTime = useCallback(() => {
    if (!preferredDate) return null;
    const dateStr = preferredDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return preferredTime ? `${dateStr} · ${preferredTime}` : dateStr;
  }, [preferredDate, preferredTime]);

  /**
   * ISO string for the scheduled instant, for persistence on the invoice
   * document. Returns null when no concrete date/time is selected (flexible
   * or none).
   */
  const scheduledAtIso = useMemo(() => {
    if (!preferredDate || !preferredTime) return null;
    const [h, rest, period] = preferredTime.split(/[: ]/);
    let hour24 = parseInt(h, 10);
    const minute = parseInt(rest, 10);
    if (period === 'PM' && hour24 !== 12) hour24 += 12;
    else if (period === 'AM' && hour24 === 12) hour24 = 0;
    const d = new Date(preferredDate);
    d.setHours(hour24, minute, 0, 0);
    return d.toISOString();
  }, [preferredDate, preferredTime]);

  return {
    timingPreference,
    preferredDate,
    preferredTime,
    isDateTimeModalVisible,
    selectedMonth,
    selectedHour,
    selectedMinute,
    selectedPeriod,
    hasScheduledDateTime,
    scheduledAtIso,
    setTimingPreference,
    setPreferredDate,
    setPreferredTime,
    setIsDateTimeModalVisible,
    setSelectedMonth,
    setSelectedHour,
    setSelectedMinute,
    setSelectedPeriod,
    handleTimingPreferenceChange,
    handleOpenDateTimePicker,
    handleConfirmDateTime,
    handleRemoveDateTime,
    handleCancelDateTime,
    formatPreferredDateTime,
  };
}

export type SchedulingPicker = ReturnType<typeof useSchedulingPicker>;
