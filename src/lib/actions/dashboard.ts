'use server';

import { requireManagerOrAdmin } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import {
  computeMemberStats,
  computeOverdueTasks,
  computePriorityBreakdown,
  computeProjectStats,
  computeRecentlyCompleted,
  computeStatusBreakdown,
  computeTeamStats,
  computeTopLineStats,
  computeUpcomingTasks,
  type CountBreakdown,
  type DashboardTask,
  type MemberStats,
  type ProjectStats,
  type TaskListEntry,
  type TeamGroup,
  type TeamStats,
  type TopLineStats,
} from '@/lib/dashboard';

async function fetchScopedTasks(assigneeIds?: string[]): Promise<DashboardTask[]> {
  const rows = await prisma.task.findMany({
    where: {
      deletedAt: null,
      project: { isPersonal: false },
      ...(assigneeIds ? { assignees: { some: { id: { in: assigneeIds } } } } : {}),
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      updatedAt: true,
      projectId: true,
      assignees: { select: { id: true, name: true } },
      project: { select: { name: true } },
    },
  });

  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    assigneeIds: t.assignees.map((a) => a.id),
    assigneeName: t.assignees.map((a) => a.name).join(', ') || null,
    projectId: t.projectId,
    projectName: t.project.name,
    updatedAt: t.updatedAt.toISOString(),
  }));
}

interface DashboardScopeData {
  scopeDescription: string;
  topLine: TopLineStats;
  statusBreakdown: CountBreakdown[];
  priorityBreakdown: CountBreakdown[];
  members: MemberStats[];
  projects: ProjectStats[];
  teams: TeamStats[];
  overdueTasks: TaskListEntry[];
  upcomingTasks: TaskListEntry[];
  recentlyCompleted: TaskListEntry[];
}

export type DashboardData =
  | ({ role: 'ADMIN'; hasTeams: true; adminExtras: { teamCount: number; projectCount: number; unassignedCount: number } } & DashboardScopeData)
  | ({ role: 'MANAGER'; hasTeams: true } & DashboardScopeData)
  | { role: 'MANAGER'; hasTeams: false };

export async function getDashboardData(): Promise<DashboardData> {
  const session = await requireManagerOrAdmin();
  const now = new Date();

  if (session.user.role === 'ADMIN') {
    const [users, teamsRaw, tasks, projectCount] = await Promise.all([
      prisma.user.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, role: true } }),
      prisma.team.findMany({
        orderBy: { name: 'asc' },
        include: { manager: { select: { name: true } }, members: { select: { userId: true } } },
      }),
      fetchScopedTasks(),
      prisma.project.count({ where: { isPersonal: false } }),
    ]);

    const teamGroups: TeamGroup[] = teamsRaw.map((t) => ({
      id: t.id,
      name: t.name,
      managerName: t.manager?.name ?? null,
      memberIds: t.members.map((m) => m.userId),
    }));

    return {
      role: 'ADMIN',
      hasTeams: true,
      scopeDescription: 'Organization-wide view of every task, team, and project.',
      topLine: computeTopLineStats(tasks, users.length, now),
      statusBreakdown: computeStatusBreakdown(tasks),
      priorityBreakdown: computePriorityBreakdown(tasks),
      members: computeMemberStats(tasks, users, now),
      projects: computeProjectStats(tasks, now),
      teams: computeTeamStats(tasks, teamGroups, now),
      overdueTasks: computeOverdueTasks(tasks, now),
      upcomingTasks: computeUpcomingTasks(tasks, now),
      recentlyCompleted: computeRecentlyCompleted(tasks, now),
      adminExtras: {
        teamCount: teamsRaw.length,
        projectCount,
        unassignedCount: tasks.filter((t) => t.assigneeIds.length === 0).length,
      },
    };
  }

  const myTeams = await prisma.team.findMany({
    where: { managerId: session.user.id },
    orderBy: { name: 'asc' },
    include: { members: { include: { user: { select: { id: true, name: true, role: true } } } } },
  });

  if (myTeams.length === 0) {
    return { role: 'MANAGER', hasTeams: false };
  }

  const peopleById = new Map<string, { id: string; name: string; role: string }>();
  for (const team of myTeams) {
    for (const membership of team.members) peopleById.set(membership.user.id, membership.user);
  }
  const people = [...peopleById.values()];

  const teamGroups: TeamGroup[] = myTeams.map((t) => ({
    id: t.id,
    name: t.name,
    managerName: session.user.name ?? null,
    memberIds: t.members.map((m) => m.userId),
  }));

  const tasks = await fetchScopedTasks(people.map((p) => p.id));

  const teamNames = myTeams.map((t) => t.name);
  const scopeDescription =
    teamNames.length === 1 ? `Overview of the ${teamNames[0]} team.` : `Overview of your teams: ${teamNames.join(', ')}.`;

  return {
    role: 'MANAGER',
    hasTeams: true,
    scopeDescription,
    topLine: computeTopLineStats(tasks, people.length, now),
    statusBreakdown: computeStatusBreakdown(tasks),
    priorityBreakdown: computePriorityBreakdown(tasks),
    members: computeMemberStats(tasks, people, now),
    projects: computeProjectStats(tasks, now),
    teams: computeTeamStats(tasks, teamGroups, now),
    overdueTasks: computeOverdueTasks(tasks, now),
    upcomingTasks: computeUpcomingTasks(tasks, now),
    recentlyCompleted: computeRecentlyCompleted(tasks, now),
  };
}
