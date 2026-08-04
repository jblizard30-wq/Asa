import { describe, expect, it } from 'vitest';
import { parseAssignees, parseDueDate, parsePriority, parseStatus, parseTags, parseTitle } from './gridCoercion';

describe('parseTitle', () => {
  it('trims surrounding whitespace', () => {
    expect(parseTitle('  Set up chairs  ')).toEqual({ ok: true, value: 'Set up chairs' });
  });

  it('rejects an empty title', () => {
    expect(parseTitle('   ')).toEqual({ ok: false, error: expect.any(String) });
  });
});

describe('parseDueDate', () => {
  it('parses ISO dates as midnight America/Chicago (CDT, summer)', () => {
    const result = parseDueDate('2026-08-12');
    expect(result).toEqual({ ok: true, value: '2026-08-12T05:00:00.000Z' });
  });

  it('parses ISO dates as midnight America/Chicago (CST, winter)', () => {
    const result = parseDueDate('2026-12-12');
    expect(result).toEqual({ ok: true, value: '2026-12-12T06:00:00.000Z' });
  });

  it('parses month-name dates with an explicit year', () => {
    expect(parseDueDate('Aug 12, 2026')).toEqual({ ok: true, value: '2026-08-12T05:00:00.000Z' });
    expect(parseDueDate('Aug 12 2026')).toEqual({ ok: true, value: '2026-08-12T05:00:00.000Z' });
  });

  it('parses slash dates with an explicit year', () => {
    expect(parseDueDate('8/12/2026')).toEqual({ ok: true, value: '2026-08-12T05:00:00.000Z' });
  });

  it('treats an empty string as clearing the due date', () => {
    expect(parseDueDate('')).toEqual({ ok: true, value: null });
    expect(parseDueDate('   ')).toEqual({ ok: true, value: null });
  });

  it('assumes the current year for a bare month/day within six months', () => {
    const now = new Date('2026-08-03T12:00:00Z');
    // June 1 relative to Aug 3 is in the past but well under six months — same year.
    expect(parseDueDate('6/1', now)).toEqual({ ok: true, value: '2026-06-01T05:00:00.000Z' });
  });

  it('rolls a bare month/day more than six months in the past to next year', () => {
    const now = new Date('2026-08-03T12:00:00Z');
    // Jan 15 relative to Aug 3 is over six months in the past — assume next year.
    expect(parseDueDate('1/15', now)).toEqual({ ok: true, value: '2027-01-15T06:00:00.000Z' });
  });

  it('assumes the current year for a bare month-name/day within six months', () => {
    const now = new Date('2026-08-03T12:00:00Z');
    expect(parseDueDate('Aug 12', now)).toEqual({ ok: true, value: '2026-08-12T05:00:00.000Z' });
  });

  it('rejects an invalid day for the given month', () => {
    expect(parseDueDate('2/30/2026')).toEqual({ ok: false, error: expect.any(String) });
    expect(parseDueDate('Feb 30, 2026')).toEqual({ ok: false, error: expect.any(String) });
  });

  it('rejects unrecognized text', () => {
    expect(parseDueDate('banana')).toEqual({ ok: false, error: expect.any(String) });
  });
});

describe('parseStatus', () => {
  it('matches the exact label', () => {
    expect(parseStatus('In Progress')).toEqual({ ok: true, value: 'IN_PROGRESS' });
  });

  it('matches case-insensitively', () => {
    expect(parseStatus('done')).toEqual({ ok: true, value: 'DONE' });
  });

  it('matches common synonyms', () => {
    expect(parseStatus('Doing')).toEqual({ ok: true, value: 'IN_PROGRESS' });
    expect(parseStatus('Completed')).toEqual({ ok: true, value: 'DONE' });
    expect(parseStatus('Not started')).toEqual({ ok: true, value: 'TODO' });
  });

  it('errors on no match', () => {
    expect(parseStatus('Whenever')).toEqual({ ok: false, error: expect.any(String) });
  });
});

describe('parsePriority', () => {
  it('matches the exact label', () => {
    expect(parsePriority('High')).toEqual({ ok: true, value: 'HIGH' });
  });

  it('matches common synonyms', () => {
    expect(parsePriority('critical')).toEqual({ ok: true, value: 'URGENT' });
    expect(parsePriority('normal')).toEqual({ ok: true, value: 'MEDIUM' });
  });

  it('errors on no match', () => {
    expect(parsePriority('Whenever')).toEqual({ ok: false, error: expect.any(String) });
  });
});

describe('parseAssignees', () => {
  const members = [
    { id: '1', name: 'Sarah Chen' },
    { id: '2', name: 'Sarah Ortiz' },
    { id: '3', name: 'Mike Lee' },
  ];

  it('resolves a single case-insensitive match', () => {
    expect(parseAssignees('mike lee', members)).toEqual({ ok: true, value: ['3'] });
  });

  it('resolves multiple comma-separated names', () => {
    const result = parseAssignees('Mike Lee, Sarah Chen', members);
    expect(result.ok).toBe(true);
    expect(result.ok && new Set(result.value)).toEqual(new Set(['3', '1']));
  });

  it('treats an empty cell as clearing assignees', () => {
    expect(parseAssignees('', members)).toEqual({ ok: true, value: [] });
  });

  it('errors when a name matches nobody', () => {
    const result = parseAssignees('Nobody Here', members);
    expect(result.ok).toBe(false);
  });

  it('errors when a partial name matches more than one member, without creating a user', () => {
    const result = parseAssignees('Sarah', members);
    // "Sarah" alone matches neither full name exactly — zero matches, not a guess.
    expect(result.ok).toBe(false);
  });

  it('errors when two members share the exact same name', () => {
    const dupeMembers = [
      { id: '1', name: 'Sam' },
      { id: '2', name: 'Sam' },
    ];
    const result = parseAssignees('Sam', dupeMembers);
    expect(result.ok).toBe(false);
  });
});

describe('parseTags', () => {
  const allTags = [
    { id: 't1', name: 'Urgent', color: 'red' },
    { id: 't2', name: 'Facilities', color: 'blue' },
  ];

  it('resolves comma-separated tag names', () => {
    const result = parseTags('Urgent, Facilities', allTags);
    expect(result.ok).toBe(true);
    expect(result.ok && new Set(result.value)).toEqual(new Set(['t1', 't2']));
  });

  it('treats an empty cell (or the placeholder dash) as clearing tags', () => {
    expect(parseTags('', allTags)).toEqual({ ok: true, value: [] });
    expect(parseTags('—', allTags)).toEqual({ ok: true, value: [] });
  });

  it('errors on an unknown tag name', () => {
    const result = parseTags('Nonexistent', allTags);
    expect(result.ok).toBe(false);
  });
});
