// src/lib/actions/dashboard.ts
'use server';

import { addDays } from 'date-fns';
import { requireManagerOrAdmin } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/modules';
import { allRatios } from '@/lib/xpRatios';
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

export interface DashboardModuleTelemetry {
  upcomingMeetups: Array<{
    id: string;
    title: string;
    category: string;
    startsAt: string | null;
    location: string | null;
    unfilledSlotCount: number;
  }>;
  criticalInventoryItems: Array<{
    id: string;
    name: string;
    onHandQty: number;
    idealQty: number;
    reorderThreshold: number;
    unit: string;
    roomName: string;
  }>;
  openVolunteerSlots: Array<{
    id: string;
    meetupId: string;
    meetupTitle: string;
    slotTitle: string;
    category: string;
    neededCount: number;
  }>;
  financialRatios?: Array<{
    label: string;
    display: string;
    status: 'healthy' | 'watch' | 'concern';
    hint: string;
  }>;
}

async function fetchModuleTelemetry(now: Date): Promise<DashboardModuleTelemetry> {
  const nextWeek = addDays(now, 7);

  const [meetupsRaw, lowStockRaw, latestSnapshot] = await Promise.all([
    isModuleEnabled('meetups')
      ? prisma.meetup.findMany({
          where: {
            archivedAt: null,
            startsAt: { gte: now, lte: nextWeek },
          },
          include: {
            signupSlots: {
              include: { claims: true },
            },
          },
          orderBy: { startsAt: 'asc' },
          take: 6,
        })
      : [],

    isModuleEnabled('inventory')
      ? prisma.inventoryItem.findMany({
          where: {
            reorderThreshold: { gt: 0 },
          },
          include: { room: true },
          take: 50,
        })
      : [],

    isModuleEnabled('xp')
      ? prisma.financialSnapshot.findFirst({
          orderBy: { periodDate: 'desc' },
        })
      : null,
  ]);

  // Filter inventory items truly below reorder threshold
  const criticalInventoryItems = lowStockRaw
    .filter((item) => item.onHandQty <= item.reorderThreshold)
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      name: item.name,
      onHandQty: item.onHandQty,
      idealQty: item.idealQty,
      reorderThreshold: item.reorderThreshold,
      unit: item.unit,
      roomName: item.room.name,
    }));

  // Process meetups and volunteer openings
  const upcomingMeetups: DashboardModuleTelemetry['upcomingMeetups'] = [];
  const openVolunteerSlots: DashboardModuleTelemetry['openVolunteerSlots'] = [];

  for (const m of meetupsRaw) {
    let unfilledInMeetup = 0;
    for (const slot of m.signupSlots) {
      const openSpots = Math.max(0, slot.capacity - slot.claims.length);
      if (openSpots > 0) {
        unfilledInMeetup += openSpots;
        openVolunteerSlots.push({
          id: slot.id,
          meetupId: m.id,
          meetupTitle: m.title,
          slotTitle: slot.title,
          category: slot.category,
          neededCount: openSpots,
        });
      }
    }

    upcomingMeetups.push({
      id: m.id,
      title: m.title,
      category: m.category,
      startsAt: m.startsAt ? m.startsAt.toISOString() : null,
      location: m.location,
      unfilledSlotCount: unfilledInMeetup,
    });
  }

  // Financial ratios from latest XP snapshot
  let financialRatios: DashboardModuleTelemetry['financialRatios'] = undefined;
  if (latestSnapshot) {
    financialRatios = allRatios({
      unrestrictedCash: Number(latestSnapshot.unrestrictedCash),
      annualRevenue: Number(latestSnapshot.annualRevenue),
      annualExpense: Number(latestSnapshot.annualExpense),
      programExpense: Number(latestSnapshot.programExpense),
      personnelCost: Number(latestSnapshot.personnelCost),
    });
  }

  return {
    upcomingMeetups,
    criticalInventoryItems,
    openVolunteerSlots: openVolunteerSlots.slice(0, 5),
    financialRatios,
  };
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
  telemetry: DashboardModuleTelemetry;
}

export type DashboardData =
  | ({ role: 'ADMIN'; hasTeams: true; adminExtras: { teamCount: number; projectCount: number; unassignedCount: number } } & DashboardScopeData)
  | ({ role: 'MANAGER'; hasTeams: true } & DashboardScopeData)
  | { role: 'MANAGER'; hasTeams: false };

export async function getDashboardData(): Promise<DashboardData> {
  const session = await requireManagerOrAdmin();
  const now = new Date();

  if (session.user.role === 'ADMIN') {
    const [users, teamsRaw, tasks, projectCount, telemetry] = await Promise.all([
      prisma.user.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, role: true } }),
      prisma.team.findMany({
        orderBy: { name: 'asc' },
        include: { manager: { select: { name: true } }, members: { select: { userId: true } } },
      }),
      fetchScopedTasks(),
      prisma.project.count({ where: { isPersonal: false } }),
      fetchModuleTelemetry(now),
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
      scopeDescription: 'Organization-wide operations cockpit: Church rhythms, rosters, tasks, and supplies.',
      topLine: computeTopLineStats(tasks, users.length, now),
      statusBreakdown: computeStatusBreakdown(tasks),
      priorityBreakdown: computePriorityBreakdown(tasks),
      members: computeMemberStats(tasks, users, now),
      projects: computeProjectStats(tasks, now),
      teams: computeTeamStats(tasks, teamGroups, now),
      overdueTasks: computeOverdueTasks(tasks, now),
      upcomingTasks: computeUpcomingTasks(tasks, now),
      recentlyCompleted: computeRecentlyCompleted(tasks, now),
      telemetry,
      adminExtras: {
        teamCount: teamsRaw.length,
        projectCount,
        unassignedCount: tasks.filter((t) => t.assigneeIds.length === 0).length,
      },
    };
  }

  const [myTeams, telemetry] = await Promise.all([
    prisma.team.findMany({
      where: { managerId: session.user.id },
      orderBy: { name: 'asc' },
      include: { members: { include: { user: { select: { id: true, name: true, role: true } } } } },
    }),
    fetchModuleTelemetry(now),
  ]);

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
    telemetry,
  };
}
