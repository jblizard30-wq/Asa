import { describe, expect, it } from 'vitest';
import { nextLocalClockInstant, startOfLocalDay } from './digestSchedule';

describe('nextLocalClockInstant', () => {
  it('returns today at the target hour when that hour has not happened yet', () => {
    // Midnight Chicago, June 1 2026 (CDT, -05:00) — well before the 7am target.
    const after = new Date('2026-06-01T05:00:00.000Z');
    const next = nextLocalClockInstant(7, 0, 'America/Chicago', after);
    // 7:00 AM Chicago (CDT, -05:00) later that same day.
    expect(next.toISOString()).toBe('2026-06-01T12:00:00.000Z');
  });

  it('rolls forward to tomorrow when the target hour already passed today', () => {
    // 3:00 PM Chicago, June 1 2026 (CDT, -05:00) — after the 7am target.
    const after = new Date('2026-06-01T20:00:00.000Z');
    const next = nextLocalClockInstant(7, 0, 'America/Chicago', after);
    // 7:00 AM Chicago the next day, June 2.
    expect(next.toISOString()).toBe('2026-06-02T12:00:00.000Z');
  });

  it('preserves wall-clock time when rolling across a DST spring-forward boundary', () => {
    // 8:00 AM Chicago, March 7 2026 (CST, -06:00) — the day before the spring-forward
    // transition, already past the 7am target so this rolls forward to March 8.
    const after = new Date('2026-03-07T14:00:00.000Z');
    const next = nextLocalClockInstant(7, 0, 'America/Chicago', after);
    // March 8 2026 is the transition day: clocks jump 2am -> 3am, so 7:00 AM local that day is
    // already CDT (-05:00), not CST — the UTC offset flips even though the requested wall-clock
    // hour (7) stays the same.
    expect(next.toISOString()).toBe('2026-03-08T12:00:00.000Z');
  });
});

describe('startOfLocalDay', () => {
  it('returns midnight Chicago on the same calendar day with no offset', () => {
    // 3:00 PM Chicago, June 1 2026 (CDT, -05:00).
    const instant = new Date('2026-06-01T20:00:00.000Z');
    const start = startOfLocalDay(instant, 'America/Chicago', 0);
    // Midnight Chicago June 1 2026 (CDT, -05:00).
    expect(start.toISOString()).toBe('2026-06-01T05:00:00.000Z');
  });

  it('advances by dayOffset calendar days', () => {
    const instant = new Date('2026-06-01T20:00:00.000Z');
    const start = startOfLocalDay(instant, 'America/Chicago', 7);
    expect(start.toISOString()).toBe('2026-06-08T05:00:00.000Z');
  });

  it('preserves the local midnight wall-clock across a DST spring-forward boundary', () => {
    // 3:00 PM Chicago, March 7 2026 (CST, -06:00) — the day before spring-forward.
    const instant = new Date('2026-03-07T21:00:00.000Z');
    const start = startOfLocalDay(instant, 'America/Chicago', 1);
    // Midnight Chicago March 8 2026 is still CST (-06:00); the transition to CDT happens at 2am local.
    expect(start.toISOString()).toBe('2026-03-08T06:00:00.000Z');
  });
});
