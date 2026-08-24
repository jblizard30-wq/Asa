import { format, isSameWeek } from 'date-fns';
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
 * Checks if a task's due date falls within the current calendar week (Monday-Sunday) in America/Chicago.
 */
export function isTaskDueThisWeek(
  dueDate: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!dueDate) return false;

  const dueDay = getCalendarDayString(dueDate);
  const [year, month, day] = dueDay.split('-').map(Number);
  const dueDateObj = new Date(year, month - 1, day);

  const nowZoned = toZonedTime(now, APP_TIMEZONE);

  return isSameWeek(dueDateObj, nowZoned, { weekStartsOn: 1 });
}

/**
 * Formats a calendar date into a readable string (e.g. "Aug 24" or "MMM d, yyyy") in Chicago time.
 */
export function formatChicagoDate(
  date: Date | string | null | undefined,
  formatPattern: string = 'MMM d',
): string {
  if (!date) return '';
  const dayStr = getCalendarDayString(date);
  const [year, month, day] = dayStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return format(d, formatPattern);
}

