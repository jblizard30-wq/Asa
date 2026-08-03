'use server';

import { z } from 'zod';
import { addDays, addMonths, addWeeks, addYears } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { runTaskAutomations } from '@/lib/automations';

const RECURRENCE_VALUES = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;

function nextOccurrence(from: Date, frequency: (typeof RECURRENCE_VALUES)[number], interval: number): Date {
  switch (frequency) {
    case 'DAILY':
      return addDays(from, interval);
    case 'WEEKLY':
      return addWeeks(from, interval);
    case 'MONTHLY':
      return addMonths(from, interval);
    case 'YEARLY':
      return addYears(from, interval);
    default:
      return from;
  }
}

export async function requireProjectMember(projectId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Not authenticated');

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: session.user.id } },
  });
  if (!membership && session.user.role !== 'ADMIN') {
    throw new Error('You are not a member of this project');
  }
  return session;
}

const urlSchema = z
  .string()
  .max(2000)
  .refine((val) => val === '' || /^https?:\/\//i.test(val), 'URL must start with http:// or https://');

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(4000).optional(),
  url: urlSchema.optional(),
  sectionId: z.string().min(1),
  parentTaskId: z.string().optional(),
  predecessorId: z.string().optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

export async function createTask(projectId: string, formData: FormData) {
  const session = await requireProjectMember(projectId);

  const parsed = createTaskSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    url: formData.get('url') || undefined,
    sectionId: formData.get('sectionId'),
    parentTaskId: formData.get('parentTaskId') || undefined,
    predecessorId: formData.get('predecessorId') || undefined,
    assigneeId: formData.get('assigneeId') || undefined,
    dueDate: formData.get('dueDate') || undefined,
    priority: formData.get('priority') || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  if (parsed.data.predecessorId) {
    const predecessor = await prisma.task.findUnique({ where: { id: parsed.data.predecessorId } });
    if (!predecessor || predecessor.projectId !== projectId) {
      return { success: false, error: 'That predecessor task is not in this project.' };
    }
  }

  const lastTask = await prisma.task.findFirst({
    where: parsed.data.parentTaskId
      ? { parentTaskId: parsed.data.parentTaskId, deletedAt: null }
      : { sectionId: parsed.data.sectionId, parentTaskId: null, deletedAt: null },
    orderBy: { order: 'desc' },
  });

  const task = await prisma.task.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      url: parsed.data.url || null,
      projectId,
      sectionId: parsed.data.sectionId,
      parentTaskId: parsed.data.parentTaskId || null,
      predecessorId: parsed.data.predecessorId || null,
      assigneeId: parsed.data.assigneeId || null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      priority: parsed.data.priority ?? 'MEDIUM',
      order: (lastTask?.order ?? -1) + 1,
    },
  });

  if (task.assigneeId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    await createNotification({
      type: 'TASK_ASSIGNED',
      recipientId: task.assigneeId,
      actorId: session.user.id,
      message: `${session.user.name} assigned you to "${task.title}" in ${project?.name}`,
      link: `/projects/${projectId}?task=${task.id}`,
      emailSubject: `New task assigned: ${task.title}`,
    });
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/my-tasks');
  return { success: true, taskId: task.id };
}

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).optional().nullable(),
  url: z.union([urlSchema, z.null()]).optional(),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  recurrence: z.enum(RECURRENCE_VALUES).optional(),
  recurrenceInterval: z.coerce.number().int().min(1).max(365).optional(),
  recurrenceEndDate: z.string().optional().nullable(),
  predecessorId: z.string().optional().nullable(),
});

type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/** Walks the predecessor chain to make sure `candidateId` never leads back to `taskId` (would form a cycle). */
async function wouldCreateSequenceCycle(taskId: string, candidateId: string): Promise<boolean> {
  let cursor: string | null = candidateId;
  for (let i = 0; i < 200 && cursor; i++) {
    if (cursor === taskId) return true;
    const t: { predecessorId: string | null } | null = await prisma.task.findUnique({
      where: { id: cursor },
      select: { predecessorId: true },
    });
    cursor = t?.predecessorId ?? null;
  }
  return false;
}

export async function updateTask(taskId: string, input: UpdateTaskInput) {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) return { success: false, error: 'Task not found' };
  if (existing.deletedAt) return { success: false, error: 'This task is in the trash. Restore it first.' };

  const session = await requireProjectMember(existing.projectId);

  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  if ('predecessorId' in parsed.data && parsed.data.predecessorId) {
    if (parsed.data.predecessorId === taskId) {
      return { success: false, error: 'A task cannot follow itself.' };
    }
    const predecessor = await prisma.task.findUnique({ where: { id: parsed.data.predecessorId } });
    if (!predecessor || predecessor.projectId !== existing.projectId) {
      return { success: false, error: 'That predecessor task is not in this project.' };
    }
    if (await wouldCreateSequenceCycle(taskId, parsed.data.predecessorId)) {
      return { success: false, error: 'That would create a circular sequence.' };
    }
  }

  const movingToActive =
    'status' in parsed.data && parsed.data.status && parsed.data.status !== 'TODO' && existing.status === 'TODO';
  if (movingToActive && existing.predecessorId) {
    const predecessor = await prisma.task.findUnique({ where: { id: existing.predecessorId } });
    if (predecessor && predecessor.status !== 'DONE') {
      return {
        success: false,
        error: `This task is locked until "${predecessor.title}" is marked done.`,
      };
    }
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if ('url' in parsed.data) {
    data.url = parsed.data.url || null;
  }
  if ('dueDate' in parsed.data) {
    data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  }
  if ('recurrenceEndDate' in parsed.data) {
    data.recurrenceEndDate = parsed.data.recurrenceEndDate ? new Date(parsed.data.recurrenceEndDate) : null;
  }
  if ('predecessorId' in parsed.data) {
    data.predecessorId = parsed.data.predecessorId || null;
  }

  const assigneeChanged =
    'assigneeId' in parsed.data && parsed.data.assigneeId !== existing.assigneeId && parsed.data.assigneeId;

  // A repeating task that's just been marked DONE reschedules itself to the next
  // occurrence instead of staying completed, so the series keeps going.
  const recurrence = parsed.data.recurrence ?? existing.recurrence;
  const turningDone = parsed.data.status === 'DONE' && existing.status !== 'DONE';
  if (turningDone && recurrence !== 'NONE') {
    const interval = parsed.data.recurrenceInterval ?? existing.recurrenceInterval;
    const endDate =
      'recurrenceEndDate' in parsed.data
        ? (data.recurrenceEndDate as Date | null)
        : existing.recurrenceEndDate;
    const baseDate = existing.dueDate ?? new Date();
    const next = nextOccurrence(baseDate, recurrence, interval);

    if (!endDate || next <= endDate) {
      data.status = existing.status;
      data.dueDate = next;
    }
  }

  const task = await prisma.task.update({ where: { id: taskId }, data });

  if (assigneeChanged && task.assigneeId) {
    const project = await prisma.project.findUnique({ where: { id: task.projectId } });
    await createNotification({
      type: 'TASK_ASSIGNED',
      recipientId: task.assigneeId,
      actorId: session.user.id,
      message: `${session.user.name} assigned you to "${task.title}" in ${project?.name}`,
      link: `/projects/${task.projectId}?task=${task.id}`,
      emailSubject: `New task assigned: ${task.title}`,
    });
  }

  // Fire on the requested status, not the final persisted one, so automations still run when the
  // recurrence logic above reschedules a "done" task instead of leaving it done.
  if (parsed.data.status && parsed.data.status !== existing.status) {
    await runTaskAutomations(taskId, { type: 'STATUS_CHANGED', status: parsed.data.status });
  }
  if ('assigneeId' in parsed.data && parsed.data.assigneeId !== existing.assigneeId) {
    await runTaskAutomations(taskId, { type: 'ASSIGNEE_CHANGED' });
  }

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath('/my-tasks');
  return { success: true };
}

/** Called by the Kanban board on drag-and-drop to persist the new section + position. */
export async function moveTask(taskId: string, destinationSectionId: string, destinationOrder: number) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { success: false, error: 'Task not found' };
  await requireProjectMember(task.projectId);

  const destinationSection = await prisma.section.findUnique({ where: { id: destinationSectionId } });
  if (!destinationSection) return { success: false, error: 'Section not found' };

  const statusForSection = (name: string) => {
    const normalized = name.trim().toLowerCase();
    if (normalized === 'done') return 'DONE' as const;
    if (normalized === 'in progress') return 'IN_PROGRESS' as const;
    return task.status;
  };

  const destinationStatus = statusForSection(destinationSection.name);
  if (destinationStatus !== 'TODO' && task.status === 'TODO' && task.predecessorId) {
    const predecessor = await prisma.task.findUnique({ where: { id: task.predecessorId } });
    if (predecessor && predecessor.status !== 'DONE') {
      return {
        success: false,
        error: `This task is locked until "${predecessor.title}" is marked done.`,
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    const siblings = await tx.task.findMany({
      where: { sectionId: destinationSectionId, parentTaskId: null, deletedAt: null, id: { not: taskId } },
      orderBy: { order: 'asc' },
    });
    siblings.splice(destinationOrder, 0, task);

    await Promise.all(
      siblings.map((t, index) =>
        tx.task.update({
          where: { id: t.id },
          data: {
            order: index,
            sectionId: destinationSectionId,
            status: t.id === taskId ? statusForSection(destinationSection.name) : t.status,
          },
        }),
      ),
    );
  });

  if (destinationStatus !== task.status) {
    await runTaskAutomations(taskId, { type: 'STATUS_CHANGED', status: destinationStatus });
  }

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath('/my-tasks');
  return { success: true };
}

export async function getTaskDetail(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignee: true,
      comments: { include: { user: true }, orderBy: { createdAt: 'asc' } },
      project: { include: { members: { include: { user: true } } } },
      subtasks: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
      fieldValues: { include: { option: true } },
      parentTask: { select: { id: true, title: true } },
      predecessor: { select: { id: true, title: true, status: true } },
      successors: { select: { id: true, title: true, status: true }, orderBy: { createdAt: 'asc' } },
      attachments: { include: { uploadedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
      tags: { orderBy: { order: 'asc' } },
    },
  });
  if (!task) return null;

  const session = await requireProjectMember(task.projectId);

  const customFields = await prisma.customField.findMany({
    where: { projectId: task.projectId },
    orderBy: { order: 'asc' },
    include: { options: { orderBy: { order: 'asc' } } },
  });

  const allTags = await prisma.tag.findMany({
    where: { projectId: task.projectId },
    orderBy: { order: 'asc' },
  });

  const projectTasks = await prisma.task.findMany({
    where: { projectId: task.projectId, id: { not: task.id }, deletedAt: null },
    select: { id: true, title: true },
    orderBy: { title: 'asc' },
  });

  const locked = Boolean(task.predecessor && task.predecessor.status !== 'DONE');

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    url: task.url,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    assigneeId: task.assigneeId,
    recurrence: task.recurrence,
    recurrenceInterval: task.recurrenceInterval,
    recurrenceEndDate: task.recurrenceEndDate ? task.recurrenceEndDate.toISOString() : null,
    projectId: task.projectId,
    projectName: task.project.name,
    sectionId: task.sectionId,
    parentTask: task.parentTask,
    predecessor: task.predecessor,
    successors: task.successors,
    locked,
    projectTasks: projectTasks.map((t) => ({ id: t.id, title: t.title })),
    viewerRole: session.user.role,
    viewerId: session.user.id,
    members: task.project.members.map((m) => ({ id: m.user.id, name: m.user.name })),
    comments: task.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      userName: c.user.name,
      userId: c.userId,
    })),
    subtasks: task.subtasks.map((s) => ({ id: s.id, title: s.title, status: s.status })),
    attachments: task.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileUrl: a.fileUrl,
      fileSize: a.fileSize,
      mimeType: a.mimeType,
      createdAt: a.createdAt.toISOString(),
      uploadedById: a.uploadedBy.id,
      uploadedByName: a.uploadedBy.name,
    })),
    customFields: customFields.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      options: f.options.map((o) => ({ id: o.id, label: o.label })),
    })),
    fieldValues: task.fieldValues.map((v) => ({
      customFieldId: v.customFieldId,
      textValue: v.textValue,
      numberValue: v.numberValue,
      dateValue: v.dateValue ? v.dateValue.toISOString() : null,
      boolValue: v.boolValue,
      optionId: v.optionId,
    })),
    tags: task.tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    allTags: allTags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
  };
}

/**
 * Soft-deletes a task (and its direct subtasks) into the trash rather than removing it —
 * see src/lib/actions/trash.ts for restore/permanent-delete/purge.
 */
export async function deleteTask(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { success: false, error: 'Task not found' };
  const session = await requireProjectMember(task.projectId);
  if (task.deletedAt) return { success: true };

  await prisma.task.updateMany({
    where: { OR: [{ id: taskId }, { parentTaskId: taskId }], deletedAt: null },
    data: { deletedAt: new Date(), deletedById: session.user.id },
  });

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath('/my-tasks');
  revalidatePath('/trash');
  return { success: true };
}

const bulkUpdateSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assigneeId: z.string().nullable().optional(),
  sectionId: z.string().optional(),
});

type BulkUpdateInput = z.infer<typeof bulkUpdateSchema>;

/** Applies the same field changes to every task in `taskIds`, used by the List view's multi-select toolbar. */
export async function bulkUpdateTasks(taskIds: string[], input: BulkUpdateInput) {
  if (taskIds.length === 0) return { success: true };
  const tasks = await prisma.task.findMany({ where: { id: { in: taskIds } } });
  if (tasks.length === 0) return { success: false, error: 'Tasks not found' };

  const projectIds = new Set(tasks.map((t) => t.projectId));
  for (const projectId of projectIds) {
    await requireProjectMember(projectId);
  }

  const parsed = bulkUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  await prisma.task.updateMany({
    where: { id: { in: taskIds }, deletedAt: null },
    data: parsed.data,
  });

  for (const projectId of projectIds) {
    revalidatePath(`/projects/${projectId}`);
  }
  revalidatePath('/my-tasks');
  return { success: true };
}

/** Soft-deletes each task (and its direct subtasks) into the trash rather than removing it. */
export async function bulkDeleteTasks(taskIds: string[]) {
  if (taskIds.length === 0) return { success: true };
  const tasks = await prisma.task.findMany({ where: { id: { in: taskIds } } });
  if (tasks.length === 0) return { success: false, error: 'Tasks not found' };

  const projectIds = [...new Set(tasks.map((t) => t.projectId))];
  let session = await requireProjectMember(projectIds[0]);
  for (const projectId of projectIds.slice(1)) {
    session = await requireProjectMember(projectId);
  }

  const ids = tasks.map((t) => t.id);
  await prisma.task.updateMany({
    where: { OR: [{ id: { in: ids } }, { parentTaskId: { in: ids } }], deletedAt: null },
    data: { deletedAt: new Date(), deletedById: session.user.id },
  });

  for (const projectId of projectIds) {
    revalidatePath(`/projects/${projectId}`);
  }
  revalidatePath('/my-tasks');
  revalidatePath('/trash');
  return { success: true };
}
