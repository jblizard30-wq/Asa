'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export interface CalendarTask {
  id: string;
  title: string;
  dueDate: string;
  priority: string;
  status: string;
  projectId: string;
  projectName: string;
  assigneeIds: string[];
  assigneeNames: string[];
  teamIds: string[];
  tags: { id: string; name: string; color: string }[];
}

export interface CalendarTasksResult {
  tasks: CalendarTask[];
  teams: { id: string; name: string }[];
  teamIdsByUserId: Record<string, string[]>;
}

/** Tasks due within [startISO, endISO], across every project the current user can access. */
export async function getTasksInRange(startISO: string, endISO: string): Promise<CalendarTasksResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { tasks: [], teams: [], teamIdsByUserId: {} };

  const isAdmin = session.user.role === 'ADMIN';
  const accessibleProjects = await prisma.project.findMany({
    where: isAdmin
      ? { OR: [{ isPersonal: false }, { isPersonal: true, createdById: session.user.id }] }
      : { members: { some: { userId: session.user.id } } },
    select: { id: true },
  });
  const projectIds = accessibleProjects.map((p) => p.id);
  if (projectIds.length === 0) return { tasks: [], teams: [], teamIdsByUserId: {} };

  const tasks = await prisma.task.findMany({
    where: {
      projectId: { in: projectIds },
      deletedAt: null,
      dueDate: { gte: new Date(startISO), lte: new Date(endISO) },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      priority: true,
      status: true,
      projectId: true,
      project: { select: { name: true } },
      assignees: { select: { id: true, name: true } },
      tags: { select: { id: true, name: true, color: true }, orderBy: { order: 'asc' } },
    },
    orderBy: { dueDate: 'asc' },
  });

  const allAssigneeIds = [...new Set(tasks.flatMap((t) => t.assignees.map((a) => a.id)))];
  const teamMemberships = allAssigneeIds.length
    ? await prisma.teamMember.findMany({
        where: { userId: { in: allAssigneeIds } },
        select: { userId: true, team: { select: { id: true, name: true } } },
      })
    : [];
  const teamIdsByUserId = new Map<string, string[]>();
  const teamsById = new Map<string, string>();
  for (const membership of teamMemberships) {
    const list = teamIdsByUserId.get(membership.userId) ?? [];
    list.push(membership.team.id);
    teamIdsByUserId.set(membership.userId, list);
    teamsById.set(membership.team.id, membership.team.name);
  }

  const resultTasks = tasks
    .filter((t) => t.dueDate)
    .map((t) => {
      const assigneeIds = t.assignees.map((a) => a.id);
      const teamIds = [...new Set(assigneeIds.flatMap((id) => teamIdsByUserId.get(id) ?? []))];
      return {
        id: t.id,
        title: t.title,
        dueDate: t.dueDate!.toISOString(),
        priority: t.priority,
        status: t.status,
        projectId: t.projectId,
        projectName: t.project.name,
        assigneeIds,
        assigneeNames: t.assignees.map((a) => a.name),
        teamIds,
        tags: t.tags,
      };
    });

  const teams = [...teamsById.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { tasks: resultTasks, teams, teamIdsByUserId: Object.fromEntries(teamIdsByUserId) };
}

export interface CalendarMeetup {
  id: string;
  title: string;
  category: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  virtualUrl: string | null;
  isPotluck: boolean;
  isAllChurch: boolean;
  teamIds: string[];
  userIds: string[];
}

/** Finalized meetups occurring within [startISO, endISO] if the meetups module is enabled and shared with the viewer. */
export async function getMeetupsInRange(startISO: string, endISO: string): Promise<CalendarMeetup[]> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return [];

  const { isModuleEnabled } = await import('@/lib/modules');
  if (!isModuleEnabled('meetups')) return [];

  const isAdmin = session.user.role === 'ADMIN';

  const userTeams = await prisma.teamMember.findMany({
    where: { userId: session.user.id },
    select: { teamId: true },
  });
  const userTeamIds = userTeams.map((t) => t.teamId);

  const meetups = await prisma.meetup.findMany({
    where: {
      archivedAt: null,
      startsAt: { gte: new Date(startISO), lte: new Date(endISO) },
      ...(isAdmin
        ? {}
        : {
            OR: [
              { isAllChurch: true },
              { createdById: session.user.id },
              { shares: { some: { userId: session.user.id } } },
              ...(userTeamIds.length > 0
                ? [{ shares: { some: { teamId: { in: userTeamIds } } } }]
                : []),
            ],
          }),
    },
    include: {
      shares: true,
    },
    orderBy: { startsAt: 'asc' },
  });

  return meetups.map((m) => ({
    id: m.id,
    title: m.title,
    category: m.category,
    startsAt: m.startsAt!.toISOString(),
    endsAt: m.endsAt ? m.endsAt.toISOString() : null,
    location: m.location,
    virtualUrl: m.virtualUrl,
    isPotluck: m.isPotluck,
    isAllChurch: m.isAllChurch,
    teamIds: m.shares.filter((s) => s.teamId).map((s) => s.teamId!),
    userIds: m.shares.filter((s) => s.userId).map((s) => s.userId!),
  }));
}
