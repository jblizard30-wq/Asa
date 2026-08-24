import { getCalendarDayString } from '@/lib/dateUtils';

export interface VolunteerCandidate {
  id: string;
  name: string;
  email?: string;
}

export interface VolunteerServeHistory {
  userId: string;
  servedAt: Date | string;
}

export interface VolunteerWeeklyPattern {
  userId: string;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  available: boolean;
}

export interface VolunteerException {
  userId: string;
  date: Date | string;
  available: boolean;
}

export interface RotationAssignmentResult {
  assigned: VolunteerCandidate[];
  unavailable: { candidate: VolunteerCandidate; reason: string }[];
  rankedPool: {
    candidate: VolunteerCandidate;
    lastServedAt: Date | null;
    serveCount: number;
  }[];
}

/**
 * Ranks eligible volunteers by fairness (least recently served first), respecting both weekly
 * availability schedules and specific date overrides.
 */
export function rankAndSelectVolunteers(
  candidates: VolunteerCandidate[],
  history: VolunteerServeHistory[],
  weeklyPatterns: VolunteerWeeklyPattern[],
  exceptions: VolunteerException[],
  targetDate: Date | string,
  slotsNeeded: number = 1,
): RotationAssignmentResult {
  const targetDayString = getCalendarDayString(targetDate);
  const [year, month, day] = targetDayString.split('-').map(Number);
  const targetDateObj = new Date(Date.UTC(year, month - 1, day));
  const targetDayOfWeek = targetDateObj.getUTCDay();

  const unavailable: { candidate: VolunteerCandidate; reason: string }[] = [];
  const eligible: VolunteerCandidate[] = [];

  for (const candidate of candidates) {
    // 1. Check one-off date exception (takes top precedence)
    const dateException = exceptions.find(
      (e) => e.userId === candidate.id && getCalendarDayString(e.date) === targetDayString,
    );

    if (dateException) {
      if (!dateException.available) {
        unavailable.push({ candidate, reason: 'Date-specific blackout exception' });
        continue;
      }
    } else {
      // 2. Check weekly pattern
      const weekly = weeklyPatterns.find(
        (p) => p.userId === candidate.id && p.dayOfWeek === targetDayOfWeek,
      );
      if (weekly && !weekly.available) {
        unavailable.push({ candidate, reason: 'Weekly schedule marked unavailable' });
        continue;
      }
    }

    eligible.push(candidate);
  }

  // Calculate serve statistics per candidate
  const rankedPool = eligible.map((candidate) => {
    const userHistory = history
      .filter((h) => h.userId === candidate.id)
      .map((h) => (typeof h.servedAt === 'string' ? new Date(h.servedAt) : h.servedAt))
      .sort((a, b) => b.getTime() - a.getTime());

    const lastServedAt = userHistory.length > 0 ? userHistory[0] : null;
    return {
      candidate,
      lastServedAt,
      serveCount: userHistory.length,
    };
  });

  // Sort candidates:
  // 1. Never served (lastServedAt === null) come first
  // 2. Oldest lastServedAt timestamp comes first
  // 3. Lowest total serve count
  // 4. Alphabetical tie-break
  rankedPool.sort((a, b) => {
    if (!a.lastServedAt && b.lastServedAt) return -1;
    if (a.lastServedAt && !b.lastServedAt) return 1;
    if (a.lastServedAt && b.lastServedAt) {
      const timeDiff = a.lastServedAt.getTime() - b.lastServedAt.getTime();
      if (timeDiff !== 0) return timeDiff;
    }
    if (a.serveCount !== b.serveCount) return a.serveCount - b.serveCount;
    return a.candidate.name.localeCompare(b.candidate.name);
  });

  const assigned = rankedPool.slice(0, Math.max(1, slotsNeeded)).map((r) => r.candidate);

  return {
    assigned,
    unavailable,
    rankedPool,
  };
}

