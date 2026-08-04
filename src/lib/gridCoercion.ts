import { fromZonedTime } from 'date-fns-tz';
import { PRIORITY_LABELS, STATUS_LABELS } from '@/lib/format';
import type { TagInfo } from '@/components/TagPicker';

/**
 * Paste lands as plain strings from the clipboard; the grid's columns are typed.
 * Every column gets one of these pure parse functions — Excel gives you strings,
 * the database has typed columns, and this is the seam between them. Never throws:
 * a bad value is reported as an error, never silently dropped or coerced to a guess.
 */
export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

type TaskStatusValue = keyof typeof STATUS_LABELS;
type TaskPriorityValue = keyof typeof PRIORITY_LABELS;

const GRID_DUE_DATE_TIMEZONE = 'America/Chicago';

export function parseTitle(raw: string): ParseResult<string> {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: false, error: 'Title cannot be empty' };
  return { ok: true, value: trimmed };
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Parses `8/12`, `Aug 12`, `Aug 12, 2026`, `2026-08-12`, `8/12/2026` — always as a calendar date in America/Chicago. */
export function parseDueDate(raw: string, now: Date = new Date()): ParseResult<string | null> {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: true, value: null };

  let year: number | null = null;
  let month: number;
  let day: number;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  const namedMatch = trimmed.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/);

  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else if (slashMatch) {
    month = Number(slashMatch[1]);
    day = Number(slashMatch[2]);
    year = slashMatch[3] ? Number(slashMatch[3]) : null;
  } else if (namedMatch) {
    const monthKey = namedMatch[1].toLowerCase();
    if (!(monthKey in MONTH_NAMES)) {
      return { ok: false, error: `Unrecognized month "${namedMatch[1]}" in "${raw}"` };
    }
    month = MONTH_NAMES[monthKey];
    day = Number(namedMatch[2]);
    year = namedMatch[3] ? Number(namedMatch[3]) : null;
  } else {
    return { ok: false, error: `Unrecognized date "${raw}" — try 8/12, Aug 12, or 2026-08-12` };
  }

  if (month < 1 || month > 12) return { ok: false, error: `Invalid month in "${raw}"` };

  if (year === null) {
    // Bare month/day: assume the current year, unless that's already more than six
    // months in the past — then assume the user means the upcoming one.
    const currentYear = now.getFullYear();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const candidateInCurrentYear = new Date(currentYear, month - 1, day);
    year = candidateInCurrentYear.getTime() < sixMonthsAgo.getTime() ? currentYear + 1 : currentYear;
  }

  if (day < 1 || day > daysInMonth(year, month)) {
    return { ok: false, error: `Invalid day in "${raw}"` };
  }

  const zoned = fromZonedTime(new Date(year, month - 1, day), GRID_DUE_DATE_TIMEZONE);
  return { ok: true, value: zoned.toISOString() };
}

function normalizeEnumInput(s: string): string {
  return s.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

const STATUS_SYNONYMS: Record<string, TaskStatusValue> = {
  'to do': 'TODO',
  todo: 'TODO',
  'not started': 'TODO',
  backlog: 'TODO',
  'in progress': 'IN_PROGRESS',
  inprogress: 'IN_PROGRESS',
  doing: 'IN_PROGRESS',
  active: 'IN_PROGRESS',
  started: 'IN_PROGRESS',
  done: 'DONE',
  complete: 'DONE',
  completed: 'DONE',
  finished: 'DONE',
};

export function parseStatus(raw: string): ParseResult<TaskStatusValue> {
  const normalized = normalizeEnumInput(raw);
  if (normalized in STATUS_SYNONYMS) return { ok: true, value: STATUS_SYNONYMS[normalized] };
  for (const value of Object.keys(STATUS_LABELS) as TaskStatusValue[]) {
    if (normalizeEnumInput(STATUS_LABELS[value]) === normalized || normalizeEnumInput(value) === normalized) {
      return { ok: true, value };
    }
  }
  return { ok: false, error: `"${raw}" doesn't match a status (To Do, In Progress, Done)` };
}

const PRIORITY_SYNONYMS: Record<string, TaskPriorityValue> = {
  low: 'LOW',
  minor: 'LOW',
  medium: 'MEDIUM',
  med: 'MEDIUM',
  normal: 'MEDIUM',
  high: 'HIGH',
  urgent: 'URGENT',
  critical: 'URGENT',
  asap: 'URGENT',
};

export function parsePriority(raw: string): ParseResult<TaskPriorityValue> {
  const normalized = normalizeEnumInput(raw);
  if (normalized in PRIORITY_SYNONYMS) return { ok: true, value: PRIORITY_SYNONYMS[normalized] };
  for (const value of Object.keys(PRIORITY_LABELS) as TaskPriorityValue[]) {
    if (normalizeEnumInput(PRIORITY_LABELS[value]) === normalized || normalizeEnumInput(value) === normalized) {
      return { ok: true, value };
    }
  }
  return { ok: false, error: `"${raw}" doesn't match a priority (Low, Medium, High, Urgent)` };
}

/** Case-insensitive exact match against team member names — comma/semicolon-separated for multiple assignees. */
export function parseAssignees(raw: string, members: { id: string; name: string }[]): ParseResult<string[]> {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: true, value: [] };

  const names = trimmed
    .split(/[,;]/)
    .map((n) => n.trim())
    .filter(Boolean);
  const ids: string[] = [];
  const problems: string[] = [];

  for (const name of names) {
    const matches = members.filter((m) => m.name.toLowerCase() === name.toLowerCase());
    if (matches.length === 1) {
      ids.push(matches[0].id);
    } else if (matches.length > 1) {
      problems.push(`"${name}" matches ${matches.length} members — open this cell and pick one`);
    } else {
      problems.push(`No member named "${name}"`);
    }
  }

  if (problems.length > 0) return { ok: false, error: problems.join('; ') };
  return { ok: true, value: Array.from(new Set(ids)) };
}

/** Case-insensitive exact match against project tags — comma/semicolon-separated for multiple tags. */
export function parseTags(raw: string, allTags: TagInfo[]): ParseResult<string[]> {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '—') return { ok: true, value: [] };

  const names = trimmed
    .split(/[,;]/)
    .map((n) => n.trim())
    .filter(Boolean);
  const ids: string[] = [];
  const problems: string[] = [];

  for (const name of names) {
    const matches = allTags.filter((t) => t.name.toLowerCase() === name.toLowerCase());
    if (matches.length === 1) {
      ids.push(matches[0].id);
    } else if (matches.length > 1) {
      problems.push(`"${name}" matches ${matches.length} tags — open this cell and pick one`);
    } else {
      problems.push(`No tag named "${name}"`);
    }
  }

  if (problems.length > 0) return { ok: false, error: problems.join('; ') };
  return { ok: true, value: Array.from(new Set(ids)) };
}
