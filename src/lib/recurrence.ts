import { RRule, type Frequency } from 'rrule';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export type SimpleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

const FREQUENCY_MAP: Record<SimpleFrequency, Frequency> = {
  DAILY: RRule.DAILY,
  WEEKLY: RRule.WEEKLY,
  MONTHLY: RRule.MONTHLY,
  YEARLY: RRule.YEARLY,
};

/** Builds a bare RRULE string (no DTSTART) from the simple frequency+interval picker the UI exposes. */
export function buildSimpleRRule(frequency: SimpleFrequency, interval: number): string {
  const rule = new RRule({ freq: FREQUENCY_MAP[frequency], interval });
  return rule.toString().replace(/^RRULE:/, '');
}

const FREQUENCY_REVERSE_MAP = new Map<Frequency, SimpleFrequency>(
  (Object.entries(FREQUENCY_MAP) as [SimpleFrequency, Frequency][]).map(([key, value]) => [value, key]),
);

/**
 * Decodes an RRULE string back into the simple frequency+interval shape the UI edits. Returns
 * null for rules more complex than that (e.g. BYDAY) — nothing in this app writes those yet, but
 * a stored rule should never be silently misrepresented if one ever showed up.
 */
export function parseSimpleRRule(rruleString: string): { frequency: SimpleFrequency; interval: number } | null {
  const { freq, interval, ...rest } = RRule.parseString(rruleString);
  if (freq === undefined) return null;
  const frequency = FREQUENCY_REVERSE_MAP.get(freq);
  if (!frequency) return null;
  if (Object.values(rest).some((v) => v !== undefined)) return null;
  return { frequency, interval: interval ?? 1 };
}

export type TaskRecurrenceInfo = {
  id: string;
  mode: 'PERIODIC' | 'AFTER_COMPLETION';
  frequency: SimpleFrequency;
  interval: number;
  endsAt: string | null;
};

/** Maps a TaskRecurrence row (however it was fetched) to the plain-serializable shape the UI reads. */
export function toTaskRecurrenceInfo(
  taskRecurrence: { id: string; mode: 'PERIODIC' | 'AFTER_COMPLETION'; rrule: string; endsAt: Date | null } | null,
): TaskRecurrenceInfo | null {
  if (!taskRecurrence) return null;
  const simpleRule = parseSimpleRRule(taskRecurrence.rrule);
  if (!simpleRule) return null;
  return {
    id: taskRecurrence.id,
    mode: taskRecurrence.mode,
    frequency: simpleRule.frequency,
    interval: simpleRule.interval,
    endsAt: taskRecurrence.endsAt ? taskRecurrence.endsAt.toISOString() : null,
  };
}

// rrule.js does all of its date math using each Date's *UTC* getters/setters, treating them as
// the semantic value — it has no concept of an IANA zone. So to compute occurrences as wall-clock
// time in a specific zone without depending on the server process's own local timezone, instants
// are converted to a "floating" Date whose UTC components equal the wall-clock time in that zone,
// and converted back afterward. Same date-fns-tz building blocks as src/lib/gridCoercion.ts.
export function toFloating(instant: Date, timezone: string): Date {
  const zoned = toZonedTime(instant, timezone);
  return new Date(
    Date.UTC(zoned.getFullYear(), zoned.getMonth(), zoned.getDate(), zoned.getHours(), zoned.getMinutes(), zoned.getSeconds()),
  );
}

export function fromFloating(floating: Date, timezone: string): Date {
  return fromZonedTime(
    new Date(
      floating.getUTCFullYear(),
      floating.getUTCMonth(),
      floating.getUTCDate(),
      floating.getUTCHours(),
      floating.getUTCMinutes(),
      floating.getUTCSeconds(),
    ),
    timezone,
  );
}

/** The next occurrence strictly after `after`, per `rruleString`, evaluated as wall-clock time in `timezone`. */
export function nextRunAfter(rruleString: string, after: Date, timezone: string): Date | null {
  const floatingAfter = toFloating(after, timezone);
  const options = RRule.parseString(rruleString);
  const rule = new RRule({ ...options, dtstart: floatingAfter });
  const next = rule.after(floatingAfter, false);
  return next ? fromFloating(next, timezone) : null;
}
