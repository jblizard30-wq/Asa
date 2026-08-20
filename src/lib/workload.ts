import { addDays, format, startOfWeek } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// Same fixed-timezone convention as dashboard.ts / taskFilters.ts — due dates are absolute,
// org-wide calendar days, so bucketing them into weeks must use the org's own calendar day
// rather than whichever timezone the server process happens to be running in.
const APP_TIMEZONE = 'America/Chicago';

export const DEFAULT_WEEKLY_CAPACITY = 5;
export const WORKLOAD_WEEK_COUNT = 6;

export interface WorkloadTask {
  status: string;
  dueDate: string | null;
  assigneeIds: string[];
}

export interface WorkloadMember {
  id: string;
  name: string;
}

export interface WorkloadWeek {
  weekStart: string;
  label: string;
}

export interface WorkloadRow {
  userId: string;
  name: string;
  counts: number[];
  unscheduledCount: number;
  total: number;
}

export interface ProjectWorkload {
  weeks: WorkloadWeek[];
  rows: WorkloadRow[];
}

/** Monday-start week key for the calendar day a due date falls on, in APP_TIMEZONE. */
function weekKey(dueDate: string): string {
  const zoned = toZonedTime(new Date(dueDate), APP_TIMEZONE);
  return format(startOfWeek(zoned, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

/**
 * Buckets each open (not-DONE) task into the Monday-start week its due date falls in, per
 * assignee, over a fixed window starting this week. Tasks with no due date count separately as
 * "unscheduled" rather than falling into an arbitrary week bucket.
 */
export function computeProjectWorkload(
  tasks: WorkloadTask[],
  members: WorkloadMember[],
  now: Date,
  weekCount: number = WORKLOAD_WEEK_COUNT,
): ProjectWorkload {
  const currentWeekStart = startOfWeek(toZonedTime(now, APP_TIMEZONE), { weekStartsOn: 1 });
  const weeks: WorkloadWeek[] = Array.from({ length: weekCount }, (_, i) => {
    const start = addDays(currentWeekStart, i * 7);
    return { weekStart: format(start, 'yyyy-MM-dd'), label: format(start, 'MMM d') };
  });
  const weekIndex = new Map(weeks.map((w, i) => [w.weekStart, i]));

  const openTasks = tasks.filter((t) => t.status !== 'DONE');

  const rows = members.map((member) => {
    const own = openTasks.filter((t) => t.assigneeIds.includes(member.id));
    const counts = new Array(weekCount).fill(0);
    let unscheduledCount = 0;

    for (const task of own) {
      if (!task.dueDate) {
        unscheduledCount += 1;
        continue;
      }
      const idx = weekIndex.get(weekKey(task.dueDate));
      if (idx !== undefined) counts[idx] += 1;
      // Tasks due before this week or beyond the window aren't dropped from `own.length`
      // (reflected in `total`), just not attributed to any single week column.
    }

    return { userId: member.id, name: member.name, counts, unscheduledCount, total: own.length };
  });

  return { weeks, rows: rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)) };
}
