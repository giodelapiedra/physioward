import { WeekRange } from '../types';

/**
 * Build 4 Monday-to-Friday "work weeks" for a calendar month, plus a
 * Remainder range covering any weekday(s) at the start OR end of the month
 * that aren't inside those 4 weeks.
 *
 * Previously these were hardcoded as [6-10, 13-17, 20-24, 27-30, 1-3]
 * which only lined up correctly for months where day 1 is a Wednesday
 * (so day 6 is a Monday). For every other month the ranges were wrong.
 *
 * Now we find the real first Monday and walk forward 7 days at a time.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export function getWeekRanges(year: number, month: number): WeekRange[] {
  const lastDay  = new Date(year, month, 0).getDate();
  const monthStr = `${year}-${pad(month)}`;
  const dateOf   = (d: number) => `${monthStr}-${pad(d)}`;
  // JS Date: 0=Sun … 1=Mon … 5=Fri … 6=Sat
  const dowOf    = (d: number) => new Date(year, month - 1, d).getDay();
  const isWeekday = (d: number) => {
    const w = dowOf(d);
    return w >= 1 && w <= 5;
  };

  // First Monday of the month (somewhere in days 1..7).
  let firstMonday = 1;
  while (firstMonday <= 7 && dowOf(firstMonday) !== 1) firstMonday++;

  // Build up to 4 Mon-Fri ranges.
  const weeks: WeekRange[] = [];
  for (let i = 0; i < 4; i++) {
    const mon = firstMonday + i * 7;
    if (mon > lastDay) break;
    const fri = Math.min(mon + 4, lastDay);
    weeks.push({
      weekNum: (i + 1) as 1 | 2 | 3 | 4,
      label:    `Week ${i + 1} [${mon}-${fri}]`,
      dateFrom: dateOf(mon),
      dateTo:   dateOf(fri),
    });
  }

  // Remainder: weekday days before Week 1, or after Week 4 if month starts on a Monday.
  let remStart = 0, remEnd = 0;
  for (let d = 1; d < firstMonday; d++) {
    if (isWeekday(d)) {
      if (!remStart) remStart = d;
      remEnd = d;
    }
  }
  if (!remStart && weeks.length >= 4) {
    const week4Fri = firstMonday + 3 * 7 + 4;
    for (let d = week4Fri + 1; d <= lastDay; d++) {
      if (isWeekday(d)) {
        if (!remStart) remStart = d;
        remEnd = d;
      }
    }
  }

  const remainder: WeekRange = remStart
    ? {
        weekNum:  'remainder',
        label:    `Remainder [${remStart}-${remEnd}]`,
        dateFrom: dateOf(remStart),
        dateTo:   dateOf(remEnd),
      }
    : {
        // No meaningful remainder — point at a date that returns no data.
        weekNum:  'remainder',
        label:    'Remainder [—]',
        dateFrom: '9999-12-31',
        dateTo:   '9999-12-31',
      };

  // Pad to 4 weeks in the rare case a month has < 4 Mondays (shouldn't happen).
  while (weeks.length < 4) {
    const i = weeks.length;
    weeks.push({
      weekNum:  (i + 1) as 1 | 2 | 3 | 4,
      label:    `Week ${i + 1} [—]`,
      dateFrom: '9999-12-31',
      dateTo:   '9999-12-31',
    });
  }

  return [...weeks, remainder];
}

export function getMonthRange(year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate();
  return {
    dateFrom: `${year}-${pad(month)}-01`,
    dateTo:   `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}
