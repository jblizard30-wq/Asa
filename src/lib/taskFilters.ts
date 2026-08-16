import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// Same fixed-timezone convention as dashboard.ts / digestSchedule.ts — due dates are absolute,
// org-wide calendar days (see toDayString below), so "is this due today" must be evaluated
// against the org's own calendar day, not whichever timezone the viewer's browser happens to
// be in (two viewers in different timezones must get the same answer for the same task).
const APP_TIMEZONE = 'America/Chicago';

/** Sentinel id used in `assigneeIds` to mean "no assignee set", since real user ids are cuids. */
export const UNASSIGNED_ID = '__unassigned__';

export type DueDatePreset = 'any' | 'overdue' | 'today' | 'this_week' | 'this_month' | 'no_date' | 'custom';

export const DUE_DATE_PRESET_LABELS: Record<DueDatePreset, string> = {
  any: 'Any due date',
  overdue: 'Overdue',
  today: 'Due today',
  this_week: 'Due this week',
  this_month: 'Due this month',
  no_date: 'No due date',
  custom: 'Custom range',
};

export interface TaskFilters {
  statuses: string[];
  priorities: string[];
  assigneeIds: string[];
  teamIds: string[];
  tagIds: string[];
  projectIds: string[];
  dueDatePreset: DueDatePreset;
  dueDateFrom: string | null;
  dueDateTo: string | null;
  search: string;
}

export const EMPTY_TASK_FILTERS: TaskFilters = {
  statuses: [],
  priorities: [],
  assigneeIds: [],
  teamIds: [],
  tagIds: [],
  projectIds: [],
  dueDatePreset: 'any',
  dueDateFrom: null,
  dueDateTo: null,
  search: '',
};

export interface FilterableTask {
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  assigneeIds: string[];
  dueDate: string | null;
  projectId?: string;
  tags: { id: string }[];
}

export interface TaskFilterContext {
  /** Maps a user id to every team id they belong to, so tasks can be matched by their assignee's team(s). */
  teamIdsByUserId?: Record<string, string[]>;
}

/**
 * Due dates carry no time-of-day — they're serialized as the UTC-midnight instant of whatever
 * calendar day the <input type="date"> picker produced, so `dueDate.slice(0, 10)` recovers that
 * day exactly regardless of the viewer's timezone. Comparing everything as "yyyy-MM-dd" strings
 * (rather than mixing that UTC-anchored instant with a local-timezone `now` Date) avoids the
 * off-by-one-day shift that any negative-UTC-offset viewer would otherwise see around midnight.
 */
function toDayString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function matchesDueDate(dueDate: string | null, filters: TaskFilters): boolean {
  if (filters.dueDatePreset === 'any') return true;
  if (filters.dueDatePreset === 'no_date') return !dueDate;
  // An unconfigured custom range (preset just selected, no bounds chosen yet) imposes no constraint.
  if (filters.dueDatePreset === 'custom' && !filters.dueDateFrom && !filters.dueDateTo) return true;
  if (!dueDate) return false;

  const day = dueDate.slice(0, 10);
  const now = toZonedTime(new Date(), APP_TIMEZONE);
  const today = toDayString(now);

  switch (filters.dueDatePreset) {
    case 'overdue':
      return day < today;
    case 'today':
      return day === today;
    case 'this_week':
      return day >= toDayString(startOfWeek(now)) && day <= toDayString(endOfWeek(now));
    case 'this_month':
      return day >= toDayString(startOfMonth(now)) && day <= toDayString(endOfMonth(now));
    case 'custom': {
      if (filters.dueDateFrom && day < filters.dueDateFrom) return false;
      if (filters.dueDateTo && day > filters.dueDateTo) return false;
      return true;
    }
    default:
      return true;
  }
}

export function matchesTaskFilters(task: FilterableTask, filters: TaskFilters, context: TaskFilterContext = {}): boolean {
  if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) return false;
  if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) return false;

  if (filters.assigneeIds.length > 0) {
    const matchesUnassigned = task.assigneeIds.length === 0 && filters.assigneeIds.includes(UNASSIGNED_ID);
    const matchesSpecific = task.assigneeIds.some((id) => filters.assigneeIds.includes(id));
    if (!matchesUnassigned && !matchesSpecific) return false;
  }

  if (filters.teamIds.length > 0) {
    const userTeams = task.assigneeIds.flatMap((id) => context.teamIdsByUserId?.[id] ?? []);
    if (!userTeams.some((teamId) => filters.teamIds.includes(teamId))) return false;
  }

  if (filters.tagIds.length > 0) {
    const taskTagIds = task.tags.map((t) => t.id);
    if (!filters.tagIds.some((id) => taskTagIds.includes(id))) return false;
  }

  if (filters.projectIds.length > 0) {
    if (!task.projectId || !filters.projectIds.includes(task.projectId)) return false;
  }

  if (!matchesDueDate(task.dueDate, filters)) return false;

  const query = filters.search.trim().toLowerCase();
  if (query) {
    const haystack = `${task.title} ${task.description ?? ''}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  return true;
}

export function countActiveFilters(filters: TaskFilters): number {
  let count = 0;
  if (filters.statuses.length > 0) count++;
  if (filters.priorities.length > 0) count++;
  if (filters.assigneeIds.length > 0) count++;
  if (filters.teamIds.length > 0) count++;
  if (filters.tagIds.length > 0) count++;
  if (filters.projectIds.length > 0) count++;
  if (filters.dueDatePreset !== 'any') count++;
  if (filters.search.trim()) count++;
  return count;
}
