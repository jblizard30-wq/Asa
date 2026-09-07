// src/lib/actions/search.ts
'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getVisibleNavDefs, SETTINGS_NAV_ITEM } from '@/lib/navItems';
import { isModuleEnabled } from '@/lib/modules';
import { listToolDefinitions } from '@/lib/tools/registry';

export interface SearchResults {
  tasks: { id: string; title: string; status: string; projectId: string; projectName: string }[];
  projects: { id: string; name: string }[];
  meetups: { id: string; title: string; category: string; startsAt: string | null; location: string | null }[];
  inventory: { id: string; name: string; onHandQty: number; unit: string; locationName: string }[];
  raci: { id: string; processName: string; ministryArea: string | null; owner: string }[];
  tools: { id: string; name: string; blurb: string; primitive: string }[];
  people: { id: string; name: string | null; email: string; role: string }[];
  teams: { id: string; name: string }[];
  comments: {
    id: string;
    taskId: string;
    taskTitle: string;
    projectId: string;
    projectName: string;
    body: string;
    userName: string;
  }[];
  pages: { key: string; label: string; href: string }[];
}

const EMPTY: SearchResults = {
  tasks: [],
  projects: [],
  meetups: [],
  inventory: [],
  raci: [],
  tools: [],
  people: [],
  teams: [],
  comments: [],
  pages: [],
};

/** Searches tasks, projects, meetups, inventory, RACI, tools, users, teams, comments, and pages. */
export async function searchAll(query: string): Promise<SearchResults> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return EMPTY;

  const term = query.trim();
  if (term.length < 2) return EMPTY;

  const isAdmin = session.user.role === 'ADMIN';
  const canManageTeams = isAdmin || session.user.role === 'MANAGER';
  const lowerTerm = term.toLowerCase();

  const pages = [...getVisibleNavDefs({ isAdmin, canManageTeams }), SETTINGS_NAV_ITEM]
    .filter(
      (def) =>
        def.label.toLowerCase().includes(lowerTerm) || def.keywords?.some((keyword) => keyword.includes(lowerTerm))
    )
    .map((def) => ({ key: def.key, label: def.label, href: def.href }));

  // Filter accessible projects
  const accessibleProjects = await prisma.project.findMany({
    where: isAdmin
      ? { OR: [{ isPersonal: false }, { isPersonal: true, createdById: session.user.id }] }
      : { members: { some: { userId: session.user.id } } },
    select: { id: true },
  });
  const projectIds = accessibleProjects.map((p) => p.id);

  // User teams for permission filtering
  const userTeams = await prisma.teamMember.findMany({
    where: { userId: session.user.id },
    select: { teamId: true },
  });
  const userTeamIds = userTeams.map((t) => t.teamId);

  // Run all module queries concurrently
  const [
    tasks,
    projects,
    comments,
    meetups,
    inventory,
    raciCharts,
    people,
    teams,
  ] = await Promise.all([
    // Tasks
    projectIds.length > 0
      ? prisma.task.findMany({
          where: {
            projectId: { in: projectIds },
            deletedAt: null,
            OR: [
              { title: { contains: term, mode: 'insensitive' } },
              { description: { contains: term, mode: 'insensitive' } },
            ],
          },
          select: { id: true, title: true, status: true, projectId: true, project: { select: { name: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 6,
        })
      : [],

    // Projects
    projectIds.length > 0
      ? prisma.project.findMany({
          where: { id: { in: projectIds }, isPersonal: false, name: { contains: term, mode: 'insensitive' } },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
          take: 4,
        })
      : [],

    // Comments
    projectIds.length > 0
      ? prisma.comment.findMany({
          where: {
            body: { contains: term, mode: 'insensitive' },
            task: { projectId: { in: projectIds }, deletedAt: null },
          },
          select: {
            id: true,
            body: true,
            user: { select: { name: true } },
            task: { select: { id: true, title: true, projectId: true, project: { select: { name: true } } } },
          },
          orderBy: { createdAt: 'desc' },
          take: 4,
        })
      : [],

    // Meetups (if enabled)
    isModuleEnabled('meetups')
      ? prisma.meetup.findMany({
          where: {
            archivedAt: null,
            OR: [
              { title: { contains: term, mode: 'insensitive' } },
              { description: { contains: term, mode: 'insensitive' } },
              { location: { contains: term, mode: 'insensitive' } },
            ],
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
          select: {
            id: true,
            title: true,
            category: true,
            startsAt: true,
            location: true,
          },
          orderBy: { startsAt: 'desc' },
          take: 5,
        })
      : [],

    // Inventory (if enabled)
    isModuleEnabled('inventory')
      ? prisma.inventoryItem.findMany({
          where: {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { notes: { contains: term, mode: 'insensitive' } },
              { shelfLocation: { contains: term, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            name: true,
            onHandQty: true,
            unit: true,
            room: {
              select: {
                name: true,
                building: { select: { name: true } },
              },
            },
          },
          orderBy: { name: 'asc' },
          take: 5,
        })
      : [],

    // RACI Charts (if enabled)
    isModuleEnabled('raci')
      ? prisma.raciChart.findMany({
          where: {
            archivedAt: null,
            OR: [
              { processName: { contains: term, mode: 'insensitive' } },
              { ministryArea: { contains: term, mode: 'insensitive' } },
              { tags: { has: term.replace(/^#+/, '') } },
            ],
            ...(isAdmin
              ? {}
              : {
                  OR: [
                    { isPublic: true },
                    { createdById: session.user.id },
                    { shares: { some: { userId: session.user.id } } },
                    ...(userTeamIds.length > 0
                      ? [{ shares: { some: { teamId: { in: userTeamIds } } } }]
                      : []),
                  ],
                }),
          },
          select: {
            id: true,
            processName: true,
            ministryArea: true,
            owner: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 4,
        })
      : [],

    // Church Users
    prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: 'asc' },
      take: 4,
    }),

    // Teams
    prisma.team.findMany({
      where: {
        name: { contains: term, mode: 'insensitive' },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
      take: 4,
    }),
  ]);

  // Strategic XP Discernment Tools (in-memory lookup)
  const matchedTools = isModuleEnabled('xp')
    ? listToolDefinitions()
        .filter(
          (tool) =>
            tool.name.toLowerCase().includes(lowerTerm) ||
            tool.blurb.toLowerCase().includes(lowerTerm) ||
            tool.primitive.toLowerCase().includes(lowerTerm)
        )
        .slice(0, 4)
        .map((t) => ({
          id: t.id,
          name: t.name,
          blurb: t.blurb,
          primitive: t.primitive,
        }))
    : [];

  return {
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      projectId: t.projectId,
      projectName: t.project.name,
    })),
    projects,
    meetups: meetups.map((m) => ({
      id: m.id,
      title: m.title,
      category: m.category,
      startsAt: m.startsAt ? m.startsAt.toISOString() : null,
      location: m.location,
    })),
    inventory: inventory.map((i) => ({
      id: i.id,
      name: i.name,
      onHandQty: i.onHandQty,
      unit: i.unit,
      locationName: `${i.room.building.name} — ${i.room.name}`,
    })),
    raci: raciCharts,
    tools: matchedTools,
    people,
    teams,
    comments: comments.map((c) => ({
      id: c.id,
      taskId: c.task.id,
      taskTitle: c.task.title,
      projectId: c.task.projectId,
      projectName: c.task.project.name,
      body: c.body,
      userName: c.user.name || 'User',
    })),
    pages,
  };
}
