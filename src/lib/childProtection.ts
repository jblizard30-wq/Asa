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
 */
export function addYears(date: Date, years: number): Date {
  const d = new Date(date.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + years);
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

  // Incomplete if missing DocuSign or any of the initial completions
  if (!record.docusignSigned || !record.ministrySafeCompletedAt || !record.backgroundCheckCompletedAt) {
    return {
      status: 'INCOMPLETE',
      daysUntilMinistrySafeExpires: null,
      daysUntilBackgroundCheckExpires: null,
      daysUntilNextRenewal: null,
    };
  }

  const msExpires = record.ministrySafeExpiresAt ?? computeMinistrySafeExpiry(record.ministrySafeCompletedAt);
  const bgExpires = record.backgroundCheckExpiresAt ?? computeBackgroundCheckExpiry(record.backgroundCheckCompletedAt);

  const msDays = differenceInCalendarDays(msExpires, now);
  const bgDays = differenceInCalendarDays(bgExpires, now);

  // If either has expired
  if (msDays < 0 || bgDays < 0) {
    return {
      status: 'EXPIRED',
      daysUntilMinistrySafeExpires: msDays,
      daysUntilBackgroundCheckExpires: bgDays,
      daysUntilNextRenewal: Math.min(msDays, bgDays),
    };
  }

  // If either is expiring within the warning threshold (45 days)
  if (msDays <= RENEWAL_WARNING_DAYS || bgDays <= RENEWAL_WARNING_DAYS) {
    return {
      status: 'EXPIRING_SOON',
      daysUntilMinistrySafeExpires: msDays,
      daysUntilBackgroundCheckExpires: bgDays,
      daysUntilNextRenewal: Math.min(msDays, bgDays),
    };
  }

  return {
    status: 'COMPLIANT',
    daysUntilMinistrySafeExpires: msDays,
    daysUntilBackgroundCheckExpires: bgDays,
    daysUntilNextRenewal: Math.min(msDays, bgDays),
  };
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
    const teamShare = await prisma.childProtectionShare.findFirst({
      where: { teamId: { in: teamIds } },
      orderBy: { access: 'desc' }, // EDIT comes before VIEW alphabetically
    });

    if (teamShare) {
      return { allowed: true, access: teamShare.access };
    }
  }

  return { allowed: false, access: null };
}
