import type { DayHoursConfig } from '@/mocks/vendorData';

type DayName = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

const DAY_NAMES: DayName[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseTime(timeStr: string): { hours: number; minutes: number } | null {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return { hours, minutes };
}

export function isVendorCurrentlyOpen(weeklyHours?: Record<DayName, DayHoursConfig>): boolean {
  if (!weeklyHours) return true;
  const now = new Date();
  const dayName = DAY_NAMES[now.getDay()];
  const config = weeklyHours[dayName];
  if (!config || config.closed) return false;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  for (const range of config.ranges) {
    const open = parseTime(range.open);
    const close = parseTime(range.close);
    if (!open || !close) continue;
    const openMin = open.hours * 60 + open.minutes;
    const closeMin = close.hours * 60 + close.minutes;
    if (currentMinutes >= openMin && currentMinutes < closeMin) return true;
  }
  return false;
}

const DISPLAY_ORDER: DayName[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT_DAY: Record<DayName, string> = {
  Sunday: 'Sun', Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat',
};

function daySignature(config?: DayHoursConfig): string {
  if (!config || config.closed || config.ranges.length === 0) return 'closed';
  return config.ranges.map((r) => `${r.open}-${r.close}`).join(',');
}

function formatDayRangesText(config: DayHoursConfig): string {
  return config.ranges.map((r) => `${r.open} – ${r.close}`).join(', ');
}

/**
 * Informational-only display of a vendor's configured weekly hours -- never
 * an Open Now/Closed/Opens-at/Closes-at judgment. Groups consecutive days
 * (Monday-first) that share the identical schedule, e.g.:
 *   ["Mon–Fri 9:00 AM – 9:00 PM", "Sat 10:00 AM – 10:00 PM", "Sun Closed"]
 * Multiple ranges on a single day are preserved and joined, e.g.
 * "9:00 AM – 12:00 PM, 2:00 PM – 6:00 PM". Deterministic: the same
 * weeklyHours object always produces the same lines in the same order.
 */
export function formatWeeklyHoursCompact(weeklyHours?: Record<DayName, DayHoursConfig>): string[] {
  if (!weeklyHours) return [];
  const lines: string[] = [];
  let i = 0;
  while (i < DISPLAY_ORDER.length) {
    const day = DISPLAY_ORDER[i];
    const config = weeklyHours[day];
    const signature = daySignature(config);
    let j = i;
    while (j + 1 < DISPLAY_ORDER.length && daySignature(weeklyHours[DISPLAY_ORDER[j + 1]]) === signature) {
      j++;
    }
    const label = i === j ? SHORT_DAY[day] : `${SHORT_DAY[day]}–${SHORT_DAY[DISPLAY_ORDER[j]]}`;
    const text = signature === 'closed' ? 'Closed' : formatDayRangesText(config as DayHoursConfig);
    lines.push(`${label} ${text}`);
    i = j + 1;
  }
  return lines;
}

export function getNextOpenTime(weeklyHours?: Record<DayName, DayHoursConfig>): string | null {
  if (!weeklyHours) return null;
  const now = new Date();
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (let offset = 0; offset < 7; offset++) {
    const dayIndex = (currentDay + offset) % 7;
    const dayName = DAY_NAMES[dayIndex];
    const config = weeklyHours[dayName];
    if (!config || config.closed || config.ranges.length === 0) continue;

    for (const range of config.ranges) {
      const open = parseTime(range.open);
      if (!open) continue;
      const openMin = open.hours * 60 + open.minutes;

      if (offset === 0 && openMin <= currentMinutes) continue;

      if (offset === 0) {
        return range.open;
      }
      const dayLabel = offset === 1 ? 'Tomorrow' : dayName;
      return `${dayLabel} ${range.open}`;
    }
  }
  return null;
}
