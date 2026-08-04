import { toFloating, fromFloating } from './recurrence';

/**
 * The next real instant at wall-clock `hour:minute:00` in `timezone` that is strictly after
 * `after`. Same floating-Date technique as recurrence.ts's nextRunAfter: convert `after` into a
 * Date whose UTC getters read as the wall-clock time in `timezone`, build the candidate clock
 * time in that same floating domain, roll it forward a calendar day if it isn't strictly later,
 * then convert back to a real instant.
 */
export function nextLocalClockInstant(hour: number, minute: number, timezone: string, after: Date): Date {
  const floatingAfter = toFloating(after, timezone);

  const candidate = new Date(
    Date.UTC(
      floatingAfter.getUTCFullYear(),
      floatingAfter.getUTCMonth(),
      floatingAfter.getUTCDate(),
      hour,
      minute,
      0,
    ),
  );

  if (candidate.getTime() <= floatingAfter.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }

  return fromFloating(candidate, timezone);
}

/**
 * The instant at which the local calendar day containing `instant`, shifted by `dayOffset`
 * days, begins in `timezone`. Same floating-Date technique as nextLocalClockInstant — used to
 * bucket task due dates into overdue / due-today / due-soon against the org's local calendar
 * rather than the server process's own (usually UTC) day boundary.
 */
export function startOfLocalDay(instant: Date, timezone: string, dayOffset = 0): Date {
  const floating = toFloating(instant, timezone);
  const startOfDay = new Date(
    Date.UTC(floating.getUTCFullYear(), floating.getUTCMonth(), floating.getUTCDate() + dayOffset),
  );
  return fromFloating(startOfDay, timezone);
}
