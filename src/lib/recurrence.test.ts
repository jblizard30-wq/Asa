import { describe, expect, it } from 'vitest';
import { buildSimpleRRule, nextRunAfter, parseSimpleRRule } from './recurrence';

describe('buildSimpleRRule', () => {
  it('builds a weekly rule with interval 1', () => {
    expect(buildSimpleRRule('WEEKLY', 1)).toBe('FREQ=WEEKLY;INTERVAL=1');
  });

  it('builds a rule with an explicit interval', () => {
    expect(buildSimpleRRule('DAILY', 90)).toBe('FREQ=DAILY;INTERVAL=90');
  });
});

describe('parseSimpleRRule', () => {
  it('round-trips every frequency built by buildSimpleRRule', () => {
    for (const frequency of ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const) {
      const rrule = buildSimpleRRule(frequency, 3);
      expect(parseSimpleRRule(rrule)).toEqual({ frequency, interval: 3 });
    }
  });

  it('returns null for a rule this app never writes (e.g. BYDAY)', () => {
    expect(parseSimpleRRule('FREQ=WEEKLY;BYDAY=SU,WE')).toBeNull();
  });
});

describe('nextRunAfter', () => {
  it('advances a weekly rule by exactly 7 days of wall-clock time', () => {
    // Midnight Chicago, March 1 2026 (CST, -06:00).
    const after = new Date('2026-03-01T06:00:00.000Z');
    const next = nextRunAfter('FREQ=WEEKLY', after, 'America/Chicago');
    // March 8 2026 00:00 Chicago is the DST-transition day itself, but the 2am jump hasn't
    // happened yet at midnight, so it's still CST (-06:00).
    expect(next?.toISOString()).toBe('2026-03-08T06:00:00.000Z');
  });

  it('preserves wall-clock time across a DST spring-forward boundary', () => {
    // Midnight Chicago, March 8 2026 — still CST (the 2am transition is later that day).
    const after = new Date('2026-03-08T06:00:00.000Z');
    const next = nextRunAfter('FREQ=WEEKLY', after, 'America/Chicago');
    // March 15 2026 00:00 Chicago is now CDT (-05:00) — same wall-clock hour, different offset.
    expect(next?.toISOString()).toBe('2026-03-15T05:00:00.000Z');
  });

  it('advances a daily rule by a custom interval (after_completion style)', () => {
    // Midnight Chicago, June 1 2026 (CDT, -05:00) — no DST boundary in the 10-day window.
    const after = new Date('2026-06-01T05:00:00.000Z');
    const next = nextRunAfter('FREQ=DAILY;INTERVAL=10', after, 'America/Chicago');
    expect(next?.toISOString()).toBe('2026-06-11T05:00:00.000Z');
  });

  it('returns a date strictly after the given instant, never the instant itself', () => {
    const after = new Date('2026-06-01T05:00:00.000Z');
    const next = nextRunAfter('FREQ=DAILY', after, 'America/Chicago');
    expect(next!.getTime()).toBeGreaterThan(after.getTime());
  });
});
