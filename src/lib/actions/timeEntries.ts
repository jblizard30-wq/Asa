'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireProjectMember } from '@/lib/actions/tasks';

const logTimeSchema = z.object({
  minutes: z.coerce.number().int().min(1).max(1440),
  note: z.string().max(500).optional(),
});

export async function logTime(taskId: string, minutes: number, note?: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { success: false, error: 'Task not found' };
  const session = await requireProjectMember(task.projectId);

  const parsed = logTimeSchema.safeParse({ minutes, note });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  await prisma.timeEntry.create({
    data: { taskId, userId: session.user.id, minutes: parsed.data.minutes, note: parsed.data.note || null },
  });

  revalidatePath(`/projects/${task.projectId}`);
  return { success: true };
}

export async function listTimeEntries(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return [];
  await requireProjectMember(task.projectId);

  const entries = await prisma.timeEntry.findMany({
    where: { taskId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { loggedAt: 'desc' },
  });

  return entries.map((e) => ({
    id: e.id,
    minutes: e.minutes,
    note: e.note,
    loggedAt: e.loggedAt.toISOString(),
    userId: e.userId,
    userName: e.user.name,
  }));
}

/** Only the entry's own author or an ADMIN/MANAGER can remove a logged time entry. */
export async function deleteTimeEntry(id: string) {
  const entry = await prisma.timeEntry.findUnique({ where: { id }, include: { task: true } });
  if (!entry) return { success: false, error: 'Entry not found' };
  const session = await requireProjectMember(entry.task.projectId);

  if (entry.userId !== session.user.id && session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') {
    return { success: false, error: 'You can only delete your own time entries.' };
  }

  await prisma.timeEntry.delete({ where: { id } });
  revalidatePath(`/projects/${entry.task.projectId}`);
  return { success: true };
}
