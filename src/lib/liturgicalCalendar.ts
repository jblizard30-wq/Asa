import { RRule } from 'rrule';
import { addDays, subDays } from 'date-fns';
import type { LiturgicalSeason } from '@prisma/client';
import { toFloating } from '@/lib/recurrence';

/**
 * Easter Sunday's date is fixed by an ecclesiastical lunar calendar, not a periodic
 * interval/weekday/month pattern — rrule has no lunar-calendar concept and can't compute it.
 * This is the "anonymous Gregorian algorithm" (Meeus, "Astronomical Algorithms", ch. 8): a
 * closed-form integer formula, not ad hoc date arithmetic — it operates purely on calendar
 * year/month/day integers, with no timezone or month-length pitfalls to get wrong. Everything
 * else in this module derives from this one anchor using rrule (for weekday-relative dates) or
 * plain fixed-day offsets from it.
 */
export function computeEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monthDayTotal = h + l - 7 * m + 114;
  const month = Math.floor(monthDayTotal / 31); // 3 = March, 4 = April
  const day = (monthDayTotal % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Advent Sunday: the Sunday nearest November 30 (St. Andrew's Day), equivalently the 4th Sunday
 * before Christmas Day (if Christmas itself falls on a Sunday, that day doesn't count as one of
 * the four). Computed via rrule's weekday search, not hand-rolled getDay() arithmetic.
 */
export function getAdventStart(year: number): Date {
  const christmas = new Date(Date.UTC(year, 11, 25));
  const rule = new RRule({ freq: RRule.WEEKLY, byweekday: RRule.SU, dtstart: new Date(Date.UTC(year, 10, 1)) });
  const sundayOnOrBeforeChristmas = rule.before(christmas, true);
  if (!sundayOnOrBeforeChristmas) throw new Error(`No Sunday found before Christmas ${year}`);
  return subDays(sundayOnOrBeforeChristmas, 21);
}

/**
 * Classifies a calendar date into one Western liturgical season. Boundaries anchored on
 * Christmas (fixed, Dec 25) use rrule for the weekday math (getAdventStart); boundaries anchored
 * on Easter (movable) use plain fixed-day offsets from the computed Easter date — Ash Wednesday
 * is always Easter-46 days and Pentecost always Easter+49 days by liturgical definition, not
 * derived arithmetic. All comparisons are calendar-date-only (time-of-day is ignored).
 */
export function getLiturgicalSeason(date: Date, timezone: string): LiturgicalSeason {
  const floating = toFloating(date, timezone);
  const year = floating.getUTCFullYear();

  const jan5 = new Date(Date.UTC(year, 0, 5));
  const dec25 = new Date(Date.UTC(year, 11, 25));
  const easter = computeEasterSunday(year);
  const ashWednesday = subDays(easter, 46);
  const pentecost = addDays(easter, 49);
  const adventSunday = getAdventStart(year);

  if (floating <= jan5) return 'CHRISTMAS';
  if (floating < ashWednesday) return 'ORDINARY_TIME';
  if (floating < easter) return 'LENT';
  if (floating < pentecost) return 'EASTER';
  if (floating.getTime() === pentecost.getTime()) return 'PENTECOST';
  if (floating < adventSunday) return 'ORDINARY_TIME';
  if (floating < dec25) return 'ADVENT';
  return 'CHRISTMAS';
}
