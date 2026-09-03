import { startOfLocalDay } from '@/lib/digestSchedule';

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-amber-100 text-amber-700',
  URGENT: 'bg-red-100 text-red-700',
};

export const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

export const STATUS_STYLES: Record<string, string> = {
  TODO: 'bg-slate-100 text-slate-600',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  DONE: 'bg-green-100 text-green-700',
};

/** Solid fills for bar charts — kept separate from the badge tints above (bg-100/text-700 pairs). */
export const STATUS_BAR_COLORS: Record<string, string> = {
  TODO: 'bg-slate-400 dark:bg-slate-500',
  IN_PROGRESS: 'bg-blue-500',
  DONE: 'bg-green-500',
};

export const PRIORITY_BAR_COLORS: Record<string, string> = {
  LOW: 'bg-slate-400 dark:bg-slate-500',
  MEDIUM: 'bg-blue-500',
  HIGH: 'bg-amber-500',
  URGENT: 'bg-red-500',
};

export const TAG_COLORS = [
  'slate',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'pink',
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

export const TAG_COLOR_STYLES: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-600',
  red: 'bg-red-100 text-red-700',
  orange: 'bg-orange-100 text-orange-700',
  amber: 'bg-amber-100 text-amber-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  lime: 'bg-lime-100 text-lime-700',
  green: 'bg-green-100 text-green-700',
  teal: 'bg-teal-100 text-teal-700',
  cyan: 'bg-cyan-100 text-cyan-700',
  blue: 'bg-blue-100 text-blue-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  violet: 'bg-violet-100 text-violet-700',
  pink: 'bg-pink-100 text-pink-700',
};

export const TAG_COLOR_DOT_STYLES: Record<string, string> = {
  slate: 'bg-slate-400',
  red: 'bg-red-400',
  orange: 'bg-orange-400',
  amber: 'bg-amber-400',
  yellow: 'bg-yellow-400',
  lime: 'bg-lime-400',
  green: 'bg-green-400',
  teal: 'bg-teal-400',
  cyan: 'bg-cyan-400',
  blue: 'bg-blue-400',
  indigo: 'bg-indigo-400',
  violet: 'bg-violet-400',
  pink: 'bg-pink-400',
};

export const ACTIVITY_ACTION_ICONS: Record<string, string> = {
  STATUS_CHANGED: '🔄',
  ASSIGNEES_CHANGED: '👤',
  PRIORITY_CHANGED: '⚡',
  DUE_DATE_CHANGED: '📅',
  TITLE_CHANGED: '✏️',
  TAGS_CHANGED: '🏷️',
  MOVED: '➡️',
  RESTORED: '♻️',
};

export const AUTOMATION_ACTION_LABELS: Record<string, string> = {
  SET_STATUS: 'Set status',
  SET_ASSIGNEE: 'Set assignee',
  MOVE_SECTION: 'Move to section',
  CREATE_TASK: 'Create a new task',
};

// Must agree with dashboard.ts's isOverdue, which drives the dashboard's overdueCount stat tile —
// otherwise per-task overdue badges here (Kanban, list, grid, My Tasks) can disagree with that
// count. Using the device's local midnight (the previous behavior) breaks that agreement for
// anyone whose device clock isn't set to Central time.
const APP_TIMEZONE = 'America/Chicago';

export function formatDueDate(dueDate: string | Date | null): { label: string; overdue: boolean } {
  if (!dueDate) return { label: 'No due date', overdue: false };
  const date = new Date(dueDate);

  const overdue = date.getTime() < startOfLocalDay(new Date(), APP_TIMEZONE).getTime();
  const label = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: APP_TIMEZONE,
  });
  return { label, overdue };
}
