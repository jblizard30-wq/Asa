import { beforeEach, describe, it, expect, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  shares: [] as Array<{ userId: string | null; teamId: string | null; access: 'VIEW' | 'EDIT' }>,
  teamMembers: [] as Array<{ userId: string; teamId: string }>,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    childProtectionShare: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.userId) return mockState.shares.find((s) => s.userId === where.userId) ?? null;
        return null;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        const teamIds: string[] = where?.teamId?.in ?? [];
        return mockState.shares
          .filter((s) => s.teamId && teamIds.includes(s.teamId))
          .map((s) => ({ access: s.access }));
      }),
    },
    teamMember: {
      findMany: vi.fn(async ({ where }: any) => mockState.teamMembers.filter((t) => t.userId === where.userId)),
    },
  },
}));

import {
  addYears,
  computeMinistrySafeExpiry,
  computeBackgroundCheckExpiry,
  computeRecordStatus,
  differenceInCalendarDays,
  checkChildProtectionAccess,
  parseChildProtectionImportRows,
  splitDelimitedLine,
  detectRenewalOverwrite,
  buildRenewalTaskContent,
  RENEWAL_WARNING_DAYS,
  RENEWAL_RENOTIFY_DAYS,
} from './childProtection';

beforeEach(() => {
  mockState.shares = [];
  mockState.teamMembers = [];
});

describe('Child Protection Renewal & Compliance Calculations', () => {
  it('adds exactly 3 years for MinistrySafe renewal', () => {
    const completedAt = new Date('2024-05-15T00:00:00.000Z');
    const expiry = computeMinistrySafeExpiry(completedAt);
    expect(expiry.getUTCFullYear()).toBe(2027);
    expect(expiry.getUTCMonth()).toBe(4); // May is index 4
    expect(expiry.getUTCDate()).toBe(15);
  });

  it('adds exactly 5 years for Background Check renewal', () => {
    const completedAt = new Date('2023-11-20T00:00:00.000Z');
    const expiry = computeBackgroundCheckExpiry(completedAt);
    expect(expiry.getUTCFullYear()).toBe(2028);
    expect(expiry.getUTCMonth()).toBe(10); // Nov is index 10
    expect(expiry.getUTCDate()).toBe(20);
  });

  it('marks record as INCOMPLETE if DocuSign is not signed', () => {
    const result = computeRecordStatus({
      docusignSigned: false,
      ministrySafeCompletedAt: new Date('2024-01-01T00:00:00.000Z'),
      backgroundCheckCompletedAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    expect(result.status).toBe('INCOMPLETE');
  });

  it('marks record as INCOMPLETE if MinistrySafe or Background check is missing', () => {
    const result1 = computeRecordStatus({
      docusignSigned: true,
      ministrySafeCompletedAt: null,
      backgroundCheckCompletedAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    expect(result1.status).toBe('INCOMPLETE');

    const result2 = computeRecordStatus({
      docusignSigned: true,
      ministrySafeCompletedAt: new Date('2024-01-01T00:00:00.000Z'),
      backgroundCheckCompletedAt: null,
    });
    expect(result2.status).toBe('INCOMPLETE');
  });

  it('marks record as COMPLIANT when all are done and well before 45-day renewal window', () => {
    const now = new Date('2026-09-10T00:00:00.000Z');
    const msDate = new Date('2025-09-10T00:00:00.000Z');
    const bgDate = new Date('2025-09-10T00:00:00.000Z');

    const result = computeRecordStatus({
      docusignSigned: true,
      ministrySafeCompletedAt: msDate,
      backgroundCheckCompletedAt: bgDate,
      now,
    });

    expect(result.status).toBe('COMPLIANT');
    expect(result.daysUntilMinistrySafeExpires).toBeGreaterThan(RENEWAL_WARNING_DAYS);
    expect(result.daysUntilBackgroundCheckExpires).toBeGreaterThan(RENEWAL_WARNING_DAYS);
  });

  it('marks record as EXPIRING_SOON when within 45 days of MinistrySafe renewal', () => {
    const now = new Date('2026-09-10T00:00:00.000Z');
    // MinistrySafe completed on 2023-10-15 -> expires 2026-10-15 (35 days from now)
    const msDate = new Date('2023-10-15T00:00:00.000Z');
    const bgDate = new Date('2025-01-01T00:00:00.000Z');

    const result = computeRecordStatus({
      docusignSigned: true,
      ministrySafeCompletedAt: msDate,
      backgroundCheckCompletedAt: bgDate,
      now,
    });

    expect(result.status).toBe('EXPIRING_SOON');
    expect(result.daysUntilMinistrySafeExpires).toBe(35);
    expect(result.daysUntilNextRenewal).toBe(35);
  });

  it('marks record as EXPIRING_SOON when within 45 days of Background Check renewal', () => {
    const now = new Date('2026-09-10T00:00:00.000Z');
    const msDate = new Date('2025-01-01T00:00:00.000Z');
    // BG Check completed 2021-09-30 -> expires 2026-09-30 (20 days from now)
    const bgDate = new Date('2021-09-30T00:00:00.000Z');

    const result = computeRecordStatus({
      docusignSigned: true,
      ministrySafeCompletedAt: msDate,
      backgroundCheckCompletedAt: bgDate,
      now,
    });

    expect(result.status).toBe('EXPIRING_SOON');
    expect(result.daysUntilBackgroundCheckExpires).toBe(20);
    expect(result.daysUntilNextRenewal).toBe(20);
  });

  it('marks record as EXPIRED when past renewal date', () => {
    const now = new Date('2026-09-10T00:00:00.000Z');
    // MinistrySafe completed 2023-08-01 -> expired 2026-08-01
    const msDate = new Date('2023-08-01T00:00:00.000Z');
    const bgDate = new Date('2024-01-01T00:00:00.000Z');

    const result = computeRecordStatus({
      docusignSigned: true,
      ministrySafeCompletedAt: msDate,
      backgroundCheckCompletedAt: bgDate,
      now,
    });

    expect(result.status).toBe('EXPIRED');
    expect(result.daysUntilMinistrySafeExpires).toBeLessThan(0);
  });
});

describe('addYears leap-day handling', () => {
  it('clips Feb 29 to Feb 28 when the target year is not a leap year (MinistrySafe, 3yr)', () => {
    const completedAt = new Date('2024-02-29T00:00:00.000Z'); // 2024 is a leap year
    const expiry = computeMinistrySafeExpiry(completedAt); // 2027 is not
    expect(expiry.getUTCFullYear()).toBe(2027);
    expect(expiry.getUTCMonth()).toBe(1); // Feb
    expect(expiry.getUTCDate()).toBe(28);
  });

  it('clips Feb 29 to Feb 28 when the target year is not a leap year (Background Check, 5yr)', () => {
    const completedAt = new Date('2024-02-29T00:00:00.000Z');
    const expiry = computeBackgroundCheckExpiry(completedAt); // 2029 is not a leap year
    expect(expiry.getUTCFullYear()).toBe(2029);
    expect(expiry.getUTCMonth()).toBe(1);
    expect(expiry.getUTCDate()).toBe(28);
  });

  it('keeps Feb 29 when the target year is also a leap year', () => {
    const completedAt = new Date('2024-02-29T00:00:00.000Z');
    const expiry = addYears(completedAt, 4); // 2028 is a leap year
    expect(expiry.toISOString()).toBe('2028-02-29T00:00:00.000Z');
  });

  it('does not affect non-Feb-29 dates', () => {
    const completedAt = new Date('2024-03-01T00:00:00.000Z');
    expect(addYears(completedAt, 3).toISOString()).toBe('2027-03-01T00:00:00.000Z');
  });
});

describe('differenceInCalendarDays', () => {
  it('computes whole calendar days regardless of time-of-day', () => {
    const from = new Date('2026-01-01T23:00:00.000Z');
    const to = new Date('2026-01-03T01:00:00.000Z');
    expect(differenceInCalendarDays(to, from)).toBe(2);
  });

  it('returns 0 for the same calendar day at different times', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-01T23:59:59.000Z');
    expect(differenceInCalendarDays(to, from)).toBe(0);
  });

  it('returns a negative value when the target date is in the past', () => {
    const from = new Date('2026-01-10T00:00:00.000Z');
    const to = new Date('2026-01-05T00:00:00.000Z');
    expect(differenceInCalendarDays(to, from)).toBe(-5);
  });
});

describe('computeRecordStatus boundary conditions', () => {
  it('is EXPIRING_SOON at exactly the 45-day boundary', () => {
    const now = new Date('2026-09-10T00:00:00.000Z');
    const result = computeRecordStatus({
      docusignSigned: true,
      ministrySafeCompletedAt: new Date('2020-01-01T00:00:00.000Z'),
      ministrySafeExpiresAt: new Date('2026-10-25T00:00:00.000Z'), // exactly 45 days out
      backgroundCheckCompletedAt: new Date('2020-01-01T00:00:00.000Z'),
      backgroundCheckExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
      now,
    });
    expect(result.daysUntilMinistrySafeExpires).toBe(45);
    expect(result.status).toBe('EXPIRING_SOON');
  });

  it('is COMPLIANT at 46 days, just outside the warning window', () => {
    const now = new Date('2026-09-10T00:00:00.000Z');
    const result = computeRecordStatus({
      docusignSigned: true,
      ministrySafeCompletedAt: new Date('2020-01-01T00:00:00.000Z'),
      ministrySafeExpiresAt: new Date('2026-10-26T00:00:00.000Z'), // exactly 46 days out
      backgroundCheckCompletedAt: new Date('2020-01-01T00:00:00.000Z'),
      backgroundCheckExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
      now,
    });
    expect(result.daysUntilMinistrySafeExpires).toBe(46);
    expect(result.status).toBe('COMPLIANT');
  });

  it('is EXPIRING_SOON, not EXPIRED, on the day it expires (0 days left)', () => {
    const now = new Date('2026-09-10T00:00:00.000Z');
    const result = computeRecordStatus({
      docusignSigned: true,
      ministrySafeCompletedAt: new Date('2020-01-01T00:00:00.000Z'),
      ministrySafeExpiresAt: new Date('2026-09-10T00:00:00.000Z'), // expires today
      backgroundCheckCompletedAt: new Date('2020-01-01T00:00:00.000Z'),
      backgroundCheckExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
      now,
    });
    expect(result.daysUntilMinistrySafeExpires).toBe(0);
    expect(result.status).toBe('EXPIRING_SOON');
  });

  it('prefers a stored expiresAt override over recomputing from completedAt', () => {
    const now = new Date('2026-09-10T00:00:00.000Z');
    const result = computeRecordStatus({
      docusignSigned: true,
      // completedAt alone would compute a far-future expiry; the stored override wins.
      ministrySafeCompletedAt: new Date('2024-01-01T00:00:00.000Z'),
      ministrySafeExpiresAt: new Date('2026-09-05T00:00:00.000Z'), // already expired
      backgroundCheckCompletedAt: new Date('2020-01-01T00:00:00.000Z'),
      backgroundCheckExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
      now,
    });
    expect(result.status).toBe('EXPIRED');
    expect(result.daysUntilMinistrySafeExpires).toBe(-5);
  });
});

describe('computeRecordStatus: INCOMPLETE does not mask an expired sub-check', () => {
  it('still reports the MinistrySafe day-count when DocuSign is unsigned', () => {
    const now = new Date('2026-09-10T00:00:00.000Z');
    const result = computeRecordStatus({
      docusignSigned: false,
      ministrySafeCompletedAt: new Date('2020-01-01T00:00:00.000Z'), // long expired
      backgroundCheckCompletedAt: null,
      now,
    });

    expect(result.status).toBe('INCOMPLETE');
    expect(result.daysUntilMinistrySafeExpires).toBeLessThan(0);
    expect(result.daysUntilBackgroundCheckExpires).toBeNull();
    expect(result.daysUntilNextRenewal).toBe(result.daysUntilMinistrySafeExpires);
  });

  it('leaves day-counts null when neither completion date exists', () => {
    const result = computeRecordStatus({
      docusignSigned: false,
      ministrySafeCompletedAt: null,
      backgroundCheckCompletedAt: null,
    });
    expect(result.status).toBe('INCOMPLETE');
    expect(result.daysUntilMinistrySafeExpires).toBeNull();
    expect(result.daysUntilBackgroundCheckExpires).toBeNull();
    expect(result.daysUntilNextRenewal).toBeNull();
  });
});

describe('splitDelimitedLine', () => {
  it('splits on a plain delimiter with no quoting', () => {
    expect(splitDelimitedLine('a,b,c', ',')).toEqual(['a', 'b', 'c']);
  });

  it('keeps a delimiter inside a quoted field intact', () => {
    expect(splitDelimitedLine('"Smith, Jr., John",john@example.com', ',')).toEqual([
      'Smith, Jr., John',
      'john@example.com',
    ]);
  });

  it('unescapes doubled quotes inside a quoted field', () => {
    expect(splitDelimitedLine('"She said ""hi""",ok', ',')).toEqual(['She said "hi"', 'ok']);
  });

  it('splits on tabs the same way', () => {
    expect(splitDelimitedLine('a\tb\tc', '\t')).toEqual(['a', 'b', 'c']);
  });
});

describe('parseChildProtectionImportRows', () => {
  it('parses a tab-separated Google Sheets paste', () => {
    const raw = 'John Doe\tjohn@example.com\tKids Ministry; Nursery\tYes\t2024-05-15\t2023-11-20';
    const { records, warnings } = parseChildProtectionImportRows(raw);
    expect(warnings).toEqual([]);
    expect(records).toEqual([
      {
        name: 'John Doe',
        email: 'john@example.com',
        ministries: ['Kids Ministry', 'Nursery'],
        docusignSigned: true,
        ministrySafeCompletedAt: '2024-05-15T00:00:00.000Z',
        backgroundCheckCompletedAt: '2023-11-20T00:00:00.000Z',
      },
    ]);
  });

  it('does not split a comma inside a quoted field from a real CSV export', () => {
    const raw = '"Smith, Jr., John",john@example.com,Nursery,Yes,2024-05-15,2023-11-20';
    const { records } = parseChildProtectionImportRows(raw);
    expect(records[0].name).toBe('Smith, Jr., John');
    expect(records[0].email).toBe('john@example.com');
  });

  it('handles CRLF line endings the same as LF', () => {
    const raw =
      'Name,Email,Ministries,DocuSign,MinistrySafe Date,Background Check Date\r\nJohn Doe,john@example.com,,Yes,,';
    const { records } = parseChildProtectionImportRows(raw);
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('John Doe');
  });

  it('skips a header row identified by a "name"/"volunteer" first column', () => {
    const raw = 'Volunteer Name,Email\nJohn Doe,john@example.com';
    const { records } = parseChildProtectionImportRows(raw);
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('John Doe');
  });

  it('does not treat a real data row as a header just because it is first', () => {
    const raw = 'John Doe,john@example.com';
    const { records } = parseChildProtectionImportRows(raw);
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('John Doe');
  });

  it('leaves a blank cell undefined instead of defaulting it, so a merge never clobbers existing data', () => {
    const raw = ['John Doe', '', '', '', '', ''].join(',');
    const { records } = parseChildProtectionImportRows(raw);
    expect(records[0]).toEqual({ name: 'John Doe' });
  });

  it('rejects an unrecognized date format instead of guessing at it, and warns', () => {
    const raw = ['John Doe', '', '', '', '15-May-2024', ''].join(',');
    const { records, warnings } = parseChildProtectionImportRows(raw);
    expect(records[0].ministrySafeCompletedAt).toBeUndefined();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('MinistrySafe');
  });

  it('parses US-format M/D/YYYY dates deterministically regardless of local timezone', () => {
    const raw = ['John Doe', '', '', '', '5/15/2024', ''].join(',');
    const { records, warnings } = parseChildProtectionImportRows(raw);
    expect(warnings).toEqual([]);
    expect(records[0].ministrySafeCompletedAt).toBe('2024-05-15T00:00:00.000Z');
  });

  it('merges duplicate rows for the same person within one paste, preferring the later non-blank value', () => {
    const raw = ['Jane Smith,jane@example.com,Nursery,No,,', 'Jane Smith,jane@example.com,,Yes,2024-05-15,'].join(
      '\n'
    );
    const { records } = parseChildProtectionImportRows(raw);
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({
      name: 'Jane Smith',
      email: 'jane@example.com',
      ministries: ['Nursery'],
      docusignSigned: true,
      ministrySafeCompletedAt: '2024-05-15T00:00:00.000Z',
    });
  });
});

describe('checkChildProtectionAccess', () => {
  it('denies access when there is no session', async () => {
    const result = await checkChildProtectionAccess(null);
    expect(result).toEqual({ allowed: false, access: null });
  });

  it('grants EDIT to a global ADMIN with no explicit share', async () => {
    const result = await checkChildProtectionAccess({ user: { id: 'admin-1', role: 'ADMIN' } } as any);
    expect(result).toEqual({ allowed: true, access: 'EDIT' });
  });

  it('denies a non-admin with no share of any kind', async () => {
    const result = await checkChildProtectionAccess({ user: { id: 'user-1', role: 'USER' } } as any);
    expect(result).toEqual({ allowed: false, access: null });
  });

  it('honors a direct VIEW share', async () => {
    mockState.shares.push({ userId: 'user-1', teamId: null, access: 'VIEW' });
    const result = await checkChildProtectionAccess({ user: { id: 'user-1', role: 'USER' } } as any);
    expect(result).toEqual({ allowed: true, access: 'VIEW' });
  });

  it('honors a direct EDIT share', async () => {
    mockState.shares.push({ userId: 'user-1', teamId: null, access: 'EDIT' });
    const result = await checkChildProtectionAccess({ user: { id: 'user-1', role: 'USER' } } as any);
    expect(result).toEqual({ allowed: true, access: 'EDIT' });
  });

  it('falls back to a team share when there is no direct share', async () => {
    mockState.teamMembers.push({ userId: 'user-1', teamId: 'team-1' });
    mockState.shares.push({ userId: null, teamId: 'team-1', access: 'VIEW' });
    const result = await checkChildProtectionAccess({ user: { id: 'user-1', role: 'USER' } } as any);
    expect(result).toEqual({ allowed: true, access: 'VIEW' });
  });

  it('grants the most permissive access when a user is on multiple shared teams', async () => {
    // Regression test: access was previously resolved via `orderBy: { access: 'desc' }`,
    // which returns 'VIEW' before 'EDIT' alphabetically — the opposite of intended.
    mockState.teamMembers.push({ userId: 'user-1', teamId: 'team-view' });
    mockState.teamMembers.push({ userId: 'user-1', teamId: 'team-edit' });
    mockState.shares.push({ userId: null, teamId: 'team-view', access: 'VIEW' });
    mockState.shares.push({ userId: null, teamId: 'team-edit', access: 'EDIT' });

    const result = await checkChildProtectionAccess({ user: { id: 'user-1', role: 'USER' } } as any);
    expect(result).toEqual({ allowed: true, access: 'EDIT' });
  });
});

describe('detectRenewalOverwrite', () => {
  const priorCert = {
    completedAt: new Date('2021-05-15T00:00:00.000Z'),
    expiresAt: new Date('2024-05-15T00:00:00.000Z'),
    url: 'https://drive.google.com/file/d/old',
  };

  it('archives the prior values when a completion date is genuinely replaced', () => {
    const entry = detectRenewalOverwrite(
      priorCert,
      { completedAt: '2024-05-01T00:00:00.000Z' },
      'MINISTRY_SAFE'
    );

    expect(entry).toEqual({
      certType: 'MINISTRY_SAFE',
      previousCompletedAt: priorCert.completedAt,
      previousExpiresAt: priorCert.expiresAt,
      previousUrl: priorCert.url,
    });
  });

  it('does not archive first-time data entry, which is not a renewal', () => {
    const entry = detectRenewalOverwrite(
      { completedAt: null, expiresAt: null, url: null },
      { completedAt: '2024-05-01T00:00:00.000Z' },
      'MINISTRY_SAFE'
    );

    expect(entry).toBeNull();
  });

  it('does not archive when the cert fields were not part of the update', () => {
    expect(detectRenewalOverwrite(priorCert, {}, 'BACKGROUND_CHECK')).toBeNull();
  });

  it('does not archive a re-save of the identical date', () => {
    // Editing an unrelated field (a phone number, say) re-submits the existing cert date;
    // that must not manufacture a renewal record.
    const entry = detectRenewalOverwrite(
      priorCert,
      { completedAt: '2021-05-15T00:00:00.000Z' },
      'MINISTRY_SAFE'
    );

    expect(entry).toBeNull();
  });

  it('treats a Date instance and its ISO string as the same instant', () => {
    const entry = detectRenewalOverwrite(
      priorCert,
      { completedAt: new Date('2021-05-15T00:00:00.000Z') },
      'MINISTRY_SAFE'
    );

    expect(entry).toBeNull();
  });

  it('archives when only the certificate link changes', () => {
    // The old link is the pointer to the superseded document — overwriting it in place is
    // how that evidence becomes unreachable.
    const entry = detectRenewalOverwrite(
      priorCert,
      { url: 'https://drive.google.com/file/d/new' },
      'BACKGROUND_CHECK'
    );

    expect(entry?.certType).toBe('BACKGROUND_CHECK');
    expect(entry?.previousUrl).toBe('https://drive.google.com/file/d/old');
  });

  it('does not archive when the same link is re-submitted', () => {
    expect(
      detectRenewalOverwrite(priorCert, { url: 'https://drive.google.com/file/d/old' }, 'MINISTRY_SAFE')
    ).toBeNull();
  });

  it('archives when a cert is cleared outright', () => {
    const entry = detectRenewalOverwrite(priorCert, { completedAt: null }, 'MINISTRY_SAFE');
    expect(entry?.previousCompletedAt).toEqual(priorCert.completedAt);
  });
});

describe('buildRenewalTaskContent', () => {
  const baseRecord = {
    name: 'Jane Volunteer',
    email: 'jane@example.com',
    ministries: ['Nursery'],
    docusignSigned: true,
    docusignUrl: null,
    ministrySafeCompletedAt: new Date('2021-05-15T00:00:00.000Z'),
    ministrySafeUrl: null,
    backgroundCheckCompletedAt: new Date('2021-05-15T00:00:00.000Z'),
    backgroundCheckUrl: null,
  };

  it('marks an expired record HIGH priority and says how long ago it lapsed', () => {
    const { title, description, priority } = buildRenewalTaskContent(baseRecord, 'EXPIRED', -10, 400);

    expect(priority).toBe('HIGH');
    expect(title).toContain('Jane Volunteer');
    expect(title).toContain('EXPIRED');
    expect(description).toContain('MinistrySafe training EXPIRED (10 days ago)');
  });

  it('uses MEDIUM priority and a countdown inside the warning window', () => {
    const { description, priority } = buildRenewalTaskContent(baseRecord, 'EXPIRING_SOON', 30, 400);

    expect(priority).toBe('MEDIUM');
    expect(description).toContain('MinistrySafe training renewal due in 30 days');
  });

  it('flags missing requirements rather than reporting a countdown for them', () => {
    const { description } = buildRenewalTaskContent(
      { ...baseRecord, docusignSigned: false, backgroundCheckCompletedAt: null },
      'INCOMPLETE',
      400,
      null
    );

    expect(description).toContain('DocuSign agreement is missing/unsigned');
    expect(description).toContain('Background check not completed');
  });

  it('appends reviewer notes only when supplied', () => {
    const withNote = buildRenewalTaskContent(baseRecord, 'EXPIRING_SOON', 10, 400, 'Call her Sunday');
    const withoutNote = buildRenewalTaskContent(baseRecord, 'EXPIRING_SOON', 10, 400);

    expect(withNote.description).toContain('Reviewer Notes');
    expect(withNote.description).toContain('Call her Sunday');
    expect(withoutNote.description).not.toContain('Reviewer Notes');
  });
});

describe('renewal cron cadence', () => {
  it('re-notifies before the warning window lapses', () => {
    // The cron's throttle has to be shorter than the warning window, or a volunteer flagged
    // on day 45 would never be raised again before the cert actually expired.
    expect(RENEWAL_RENOTIFY_DAYS).toBeLessThan(RENEWAL_WARNING_DAYS);
  });
});
