import { prisma } from '@/lib/prisma';
import type { Session } from 'next-auth';

export type ChildProtectionStatus = 'COMPLIANT' | 'EXPIRING_SOON' | 'EXPIRED' | 'INCOMPLETE';

export const RENEWAL_WARNING_DAYS = 45;
export const MINISTRY_SAFE_VALIDITY_YEARS = 3;
export const BACKGROUND_CHECK_VALIDITY_YEARS = 5;

export interface SerializedChildProtectionRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  ministries: string[];
  docusignSigned: boolean;
  docusignSignedAt: string | null;
  docusignUrl: string | null;
  ministrySafeCompletedAt: string | null;
  ministrySafeExpiresAt: string | null;
  ministrySafeUrl: string | null;
  backgroundCheckCompletedAt: string | null;
  backgroundCheckExpiresAt: string | null;
  backgroundCheckUrl: string | null;
  notes: string | null;
  userId: string | null;
  user: { id: string; name: string; email: string } | null;
  status: ChildProtectionStatus;
  daysUntilMinistrySafeExpires: number | null;
  daysUntilBackgroundCheckExpires: number | null;
  daysUntilNextRenewal: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Adds years to a date safely in UTC to avoid local timezone jumps.
 *
 * A Feb 29 source date is clipped to Feb 28 when the target year has no leap
 * day, rather than silently rolling over to Mar 1 (JS Date's default
 * behavior) — for a compliance expiry, the conservative (earlier) date is
 * the intended one, not a bonus day of validity.
 */
export function addYears(date: Date, years: number): Date {
  const wasFeb29 = date.getUTCMonth() === 1 && date.getUTCDate() === 29;
  const d = new Date(date.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + years);
  if (wasFeb29 && d.getUTCMonth() !== 1) {
    d.setUTCMonth(1, 28);
  }
  return d;
}

export function computeMinistrySafeExpiry(completedAt: Date): Date {
  return addYears(completedAt, MINISTRY_SAFE_VALIDITY_YEARS);
}

export function computeBackgroundCheckExpiry(completedAt: Date): Date {
  return addYears(completedAt, BACKGROUND_CHECK_VALIDITY_YEARS);
}

export function differenceInCalendarDays(futureDate: Date, fromDate: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const utc1 = Date.UTC(futureDate.getUTCFullYear(), futureDate.getUTCMonth(), futureDate.getUTCDate());
  const utc2 = Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate());
  return Math.floor((utc1 - utc2) / msPerDay);
}

export function computeRecordStatus(record: {
  docusignSigned: boolean;
  ministrySafeCompletedAt: Date | null;
  ministrySafeExpiresAt?: Date | null;
  backgroundCheckCompletedAt: Date | null;
  backgroundCheckExpiresAt?: Date | null;
  now?: Date;
}): {
  status: ChildProtectionStatus;
  daysUntilMinistrySafeExpires: number | null;
  daysUntilBackgroundCheckExpires: number | null;
  daysUntilNextRenewal: number | null;
} {
  const now = record.now ?? new Date();

  // Day counts are computed whenever a completion date exists, even if the
  // record is otherwise INCOMPLETE (e.g. missing DocuSign) — an already-
  // expired MinistrySafe cert shouldn't be masked just because some other
  // requirement is also outstanding.
  const msExpires = record.ministrySafeCompletedAt
    ? record.ministrySafeExpiresAt ?? computeMinistrySafeExpiry(record.ministrySafeCompletedAt)
    : null;
  const bgExpires = record.backgroundCheckCompletedAt
    ? record.backgroundCheckExpiresAt ?? computeBackgroundCheckExpiry(record.backgroundCheckCompletedAt)
    : null;

  const msDays = msExpires ? differenceInCalendarDays(msExpires, now) : null;
  const bgDays = bgExpires ? differenceInCalendarDays(bgExpires, now) : null;

  const knownDays = [msDays, bgDays].filter((d): d is number => d !== null);
  const daysUntilNextRenewal = knownDays.length > 0 ? Math.min(...knownDays) : null;

  // Incomplete if missing DocuSign or any of the initial completions
  if (!record.docusignSigned || !record.ministrySafeCompletedAt || !record.backgroundCheckCompletedAt) {
    return {
      status: 'INCOMPLETE',
      daysUntilMinistrySafeExpires: msDays,
      daysUntilBackgroundCheckExpires: bgDays,
      daysUntilNextRenewal,
    };
  }

  // Both dates are present past this point, so msDays/bgDays are non-null.
  // If either has expired
  if (msDays! < 0 || bgDays! < 0) {
    return {
      status: 'EXPIRED',
      daysUntilMinistrySafeExpires: msDays,
      daysUntilBackgroundCheckExpires: bgDays,
      daysUntilNextRenewal,
    };
  }

  // If either is expiring within the warning threshold (45 days)
  if (msDays! <= RENEWAL_WARNING_DAYS || bgDays! <= RENEWAL_WARNING_DAYS) {
    return {
      status: 'EXPIRING_SOON',
      daysUntilMinistrySafeExpires: msDays,
      daysUntilBackgroundCheckExpires: bgDays,
      daysUntilNextRenewal,
    };
  }

  return {
    status: 'COMPLIANT',
    daysUntilMinistrySafeExpires: msDays,
    daysUntilBackgroundCheckExpires: bgDays,
    daysUntilNextRenewal,
  };
}

// ---------------------------------------------------------------------------
// CSV / Google Sheets import parsing
// ---------------------------------------------------------------------------

/**
 * One parsed row from a pasted CSV/Sheets import. A field is `undefined`
 * when its cell was blank — distinct from an explicit value — so callers can
 * merge into an existing record without a blank cell clobbering real data.
 */
export interface ParsedChildProtectionImportRow {
  name: string;
  email?: string;
  ministries?: string[];
  docusignSigned?: boolean;
  ministrySafeCompletedAt?: string;
  backgroundCheckCompletedAt?: string;
}

/**
 * Splits one line on `delimiter`, honoring RFC 4180 quoting (a field starting
 * with `"` runs until the matching unescaped `"`, with `""` as an escaped
 * quote). Needed because a real CSV export's quoted field can contain the
 * same character used elsewhere as the delimiter (e.g. "Smith, Jr., John").
 */
export function splitDelimitedLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' && current.length === 0) {
      inQuotes = true;
    } else if (char === delimiter) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

function looksLikeHeaderCell(firstCell: string): boolean {
  const normalized = firstCell.trim().toLowerCase();
  return normalized.includes('name') || normalized.includes('volunteer');
}

function parseDocusignCell(raw: string | undefined): boolean | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.toLowerCase();
  return normalized === 'yes' || normalized === 'true' || normalized === 'x' || normalized === '1';
}

/**
 * Parses a date cell into a UTC-anchored ISO string. Only unambiguous
 * formats are accepted (ISO `YYYY-MM-DD`, or `M/D/YYYY` as commonly exported
 * by Excel/Sheets) and both are constructed via `Date.UTC` directly — never
 * `new Date(arbitraryString)`, which parses non-ISO formats in the browser's
 * local timezone and can silently shift the date by a day depending on the
 * importing user's timezone. An unrecognized or invalid-calendar-date cell
 * is reported as invalid rather than guessed at.
 */
function parseImportDateCell(raw: string | undefined): { iso: string | undefined; invalid: boolean } {
  if (raw === undefined) return { iso: undefined, invalid: false };
  const trimmed = raw.trim();
  if (!trimmed) return { iso: undefined, invalid: false };

  let match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const [, y, mo, d] = match;
    const iso = utcIsoDateOrNull(Number(y), Number(mo), Number(d));
    return iso ? { iso, invalid: false } : { iso: undefined, invalid: true };
  }

  match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    const [, mo, d, yRaw] = match;
    const y = yRaw.length === 2 ? 2000 + Number(yRaw) : Number(yRaw);
    const iso = utcIsoDateOrNull(y, Number(mo), Number(d));
    return iso ? { iso, invalid: false } : { iso: undefined, invalid: true };
  }

  return { iso: undefined, invalid: true };
}

function utcIsoDateOrNull(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date.toISOString();
}

function mergeImportRow(
  base: ParsedChildProtectionImportRow,
  incoming: ParsedChildProtectionImportRow
): ParsedChildProtectionImportRow {
  return {
    name: incoming.name || base.name,
    email: incoming.email !== undefined ? incoming.email : base.email,
    ministries: incoming.ministries !== undefined ? incoming.ministries : base.ministries,
    docusignSigned: incoming.docusignSigned !== undefined ? incoming.docusignSigned : base.docusignSigned,
    ministrySafeCompletedAt:
      incoming.ministrySafeCompletedAt !== undefined ? incoming.ministrySafeCompletedAt : base.ministrySafeCompletedAt,
    backgroundCheckCompletedAt:
      incoming.backgroundCheckCompletedAt !== undefined
        ? incoming.backgroundCheckCompletedAt
        : base.backgroundCheckCompletedAt,
  };
}

/**
 * Parses pasted CSV or Google Sheets text into import rows. Delimiter (tab
 * vs. comma) is decided once from the first line, not per-row, so one field
 * containing a stray tab can't desync that row's columns from its neighbors.
 * Rows that collapse to the same person within the same paste (matched by
 * email, else by name) are merged rather than both imported, so pasting two
 * overlapping sheets doesn't create duplicates before the data even reaches
 * the database.
 */
export function parseChildProtectionImportRows(raw: string): {
  records: ParsedChildProtectionImportRow[];
  warnings: string[];
} {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const warnings: string[] = [];
  if (lines.length === 0) return { records: [], warnings };

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const parsedRows: ParsedChildProtectionImportRow[] = [];

  lines.forEach((line, index) => {
    const parts = splitDelimitedLine(line, delimiter).map((p) => p.trim());
    const name = parts[0];

    if (index === 0 && looksLikeHeaderCell(name ?? '')) {
      return;
    }
    if (!name) return;

    const email = parts[1] ? parts[1] : undefined;
    const ministries = parts[2]
      ? parts[2].split(';').map((s) => s.trim()).filter((s) => s.length > 0)
      : undefined;
    const docusignSigned = parseDocusignCell(parts[3]);

    const msResult = parseImportDateCell(parts[4]);
    if (msResult.invalid) {
      warnings.push(
        `Row ${index + 1} ("${name}"): MinistrySafe date "${parts[4]}" wasn't recognized — imported without it, please set it manually.`
      );
    }

    const bgResult = parseImportDateCell(parts[5]);
    if (bgResult.invalid) {
      warnings.push(
        `Row ${index + 1} ("${name}"): Background Check date "${parts[5]}" wasn't recognized — imported without it, please set it manually.`
      );
    }

    parsedRows.push({
      name,
      email,
      ministries,
      docusignSigned,
      ministrySafeCompletedAt: msResult.iso,
      backgroundCheckCompletedAt: bgResult.iso,
    });
  });

  const collapsed: ParsedChildProtectionImportRow[] = [];
  const indexByKey = new Map<string, number>();
  for (const row of parsedRows) {
    const key = row.email ? `email:${row.email.toLowerCase()}` : `name:${row.name.toLowerCase()}`;
    const existingIndex = indexByKey.get(key);
    if (existingIndex !== undefined) {
      collapsed[existingIndex] = mergeImportRow(collapsed[existingIndex], row);
    } else {
      indexByKey.set(key, collapsed.length);
      collapsed.push(row);
    }
  }

  return { records: collapsed, warnings };
}

/**
 * Access control for Child Protection module.
 * - Global ADMINs always get EDIT access.
 * - Non-admins must have an explicit ChildProtectionShare via their userId or team membership.
 */
export async function checkChildProtectionAccess(
  session: Session | null
): Promise<{ allowed: boolean; access: 'VIEW' | 'EDIT' | null }> {
  if (!session?.user?.id) {
    return { allowed: false, access: null };
  }

  if (session.user.role === 'ADMIN') {
    return { allowed: true, access: 'EDIT' };
  }

  // Check direct user share
  const userShare = await prisma.childProtectionShare.findUnique({
    where: { userId: session.user.id },
  });

  if (userShare) {
    return { allowed: true, access: userShare.access };
  }

  // Check team shares
  const userTeams = await prisma.teamMember.findMany({
    where: { userId: session.user.id },
    select: { teamId: true },
  });

  if (userTeams.length > 0) {
    const teamIds = userTeams.map((t) => t.teamId);
    const teamShares = await prisma.childProtectionShare.findMany({
      where: { teamId: { in: teamIds } },
      select: { access: true },
    });

    // A user can belong to multiple shared teams with different access levels;
    // the most permissive one wins rather than an arbitrary one.
    if (teamShares.length > 0) {
      const access = teamShares.some((s) => s.access === 'EDIT') ? 'EDIT' : 'VIEW';
      return { allowed: true, access };
    }
  }

  return { allowed: false, access: null };
}
