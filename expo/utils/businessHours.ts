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
