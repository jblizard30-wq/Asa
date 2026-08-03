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

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  USER: 'User',
};

export const RECURRENCE_LABELS: Record<string, string> = {
  NONE: 'Does not repeat',
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
};

export const AUTOMATION_TRIGGER_LABELS: Record<string, string> = {
  STATUS_CHANGED: 'status changes to',
  ASSIGNEE_CHANGED: 'assignee changes',
  DUE_DATE_APPROACHING: 'due date is approaching',
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

export const AUTOMATION_ACTION_LABELS: Record<string, string> = {
  SET_STATUS: 'Set status',
  SET_ASSIGNEE: 'Set assignee',
  MOVE_SECTION: 'Move to section',
  CREATE_TASK: 'Create a new task',
};

export function formatDueDate(dueDate: string | Date | null): { label: string; overdue: boolean } {
  if (!dueDate) return { label: 'No due date', overdue: false };
  const date = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const compare = new Date(date);
  compare.setHours(0, 0, 0, 0);

  const overdue = compare.getTime() < now.getTime();
  const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return { label, overdue };
}
