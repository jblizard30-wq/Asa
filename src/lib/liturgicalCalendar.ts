import { RRule } from 'rrule';
import { addDays, subDays } from 'date-fns';
import type { LiturgicalSeason } from '@prisma/client';
import { getCalendarDayString } from '@/lib/dateUtils';

export const LITURGICAL_TIMEZONE = 'America/Chicago';

/**
 * Computes the date of Easter Sunday using the Meeus/Jones/Butcher anonymous Gregorian algorithm.
 * Valid for any Gregorian calendar year.
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
 * Advent Sunday: the 4th Sunday before Christmas Day.
 */
export function getAdventStart(year: number): Date {
  const christmas = new Date(Date.UTC(year, 11, 25));
  const rule = new RRule({
    freq: RRule.WEEKLY,
    byweekday: RRule.SU,
    dtstart: new Date(Date.UTC(year, 10, 1)),
  });
  const sundayOnOrBeforeChristmas = rule.before(christmas, true);
  if (!sundayOnOrBeforeChristmas) throw new Error(`No Sunday found before Christmas ${year}`);
  return subDays(sundayOnOrBeforeChristmas, 21);
}

/**
 * Classifies any given calendar date into its Western liturgical season:
 * - ADVENT (from Advent Sunday up to Dec 24)
 * - CHRISTMAS (Dec 25 through Epiphany Eve Jan 5)
 * - LENT (Ash Wednesday = Easter - 46 days through Holy Saturday)
 * - EASTER (Easter Sunday through the eve of Pentecost)
 * - PENTECOST (Easter + 49 days)
 * - ORDINARY_TIME (Time after Epiphany and Time after Pentecost)
 */
export function getLiturgicalSeason(
  date: Date | string,
): LiturgicalSeason {
  const dayStr = getCalendarDayString(date);
  const [year, month, day] = dayStr.split('-').map(Number);

  const floating = new Date(Date.UTC(year, month - 1, day));
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

export interface LiturgicalKeyDate {
  name: string;
  season: LiturgicalSeason;
  date: Date;
}

/** Returns the major liturgical holy days for a given ministry year. */
export function getLiturgicalKeyDates(year: number): LiturgicalKeyDate[] {
  const easter = computeEasterSunday(year);
  return [
    { name: 'Ash Wednesday', season: 'LENT', date: subDays(easter, 46) },
    { name: 'Palm Sunday', season: 'LENT', date: subDays(easter, 7) },
    { name: 'Maundy Thursday', season: 'LENT', date: subDays(easter, 3) },
    { name: 'Good Friday', season: 'LENT', date: subDays(easter, 2) },
    { name: 'Easter Sunday', season: 'EASTER', date: easter },
    { name: 'Pentecost Sunday', season: 'PENTECOST', date: addDays(easter, 49) },
    { name: 'First Sunday of Advent', season: 'ADVENT', date: getAdventStart(year) },
    { name: 'Christmas Day', season: 'CHRISTMAS', date: new Date(Date.UTC(year, 11, 25)) },
  ];
}

