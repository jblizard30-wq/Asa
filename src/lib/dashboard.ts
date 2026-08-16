import { differenceInCalendarDays } from 'date-fns';
import { startOfLocalDay } from '@/lib/digestSchedule';

const APP_TIMEZONE = 'America/Chicago';

export const STATUS_ORDER = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
export const PRIORITY_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export interface DashboardTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assigneeIds: string[];
  assigneeName: string | null;
  projectId: string;
  projectName: string;
  updatedAt: string;
}

export interface DashboardPerson {
  id: string;
  name: string;
  role: string;
}

export interface CountBreakdown {
  key: string;
  count: number;
}

export interface MemberStats {
  userId: string;
  name: string;
  role: string;
  openCount: number;
  overdueCount: number;
  dueSoonCount: number;
  completedRecentCount: number;
  totalCount: number;
  completionRate: number;
}

export interface ProjectStats {
  projectId: string;
  projectName: string;
  openCount: number;
  overdueCount: number;
  doneCount: number;
  totalCount: number;
  completionRate: number;
}

export interface TeamGroup {
  id: string;
  name: string;
  managerName: string | null;
  memberIds: string[];
}

export interface TeamStats extends TeamGroup {
  memberCount: number;
  openCount: number;
  overdueCount: number;
  doneCount: number;
  totalCount: number;
  completionRate: number;
}

export interface TaskListEntry {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  assigneeName: string | null;
  priority: string;
  dueDate: string | null;
  updatedAt: string;
  /** Positive = overdue, negative = upcoming. Only set for tasks with a due date. */
  daysFromNow: number | null;
}

export interface TopLineStats {
  peopleCount: number;
  openCount: number;
  overdueCount: number;
  dueSoonCount: number;
  completedRecentCount: number;
  totalCount: number;
  completionRate: number;
}

export function isOverdue(task: Pick<DashboardTask, 'status' | 'dueDate'>, now: Date): boolean {
  if (task.status === 'DONE' || !task.dueDate) return false;
  return new Date(task.dueDate).getTime() < startOfLocalDay(now, APP_TIMEZONE).getTime();
}

export function isDueSoon(task: Pick<DashboardTask, 'status' | 'dueDate'>, now: Date, days = 7): boolean {
  if (task.status === 'DONE' || !task.dueDate) return false;
  const due = new Date(task.dueDate).getTime();
  const today = startOfLocalDay(now, APP_TIMEZONE).getTime();
  return due >= today && due <= startOfLocalDay(now, APP_TIMEZONE, days).getTime();
}

export function isRecentlyCompleted(task: Pick<DashboardTask, 'status' | 'updatedAt'>, now: Date, windowDays = 14): boolean {
  if (task.status !== 'DONE') return false;
  return new Date(task.updatedAt).getTime() >= startOfLocalDay(now, APP_TIMEZONE, -windowDays).getTime();
}

function safeRate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function computeTopLineStats(tasks: DashboardTask[], peopleCount: number, now: Date): TopLineStats {
  const doneCount = tasks.filter((t) => t.status === 'DONE').length;
  return {
    peopleCount,
    openCount: tasks.filter((t) => t.status !== 'DONE').length,
    overdueCount: tasks.filter((t) => isOverdue(t, now)).length,
    dueSoonCount: tasks.filter((t) => isDueSoon(t, now)).length,
    completedRecentCount: tasks.filter((t) => isRecentlyCompleted(t, now)).length,
    totalCount: tasks.length,
    completionRate: safeRate(doneCount, tasks.length),
  };
}

export function computeStatusBreakdown(tasks: DashboardTask[]): CountBreakdown[] {
  return STATUS_ORDER.map((status) => ({
    key: status,
    count: tasks.filter((t) => t.status === status).length,
  }));
}

/** Priority mix of open (not-DONE) tasks — what's actually on the plate right now. */
export function computePriorityBreakdown(tasks: DashboardTask[]): CountBreakdown[] {
  const open = tasks.filter((t) => t.status !== 'DONE');
  return PRIORITY_ORDER.map((priority) => ({
    key: priority,
    count: open.filter((t) => t.priority === priority).length,
  }));
}

export function computeMemberStats(tasks: DashboardTask[], people: DashboardPerson[], now: Date): MemberStats[] {
  return people
    .map((person) => {
      const own = tasks.filter((t) => t.assigneeIds.includes(person.id));
      const doneCount = own.filter((t) => t.status === 'DONE').length;
      return {
        userId: person.id,
        name: person.name,
        role: person.role,
        openCount: own.filter((t) => t.status !== 'DONE').length,
        overdueCount: own.filter((t) => isOverdue(t, now)).length,
        dueSoonCount: own.filter((t) => isDueSoon(t, now)).length,
        completedRecentCount: own.filter((t) => isRecentlyCompleted(t, now)).length,
        totalCount: own.length,
        completionRate: safeRate(doneCount, own.length),
      };
    })
    .sort((a, b) => b.overdueCount - a.overdueCount || b.openCount - a.openCount || a.name.localeCompare(b.name));
}

export function computeProjectStats(tasks: DashboardTask[], now: Date): ProjectStats[] {
  const byProject = new Map<string, { projectName: string; tasks: DashboardTask[] }>();
  for (const task of tasks) {
    const entry = byProject.get(task.projectId) ?? { projectName: task.projectName, tasks: [] };
    entry.tasks.push(task);
    byProject.set(task.projectId, entry);
  }

  return [...byProject.entries()]
    .map(([projectId, { projectName, tasks: projectTasks }]) => {
      const doneCount = projectTasks.filter((t) => t.status === 'DONE').length;
      return {
        projectId,
        projectName,
        openCount: projectTasks.filter((t) => t.status !== 'DONE').length,
        overdueCount: projectTasks.filter((t) => isOverdue(t, now)).length,
        doneCount,
        totalCount: projectTasks.length,
        completionRate: safeRate(doneCount, projectTasks.length),
      };
    })
    .sort((a, b) => b.openCount - a.openCount || b.overdueCount - a.overdueCount);
}

export function computeTeamStats(tasks: DashboardTask[], teams: TeamGroup[], now: Date): TeamStats[] {
  return teams
    .map((team) => {
      const memberIdSet = new Set(team.memberIds);
      const teamTasks = tasks.filter((t) => t.assigneeIds.some((id) => memberIdSet.has(id)));
      const doneCount = teamTasks.filter((t) => t.status === 'DONE').length;
      return {
        ...team,
        memberCount: team.memberIds.length,
        openCount: teamTasks.filter((t) => t.status !== 'DONE').length,
        overdueCount: teamTasks.filter((t) => isOverdue(t, now)).length,
        doneCount,
        totalCount: teamTasks.length,
        completionRate: safeRate(doneCount, teamTasks.length),
      };
    })
    .sort((a, b) => b.openCount - a.openCount);
}

function toListEntry(task: DashboardTask, now: Date): TaskListEntry {
  return {
    id: task.id,
    title: task.title,
    projectId: task.projectId,
    projectName: task.projectName,
    assigneeName: task.assigneeName,
    priority: task.priority,
    dueDate: task.dueDate,
    updatedAt: task.updatedAt,
    daysFromNow: task.dueDate ? differenceInCalendarDays(startOfLocalDay(now, APP_TIMEZONE), new Date(task.dueDate)) : null,
  };
}

export function computeOverdueTasks(tasks: DashboardTask[], now: Date, limit = 10): TaskListEntry[] {
  return tasks
    .filter((t) => isOverdue(t, now))
    .map((t) => toListEntry(t, now))
    .sort((a, b) => (b.daysFromNow ?? 0) - (a.daysFromNow ?? 0))
    .slice(0, limit);
}

export function computeUpcomingTasks(tasks: DashboardTask[], now: Date, days = 7, limit = 10): TaskListEntry[] {
  // daysFromNow is negative for future due dates (e.g. -1 = due tomorrow); descending puts the
  // least-negative (soonest) first, same comparator direction as computeOverdueTasks.
  return tasks
    .filter((t) => isDueSoon(t, now, days))
    .map((t) => toListEntry(t, now))
    .sort((a, b) => (b.daysFromNow ?? 0) - (a.daysFromNow ?? 0))
    .slice(0, limit);
}

export function computeRecentlyCompleted(tasks: DashboardTask[], now: Date, windowDays = 14, limit = 10): TaskListEntry[] {
  return tasks
    .filter((t) => isRecentlyCompleted(t, now, windowDays))
    .map((t) => toListEntry(t, now))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}
