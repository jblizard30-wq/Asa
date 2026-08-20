'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSession, requireAdmin } from '@/lib/permissions';
import { TRASH_RETENTION_DAYS } from '@/lib/trash';

const trashListInclude = {
  project: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
  deletedBy: { select: { id: true, name: true } },
  parentTask: { select: { id: true, title: true } },
} as const;

function toTrashEntry(task: {
  id: string;
  title: string;
  deletedAt: Date | null;
  project: { id: string; name: string };
  section: { id: string; name: string };
  deletedBy: { id: string; name: string } | null;
  parentTask: { id: string; title: string } | null;
}) {
  const deletedAt = task.deletedAt as Date;
  const purgesAt = new Date(deletedAt.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  return {
    id: task.id,
    title: task.title,
    projectId: task.project.id,
    projectName: task.project.name,
    sectionName: task.section.name,
    deletedById: task.deletedBy?.id ?? null,
    deletedByName: task.deletedBy?.name ?? 'Unknown',
    deletedAt: deletedAt.toISOString(),
    purgesAt: purgesAt.toISOString(),
    parentTaskTitle: task.parentTask?.title ?? null,
  };
}

/** The signed-in user's own trash — only tasks they personally deleted. */
export async function getMyTrash() {
  const session = await requireSession();

  const tasks = await prisma.task.findMany({
    where: { deletedById: session.user.id, deletedAt: { not: null } },
    include: trashListInclude,
    orderBy: { deletedAt: 'desc' },
  });

  return tasks.map(toTrashEntry);
}

/** Every deleted task across all users — admin only. */
export async function getAllTrash() {
  await requireAdmin();

  const tasks = await prisma.task.findMany({
    where: { deletedAt: { not: null } },
    include: trashListInclude,
    orderBy: { deletedAt: 'desc' },
  });

  return tasks.map(toTrashEntry);
}

async function assertCanManageTrashedTask(taskId: string) {
  const session = await requireSession();
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || !task.deletedAt) return { session, task: null as null };

  const isOwnDeletion = task.deletedById === session.user.id;
  const isAdmin = session.user.role === 'ADMIN';
  if (!isOwnDeletion && !isAdmin) throw new Error('You can only manage tasks in your own trash');

  return { session, task };
}

/** Restores a trashed task back to its original project/section. Direct subtasks are left as-is in trash. */
export async function restoreTask(taskId: string) {
  const { task } = await assertCanManageTrashedTask(taskId);
  if (!task) return { success: false, error: 'Task not found in trash' };

  await prisma.task.update({
    where: { id: taskId },
    data: { deletedAt: null, deletedById: null },
  });

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath('/my-tasks');
  revalidatePath('/trash');
  revalidatePath('/admin/trash');
  return { success: true };
}

/** Hard-deletes a trashed task for good (cascades to its comments, subtasks, field values, reminders). */
export async function permanentlyDeleteTask(taskId: string) {
  const { task } = await assertCanManageTrashedTask(taskId);
  if (!task) return { success: false, error: 'Task not found in trash' };

  await prisma.task.delete({ where: { id: taskId } });

  revalidatePath('/trash');
  revalidatePath('/admin/trash');
  return { success: true };
}

/** Restores many trashed tasks at once in a single query — the trash list's bulk-select action. */
export async function restoreTasks(taskIds: string[]) {
  if (taskIds.length === 0) return { success: true, restoredCount: 0 };

  const session = await requireSession();
  const isAdmin = session.user.role === 'ADMIN';

  const tasks = await prisma.task.findMany({ where: { id: { in: taskIds } } });
  const found = new Map(tasks.map((t) => [t.id, t]));

  const projectIds = new Set<string>();
  for (const id of taskIds) {
    const task = found.get(id);
    if (!task || !task.deletedAt) return { success: false, error: 'One or more tasks are no longer in the trash.' };
    if (!isAdmin && task.deletedById !== session.user.id) {
      return { success: false, error: 'You can only manage tasks in your own trash' };
    }
    projectIds.add(task.projectId);
  }

  const result = await prisma.task.updateMany({
    where: { id: { in: taskIds } },
    data: { deletedAt: null, deletedById: null },
  });

  for (const projectId of projectIds) revalidatePath(`/projects/${projectId}`);
  revalidatePath('/my-tasks');
  revalidatePath('/trash');
  revalidatePath('/admin/trash');
  return { success: true, restoredCount: result.count };
}

/** Hard-deletes many trashed tasks at once in a single query — the trash list's bulk-select action. */
export async function permanentlyDeleteTasks(taskIds: string[]) {
  if (taskIds.length === 0) return { success: true, deletedCount: 0 };

  const session = await requireSession();
  const isAdmin = session.user.role === 'ADMIN';

  const tasks = await prisma.task.findMany({ where: { id: { in: taskIds } } });
  const found = new Map(tasks.map((t) => [t.id, t]));

  for (const id of taskIds) {
    const task = found.get(id);
    if (!task || !task.deletedAt) return { success: false, error: 'One or more tasks are no longer in the trash.' };
    if (!isAdmin && task.deletedById !== session.user.id) {
      return { success: false, error: 'You can only manage tasks in your own trash' };
    }
  }

  const result = await prisma.task.deleteMany({ where: { id: { in: taskIds } } });

  revalidatePath('/trash');
  revalidatePath('/admin/trash');
  return { success: true, deletedCount: result.count };
}

/** Hard-deletes every task whose trash retention window has expired. Intended to be called by a scheduled job. */
export async function purgeExpiredTrash() {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await prisma.task.deleteMany({
    where: { deletedAt: { not: null, lte: cutoff } },
  });
  return { purgedCount: result.count };
}
