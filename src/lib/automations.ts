import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { materializeAfterCompletion } from '@/lib/materializeRecurrence';
import { broadcastAppEvent } from '@/lib/events';
import type { AutomationRule, TaskStatus } from '@prisma/client';

const MAX_CHAIN_DEPTH = 5;

type TaskAutomationEvent = { type: 'STATUS_CHANGED'; status: TaskStatus } | { type: 'ASSIGNEE_CHANGED' };

async function logRun(ruleId: string, status: 'SUCCESS' | 'FAILED' | 'SKIPPED', detail?: string) {
  await prisma.automationRun.create({ data: { ruleId, status, detail } });
}

/** True if the task is trashed, or no longer exists. Unlike updateTask, a rule firing on a
 * trashed task has no user in the loop to see a "task is in the trash" error, so this is a
 * silent skip (logged) rather than a thrown error — never resurrect/mutate a task someone
 * deliberately trashed just because a rule happened to fire on it. */
async function isTargetTrashed(taskId: string): Promise<boolean> {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { deletedAt: true } });
  return !task || task.deletedAt !== null;
}

/** Finds rules whose trigger matches `event` on `taskId` and applies each one's action. */
export async function runTaskAutomations(taskId: string, event: TaskAutomationEvent, depth = 0): Promise<void> {
  if (depth >= MAX_CHAIN_DEPTH) return;

  const currentTask = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true },
  });
  if (!currentTask) return;

  const rules = await prisma.automationRule.findMany({
    where: {
      enabled: true,
      triggerType: event.type,
      ...(event.type === 'STATUS_CHANGED' ? { triggerStatus: event.status } : {}),
      OR: [
        { sourceTaskId: taskId },
        { projectId: currentTask.projectId, sourceTaskId: null },
      ],
    },
  });

  for (const rule of rules) {
    await applyAutomationAction(rule, depth, taskId);
  }
}

/**
 * Executes a single rule's action. Supports both specific targetTaskId and pattern-based sourceTaskId triggers.
 */
export async function applyAutomationAction(rule: AutomationRule, depth: number, triggeringTaskId?: string): Promise<void> {
  const effectiveTargetTaskId = rule.targetTaskId ?? triggeringTaskId ?? rule.sourceTaskId;

  try {
    switch (rule.actionType) {
      case 'SET_STATUS': {
        if (!effectiveTargetTaskId || !rule.actionStatus) {
          await logRun(rule.id, 'SKIPPED', 'Missing target task or status');
          return;
        }
        if (await isTargetTrashed(effectiveTargetTaskId)) {
          await logRun(rule.id, 'SKIPPED', 'Target task is in the trash');
          return;
        }

        const claimedDoneTransition =
          rule.actionStatus === 'DONE' &&
          (
            await prisma.task.updateMany({
              where: { id: effectiveTargetTaskId, status: { not: 'DONE' } },
              data: { status: 'DONE' },
            })
          ).count > 0;

        const target = await prisma.task.update({
          where: { id: effectiveTargetTaskId },
          data: { status: rule.actionStatus },
        });

        if (claimedDoneTransition) {
          await materializeAfterCompletion(target.id, new Date());
        }

        await logRun(rule.id, 'SUCCESS');
        broadcastAppEvent({ type: 'TASK_UPDATED', projectId: target.projectId, taskId: target.id });
        revalidatePath(`/projects/${target.projectId}`);
        revalidatePath('/my-tasks');
        await runTaskAutomations(target.id, { type: 'STATUS_CHANGED', status: target.status }, depth + 1);
        return;
      }
      case 'SET_ASSIGNEE': {
        if (!effectiveTargetTaskId) {
          await logRun(rule.id, 'SKIPPED', 'Missing target task');
          return;
        }
        if (await isTargetTrashed(effectiveTargetTaskId)) {
          await logRun(rule.id, 'SKIPPED', 'Target task is in the trash');
          return;
        }
        let assigneeIdsToSet: string[] = rule.actionAssigneeId ? [rule.actionAssigneeId] : [];
        if (rule.assigneeMode === 'SAME_AS_SOURCE' && rule.sourceTaskId) {
          const source = await prisma.task.findUnique({
            where: { id: rule.sourceTaskId },
            include: { assignees: { select: { id: true } } },
          });
          assigneeIdsToSet = source?.assignees.map((a) => a.id) ?? [];
        }
        const target = await prisma.task.update({
          where: { id: effectiveTargetTaskId },
          data: { assignees: { set: assigneeIdsToSet.map((id) => ({ id })) } },
        });
        if (assigneeIdsToSet.length > 0) {
          const project = await prisma.project.findUnique({ where: { id: target.projectId } });
          await Promise.all(
            assigneeIdsToSet.map((recipientId) =>
              createNotification({
                type: 'TASK_ASSIGNED',
                recipientId,
                actorId: rule.createdById,
                message: `An automation assigned you to "${target.title}" in ${project?.name}`,
                link: `/projects/${target.projectId}?task=${target.id}`,
                emailSubject: `Task assigned via automation: ${target.title}`,
              }),
            ),
          );
        }
        await logRun(rule.id, 'SUCCESS');
        broadcastAppEvent({ type: 'TASK_UPDATED', projectId: target.projectId, taskId: target.id });
        revalidatePath(`/projects/${target.projectId}`);
        revalidatePath('/my-tasks');
        return;
      }
      case 'MOVE_SECTION': {
        if (!effectiveTargetTaskId || !rule.targetSectionId) {
          await logRun(rule.id, 'SKIPPED', 'Missing target task or section');
          return;
        }
        if (await isTargetTrashed(effectiveTargetTaskId)) {
          await logRun(rule.id, 'SKIPPED', 'Target task is in the trash');
          return;
        }
        const target = await prisma.task.update({
          where: { id: effectiveTargetTaskId },
          data: { sectionId: rule.targetSectionId },
        });
        await logRun(rule.id, 'SUCCESS');
        broadcastAppEvent({ type: 'TASK_MOVED', projectId: target.projectId, taskId: target.id });
        revalidatePath(`/projects/${target.projectId}`);
        return;
      }
      case 'CREATE_TASK': {
        if (!rule.targetSectionId || !rule.newTaskTitle) {
          await logRun(rule.id, 'SKIPPED', 'Missing section or title for new task');
          return;
        }
        const section = await prisma.section.findUnique({
          where: { id: rule.targetSectionId },
          select: { projectId: true },
        });
        if (!section) {
          await logRun(rule.id, 'FAILED', 'Target section does not exist');
          return;
        }
        const lastTask = await prisma.task.findFirst({
          where: { sectionId: rule.targetSectionId, parentTaskId: null, deletedAt: null },
          orderBy: { order: 'desc' },
          select: { order: true },
        });
        const created = await prisma.task.create({
          data: {
            title: rule.newTaskTitle,
            description: rule.newTaskDescription || null,
            projectId: section.projectId,
            sectionId: rule.targetSectionId,
            priority: rule.newTaskPriority ?? 'MEDIUM',
            order: (lastTask?.order ?? -1) + 1,
            assignees: rule.newTaskAssigneeId ? { connect: [{ id: rule.newTaskAssigneeId }] } : undefined,
          },
        });
        if (rule.newTaskAssigneeId) {
          const project = await prisma.project.findUnique({ where: { id: section.projectId } });
          await createNotification({
            type: 'TASK_ASSIGNED',
            recipientId: rule.newTaskAssigneeId,
            actorId: rule.createdById,
            message: `An automation assigned you to "${created.title}" in ${project?.name}`,
            link: `/projects/${section.projectId}?task=${created.id}`,
            emailSubject: `New task assigned via automation: ${created.title}`,
          });
        }
        await logRun(rule.id, 'SUCCESS', `Created task ${created.id}`);
        broadcastAppEvent({ type: 'TASK_CREATED', projectId: section.projectId, taskId: created.id });
        revalidatePath(`/projects/${section.projectId}`);
        revalidatePath('/my-tasks');
        return;
      }
      default: {
        await logRun(rule.id, 'SKIPPED', `Unknown actionType`);
        return;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logRun(rule.id, 'FAILED', message);
  }
}

