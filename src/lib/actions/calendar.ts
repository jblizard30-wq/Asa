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
  assigneeName: string | null;
}

/** Tasks due within [startISO, endISO], across every project the current user can access. */
export async function getTasksInRange(startISO: string, endISO: string): Promise<CalendarTask[]> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return [];

  const isAdmin = session.user.role === 'ADMIN';
  const accessibleProjects = await prisma.project.findMany({
    where: isAdmin ? {} : { members: { some: { userId: session.user.id } } },
    select: { id: true },
  });
  const projectIds = accessibleProjects.map((p) => p.id);
  if (projectIds.length === 0) return [];

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
      assignee: { select: { name: true } },
    },
    orderBy: { dueDate: 'asc' },
  });

  return tasks
    .filter((t) => t.dueDate)
    .map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate!.toISOString(),
      priority: t.priority,
      status: t.status,
      projectId: t.projectId,
      projectName: t.project.name,
      assigneeName: t.assignee?.name ?? null,
    }));
}
