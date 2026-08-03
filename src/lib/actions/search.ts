'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export interface SearchResults {
  tasks: { id: string; title: string; status: string; projectId: string; projectName: string }[];
  projects: { id: string; name: string }[];
  comments: {
    id: string;
    taskId: string;
    taskTitle: string;
    projectId: string;
    projectName: string;
    body: string;
    userName: string;
  }[];
}

const EMPTY: SearchResults = { tasks: [], projects: [], comments: [] };

/** Searches tasks, projects, and comments across every project the current user can access. */
export async function searchAll(query: string): Promise<SearchResults> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return EMPTY;

  const term = query.trim();
  if (term.length < 2) return EMPTY;

  const isAdmin = session.user.role === 'ADMIN';
  const accessibleProjects = await prisma.project.findMany({
    where: isAdmin ? {} : { members: { some: { userId: session.user.id } } },
    select: { id: true },
  });
  const projectIds = accessibleProjects.map((p) => p.id);
  if (projectIds.length === 0) return EMPTY;

  const [tasks, projects, comments] = await Promise.all([
    prisma.task.findMany({
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
      take: 8,
    }),
    prisma.project.findMany({
      where: { id: { in: projectIds }, isPersonal: false, name: { contains: term, mode: 'insensitive' } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 5,
    }),
    prisma.comment.findMany({
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
      take: 6,
    }),
  ]);

  return {
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      projectId: t.projectId,
      projectName: t.project.name,
    })),
    projects,
    comments: comments.map((c) => ({
      id: c.id,
      taskId: c.task.id,
      taskTitle: c.task.title,
      projectId: c.task.projectId,
      projectName: c.task.project.name,
      body: c.body,
      userName: c.user.name,
    })),
  };
}
