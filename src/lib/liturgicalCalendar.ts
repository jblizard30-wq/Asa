import { RRule } from 'rrule';
import { addDays, subDays, differenceInCalendarDays, parseISO, format } from 'date-fns';
import type { LiturgicalSeason } from '@prisma/client';
import { getCalendarDayString } from '@/lib/dateUtils';

export const LITURGICAL_TIMEZONE = 'America/Chicago';

/**
 * Computes the date of Easter Sunday using the Meeus/Jones/Butcher anonymous Gregorian algorithm.
 * Valid for any Gregorian calendar year.
 */
export function computeEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monthDayTotal = h + l - 7 * m + 114;
  const month = Math.floor(monthDayTotal / 31); // 3 = March, 4 = April
  const day = (monthDayTotal % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Advent Sunday: the 4th Sunday before Christmas Day.
 */
export function getAdventStart(year: number): Date {
  const christmas = new Date(Date.UTC(year, 11, 25));
  const rule = new RRule({
    freq: RRule.WEEKLY,
    byweekday: RRule.SU,
    dtstart: new Date(Date.UTC(year, 10, 1)),
  });
  const sundayOnOrBeforeChristmas = rule.before(christmas, true);
  if (!sundayOnOrBeforeChristmas) throw new Error(`No Sunday found before Christmas ${year}`);
  return subDays(sundayOnOrBeforeChristmas, 21);
}

/**
 * Classifies any given calendar date into its Western liturgical season:
 * - ADVENT (from Advent Sunday up to Dec 24)
 * - CHRISTMAS (Dec 25 through Epiphany Eve Jan 5)
 * - LENT (Ash Wednesday = Easter - 46 days through Holy Saturday)
 * - EASTER (Easter Sunday through the eve of Pentecost)
 * - PENTECOST (Easter + 49 days)
 * - ORDINARY_TIME (Time after Epiphany and Time after Pentecost)
 */
export function getLiturgicalSeason(
  date: Date | string,
): LiturgicalSeason {
  const dayStr = getCalendarDayString(date);
  const [year, month, day] = dayStr.split('-').map(Number);

  const floating = new Date(Date.UTC(year, month - 1, day));
  const jan5 = new Date(Date.UTC(year, 0, 5));
  const dec25 = new Date(Date.UTC(year, 11, 25));
  const easter = computeEasterSunday(year);
  const ashWednesday = subDays(easter, 46);
  const pentecost = addDays(easter, 49);
  const adventSunday = getAdventStart(year);

  if (floating <= jan5) return 'CHRISTMAS';
  if (floating < ashWednesday) return 'ORDINARY_TIME';
  if (floating < easter) return 'LENT';
  if (floating < pentecost) return 'EASTER';
  if (floating.getTime() === pentecost.getTime()) return 'PENTECOST';
  if (floating < adventSunday) return 'ORDINARY_TIME';
  if (floating < dec25) return 'ADVENT';
  return 'CHRISTMAS';
}

export interface LiturgicalSeasonInfo {
  season: LiturgicalSeason;
  name: string;
  colorName: string;
  colorHex: string;
  badgeClass: string;
}

export const LITURGICAL_SEASON_DETAILS: Record<LiturgicalSeason, LiturgicalSeasonInfo> = {
  ADVENT: {
    season: 'ADVENT',
    name: 'Advent',
    colorName: 'Purple / Violet',
    colorHex: '#7e22ce',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300',
  },
  CHRISTMAS: {
    season: 'CHRISTMAS',
    name: 'Christmas',
    colorName: 'White / Gold',
    colorHex: '#eab308',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300',
  },
  LENT: {
    season: 'LENT',
    name: 'Lent',
    colorName: 'Purple',
    colorHex: '#6b21a8',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300',
  },
  EASTER: {
    season: 'EASTER',
    name: 'Easter',
    colorName: 'White / Gold',
    colorHex: '#eab308',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300',
  },
  PENTECOST: {
    season: 'PENTECOST',
    name: 'Pentecost',
    colorName: 'Red',
    colorHex: '#dc2626',
    badgeClass: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300',
  },
  ORDINARY_TIME: {
    season: 'ORDINARY_TIME',
    name: 'Ordinary Time',
    colorName: 'Green',
    colorHex: '#16a34a',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
};

/**
 * Calculates the next upcoming Sunday date (or today if today is Sunday).
 */
export function getNextSunday(fromDate: Date = new Date()): Date {
  const date = new Date(fromDate);
  const day = date.getDay(); // 0 is Sunday
  const diff = day === 0 ? 0 : 7 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(10, 0, 0, 0);
  return date;
}

export interface LiturgicalKeyDate {
  name: string;
  season: LiturgicalSeason;
  date: Date;
}

/** Returns the major liturgical holy days for a given ministry year. */
export function getLiturgicalKeyDates(year: number): LiturgicalKeyDate[] {
  const easter = computeEasterSunday(year);
  return [
    { name: 'Ash Wednesday', season: 'LENT', date: subDays(easter, 46) },
    { name: 'Palm Sunday', season: 'LENT', date: subDays(easter, 7) },
    { name: 'Maundy Thursday', season: 'LENT', date: subDays(easter, 3) },
    { name: 'Good Friday', season: 'LENT', date: subDays(easter, 2) },
    { name: 'Easter Sunday', season: 'EASTER', date: easter },
    { name: 'Pentecost Sunday', season: 'PENTECOST', date: addDays(easter, 49) },
    { name: 'First Sunday of Advent', season: 'ADVENT', date: getAdventStart(year) },
    { name: 'Christmas Day', season: 'CHRISTMAS', date: new Date(Date.UTC(year, 11, 25)) },
  ];
}

// ============================================================================
// Liturgical Seasonal Par Level Surges
// ============================================================================

export const SACRED_COMMUNION_KEYWORDS = [
  'communion',
  'wafer',
  'wafers',
  'wine',
  'altar candle',
  'altar candles',
  'candle',
  'candles',
  'chalice',
  'paten',
  'purificator',
  'eucharist',
  'eucharistic',
  'host',
  'hosts',
  'sacrament',
  'sacramental',
  'grape juice',
];

/**
 * Checks whether an inventory item is classified as a sacred or communion supply
 * that experiences elevated liturgical feast demand (e.g. Communion Wafers, Wine, Altar Candles).
 */
export function isSacredOrCommunionItem(item: {
  name: string;
  notes?: string | null;
  inventoryType?: { slug?: string; name?: string } | null;
}): boolean {
  const nameLower = item.name.toLowerCase();
  const notesLower = item.notes?.toLowerCase() ?? '';

  const hasKeyword = SACRED_COMMUNION_KEYWORDS.some(
    (kw) => nameLower.includes(kw) || notesLower.includes(kw)
  );
  if (hasKeyword) return true;

  if (notesLower.includes('sacred') || notesLower.includes('[sacred]')) return true;

  return false;
}

export interface ActiveSurgeWindow {
  isActive: boolean;
  feastName: 'Easter Sunday' | 'Christmas Eve' | null;
  seasonName: 'Lent/Easter' | 'Advent/Christmas' | null;
  badgeText: string | null;
  surgeReason: string | null;
  daysUntilFeast: number | null;
  feastDateString: string | null;
}

/**
 * Determines whether a given target date (in America/Chicago) falls within
 * the 30-day preparation window prior to Easter Sunday or Christmas Eve.
 */
export function getActiveLiturgicalSurgeWindow(
  targetDate: Date | string = new Date()
): ActiveSurgeWindow {
  const dayStr = getCalendarDayString(targetDate);
  const [year] = dayStr.split('-').map(Number);

  // Check candidate years around the boundary (previous, current, next)
  const candidateYears = [year - 1, year, year + 1];

  for (const y of candidateYears) {
    // 1. Easter Sunday Window (30 days prior through Easter Sunday)
    const easter = computeEasterSunday(y);
    const easterStr = getCalendarDayString(easter);
    const easterDate = parseISO(easterStr);
    const easterSurgeStartDate = subDays(easterDate, 30);
    const easterSurgeStartStr = format(easterSurgeStartDate, 'yyyy-MM-dd');

    if (dayStr >= easterSurgeStartStr && dayStr <= easterStr) {
      const daysUntil = differenceInCalendarDays(easterDate, parseISO(dayStr));
      return {
        isActive: true,
        feastName: 'Easter Sunday',
        seasonName: 'Lent/Easter',
        badgeText: '⚡ Lent/Easter Par Surge Active',
        surgeReason: 'Lent/Easter Par Surge Active',
        daysUntilFeast: Math.max(0, daysUntil),
        feastDateString: easterStr,
      };
    }

    // 2. Christmas Eve Window (30 days prior to Dec 24 through Christmas Day Dec 25)
    const christmasEveStr = `${y}-12-24`;
    const christmasDayStr = `${y}-12-25`;
    const christmasEveDate = parseISO(christmasEveStr);
    const christmasSurgeStartDate = subDays(christmasEveDate, 30);
    const christmasSurgeStartStr = format(christmasSurgeStartDate, 'yyyy-MM-dd');

    if (dayStr >= christmasSurgeStartStr && dayStr <= christmasDayStr) {
      const daysUntil = differenceInCalendarDays(christmasEveDate, parseISO(dayStr));
      return {
        isActive: true,
        feastName: 'Christmas Eve',
        seasonName: 'Advent/Christmas',
        badgeText: '⚡ Advent/Christmas Par Surge Active',
        surgeReason: 'Advent/Christmas Par Surge Active',
        daysUntilFeast: Math.max(0, daysUntil),
        feastDateString: christmasEveStr,
      };
    }
  }

  return {
    isActive: false,
    feastName: null,
    seasonName: null,
    badgeText: null,
    surgeReason: null,
    daysUntilFeast: null,
    feastDateString: null,
  };
}

/**
 * Calculates elevated par level with +50% surge, ceiling rounded.
 */
export function calculateSurgedParLevel(basePar: number): number {
  if (basePar <= 0) return 0;
  return Math.ceil(basePar * 1.5);
}

export class ParSurgeResult {
  surgedParLevel: number;
  effectivePar: number;
  basePar: number;
  isSurged: boolean;
  surgeMultiplier: number;
  feastName: string | null;
  badgeText: string | null;
  surgeReason: string | null;
  daysUntilFeast: number | null;

  constructor(data: {
    surgedParLevel: number;
    basePar: number;
    isSurged: boolean;
    surgeMultiplier: number;
    feastName: string | null;
    badgeText: string | null;
    surgeReason: string | null;
    daysUntilFeast: number | null;
  }) {
    this.surgedParLevel = data.surgedParLevel;
    this.effectivePar = data.surgedParLevel;
    this.basePar = data.basePar;
    this.isSurged = data.isSurged;
    this.surgeMultiplier = data.surgeMultiplier;
    this.feastName = data.feastName;
    this.badgeText = data.badgeText;
    this.surgeReason = data.surgeReason;
    this.daysUntilFeast = data.daysUntilFeast;
  }

  valueOf(): number {
    return this.surgedParLevel;
  }

  toString(): string {
    return String(this.surgedParLevel);
  }

  [Symbol.toPrimitive](hint: string) {
    if (hint === 'string') return String(this.surgedParLevel);
    return this.surgedParLevel;
  }
}

export interface ItemForParSurge {
  idealQty: number;
  name?: string;
  notes?: string | null;
  inventoryType?: { slug?: string; name?: string } | null;
  inventoryTypeId?: string | null;
}

/**
 * Intelligent par surge calculator:
 * For sacred/communion items (e.g. Communion Wafers, Communion Wine, Altar Candles),
 * automatically calculates an elevated seasonal par threshold (+50%) 30 days prior
 * to major feast days (Easter Sunday, Christmas Eve) using Meeus astronomical Easter calculation.
 */
export function getSurgedParLevel(
  item: ItemForParSurge,
  targetDate: Date | string = new Date()
): ParSurgeResult {
  const basePar = Math.max(0, item.idealQty ?? 0);
  const surgeWindow = getActiveLiturgicalSurgeWindow(targetDate);
  const isSacred = isSacredOrCommunionItem({
    name: item.name ?? '',
    notes: item.notes,
    inventoryType: item.inventoryType,
  });

  const shouldSurge = surgeWindow.isActive && isSacred;
  const surgedParLevel = shouldSurge ? calculateSurgedParLevel(basePar) : basePar;

  return new ParSurgeResult({
    surgedParLevel,
    basePar,
    isSurged: shouldSurge,
    surgeMultiplier: shouldSurge ? 1.5 : 1.0,
    feastName: shouldSurge ? surgeWindow.feastName : null,
    badgeText: shouldSurge ? surgeWindow.badgeText : null,
    surgeReason: shouldSurge ? surgeWindow.surgeReason : null,
    daysUntilFeast: shouldSurge ? surgeWindow.daysUntilFeast : null,
  });
}

// ============================================================================
// Revised Common Lectionary (RCL) Auto-Sync Engine
// ============================================================================

export interface LectionaryReadingSet {
  sundayName: string;
  season: LiturgicalSeason;
  cycle: 'A' | 'B' | 'C';
  date: string; // yyyy-MM-dd
  firstReading: string;
  psalm: string;
  epistle: string;
  gospel: string;
  citationSummary: string;
}

export interface CanonicalReadingsByCycle {
  A: { firstReading: string; psalm: string; epistle: string; gospel: string };
  B: { firstReading: string; psalm: string; epistle: string; gospel: string };
  C: { firstReading: string; psalm: string; epistle: string; gospel: string };
}

/**
 * Computes the Revised Common Lectionary (RCL) 3-Year Cycle (Year A, B, or C) for any calendar date.
 * The liturgical year begins on the First Sunday of Advent.
 * - Year A: Gospel of Matthew (e.g. 2022-2023, 2025-2026)
 * - Year B: Gospel of Mark (e.g. 2023-2024, 2026-2027)
 * - Year C: Gospel of Luke (e.g. 2024-2025, 2027-2028)
 */
export function getLectionaryCycle(date: Date | string = new Date()): 'A' | 'B' | 'C' {
  const dayStr = getCalendarDayString(date);
  const [year] = dayStr.split('-').map(Number);
  const adventStart = getAdventStart(year);
  const adventStartStr = getCalendarDayString(adventStart);

  const liturgicalYear = dayStr >= adventStartStr ? year : year - 1;
  const mod = (liturgicalYear + 1) % 3;
  if (mod === 1) return 'A';
  if (mod === 2) return 'B';
  return 'C';
}

/** Canonical Scripture readings database for the Revised Common Lectionary across Years A, B, and C. */
const RCL_READINGS_DB: Record<string, CanonicalReadingsByCycle> = {
  'advent-1': {
    A: { firstReading: 'Isaiah 2:1-5', psalm: 'Psalm 122', epistle: 'Romans 13:11-14', gospel: 'Matthew 24:36-44' },
    B: { firstReading: 'Isaiah 64:1-9', psalm: 'Psalm 80:1-7, 17-19', epistle: '1 Corinthians 1:3-9', gospel: 'Mark 13:24-37' },
    C: { firstReading: 'Jeremiah 33:14-16', psalm: 'Psalm 25:1-10', epistle: '1 Thessalonians 3:9-13', gospel: 'Luke 21:25-36' },
  },
  'advent-2': {
    A: { firstReading: 'Isaiah 11:1-10', psalm: 'Psalm 72:1-7, 18-19', epistle: 'Romans 15:4-13', gospel: 'Matthew 3:1-12' },
    B: { firstReading: 'Isaiah 40:1-11', psalm: 'Psalm 85:1-2, 8-13', epistle: '2 Peter 3:8-15a', gospel: 'Mark 1:1-8' },
    C: { firstReading: 'Malachi 3:1-4', psalm: 'Luke 1:68-79', epistle: 'Philippians 1:3-11', gospel: 'Luke 3:1-6' },
  },
  'advent-3': {
    A: { firstReading: 'Isaiah 35:1-10', psalm: 'Psalm 146:5-10', epistle: 'James 5:7-10', gospel: 'Matthew 11:2-11' },
    B: { firstReading: 'Isaiah 61:1-4, 8-11', psalm: 'Psalm 126', epistle: '1 Thessalonians 5:16-24', gospel: 'John 1:6-8, 19-28' },
    C: { firstReading: 'Zephaniah 3:14-20', psalm: 'Isaiah 12:2-6', epistle: 'Philippians 4:4-7', gospel: 'Luke 3:7-18' },
  },
  'advent-4': {
    A: { firstReading: 'Isaiah 7:10-16', psalm: 'Psalm 80:1-7, 17-19', epistle: 'Romans 1:1-7', gospel: 'Matthew 1:18-25' },
    B: { firstReading: '2 Samuel 7:1-11, 16', psalm: 'Luke 1:46b-55', epistle: 'Romans 16:25-27', gospel: 'Luke 1:26-38' },
    C: { firstReading: 'Micah 5:2-5a', psalm: 'Luke 1:46b-55', epistle: 'Hebrews 10:5-10', gospel: 'Luke 1:39-45' },
  },
  'christmas-day': {
    A: { firstReading: 'Isaiah 9:2-7', psalm: 'Psalm 96', epistle: 'Titus 2:11-14', gospel: 'Luke 2:1-20' },
    B: { firstReading: 'Isaiah 9:2-7', psalm: 'Psalm 96', epistle: 'Titus 2:11-14', gospel: 'Luke 2:1-20' },
    C: { firstReading: 'Isaiah 9:2-7', psalm: 'Psalm 96', epistle: 'Titus 2:11-14', gospel: 'Luke 2:1-20' },
  },
  'christmas-1': {
    A: { firstReading: 'Isaiah 63:7-9', psalm: 'Psalm 148', epistle: 'Hebrews 2:10-18', gospel: 'Matthew 2:13-23' },
    B: { firstReading: 'Isaiah 61:10-62:3', psalm: 'Psalm 148', epistle: 'Galatians 4:4-7', gospel: 'Luke 2:22-40' },
    C: { firstReading: '1 Samuel 2:18-20, 26', psalm: 'Psalm 148', epistle: 'Colossians 3:12-17', gospel: 'Luke 2:41-52' },
  },
  'epiphany': {
    A: { firstReading: 'Isaiah 60:1-6', psalm: 'Psalm 72:1-7, 10-14', epistle: 'Ephesians 3:1-12', gospel: 'Matthew 2:1-12' },
    B: { firstReading: 'Isaiah 60:1-6', psalm: 'Psalm 72:1-7, 10-14', epistle: 'Ephesians 3:1-12', gospel: 'Matthew 2:1-12' },
    C: { firstReading: 'Isaiah 60:1-6', psalm: 'Psalm 72:1-7, 10-14', epistle: 'Ephesians 3:1-12', gospel: 'Matthew 2:1-12' },
  },
  'baptism-of-the-lord': {
    A: { firstReading: 'Isaiah 42:1-9', psalm: 'Psalm 29', epistle: 'Acts 10:34-43', gospel: 'Matthew 3:13-17' },
    B: { firstReading: 'Genesis 1:1-5', psalm: 'Psalm 29', epistle: 'Acts 19:1-7', gospel: 'Mark 1:4-11' },
    C: { firstReading: 'Isaiah 43:1-7', psalm: 'Psalm 29', epistle: 'Acts 8:14-17', gospel: 'Luke 3:15-17, 21-22' },
  },
  'epiphany-2': {
    A: { firstReading: 'Isaiah 49:1-7', psalm: 'Psalm 40:1-11', epistle: '1 Corinthians 1:1-9', gospel: 'John 1:29-42' },
    B: { firstReading: '1 Samuel 3:1-10, 11-20', psalm: 'Psalm 139:1-6, 13-18', epistle: '1 Corinthians 6:12-20', gospel: 'John 1:43-51' },
    C: { firstReading: 'Isaiah 62:1-5', psalm: 'Psalm 36:5-10', epistle: '1 Corinthians 12:1-11', gospel: 'John 2:1-11' },
  },
  'epiphany-3': {
    A: { firstReading: 'Isaiah 9:1-4', psalm: 'Psalm 27:1, 4-9', epistle: '1 Corinthians 1:10-18', gospel: 'Matthew 4:12-23' },
    B: { firstReading: 'Jonah 3:1-5, 10', psalm: 'Psalm 62:5-12', epistle: '1 Corinthians 7:29-31', gospel: 'Mark 1:14-20' },
    C: { firstReading: 'Nehemiah 8:1-3, 5-6, 8-10', psalm: 'Psalm 19', epistle: '1 Corinthians 12:12-31a', gospel: 'Luke 4:14-21' },
  },
  'transfiguration': {
    A: { firstReading: 'Exodus 24:12-18', psalm: 'Psalm 2', epistle: '2 Peter 1:16-21', gospel: 'Matthew 17:1-9' },
    B: { firstReading: '2 Kings 2:1-12', psalm: 'Psalm 50:1-6', epistle: '2 Corinthians 4:3-6', gospel: 'Mark 9:2-9' },
    C: { firstReading: 'Exodus 34:29-35', psalm: 'Psalm 99', epistle: '2 Corinthians 3:12-4:2', gospel: 'Luke 9:28-36' },
  },
  'ash-wednesday': {
    A: { firstReading: 'Joel 2:1-2, 12-17', psalm: 'Psalm 51:1-17', epistle: '2 Corinthians 5:20b-6:10', gospel: 'Matthew 6:1-6, 16-21' },
    B: { firstReading: 'Joel 2:1-2, 12-17', psalm: 'Psalm 51:1-17', epistle: '2 Corinthians 5:20b-6:10', gospel: 'Matthew 6:1-6, 16-21' },
    C: { firstReading: 'Joel 2:1-2, 12-17', psalm: 'Psalm 51:1-17', epistle: '2 Corinthians 5:20b-6:10', gospel: 'Matthew 6:1-6, 16-21' },
  },
  'lent-1': {
    A: { firstReading: 'Genesis 2:15-17; 3:1-7', psalm: 'Psalm 32', epistle: 'Romans 5:12-19', gospel: 'Matthew 4:1-11' },
    B: { firstReading: 'Genesis 9:8-17', psalm: 'Psalm 25:1-10', epistle: '1 Peter 3:18-22', gospel: 'Mark 1:9-15' },
    C: { firstReading: 'Deuteronomy 26:1-11', psalm: 'Psalm 91:1-2, 9-16', epistle: 'Romans 10:8b-13', gospel: 'Luke 4:1-13' },
  },
  'lent-2': {
    A: { firstReading: 'Genesis 12:1-4a', psalm: 'Psalm 121', epistle: 'Romans 4:1-5, 13-17', gospel: 'John 3:1-17' },
    B: { firstReading: 'Genesis 17:1-7, 15-16', psalm: 'Psalm 22:23-31', epistle: 'Romans 4:13-25', gospel: 'Mark 8:31-38' },
    C: { firstReading: 'Genesis 15:1-12, 17-18', psalm: 'Psalm 27', epistle: 'Philippians 3:17-4:1', gospel: 'Luke 13:31-35' },
  },
  'lent-3': {
    A: { firstReading: 'Exodus 17:1-7', psalm: 'Psalm 95', epistle: 'Romans 5:1-11', gospel: 'John 4:5-42' },
    B: { firstReading: 'Exodus 20:1-17', psalm: 'Psalm 19', epistle: '1 Corinthians 1:18-25', gospel: 'John 2:13-22' },
    C: { firstReading: 'Isaiah 55:1-9', psalm: 'Psalm 63:1-8', epistle: '1 Corinthians 10:1-13', gospel: 'Luke 13:1-9' },
  },
  'lent-4': {
    A: { firstReading: '1 Samuel 16:1-13', psalm: 'Psalm 23', epistle: 'Ephesians 5:8-14', gospel: 'John 9:1-41' },
    B: { firstReading: 'Numbers 21:4-9', psalm: 'Psalm 107:1-3, 17-22', epistle: 'Ephesians 2:1-10', gospel: 'John 3:14-21' },
    C: { firstReading: 'Joshua 5:9-12', psalm: 'Psalm 32', epistle: '2 Corinthians 5:16-21', gospel: 'Luke 15:1-3, 11b-32' },
  },
  'lent-5': {
    A: { firstReading: 'Ezekiel 37:1-14', psalm: 'Psalm 130', epistle: 'Romans 8:6-11', gospel: 'John 11:1-45' },
    B: { firstReading: 'Jeremiah 31:31-34', psalm: 'Psalm 51:1-12', epistle: 'Hebrews 5:5-10', gospel: 'John 12:20-33' },
    C: { firstReading: 'Isaiah 43:16-21', psalm: 'Psalm 126', epistle: 'Philippians 3:4b-14', gospel: 'John 12:1-8' },
  },
  'palm-sunday': {
    A: { firstReading: 'Isaiah 50:4-9a', psalm: 'Psalm 31:9-16', epistle: 'Philippians 2:5-11', gospel: 'Matthew 26:14-27:66' },
    B: { firstReading: 'Isaiah 50:4-9a', psalm: 'Psalm 31:9-16', epistle: 'Philippians 2:5-11', gospel: 'Mark 14:1-15:47' },
    C: { firstReading: 'Isaiah 50:4-9a', psalm: 'Psalm 31:9-16', epistle: 'Philippians 2:5-11', gospel: 'Luke 22:14-23:56' },
  },
  'easter-sunday': {
    A: { firstReading: 'Acts 10:34-43', psalm: 'Psalm 118:1-2, 14-24', epistle: 'Colossians 3:1-4', gospel: 'Matthew 28:1-10' },
    B: { firstReading: 'Acts 10:34-43', psalm: 'Psalm 118:1-2, 14-24', epistle: '1 Corinthians 15:1-11', gospel: 'Mark 16:1-8' },
    C: { firstReading: 'Acts 10:34-43', psalm: 'Psalm 118:1-2, 14-24', epistle: '1 Corinthians 15:19-26', gospel: 'Luke 24:1-12' },
  },
  'easter-2': {
    A: { firstReading: 'Acts 2:14a, 22-32', psalm: 'Psalm 16', epistle: '1 Peter 1:3-9', gospel: 'John 20:19-31' },
    B: { firstReading: 'Acts 4:32-35', psalm: 'Psalm 133', epistle: '1 John 1:1-2:2', gospel: 'John 20:19-31' },
    C: { firstReading: 'Acts 5:27-32', psalm: 'Psalm 118:14-29', epistle: 'Revelation 1:4-8', gospel: 'John 20:19-31' },
  },
  'easter-3': {
    A: { firstReading: 'Acts 2:14a, 36-41', psalm: 'Psalm 116:1-4, 12-19', epistle: '1 Peter 1:17-23', gospel: 'Luke 24:13-35' },
    B: { firstReading: 'Acts 3:12-19', psalm: 'Psalm 4', epistle: '1 John 3:1-7', gospel: 'Luke 24:36b-48' },
    C: { firstReading: 'Acts 9:1-6', psalm: 'Psalm 30', epistle: 'Revelation 5:11-14', gospel: 'John 21:1-19' },
  },
  'easter-4': {
    A: { firstReading: 'Acts 2:42-47', psalm: 'Psalm 23', epistle: '1 Peter 2:19-25', gospel: 'John 10:1-10' },
    B: { firstReading: 'Acts 4:5-12', psalm: 'Psalm 23', epistle: '1 John 3:16-24', gospel: 'John 10:11-18' },
    C: { firstReading: 'Acts 9:36-43', psalm: 'Psalm 23', epistle: 'Revelation 7:9-17', gospel: 'John 10:22-30' },
  },
  'easter-5': {
    A: { firstReading: 'Acts 7:55-60', psalm: 'Psalm 31:1-5, 15-16', epistle: '1 Peter 2:2-10', gospel: 'John 14:1-14' },
    B: { firstReading: 'Acts 8:26-40', psalm: 'Psalm 22:25-31', epistle: '1 John 4:7-21', gospel: 'John 15:1-8' },
    C: { firstReading: 'Acts 11:1-18', psalm: 'Psalm 148', epistle: 'Revelation 21:1-6', gospel: 'John 13:31-35' },
  },
  'easter-6': {
    A: { firstReading: 'Acts 17:22-31', psalm: 'Psalm 66:8-20', epistle: '1 Peter 3:13-22', gospel: 'John 14:15-21' },
    B: { firstReading: 'Acts 10:44-48', psalm: 'Psalm 98', epistle: '1 John 5:1-6', gospel: 'John 15:9-17' },
    C: { firstReading: 'Acts 16:9-15', psalm: 'Psalm 67', epistle: 'Revelation 21:10, 22-22:5', gospel: 'John 14:23-29' },
  },
  'easter-7': {
    A: { firstReading: 'Acts 1:6-14', psalm: 'Psalm 68:1-10, 32-35', epistle: '1 Peter 4:12-14; 5:6-11', gospel: 'John 17:1-11' },
    B: { firstReading: 'Acts 1:15-17, 21-26', psalm: 'Psalm 1', epistle: '1 John 5:9-13', gospel: 'John 17:6-19' },
    C: { firstReading: 'Acts 16:16-34', psalm: 'Psalm 97', epistle: 'Revelation 22:12-14, 16-17, 20-21', gospel: 'John 17:20-26' },
  },
  'pentecost': {
    A: { firstReading: 'Acts 2:1-21', psalm: 'Psalm 104:24-34, 35b', epistle: '1 Corinthians 12:3b-13', gospel: 'John 20:19-23' },
    B: { firstReading: 'Acts 2:1-21', psalm: 'Psalm 104:24-34, 35b', epistle: 'Romans 8:22-27', gospel: 'John 15:26-27; 16:4b-15' },
    C: { firstReading: 'Acts 2:1-21', psalm: 'Psalm 104:24-34, 35b', epistle: 'Romans 8:14-17', gospel: 'John 14:8-17, 25-27' },
  },
  'trinity-sunday': {
    A: { firstReading: 'Genesis 1:1-2:4a', psalm: 'Psalm 8', epistle: '2 Corinthians 13:11-13', gospel: 'Matthew 28:16-20' },
    B: { firstReading: 'Isaiah 6:1-8', psalm: 'Psalm 29', epistle: 'Romans 8:12-17', gospel: 'John 3:1-17' },
    C: { firstReading: 'Proverbs 8:1-4, 22-31', psalm: 'Psalm 8', epistle: 'Romans 5:1-5', gospel: 'John 16:12-15' },
  },
  'christ-the-king': {
    A: { firstReading: 'Ezekiel 34:11-16, 20-24', psalm: 'Psalm 100', epistle: 'Ephesians 1:15-23', gospel: 'Matthew 25:31-46' },
    B: { firstReading: '2 Samuel 23:1-7', psalm: 'Psalm 132:1-12', epistle: 'Revelation 1:4b-8', gospel: 'John 18:33-37' },
    C: { firstReading: 'Jeremiah 23:1-6', psalm: 'Luke 1:68-79', epistle: 'Colossians 1:11-20', gospel: 'Luke 23:33-43' },
  },
  // Ordinary Time Propers
  'proper-17': {
    A: { firstReading: 'Exodus 3:1-15', psalm: 'Psalm 105:1-6, 23-26, 45c', epistle: 'Romans 12:9-21', gospel: 'Matthew 16:21-28' },
    B: { firstReading: 'Song of Solomon 2:8-13', psalm: 'Psalm 45:1-2, 6-9', epistle: 'James 1:17-27', gospel: 'Mark 7:1-8, 14-15, 21-23' },
    C: { firstReading: 'Jeremiah 2:4-13', psalm: 'Psalm 81:1, 10-16', epistle: 'Hebrews 13:1-8, 15-16', gospel: 'Luke 14:1, 7-14' },
  },
  'proper-18': {
    A: { firstReading: 'Ezekiel 33:7-11', psalm: 'Psalm 119:33-40', epistle: 'Romans 13:8-14', gospel: 'Matthew 18:15-20' },
    B: { firstReading: 'Proverbs 22:1-2, 8-9, 22-23', psalm: 'Psalm 125', epistle: 'James 2:1-17', gospel: 'Mark 7:24-37' },
    C: { firstReading: 'Jeremiah 18:1-11', psalm: 'Psalm 139:1-6, 13-18', epistle: 'Philemon 1-21', gospel: 'Luke 14:25-33' },
  },
  'proper-19': {
    A: { firstReading: 'Genesis 50:15-21', psalm: 'Psalm 103:1-13', epistle: 'Romans 14:1-12', gospel: 'Matthew 18:21-35' },
    B: { firstReading: 'Proverbs 1:20-33', psalm: 'Psalm 19', epistle: 'James 3:1-12', gospel: 'Mark 8:27-38' },
    C: { firstReading: 'Jeremiah 4:11-12, 22-28', psalm: 'Psalm 14', epistle: '1 Timothy 1:12-17', gospel: 'Luke 15:1-10' },
  },
  'proper-20': {
    A: { firstReading: 'Jonah 3:10-4:11', psalm: 'Psalm 145:1-8', epistle: 'Philippians 1:21-30', gospel: 'Matthew 20:1-16' },
    B: { firstReading: 'Proverbs 31:10-31', psalm: 'Psalm 1', epistle: 'James 3:13-4:3, 7-8a', gospel: 'Mark 9:30-37' },
    C: { firstReading: 'Jeremiah 8:18-9:1', psalm: 'Psalm 79:1-9', epistle: '1 Timothy 2:1-7', gospel: 'Luke 16:1-13' },
  },
  'proper-21': {
    A: { firstReading: 'Ezekiel 18:1-4, 25-32', psalm: 'Psalm 25:1-9', epistle: 'Philippians 2:1-13', gospel: 'Matthew 21:23-32' },
    B: { firstReading: 'Esther 7:1-6, 9-10; 9:20-22', psalm: 'Psalm 124', epistle: 'James 5:13-20', gospel: 'Mark 9:38-50' },
    C: { firstReading: 'Jeremiah 32:1-3a, 6-15', psalm: 'Psalm 91:1-6, 14-16', epistle: '1 Timothy 6:6-19', gospel: 'Luke 16:19-31' },
  },
  'proper-22': {
    A: { firstReading: 'Isaiah 5:1-7', psalm: 'Psalm 80:7-15', epistle: 'Philippians 3:4b-14', gospel: 'Matthew 21:33-46' },
    B: { firstReading: 'Job 1:1; 2:1-10', psalm: 'Psalm 26', epistle: 'Hebrews 1:1-4; 2:5-12', gospel: 'Mark 10:2-16' },
    C: { firstReading: 'Lamentations 1:1-6', psalm: 'Psalm 137', epistle: '2 Timothy 1:1-14', gospel: 'Luke 17:5-10' },
  },
  'proper-23': {
    A: { firstReading: 'Isaiah 25:1-9', psalm: 'Psalm 23', epistle: 'Philippians 4:1-9', gospel: 'Matthew 22:1-14' },
    B: { firstReading: 'Job 23:1-9, 16-17', psalm: 'Psalm 22:1-15', epistle: 'Hebrews 4:12-16', gospel: 'Mark 10:17-31' },
    C: { firstReading: 'Jeremiah 29:1, 4-7', psalm: 'Psalm 66:1-12', epistle: '2 Timothy 2:8-15', gospel: 'Luke 17:11-19' },
  },
  'proper-24': {
    A: { firstReading: 'Exodus 33:12-23', psalm: 'Psalm 99', epistle: '1 Thessalonians 1:1-10', gospel: 'Matthew 22:15-22' },
    B: { firstReading: 'Job 38:1-7, 34-41', psalm: 'Psalm 104:1-9, 24, 35c', epistle: 'Hebrews 5:1-10', gospel: 'Mark 10:35-45' },
    C: { firstReading: 'Jeremiah 31:27-34', psalm: 'Psalm 119:97-104', epistle: '2 Timothy 3:14-4:5', gospel: 'Luke 18:1-8' },
  },
  'proper-25': {
    A: { firstReading: 'Deuteronomy 34:1-12', psalm: 'Psalm 90:1-6, 13-17', epistle: '1 Thessalonians 2:1-8', gospel: 'Matthew 22:34-46' },
    B: { firstReading: 'Job 42:1-6, 10-17', psalm: 'Psalm 34:1-8, 19-22', epistle: 'Hebrews 7:23-28', gospel: 'Mark 10:46-52' },
    C: { firstReading: 'Joel 2:23-32', psalm: 'Psalm 65', epistle: '2 Timothy 4:6-8, 16-18', gospel: 'Luke 18:9-14' },
  },
  'proper-26': {
    A: { firstReading: 'Joshua 3:7-17', psalm: 'Psalm 107:1-7, 33-37', epistle: '1 Thessalonians 2:9-13', gospel: 'Matthew 23:1-12' },
    B: { firstReading: 'Ruth 1:1-18', psalm: 'Psalm 146', epistle: 'Hebrews 9:11-14', gospel: 'Mark 12:28-34' },
    C: { firstReading: 'Habakkuk 1:1-4; 2:1-4', psalm: 'Psalm 119:137-144', epistle: '2 Thessalonians 1:1-4, 11-12', gospel: 'Luke 19:1-10' },
  },
  'proper-27': {
    A: { firstReading: 'Joshua 24:1-3a, 14-25', psalm: 'Psalm 78:1-7', epistle: '1 Thessalonians 4:13-18', gospel: 'Matthew 25:1-13' },
    B: { firstReading: 'Ruth 3:1-5; 4:13-17', psalm: 'Psalm 127', epistle: 'Hebrews 9:24-28', gospel: 'Mark 12:38-44' },
    C: { firstReading: 'Haggai 1:15b-2:9', psalm: 'Psalm 145:1-5, 17-21', epistle: '2 Thessalonians 2:1-5, 13-17', gospel: 'Luke 20:27-38' },
  },
  'proper-28': {
    A: { firstReading: 'Judges 4:1-7', psalm: 'Psalm 123', epistle: '1 Thessalonians 5:1-11', gospel: 'Matthew 25:14-30' },
    B: { firstReading: '1 Samuel 1:4-20', psalm: '1 Samuel 2:1-10', epistle: 'Hebrews 10:11-25', gospel: 'Mark 13:1-8' },
    C: { firstReading: 'Isaiah 65:17-25', psalm: 'Isaiah 12', epistle: '2 Thessalonians 3:6-13', gospel: 'Luke 21:5-19' },
  },
};

/**
 * Resolves the liturgical Sunday or major Holy Day for any given date.
 */
export function getLiturgicalSunday(date: Date | string = new Date()): {
  key: string;
  name: string;
  season: LiturgicalSeason;
  cycle: 'A' | 'B' | 'C';
} {
  const dayStr = getCalendarDayString(date);
  const [year, month, day] = dayStr.split('-').map(Number);
  const floating = new Date(Date.UTC(year, month - 1, day));
  const cycle = getLectionaryCycle(floating);
  const season = getLiturgicalSeason(floating);

  const easter = computeEasterSunday(year);
  const easterDiff = differenceInCalendarDays(floating, easter);

  // Holy Week / Easter checks
  if (easterDiff === 0) return { key: 'easter-sunday', name: 'Easter Day (Resurrection of the Lord)', season: 'EASTER', cycle };
  if (easterDiff === 7) return { key: 'easter-2', name: 'Second Sunday of Easter', season: 'EASTER', cycle };
  if (easterDiff === 14) return { key: 'easter-3', name: 'Third Sunday of Easter', season: 'EASTER', cycle };
  if (easterDiff === 21) return { key: 'easter-4', name: 'Fourth Sunday of Easter (Good Shepherd)', season: 'EASTER', cycle };
  if (easterDiff === 28) return { key: 'easter-5', name: 'Fifth Sunday of Easter', season: 'EASTER', cycle };
  if (easterDiff === 35) return { key: 'easter-6', name: 'Sixth Sunday of Easter', season: 'EASTER', cycle };
  if (easterDiff === 42) return { key: 'easter-7', name: 'Seventh Sunday of Easter', season: 'EASTER', cycle };
  if (easterDiff === 49) return { key: 'pentecost', name: 'Day of Pentecost', season: 'PENTECOST', cycle };
  if (easterDiff === 56) return { key: 'trinity-sunday', name: 'Trinity Sunday', season: 'ORDINARY_TIME', cycle };

  // Lent checks
  if (easterDiff === -46) return { key: 'ash-wednesday', name: 'Ash Wednesday', season: 'LENT', cycle };
  if (easterDiff === -42) return { key: 'lent-1', name: 'First Sunday in Lent', season: 'LENT', cycle };
  if (easterDiff === -35) return { key: 'lent-2', name: 'Second Sunday in Lent', season: 'LENT', cycle };
  if (easterDiff === -28) return { key: 'lent-3', name: 'Third Sunday in Lent', season: 'LENT', cycle };
  if (easterDiff === -21) return { key: 'lent-4', name: 'Fourth Sunday in Lent', season: 'LENT', cycle };
  if (easterDiff === -14) return { key: 'lent-5', name: 'Fifth Sunday in Lent', season: 'LENT', cycle };
  if (easterDiff === -7) return { key: 'palm-sunday', name: 'Palm / Passion Sunday', season: 'LENT', cycle };
  if (easterDiff === -49) return { key: 'transfiguration', name: 'Transfiguration of the Lord', season: 'ORDINARY_TIME', cycle };

  // Advent checks
  const adventStart = getAdventStart(year);
  const adventDiff = differenceInCalendarDays(floating, adventStart);
  if (adventDiff === 0) return { key: 'advent-1', name: 'First Sunday of Advent', season: 'ADVENT', cycle };
  if (adventDiff === 7) return { key: 'advent-2', name: 'Second Sunday of Advent', season: 'ADVENT', cycle };
  if (adventDiff === 14) return { key: 'advent-3', name: 'Third Sunday of Advent', season: 'ADVENT', cycle };
  if (adventDiff === 21) return { key: 'advent-4', name: 'Fourth Sunday of Advent', season: 'ADVENT', cycle };

  // Christmas / Epiphany checks
  if (month === 12 && day === 25) return { key: 'christmas-day', name: 'Nativity of the Lord (Christmas Day)', season: 'CHRISTMAS', cycle };
  if (month === 12 && day > 25) return { key: 'christmas-1', name: 'First Sunday after Christmas', season: 'CHRISTMAS', cycle };
  if (month === 1 && day === 6) return { key: 'epiphany', name: 'Epiphany of the Lord', season: 'ORDINARY_TIME', cycle };
  if (month === 1 && day >= 7 && day <= 13) return { key: 'baptism-of-the-lord', name: 'Baptism of the Lord', season: 'ORDINARY_TIME', cycle };
  if (month === 1 && day > 13) return { key: 'epiphany-2', name: 'Second Sunday after Epiphany', season: 'ORDINARY_TIME', cycle };
  if (month === 2 && floating < subDays(easter, 49)) return { key: 'epiphany-3', name: 'Third Sunday after Epiphany', season: 'ORDINARY_TIME', cycle };

  // Ordinary Time & Christ the King
  const nextAdventStart = getAdventStart(year);
  const daysToAdvent = differenceInCalendarDays(nextAdventStart, floating);
  if (daysToAdvent === 7) return { key: 'christ-the-king', name: 'Christ the King (Reign of Christ)', season: 'ORDINARY_TIME', cycle };

  // Autumn Propers based on approximate calendar week
  if (month === 8) return { key: 'proper-17', name: 'Proper 17 (22nd Sunday in Ordinary Time)', season: 'ORDINARY_TIME', cycle };
  if (month === 9 && day <= 10) return { key: 'proper-18', name: 'Proper 18 (23rd Sunday in Ordinary Time)', season: 'ORDINARY_TIME', cycle };
  if (month === 9 && day <= 17) return { key: 'proper-19', name: 'Proper 19 (24th Sunday in Ordinary Time)', season: 'ORDINARY_TIME', cycle };
  if (month === 9 && day <= 24) return { key: 'proper-20', name: 'Proper 20 (25th Sunday in Ordinary Time)', season: 'ORDINARY_TIME', cycle };
  if (month === 9 || (month === 10 && day <= 3)) return { key: 'proper-21', name: 'Proper 21 (26th Sunday in Ordinary Time)', season: 'ORDINARY_TIME', cycle };
  if (month === 10 && day <= 10) return { key: 'proper-22', name: 'Proper 22 (27th Sunday in Ordinary Time)', season: 'ORDINARY_TIME', cycle };
  if (month === 10 && day <= 17) return { key: 'proper-23', name: 'Proper 23 (28th Sunday in Ordinary Time)', season: 'ORDINARY_TIME', cycle };
  if (month === 10 && day <= 24) return { key: 'proper-24', name: 'Proper 24 (29th Sunday in Ordinary Time)', season: 'ORDINARY_TIME', cycle };
  if (month === 10) return { key: 'proper-25', name: 'Proper 25 (30th Sunday in Ordinary Time)', season: 'ORDINARY_TIME', cycle };
  if (month === 11 && day <= 7) return { key: 'proper-26', name: 'Proper 26 (31st Sunday in Ordinary Time)', season: 'ORDINARY_TIME', cycle };
  if (month === 11 && day <= 14) return { key: 'proper-27', name: 'Proper 27 (32nd Sunday in Ordinary Time)', season: 'ORDINARY_TIME', cycle };
  if (month === 11 && day <= 21) return { key: 'proper-28', name: 'Proper 28 (33rd Sunday in Ordinary Time)', season: 'ORDINARY_TIME', cycle };

  return { key: 'proper-18', name: 'Sunday in Ordinary Time', season: 'ORDINARY_TIME', cycle };
}

/**
 * Retrieves the 4 canonical weekly Scripture texts (First Reading, Psalm, Epistle, Gospel)
 * for the current liturgical Sunday according to the Revised Common Lectionary 3-Year Cycle.
 */
export function getLectionaryReadings(date: Date | string = new Date()): LectionaryReadingSet {
  const dayStr = getCalendarDayString(date);
  const liturgicalDay = getLiturgicalSunday(date);
  const cycle = liturgicalDay.cycle;

  const readingEntry = RCL_READINGS_DB[liturgicalDay.key] ?? RCL_READINGS_DB['proper-18'];
  const readings = readingEntry[cycle] ?? readingEntry.A;

  const citationSummary = `${readings.firstReading} • ${readings.psalm} • ${readings.epistle} • ${readings.gospel}`;

  return {
    sundayName: liturgicalDay.name,
    season: liturgicalDay.season,
    cycle,
    date: dayStr,
    firstReading: readings.firstReading,
    psalm: readings.psalm,
    epistle: readings.epistle,
    gospel: readings.gospel,
    citationSummary,
  };
}
