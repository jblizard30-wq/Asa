import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export const APP_TIMEZONE = 'America/Chicago';

/**
 * Extracts a normalized YYYY-MM-DD calendar day string.
 * If given a date-only string (e.g. "2026-08-24"), preserves the date literal directly.
 * If given a full instant / Date object, converts to America/Chicago wall-clock date.
 */
export function getCalendarDayString(date: Date | string = new Date()): string {
  if (typeof date === 'string') {
    const trimmed = date.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    // If it's a midnight UTC ISO string like "2026-08-24T00:00:00.000Z", extract date portion
    if (/^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?Z?$/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    const parsed = new Date(trimmed);
    const zoned = toZonedTime(parsed, APP_TIMEZONE);
    return format(zoned, 'yyyy-MM-dd');
  }

  // If it's an exact UTC midnight Date instance, extract UTC date portion
  if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0) {
    return date.toISOString().slice(0, 10);
  }

  const zoned = toZonedTime(date, APP_TIMEZONE);
  return format(zoned, 'yyyy-MM-dd');
}

/**
 * Returns the current calendar day in America/Chicago as YYYY-MM-DD.
 */
export function getChicagoToday(now: Date = new Date()): string {
  const zoned = toZonedTime(now, APP_TIMEZONE);
  return format(zoned, 'yyyy-MM-dd');
}

/**
 * Accurately determines if a task is overdue by comparing calendar days in America/Chicago,
 * rather than comparing raw UTC instants. A task due on 2026-08-24 is overdue only once
 * the local Chicago clock ticks to 2026-08-25.
 */
export function isTaskOverdue(
  dueDate: Date | string | null | undefined,
  status?: string,
  now: Date = new Date(),
): boolean {
  if (!dueDate || status === 'DONE') return false;

  const dueDay = getCalendarDayString(dueDate);
  const currentDay = getChicagoToday(now);

  return dueDay < currentDay;
}

/**
 * Checks if a task's due date falls on today's calendar day in America/Chicago.
 */
export function isTaskDueToday(
  dueDate: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!dueDate) return false;

  const dueDay = getCalendarDayString(dueDate);
  const currentDay = getChicagoToday(now);

  return dueDay === currentDay;
}

/**
 * Signed day count from today's Chicago calendar day to dueDate's calendar day: positive means
 * dueDate was N days ago (overdue by N days), negative means dueDate is N days in the future.
 *
 * Diffs calendar-day strings rather than raw instants, same as isTaskOverdue/isTaskDueToday
 * above — that's what makes this correct for both dueDate storage conventions this app has: a
 * date typed into an <input type="date"> stores UTC-midnight of that day, while pasting into
 * the grid stores Chicago-midnight of that day (see gridCoercion.ts's parseDueDate). Comparing
 * the raw instants directly (e.g. `dueDate.getTime() < startOfLocalDay(now).getTime()`) mislabels
 * a same-day UTC-midnight due date as overdue for the first several hours of its actual due day.
 * parseISO on a date-only "yyyy-MM-dd" string anchors it at local midnight in the *server's*
 * timezone, but since both operands go through it identically, the offset cancels out of the
 * diff regardless of what timezone the server runs in.
 */
export function daysFromToday(dueDate: Date | string, now: Date = new Date()): number {
  const dueDay = parseISO(getCalendarDayString(dueDate));
  const today = parseISO(getChicagoToday(now));
  return differenceInCalendarDays(today, dueDay);
}


/**
 * Formats a stored date for display as a calendar day (M/D/YYYY), correct for both of the
 * storage conventions described above. Resolves the calendar day via getCalendarDayString
 * first, so a UTC-midnight date (what an <input type="date"> stores) renders as that same
 * day instead of slipping back one for a viewer in Chicago — which is what a bare
 * `new Date(value).toLocaleDateString()` does. Returns null for a missing date so callers
 * can pick their own placeholder.
 */
export function formatCalendarDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const [year, month, day] = getCalendarDayString(date).split('-');
  return `${Number(month)}/${Number(day)}/${year}`;
}
