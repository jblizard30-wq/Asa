import { describe, it, expect } from 'vitest';
import { isTaskOverdue, isTaskDueToday, getCalendarDayString, getChicagoToday } from './dateUtils';

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
});

