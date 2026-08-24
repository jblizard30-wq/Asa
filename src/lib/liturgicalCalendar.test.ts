import { describe, it, expect } from 'vitest';
import { computeEasterSunday, getAdventStart, getLiturgicalSeason, getLiturgicalKeyDates } from './liturgicalCalendar';

describe('liturgicalCalendar', () => {
  it('computes Easter Sunday accurately across multiple historical and future years', () => {
    // 2024: March 31
    expect(computeEasterSunday(2024).toISOString().slice(0, 10)).toBe('2024-03-31');
    // 2025: April 20
    expect(computeEasterSunday(2025).toISOString().slice(0, 10)).toBe('2025-04-20');
    // 2026: April 5
    expect(computeEasterSunday(2026).toISOString().slice(0, 10)).toBe('2026-04-05');
    // 2027: March 28
    expect(computeEasterSunday(2027).toISOString().slice(0, 10)).toBe('2027-03-28');
  });

  it('computes Advent Sunday start accurately (4 Sundays before Christmas)', () => {
    // 2024: Dec 1
    expect(getAdventStart(2024).toISOString().slice(0, 10)).toBe('2024-12-01');
    // 2025: Nov 30
    expect(getAdventStart(2025).toISOString().slice(0, 10)).toBe('2025-11-30');
    // 2026: Nov 29
    expect(getAdventStart(2026).toISOString().slice(0, 10)).toBe('2026-11-29');
  });

  it('accurately classifies dates into liturgical seasons', () => {
    // Christmas season
    expect(getLiturgicalSeason(new Date('2026-12-25'))).toBe('CHRISTMAS');
    expect(getLiturgicalSeason(new Date('2026-01-02'))).toBe('CHRISTMAS');

    // Lent 2026 (Easter is April 5, Ash Wed is Feb 18)
    expect(getLiturgicalSeason(new Date('2026-03-15'))).toBe('LENT');

    // Easter season (between Easter and Pentecost)
    expect(getLiturgicalSeason(new Date('2026-04-05'))).toBe('EASTER');
    expect(getLiturgicalSeason(new Date('2026-04-20'))).toBe('EASTER');

    // Pentecost Sunday (Easter + 49 days = May 24, 2026)
    expect(getLiturgicalSeason(new Date('2026-05-24'))).toBe('PENTECOST');

    // Ordinary Time in summer
    expect(getLiturgicalSeason(new Date('2026-07-15'))).toBe('ORDINARY_TIME');

    // Advent
    expect(getLiturgicalSeason(new Date('2026-12-10'))).toBe('ADVENT');
  });

  it('returns valid key liturgical dates for a ministry year', () => {
    const dates = getLiturgicalKeyDates(2026);
    expect(dates.length).toBe(8);
    expect(dates.find((d) => d.name === 'Good Friday')).toBeDefined();
    expect(dates.find((d) => d.name === 'Easter Sunday')?.date.toISOString().slice(0, 10)).toBe('2026-04-05');
  });
});

