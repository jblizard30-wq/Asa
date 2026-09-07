import { describe, it, expect } from 'vitest';
import {
  computeEasterSunday,
  getAdventStart,
  getLiturgicalSeason,
  getLiturgicalKeyDates,
  isSacredOrCommunionItem,
  getActiveLiturgicalSurgeWindow,
  calculateSurgedParLevel,
  getSurgedParLevel,
  getLectionaryCycle,
  getLiturgicalSunday,
  getLectionaryReadings,
} from './liturgicalCalendar';

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

  describe('Liturgical Seasonal Par Level Surges', () => {
    it('accurately identifies sacred and communion items', () => {
      // Sacred/communion items
      expect(isSacredOrCommunionItem({ name: 'Communion Wafers' })).toBe(true);
      expect(isSacredOrCommunionItem({ name: 'Communion Wine' })).toBe(true);
      expect(isSacredOrCommunionItem({ name: 'Altar Candles' })).toBe(true);
      expect(isSacredOrCommunionItem({ name: 'Communion Cups (1000ct)' })).toBe(true);
      expect(isSacredOrCommunionItem({ name: 'Grape Juice for Communion' })).toBe(true);
      expect(isSacredOrCommunionItem({ name: 'Chalice Linen' })).toBe(true);
      expect(isSacredOrCommunionItem({ name: 'Unleavened Hosts' })).toBe(true);
      expect(isSacredOrCommunionItem({ name: 'Special Item', notes: 'Reserved for sacred altar use' })).toBe(true);

      // Secular/administrative items
      expect(isSacredOrCommunionItem({ name: 'Copy Paper 20lb' })).toBe(false);
      expect(isSacredOrCommunionItem({ name: 'Dishwasher Pods' })).toBe(false);
      expect(isSacredOrCommunionItem({ name: 'Baby Wipes' })).toBe(false);
      expect(isSacredOrCommunionItem({ name: 'Coffee Beans 5lb' })).toBe(false);
      expect(isSacredOrCommunionItem({ name: 'Connection Cards' })).toBe(false);
      expect(isSacredOrCommunionItem({ name: 'Offering Envelopes' })).toBe(false);
    });

    it('calculates par level with +50% surge and ceiling rounding', () => {
      expect(calculateSurgedParLevel(4)).toBe(6);
      expect(calculateSurgedParLevel(1)).toBe(2);
      expect(calculateSurgedParLevel(3)).toBe(5);
      expect(calculateSurgedParLevel(10)).toBe(15);
      expect(calculateSurgedParLevel(0)).toBe(0);
    });

    it('identifies the active 30-day feast surge windows', () => {
      // 2026 Easter is April 5 (2026-04-05) -> 30-day window is March 6 through April 5
      const windowStart = getActiveLiturgicalSurgeWindow(new Date('2026-03-06T12:00:00Z'));
      expect(windowStart.isActive).toBe(true);
      expect(windowStart.feastName).toBe('Easter Sunday');
      expect(windowStart.badgeText).toBe('⚡ Lent/Easter Par Surge Active');
      expect(windowStart.daysUntilFeast).toBe(30);

      const midLent = getActiveLiturgicalSurgeWindow(new Date('2026-03-20T12:00:00Z'));
      expect(midLent.isActive).toBe(true);
      expect(midLent.feastName).toBe('Easter Sunday');
      expect(midLent.daysUntilFeast).toBe(16);

      const easterDay = getActiveLiturgicalSurgeWindow(new Date('2026-04-05T10:00:00Z'));
      expect(easterDay.isActive).toBe(true);
      expect(easterDay.daysUntilFeast).toBe(0);

      const beforeEasterWindow = getActiveLiturgicalSurgeWindow(new Date('2026-03-05T12:00:00Z'));
      expect(beforeEasterWindow.isActive).toBe(false);

      const afterEasterWindow = getActiveLiturgicalSurgeWindow(new Date('2026-04-06T12:00:00Z'));
      expect(afterEasterWindow.isActive).toBe(false);

      // 2026 Christmas Eve is Dec 24 (2026-12-24) -> 30-day window is Nov 24 through Dec 25
      const christmasStart = getActiveLiturgicalSurgeWindow(new Date('2026-11-24T12:00:00Z'));
      expect(christmasStart.isActive).toBe(true);
      expect(christmasStart.feastName).toBe('Christmas Eve');
      expect(christmasStart.badgeText).toBe('⚡ Advent/Christmas Par Surge Active');

      const midAdvent = getActiveLiturgicalSurgeWindow(new Date('2026-12-10T12:00:00Z'));
      expect(midAdvent.isActive).toBe(true);
      expect(midAdvent.feastName).toBe('Christmas Eve');
      expect(midAdvent.daysUntilFeast).toBe(14);

      const beforeChristmasWindow = getActiveLiturgicalSurgeWindow(new Date('2026-11-23T12:00:00Z'));
      expect(beforeChristmasWindow.isActive).toBe(false);
    });

    it('elevates par levels (+50%) for sacred items during active surge windows', () => {
      const wafersItem = { name: 'Communion Wafers', idealQty: 4 };
      const wineItem = { name: 'Communion Wine', idealQty: 6 };
      const candlesItem = { name: 'Altar Candles', idealQty: 10 };
      const nonSacredItem = { name: 'Coffee Pods', idealQty: 10 };

      // During Easter surge (e.g. March 20, 2026)
      const targetDate = new Date('2026-03-20T12:00:00Z');
      const wafersSurge = getSurgedParLevel(wafersItem, targetDate);
      expect(wafersSurge.isSurged).toBe(true);
      expect(wafersSurge.surgedParLevel).toBe(6);
      expect(wafersSurge.basePar).toBe(4);
      expect(wafersSurge.surgeMultiplier).toBe(1.5);
      expect(wafersSurge.badgeText).toBe('⚡ Lent/Easter Par Surge Active');
      expect(wafersSurge.feastName).toBe('Easter Sunday');

      // Numeric coercion
      expect(Number(wafersSurge)).toBe(6);
      expect(+wafersSurge).toBe(6);
      expect(wafersSurge.valueOf()).toBe(6);

      // Non-sacred item during same period
      const coffeeSurge = getSurgedParLevel(nonSacredItem, targetDate);
      expect(coffeeSurge.isSurged).toBe(false);
      expect(coffeeSurge.surgedParLevel).toBe(10);
      expect(coffeeSurge.badgeText).toBeNull();

      // Christmas Eve surge for candles (e.g. Dec 10, 2026)
      const candlesSurge = getSurgedParLevel(candlesItem, new Date('2026-12-10T12:00:00Z'));
      expect(candlesSurge.isSurged).toBe(true);
      expect(candlesSurge.surgedParLevel).toBe(15);
      expect(candlesSurge.badgeText).toBe('⚡ Advent/Christmas Par Surge Active');
      expect(candlesSurge.feastName).toBe('Christmas Eve');

      // During Ordinary Time (e.g. July 15, 2026), no surge
      const summerSurge = getSurgedParLevel(wineItem, new Date('2026-07-15T12:00:00Z'));
      expect(summerSurge.isSurged).toBe(false);
      expect(summerSurge.surgedParLevel).toBe(6);
      expect(summerSurge.badgeText).toBeNull();
    });
  });

  describe('Revised Common Lectionary (RCL) Auto-Sync', () => {
    it('accurately computes the 3-Year Lectionary cycle across multiple years', () => {
      // 2023 Lent (liturgical year 2022) -> Year A
      expect(getLectionaryCycle(new Date('2023-03-12'))).toBe('A');

      // 2024 Easter (liturgical year 2023) -> Year B
      expect(getLectionaryCycle(new Date('2024-03-31'))).toBe('B');

      // 2024 Advent (liturgical year 2024 starts Dec 1, 2024) -> Year C
      expect(getLectionaryCycle(new Date('2024-12-08'))).toBe('C');

      // 2025 Easter (liturgical year 2024) -> Year C
      expect(getLectionaryCycle(new Date('2025-04-20'))).toBe('C');

      // 2025 Advent (liturgical year 2025 starts Nov 30, 2025) -> Year A
      expect(getLectionaryCycle(new Date('2025-12-07'))).toBe('A');

      // 2026 Easter (April 5, 2026 in liturgical year 2025) -> Year A
      expect(getLectionaryCycle(new Date('2026-04-05'))).toBe('A');

      // 2026 September (liturgical year 2025) -> Year A
      expect(getLectionaryCycle(new Date('2026-09-06'))).toBe('A');

      // 2026 Advent (liturgical year 2026 starts Nov 29, 2026) -> Year B
      expect(getLectionaryCycle(new Date('2026-11-29'))).toBe('B');

      // 2027 Easter (March 28, 2027 in liturgical year 2026) -> Year B
      expect(getLectionaryCycle(new Date('2027-03-28'))).toBe('B');
    });

    it('accurately resolves liturgical Sundays and major holy days', () => {
      // Easter Sunday 2026 (April 5)
      const easter = getLiturgicalSunday(new Date('2026-04-05'));
      expect(easter.key).toBe('easter-sunday');
      expect(easter.season).toBe('EASTER');
      expect(easter.cycle).toBe('A');
      expect(easter.name).toContain('Easter');

      // 2nd Sunday of Easter (April 12, 2026)
      const easter2 = getLiturgicalSunday(new Date('2026-04-12'));
      expect(easter2.key).toBe('easter-2');

      // Pentecost 2026 (May 24, 2026)
      const pentecost = getLiturgicalSunday(new Date('2026-05-24'));
      expect(pentecost.key).toBe('pentecost');
      expect(pentecost.season).toBe('PENTECOST');

      // Trinity Sunday 2026 (May 31, 2026)
      const trinity = getLiturgicalSunday(new Date('2026-05-31'));
      expect(trinity.key).toBe('trinity-sunday');

      // First Sunday in Lent 2026 (Feb 22, 2026)
      const lent1 = getLiturgicalSunday(new Date('2026-02-22'));
      expect(lent1.key).toBe('lent-1');
      expect(lent1.season).toBe('LENT');

      // Palm Sunday 2026 (March 29, 2026)
      const palm = getLiturgicalSunday(new Date('2026-03-29'));
      expect(palm.key).toBe('palm-sunday');

      // First Sunday of Advent 2026 (Nov 29, 2026)
      const advent1 = getLiturgicalSunday(new Date('2026-11-29'));
      expect(advent1.key).toBe('advent-1');
      expect(advent1.season).toBe('ADVENT');
      expect(advent1.cycle).toBe('B');
    });

    it('returns the 4 canonical Scripture texts with citation summaries for Year A, B, and C', () => {
      // Easter Sunday 2026 (Year A)
      const easterReadings = getLectionaryReadings(new Date('2026-04-05'));
      expect(easterReadings.cycle).toBe('A');
      expect(easterReadings.firstReading).toBe('Acts 10:34-43');
      expect(easterReadings.psalm).toBe('Psalm 118:1-2, 14-24');
      expect(easterReadings.epistle).toBe('Colossians 3:1-4');
      expect(easterReadings.gospel).toBe('Matthew 28:1-10');
      expect(easterReadings.citationSummary).toBe(
        'Acts 10:34-43 • Psalm 118:1-2, 14-24 • Colossians 3:1-4 • Matthew 28:1-10'
      );

      // Advent 1 in 2025 (Year A) -> Matthew
      const adventReadingsA = getLectionaryReadings(new Date('2025-11-30'));
      expect(adventReadingsA.cycle).toBe('A');
      expect(adventReadingsA.gospel).toBe('Matthew 24:36-44');
      expect(adventReadingsA.firstReading).toBe('Isaiah 2:1-5');

      // Advent 1 in 2026 (Year B) -> Mark
      const adventReadingsB = getLectionaryReadings(new Date('2026-11-29'));
      expect(adventReadingsB.cycle).toBe('B');
      expect(adventReadingsB.gospel).toBe('Mark 13:24-37');
      expect(adventReadingsB.firstReading).toBe('Isaiah 64:1-9');

      // Advent 1 in 2024 (Year C) -> Luke
      const adventReadingsC = getLectionaryReadings(new Date('2024-12-01'));
      expect(adventReadingsC.cycle).toBe('C');
      expect(adventReadingsC.gospel).toBe('Luke 21:25-36');
      expect(adventReadingsC.firstReading).toBe('Jeremiah 33:14-16');

      // September 2026 (Proper 18, Year A)
      const septReadings = getLectionaryReadings(new Date('2026-09-06'));
      expect(septReadings.cycle).toBe('A');
      expect(septReadings.gospel).toBe('Matthew 18:15-20');
      expect(septReadings.firstReading).toBe('Ezekiel 33:7-11');
      expect(septReadings.epistle).toBe('Romans 13:8-14');
      expect(septReadings.psalm).toBe('Psalm 119:33-40');
    });
  });
});

