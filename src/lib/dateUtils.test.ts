import { describe, it, expect } from 'vitest';
import { isTaskOverdue, isTaskDueToday, getCalendarDayString, getChicagoToday, daysFromToday } from './dateUtils';

describe('dateUtils - America/Chicago calendar day math', () => {
  it('correctly handles due dates at 7:00 PM CDT without false early overdue', () => {
    // 7:30 PM CDT on August 24, 2026 is 2026-08-25T00:30:00.000Z
    const dueDate = '2026-08-24';
    const nowEvening = new Date('2026-08-25T00:30:00.000Z'); // 7:30 PM CDT Aug 24

    expect(getChicagoToday(nowEvening)).toBe('2026-08-24');
    expect(isTaskDueToday(dueDate, nowEvening)).toBe(true);
    expect(isTaskOverdue(dueDate, 'TODO', nowEvening)).toBe(false);
  });

  it('marks task overdue once local Chicago calendar day passes to next day', () => {
    const dueDate = '2026-08-24';
    const nextDayMorning = new Date('2026-08-25T14:00:00.000Z'); // 9:00 AM CDT Aug 25

    expect(getChicagoToday(nextDayMorning)).toBe('2026-08-25');
    expect(isTaskOverdue(dueDate, 'TODO', nextDayMorning)).toBe(true);
  });

  it('never marks DONE tasks as overdue', () => {
    const pastDueDate = '2026-01-01';
    const now = new Date('2026-08-24T12:00:00.000Z');

    expect(isTaskOverdue(pastDueDate, 'DONE', now)).toBe(false);
    expect(isTaskOverdue(pastDueDate, 'TODO', now)).toBe(true);
  });

  describe('daysFromToday', () => {
    it('is 0 for a task due today, stored as UTC-midnight of the picked day, checked mid-morning Chicago time', () => {
      // The <input type="date"> save path (createTask/updateTask) stores UTC-midnight of the
      // picked calendar day. Checking at 9:00 AM CDT on that same day must not read this as
      // "yesterday" just because the UTC-midnight instant is a few hours before Chicago-midnight.
      const dueDate = new Date('2026-08-25T00:00:00.000Z');
      const now = new Date('2026-08-25T14:00:00.000Z'); // 9:00 AM CDT Aug 25

      expect(daysFromToday(dueDate, now)).toBe(0);
    });

    it('is 0 for a task due today, stored as Chicago-midnight of the picked day (grid-paste convention)', () => {
      const dueDate = new Date('2026-08-25T05:00:00.000Z'); // Chicago midnight (CDT, UTC-5) Aug 25
      const now = new Date('2026-08-25T14:00:00.000Z'); // 9:00 AM CDT Aug 25

      expect(daysFromToday(dueDate, now)).toBe(0);
    });

    it('is positive N for a task overdue by N days, negative N for a task due in N days', () => {
      const now = new Date('2026-08-25T14:00:00.000Z'); // 9:00 AM CDT Aug 25

      expect(daysFromToday(new Date('2026-08-20T00:00:00.000Z'), now)).toBe(5);
      expect(daysFromToday(new Date('2026-08-28T00:00:00.000Z'), now)).toBe(-3);
    });
  });
});

