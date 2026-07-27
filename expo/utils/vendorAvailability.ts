import { Vendor, DayHoursConfig } from '@/mocks/vendorData';

type DayName = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

const DAY_NAMES: DayName[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseTime(timeStr: string): { hours: number; minutes: number } | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return { hours, minutes };
}

function isCurrentlyInRange(now: Date, dayConfig: DayHoursConfig): boolean {
  if (dayConfig.closed || dayConfig.ranges.length === 0) return false;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return dayConfig.ranges.some((range) => {
    const open = parseTime(range.open);
    const close = parseTime(range.close);
    if (!open || !close) return false;
    const openMin = open.hours * 60 + open.minutes;
    const closeMin = close.hours * 60 + close.minutes;
    return currentMinutes >= openMin && currentMinutes < closeMin;
  });
}

export function isVendorCurrentlyOpen(vendor: Vendor): boolean {
  if (vendor.storeStatusMode === 'manual') {
    return vendor.storeStatus === 'open';
  }
  if (vendor.storeStatus === 'closed' || vendor.closedForOrders) return false;
  if (!vendor.weeklyHours) return vendor.storeStatus === 'open' || vendor.isOpenNow;
  const now = new Date();
  const dayName = DAY_NAMES[now.getDay()];
  const dayConfig = vendor.weeklyHours[dayName];
  return isCurrentlyInRange(now, dayConfig);
}

export function getNextOpenTime(vendor: Vendor): string {
  if (!vendor.weeklyHours) return '';
  const now = new Date();
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (let offset = 0; offset < 7; offset++) {
    const dayIndex = (currentDay + offset) % 7;
    const dayName = DAY_NAMES[dayIndex];
    const dayConfig = vendor.weeklyHours[dayName];

    if (dayConfig.closed || dayConfig.ranges.length === 0) continue;

    for (const range of dayConfig.ranges) {
      const open = parseTime(range.open);
      if (!open) continue;
      const openMin = open.hours * 60 + open.minutes;

      if (offset === 0 && openMin > currentMinutes) {
        return `today at ${range.open}`;
      }
      if (offset === 1) {
        return `tomorrow at ${range.open}`;
      }
      if (offset > 1) {
        return `${dayName} at ${range.open}`;
      }
    }
  }

  return '';
}

export function getNextOpenTimeShort(vendor: Vendor): string {
  const nextOpen = getNextOpenTime(vendor);
  if (!nextOpen) return '';
  return `Opens ${nextOpen}`;
}
