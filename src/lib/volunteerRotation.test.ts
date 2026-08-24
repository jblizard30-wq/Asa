import { describe, it, expect } from 'vitest';
import { rankAndSelectVolunteers } from './volunteerRotation';

describe('volunteerRotation', () => {
  const volunteers = [
    { id: 'u1', name: 'Alice' },
    { id: 'u2', name: 'Bob' },
    { id: 'u3', name: 'Charlie' },
    { id: 'u4', name: 'Diana' },
  ];

  it('selects volunteers who have never served first', () => {
    const history = [
      { userId: 'u1', servedAt: new Date('2026-08-01') },
      { userId: 'u2', servedAt: new Date('2026-08-08') },
    ];

    const result = rankAndSelectVolunteers(
      volunteers,
      history,
      [],
      [],
      new Date('2026-08-24'),
      2,
    );

    // Charlie & Diana have never served, so they should be assigned first
    const assignedIds = result.assigned.map((u) => u.id);
    expect(assignedIds).toContain('u3');
    expect(assignedIds).toContain('u4');
    expect(result.assigned.length).toBe(2);
  });

  it('prioritizes the least recently served volunteer when all have served', () => {
    const history = [
      { userId: 'u1', servedAt: new Date('2026-08-15') }, // served 9 days ago
      { userId: 'u2', servedAt: new Date('2026-07-01') }, // served 54 days ago (oldest)
      { userId: 'u3', servedAt: new Date('2026-08-10') }, // served 14 days ago
    ];

    const result = rankAndSelectVolunteers(
      [volunteers[0], volunteers[1], volunteers[2]],
      history,
      [],
      [],
      new Date('2026-08-24'),
      1,
    );

    expect(result.assigned[0].id).toBe('u2'); // Bob served longest ago
  });

  it('respects weekly availability schedules and specific blackout exceptions', () => {
    const weeklyPatterns = [
      { userId: 'u3', dayOfWeek: 0, available: false }, // Charlie unavailable on Sundays
    ];
    const exceptions = [
      { userId: 'u4', date: '2026-08-24', available: false }, // Diana has specific blackout on this day
    ];

    const result = rankAndSelectVolunteers(
      volunteers,
      [],
      weeklyPatterns,
      exceptions,
      '2026-08-24T12:00:00Z', // target date
      2,
    );

    const assignedIds = result.assigned.map((u) => u.id);
    expect(assignedIds).not.toContain('u4'); // Diana blocked by exception
    expect(result.unavailable.find((u) => u.candidate.id === 'u4')).toBeDefined();
  });
});

