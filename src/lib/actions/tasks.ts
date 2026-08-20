'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import type { ActivityAction, Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { runTaskAutomations } from '@/lib/automations';
import { materializeAfterCompletion } from '@/lib/materializeRecurrence';
import { toTaskRecurrenceInfo } from '@/lib/recurrence';
import { PRIORITY_LABELS, STATUS_LABELS } from '@/lib/format';
import { dispatchWebhooks } from '@/lib/webhooks/dispatch';

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

async function logActivity(taskId: string, actorId: string | null, action: ActivityAction, detail: string) {
  await prisma.taskActivity.create({ data: { taskId, actorId, action, detail } });
}

function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

type TaskStatusValue = 'TODO' | 'IN_PROGRESS' | 'DONE';

// The board column a task's status corresponds to, and vice versa. Every project's sections
// start as exactly these three (see DEFAULT_SECTIONS in actions/projects.ts) and there's no
// UI to rename or add sections yet, so matching on name is reliable — not a placeholder for a
// more elaborate scheme. Keeping status and column in sync (both ways) is the point: without
// it, a status edit made outside the board (grid dropdown, task detail, subtask checkbox)
// leaves the task's card sitting in a column that no longer matches its status.
const STATUS_SECTION_NAMES: Record<TaskStatusValue, string> = {
  TODO: 'to do',
  IN_PROGRESS: 'in progress',
  DONE: 'done',
};

function statusFromSectionName(name: string): TaskStatusValue | null {
  const normalized = name.trim().toLowerCase();
  const entry = (Object.entries(STATUS_SECTION_NAMES) as [TaskStatusValue, string][]).find(
    ([, sectionName]) => sectionName === normalized,
  );
  return entry ? entry[0] : null;
}

/** Appends `taskId` to the end of `sectionId`, returning the order value to write. Top-level tasks only. */
async function endOfSectionOrder(sectionId: string): Promise<number> {
  const last = await prisma.task.findFirst({
    where: { sectionId, parentTaskId: null, deletedAt: null },
    orderBy: { order: 'desc' },
  });
  return (last?.order ?? -1) + 1;
}

/** Unfinished blockers of `taskId` — the tasks it can't start/move forward until they're DONE. */
async function getUnfinishedBlockers(taskId: string): Promise<{ id: string; title: string; status: string }[]> {
  const rows = await prisma.taskDependency.findMany({
    where: { blockedId: taskId },
    include: { blocker: { select: { id: true, title: true, status: true } } },
  });
  return rows.map((r) => r.blocker).filter((b) => b.status !== 'DONE');
}

/**
 * Walks backwards from `blockerId` along blockedId->blocker edges (its blockers, their blockers,
 * etc.) to make sure `blockedId` never leads back to `taskId` (would form a cycle).
 */
async function wouldCreateDependencyCycle(taskId: string, blockerId: string): Promise<boolean> {
  const visited = new Set<string>();
  const queue: string[] = [blockerId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const rows = await prisma.taskDependency.findMany({ where: { blockedId: current }, select: { blockerId: true } });
    for (const row of rows) queue.push(row.blockerId);
  }
  return false;
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
  assigneeIds: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

export async function createTask(projectId: string, formData: FormData) {
  const session = await requireProjectMember(projectId);

  const assigneeIdsRaw = formData.getAll('assigneeIds').filter((v): v is string => typeof v === 'string' && v.length > 0);
  const singleAssigneeId = formData.get('assigneeId');
  if (typeof singleAssigneeId === 'string' && singleAssigneeId) assigneeIdsRaw.push(singleAssigneeId);

  const parsed = createTaskSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    url: formData.get('url') || undefined,
    sectionId: formData.get('sectionId'),
    parentTaskId: formData.get('parentTaskId') || undefined,
    assigneeIds: assigneeIdsRaw.length > 0 ? assigneeIdsRaw : undefined,
    startDate: formData.get('startDate') || undefined,
    dueDate: formData.get('dueDate') || undefined,
    priority: formData.get('priority') || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const lastTask = await prisma.task.findFirst({
    where: parsed.data.parentTaskId
      ? { parentTaskId: parsed.data.parentTaskId, deletedAt: null }
      : { sectionId: parsed.data.sectionId, parentTaskId: null, deletedAt: null },
    orderBy: { order: 'desc' },
  });

  const assigneeIds = parsed.data.assigneeIds ?? [];

  const task = await prisma.task.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      url: parsed.data.url || null,
      projectId,
      sectionId: parsed.data.sectionId,
      parentTaskId: parsed.data.parentTaskId || null,
      assignees: assigneeIds.length > 0 ? { connect: assigneeIds.map((id) => ({ id })) } : undefined,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      priority: parsed.data.priority ?? 'MEDIUM',
      order: (lastTask?.order ?? -1) + 1,
    },
  });

  if (assigneeIds.length > 0) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    await Promise.all(
      assigneeIds.map((recipientId) =>
        createNotification({
          type: 'TASK_ASSIGNED',
          recipientId,
          actorId: session.user.id,
          message: `${session.user.name} assigned you to "${task.title}" in ${project?.name}`,
          link: `/projects/${projectId}?task=${task.id}`,
          emailSubject: `New task assigned: ${task.title}`,
        }),
      ),
    );
  }

  void dispatchWebhooks('TASK_CREATED', { taskId: task.id, projectId, title: task.title, status: task.status });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/my-tasks');
  return { success: true, taskId: task.id };
}

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).optional().nullable(),
  url: z.union([urlSchema, z.null()]).optional(),
  assigneeIds: z.array(z.string()).optional(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
});

type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export async function updateTask(taskId: string, input: UpdateTaskInput) {
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignees: { select: { id: true } } },
  });
  if (!existing) return { success: false, error: 'Task not found' };
  if (existing.deletedAt) return { success: false, error: 'This task is in the trash. Restore it first.' };

  const session = await requireProjectMember(existing.projectId);

  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const movingToActive =
    'status' in parsed.data && parsed.data.status && parsed.data.status !== 'TODO' && existing.status === 'TODO';
  if (movingToActive) {
    const blockers = await getUnfinishedBlockers(taskId);
    if (blockers.length > 0) {
      return {
        success: false,
        error: `This task is locked until ${blockers.map((b) => `"${b.title}"`).join(', ')} ${
          blockers.length > 1 ? 'are' : 'is'
        } marked done.`,
      };
    }
  }

  const data: Record<string, unknown> = { ...parsed.data };
  delete data.assigneeIds;
  if ('url' in parsed.data) {
    data.url = parsed.data.url || null;
  }
  if ('startDate' in parsed.data) {
    data.startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null;
  }
  if ('dueDate' in parsed.data) {
    data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  }

  // Keep the board column in sync with a status change made outside the board itself (grid
  // dropdown, task detail panel, subtask checkbox). moveTask (drag-and-drop) already does the
  // reverse — deriving status from the destination column — so this is the other half of the
  // same invariant; skip subtasks, which aren't independently positioned on the board.
  if (parsed.data.status && parsed.data.status !== existing.status && existing.parentTaskId === null) {
    const targetSectionName = STATUS_SECTION_NAMES[parsed.data.status];
    const destinationSection = await prisma.section.findFirst({
      where: { projectId: existing.projectId, name: { equals: targetSectionName, mode: 'insensitive' } },
    });
    if (destinationSection && destinationSection.id !== existing.sectionId) {
      data.sectionId = destinationSection.id;
      data.order = await endOfSectionOrder(destinationSection.id);
    }
  }

  const existingAssigneeIds = existing.assignees.map((a) => a.id);
  const newAssigneeIds = parsed.data.assigneeIds;
  const assigneesChanged = newAssigneeIds !== undefined && !sameIdSet(newAssigneeIds, existingAssigneeIds);
  if (newAssigneeIds !== undefined) {
    data.assignees = { set: newAssigneeIds.map((id) => ({ id })) };
  }

  const turningDone = parsed.data.status === 'DONE' && existing.status !== 'DONE';

  // Atomically claim the not-DONE -> DONE transition before materializing the next occurrence.
  // `existing.status` above is a snapshot read before this request's write lands, so two
  // concurrent requests completing the same task (a double-click, or a race against moveTask
  // below) would otherwise both compute turningDone = true from their own stale snapshot and
  // each call materializeAfterCompletion with a slightly different completedAt — which can round
  // to two different occurrenceDate values that both legitimately pass the
  // (recurrenceId, occurrenceDate) unique index, producing two real duplicate task rows for what
  // was really one completion event. The updateMany's `where` makes the claim atomic: only the
  // request whose write actually flips status from non-DONE to DONE gets count > 0.
  const claimedDoneTransition =
    turningDone &&
    (
      await prisma.task.updateMany({
        where: { id: taskId, status: { not: 'DONE' } },
        data: { status: 'DONE' },
      })
    ).count > 0;

  const task = await prisma.task.update({ where: { id: taskId }, data });

  // A repeating task that's just been marked DONE spawns its next occurrence as a new task
  // row (store the recipe, not the meals) — this one stays DONE, with real history, instead
  // of the old behavior of silently flipping the same row back to not-done.
  if (claimedDoneTransition) {
    await materializeAfterCompletion(taskId, new Date());
  }

  if (assigneesChanged) {
    const newlyAdded = newAssigneeIds!.filter((id) => !existingAssigneeIds.includes(id));
    if (newlyAdded.length > 0) {
      const project = await prisma.project.findUnique({ where: { id: task.projectId } });
      await Promise.all(
        newlyAdded.map((recipientId) =>
          createNotification({
            type: 'TASK_ASSIGNED',
            recipientId,
            actorId: session.user.id,
            message: `${session.user.name} assigned you to "${task.title}" in ${project?.name}`,
            link: `/projects/${task.projectId}?task=${task.id}`,
            emailSubject: `New task assigned: ${task.title}`,
          }),
        ),
      );
    }

    const newNames =
      newAssigneeIds!.length > 0
        ? (await prisma.user.findMany({ where: { id: { in: newAssigneeIds } }, select: { name: true } })).map(
            (u) => u.name,
          )
        : [];
    await logActivity(
      taskId,
      session.user.id,
      'ASSIGNEES_CHANGED',
      newNames.length > 0 ? `Assignees changed to ${newNames.join(', ')}` : 'Assignees cleared',
    );
  }

  if (parsed.data.status && parsed.data.status !== existing.status) {
    await logActivity(
      taskId,
      session.user.id,
      'STATUS_CHANGED',
      `Status changed from ${STATUS_LABELS[existing.status]} to ${STATUS_LABELS[parsed.data.status]}`,
    );
  }

  if ('priority' in parsed.data && parsed.data.priority && parsed.data.priority !== existing.priority) {
    await logActivity(
      taskId,
      session.user.id,
      'PRIORITY_CHANGED',
      `Priority changed from ${PRIORITY_LABELS[existing.priority]} to ${PRIORITY_LABELS[parsed.data.priority]}`,
    );
  }

  if ('dueDate' in parsed.data) {
    const oldDue = existing.dueDate ? existing.dueDate.toISOString() : null;
    const newDue = parsed.data.dueDate ? new Date(parsed.data.dueDate).toISOString() : null;
    if (oldDue !== newDue) {
      await logActivity(
        taskId,
        session.user.id,
        'DUE_DATE_CHANGED',
        newDue ? `Due date changed to ${new Date(newDue).toLocaleDateString()}` : 'Due date cleared',
      );
    }
  }

  if (parsed.data.status && parsed.data.status !== existing.status) {
    await runTaskAutomations(taskId, { type: 'STATUS_CHANGED', status: parsed.data.status });
  }
  if (assigneesChanged) {
    await runTaskAutomations(taskId, { type: 'ASSIGNEE_CHANGED' });
  }

  void dispatchWebhooks('TASK_UPDATED', { taskId: task.id, projectId: task.projectId, title: task.title, status: task.status });
  if (task.status === 'DONE' && existing.status !== 'DONE') {
    void dispatchWebhooks('TASK_COMPLETED', { taskId: task.id, projectId: task.projectId, title: task.title });
  }

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath('/my-tasks');
  return { success: true };
}

/** Called by the Kanban board on drag-and-drop to persist the new section + position. */
export async function moveTask(taskId: string, destinationSectionId: string, destinationOrder: number) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { success: false, error: 'Task not found' };
  const session = await requireProjectMember(task.projectId);

  const destinationSection = await prisma.section.findUnique({ where: { id: destinationSectionId } });
  if (!destinationSection) return { success: false, error: 'Section not found' };

  const destinationStatus = statusFromSectionName(destinationSection.name) ?? task.status;
  if (destinationStatus !== 'TODO' && task.status === 'TODO') {
    const blockers = await getUnfinishedBlockers(taskId);
    if (blockers.length > 0) {
      return {
        success: false,
        error: `This task is locked until ${blockers.map((b) => `"${b.title}"`).join(', ')} ${
          blockers.length > 1 ? 'are' : 'is'
        } marked done.`,
      };
    }
  }

  const turningDone = destinationStatus === 'DONE' && task.status !== 'DONE';

  // See updateTask's identical claim for the full explanation: `task.status` above is a snapshot
  // read before this transaction starts, so a concurrent updateTask (or another moveTask) landing
  // on the same task could otherwise race this one — both would compute turningDone = true and
  // both call materializeAfterCompletion with a different completedAt, which can round to two
  // different occurrenceDate values that both pass the unique index, producing a real duplicate
  // task row for one completion event. Claiming the status flip atomically inside the same
  // transaction as the reorder (via updateMany's conditional `where`, not the unconditional
  // `update` the sibling loop uses below) makes only one racing request's claim succeed.
  let claimedDoneTransition = false;
  await prisma.$transaction(async (tx) => {
    if (turningDone) {
      const claim = await tx.task.updateMany({
        where: { id: taskId, status: { not: 'DONE' } },
        data: { status: 'DONE' },
      });
      claimedDoneTransition = claim.count > 0;
    }

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
            status: t.id === taskId ? destinationStatus : t.status,
          },
        }),
      ),
    );
  });

  // Same "recipe, not the meals" spawn as updateTask's turningDone path — dragging an
  // AFTER_COMPLETION-mode recurring task's card into a "Done" column must also spawn its
  // next occurrence, not just plain status-change automations.
  if (claimedDoneTransition) {
    await materializeAfterCompletion(taskId, new Date());
  }

  if (destinationSectionId !== task.sectionId) {
    await logActivity(taskId, session.user.id, 'MOVED', `Moved to "${destinationSection.name}"`);
  }

  if (destinationStatus !== task.status) {
    await runTaskAutomations(taskId, { type: 'STATUS_CHANGED', status: destinationStatus });
  }

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath('/my-tasks');
  return { success: true };
}

/** Adds a "blockedId depends on blockerId" edge, rejecting self-edges, duplicates, and cycles. */
export async function addDependency(taskId: string, blockerId: string) {
  if (taskId === blockerId) return { success: false, error: 'A task cannot depend on itself.' };

  const [blocked, blocker] = await Promise.all([
    prisma.task.findUnique({ where: { id: taskId } }),
    prisma.task.findUnique({ where: { id: blockerId } }),
  ]);
  if (!blocked) return { success: false, error: 'Task not found' };
  if (!blocker || blocker.projectId !== blocked.projectId) {
    return { success: false, error: 'That task is not in this project.' };
  }

  await requireProjectMember(blocked.projectId);

  const existingEdge = await prisma.taskDependency.findUnique({
    where: { blockedId_blockerId: { blockedId: taskId, blockerId } },
  });
  if (existingEdge) return { success: true };

  if (await wouldCreateDependencyCycle(taskId, blockerId)) {
    return { success: false, error: 'That would create a circular dependency.' };
  }

  await prisma.taskDependency.create({ data: { blockedId: taskId, blockerId } });

  revalidatePath(`/projects/${blocked.projectId}`);
  revalidatePath('/my-tasks');
  return { success: true };
}

export async function removeDependency(taskId: string, blockerId: string) {
  const blocked = await prisma.task.findUnique({ where: { id: taskId } });
  if (!blocked) return { success: false, error: 'Task not found' };
  await requireProjectMember(blocked.projectId);

  await prisma.taskDependency.deleteMany({ where: { blockedId: taskId, blockerId } });

  revalidatePath(`/projects/${blocked.projectId}`);
  revalidatePath('/my-tasks');
  return { success: true };
}

export async function getTaskDetail(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignees: { select: { id: true, name: true } },
      taskRecurrence: true,
      comments: { include: { user: true }, orderBy: { createdAt: 'asc' } },
      project: { include: { members: { include: { user: true } } } },
      subtasks: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
      fieldValues: { include: { option: true } },
      parentTask: { select: { id: true, title: true } },
      blockedBy: { include: { blocker: { select: { id: true, title: true, status: true } } } },
      blocking: { include: { blocked: { select: { id: true, title: true, status: true } } } },
      attachments: { include: { uploadedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
      tags: { orderBy: { order: 'asc' } },
      timeEntries: { include: { user: { select: { id: true, name: true } } }, orderBy: { loggedAt: 'desc' } },
      activities: {
        include: { actor: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
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

  const blockedBy = task.blockedBy.map((d) => d.blocker);
  const blocking = task.blocking.map((d) => d.blocked);
  const locked = blockedBy.some((b) => b.status !== 'DONE');

  const taskRecurrence = toTaskRecurrenceInfo(task.taskRecurrence);

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    url: task.url,
    status: task.status,
    priority: task.priority,
    startDate: task.startDate ? task.startDate.toISOString() : null,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    assignees: task.assignees.map((a) => ({ id: a.id, name: a.name })),
    taskRecurrence,
    projectId: task.projectId,
    projectName: task.project.name,
    sectionId: task.sectionId,
    parentTask: task.parentTask,
    blockedBy,
    blocking,
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
    timeEntries: task.timeEntries.map((te) => ({
      id: te.id,
      minutes: te.minutes,
      note: te.note,
      loggedAt: te.loggedAt.toISOString(),
      userId: te.userId,
      userName: te.user.name,
    })),
    activities: task.activities.map((a) => ({
      id: a.id,
      action: a.action,
      detail: a.detail,
      createdAt: a.createdAt.toISOString(),
      actorName: a.actor?.name ?? null,
    })),
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

  void dispatchWebhooks('TASK_DELETED', { taskId: task.id, projectId: task.projectId, title: task.title });

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath('/my-tasks');
  revalidatePath('/trash');
  return { success: true };
}

const bulkUpdateSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assigneeIds: z.array(z.string()).optional(),
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

  const { assigneeIds, ...scalarData } = parsed.data;

  if (Object.keys(scalarData).length > 0) {
    await prisma.task.updateMany({
      where: { id: { in: taskIds }, deletedAt: null },
      data: scalarData,
    });
  }

  if (assigneeIds !== undefined) {
    await Promise.all(
      taskIds.map((id) =>
        prisma.task.update({ where: { id }, data: { assignees: { set: assigneeIds.map((uid) => ({ id: uid })) } } }),
      ),
    );
  }

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

const gridBatchEditSchema = z.object({
  taskId: z.string(),
  title: z.string().min(1).max(200).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  dueDate: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
});

export type GridBatchEdit = z.infer<typeof gridBatchEditSchema>;

/**
 * Applies many independent per-task field edits in a single transaction — the grid
 * view's paste/fill-down write path. Unlike bulkUpdateTasks (one patch applied to
 * every task), each task here can carry different values, so it's its own action
 * rather than an overload of bulkUpdateTasks's shape. Mirrors bulkUpdateTasks in
 * skipping per-field activity logging/automations/webhooks — those are single-task
 * ceremony that would reintroduce the same N-round-trip cost this exists to avoid.
 */
export async function batchUpdateTaskFields(edits: GridBatchEdit[]) {
  const parsed = z.array(gridBatchEditSchema).min(1).safeParse(edits);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const taskIds = parsed.data.map((e) => e.taskId);
  const tasks = await prisma.task.findMany({ where: { id: { in: taskIds } } });
  if (tasks.length === 0) return { success: false, error: 'Tasks not found' };
  const validIds = new Set(tasks.map((t) => t.id));

  const projectIds = new Set(tasks.map((t) => t.projectId));
  for (const projectId of projectIds) {
    await requireProjectMember(projectId);
  }

  const ops = parsed.data.flatMap((edit) => {
    if (!validIds.has(edit.taskId)) return [];
    const data: Prisma.TaskUpdateInput = {};
    if (edit.title !== undefined) data.title = edit.title;
    if (edit.priority !== undefined) data.priority = edit.priority;
    if (edit.status !== undefined) data.status = edit.status;
    if (edit.dueDate !== undefined) data.dueDate = edit.dueDate ? new Date(edit.dueDate) : null;
    if (edit.assigneeIds !== undefined) data.assignees = { set: edit.assigneeIds.map((id) => ({ id })) };
    if (edit.tagIds !== undefined) data.tags = { set: edit.tagIds.map((id) => ({ id })) };
    if (Object.keys(data).length === 0) return [];
    return [prisma.task.update({ where: { id: edit.taskId }, data })];
  });

  if (ops.length > 0) {
    await prisma.$transaction(ops);
  }

  for (const projectId of projectIds) revalidatePath(`/projects/${projectId}`);
  revalidatePath('/my-tasks');
  return { success: true };
}

const batchCreateTasksSchema = z.object({
  sectionId: z.string(),
  titles: z.array(z.string().min(1).max(200)).min(1),
});

/** Creates several bare (title-only) tasks in one transaction — used when a grid paste has more rows than exist. */
export async function batchCreateTasks(sectionId: string, titles: string[]) {
  const parsed = batchCreateTasksSchema.safeParse({ sectionId, titles });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const section = await prisma.section.findUnique({ where: { id: parsed.data.sectionId } });
  if (!section) return { success: false, error: 'Section not found' };
  await requireProjectMember(section.projectId);

  const lastTask = await prisma.task.findFirst({
    where: { sectionId: section.id, parentTaskId: null, deletedAt: null },
    orderBy: { order: 'desc' },
  });
  let nextOrder = (lastTask?.order ?? -1) + 1;

  const created = await prisma.$transaction(
    parsed.data.titles.map((title) =>
      prisma.task.create({
        data: { title, projectId: section.projectId, sectionId: section.id, order: nextOrder++ },
      }),
    ),
  );

  revalidatePath(`/projects/${section.projectId}`);
  revalidatePath('/my-tasks');
  return { success: true, tasks: created.map((t) => ({ id: t.id, title: t.title })) };
}
