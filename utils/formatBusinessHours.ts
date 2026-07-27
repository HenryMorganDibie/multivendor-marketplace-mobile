import { DayHoursConfig } from '@/mocks/vendorData';

type WeeklyHours = {
  Sunday: DayHoursConfig;
  Monday: DayHoursConfig;
  Tuesday: DayHoursConfig;
  Wednesday: DayHoursConfig;
  Thursday: DayHoursConfig;
  Friday: DayHoursConfig;
  Saturday: DayHoursConfig;
};

const DAY_ORDER: (keyof WeeklyHours)[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const SHORT_DAY: Record<string, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

interface HoursLine {
  label: string;
  hours: string;
  isClosed: boolean;
}

function rangesString(config: DayHoursConfig): string {
  if (config.closed || config.ranges.length === 0) return 'Closed';
  return config.ranges.map(r => `${r.open} – ${r.close}`).join(', ');
}

export function formatWeeklyHours(weeklyHours: WeeklyHours): HoursLine[] {
  const lines: HoursLine[] = [];
  let i = 0;

  while (i < DAY_ORDER.length) {
    const day = DAY_ORDER[i];
    const config = weeklyHours[day];
    const hrs = rangesString(config);

    let j = i + 1;
    while (j < DAY_ORDER.length) {
      const nextDay = DAY_ORDER[j];
      const nextConfig = weeklyHours[nextDay];
      if (rangesString(nextConfig) === hrs) {
        j++;
      } else {
        break;
      }
    }

    const startDay = SHORT_DAY[day];
    const endDay = SHORT_DAY[DAY_ORDER[j - 1]];
    const label = i === j - 1 ? startDay : `${startDay}–${endDay}`;

    lines.push({
      label,
      hours: hrs,
      isClosed: config.closed || config.ranges.length === 0,
    });

    i = j;
  }

  return lines;
}
