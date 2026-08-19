import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { materializeAfterCompletion } from '@/lib/materializeRecurrence';
import type { AutomationRule, TaskStatus } from '@prisma/client';

const MAX_CHAIN_DEPTH = 5;

type TaskAutomationEvent = { type: 'STATUS_CHANGED'; status: TaskStatus } | { type: 'ASSIGNEE_CHANGED' };

async function logRun(ruleId: string, status: 'SUCCESS' | 'FAILED' | 'SKIPPED', detail?: string) {
  await prisma.automationRun.create({ data: { ruleId, status, detail } });
}

/** Finds rules whose trigger matches `event` on `taskId` and applies each one's action. */
export async function runTaskAutomations(taskId: string, event: TaskAutomationEvent, depth = 0): Promise<void> {
  if (depth >= MAX_CHAIN_DEPTH) return;

  const rules = await prisma.automationRule.findMany({
    where: {
      sourceTaskId: taskId,
      enabled: true,
      triggerType: event.type,
      ...(event.type === 'STATUS_CHANGED' ? { triggerStatus: event.status } : {}),
    },
  });

  for (const rule of rules) {
    await applyAutomationAction(rule, depth);
  }
}

/**
 * Executes a single rule's action. Exported separately so the due-date cron route can invoke
 * matched DUE_DATE_APPROACHING rules directly, since those aren't dispatched via runTaskAutomations.
 */
export async function applyAutomationAction(rule: AutomationRule, depth: number): Promise<void> {
  try {
    switch (rule.actionType) {
      case 'SET_STATUS': {
        if (!rule.targetTaskId || !rule.actionStatus) {
          await logRun(rule.id, 'SKIPPED', 'Missing target task or status');
          return;
        }
        // Atomically claim the not-DONE -> DONE transition, same guard as updateTask/moveTask in
        // src/lib/actions/tasks.ts: a plain findUnique-then-update here would let this automation
        // race a concurrent manual completion of the same task, each computing turningDone from
        // its own stale snapshot and each materializing the next occurrence with a different
        // completedAt — producing a real duplicate task row for one completion event. The
        // updateMany's `where` makes the claim atomic: only the write that actually flips status
        // from non-DONE to DONE gets count > 0.
        const claimedDoneTransition =
          rule.actionStatus === 'DONE' &&
          (
            await prisma.task.updateMany({
              where: { id: rule.targetTaskId, status: { not: 'DONE' } },
              data: { status: 'DONE' },
            })
          ).count > 0;

        const target = await prisma.task.update({
          where: { id: rule.targetTaskId },
          data: { status: rule.actionStatus },
        });
        // Same rule as updateTask: an automation that completes a recurring task must still
        // spawn its next occurrence — this used to bypass that entirely by updating the row
        // directly instead of going through updateTask.
        if (claimedDoneTransition) {
          await materializeAfterCompletion(target.id, new Date());
        }
        await logRun(rule.id, 'SUCCESS');
        revalidatePath(`/projects/${target.projectId}`);
        revalidatePath('/my-tasks');
        await runTaskAutomations(target.id, { type: 'STATUS_CHANGED', status: target.status }, depth + 1);
        return;
      }
      case 'SET_ASSIGNEE': {
        if (!rule.targetTaskId) {
          await logRun(rule.id, 'SKIPPED', 'Missing target task');
          return;
        }
        let assigneeIdsToSet: string[] = rule.actionAssigneeId ? [rule.actionAssigneeId] : [];
        if (rule.assigneeMode === 'SAME_AS_SOURCE') {
          const source = await prisma.task.findUnique({
            where: { id: rule.sourceTaskId },
            include: { assignees: { select: { id: true } } },
          });
          assigneeIdsToSet = source?.assignees.map((a) => a.id) ?? [];
        }
        const target = await prisma.task.update({
          where: { id: rule.targetTaskId },
          data: { assignees: { set: assigneeIdsToSet.map((id) => ({ id })) } },
        });
        if (assigneeIdsToSet.length > 0) {
          const project = await prisma.project.findUnique({ where: { id: target.projectId } });
          await Promise.all(
            assigneeIdsToSet.map((recipientId) =>
              createNotification({
                type: 'TASK_ASSIGNED',
                recipientId,
                message: `An automation assigned you to "${target.title}" in ${project?.name}`,
                link: `/projects/${target.projectId}?task=${target.id}`,
                emailSubject: `New task assigned: ${target.title}`,
              }),
            ),
          );
        }
        await logRun(rule.id, 'SUCCESS');
        revalidatePath(`/projects/${target.projectId}`);
        revalidatePath('/my-tasks');
        await runTaskAutomations(target.id, { type: 'ASSIGNEE_CHANGED' }, depth + 1);
        return;
      }
      case 'MOVE_SECTION': {
        if (!rule.targetTaskId || !rule.targetSectionId) {
          await logRun(rule.id, 'SKIPPED', 'Missing target task or section');
          return;
        }
        const section = await prisma.section.findUnique({ where: { id: rule.targetSectionId } });
        if (!section) {
          await logRun(rule.id, 'SKIPPED', 'Target section not found');
          return;
        }
        const target = await prisma.task.update({
          where: { id: rule.targetTaskId },
          data: { sectionId: section.id, projectId: section.projectId },
        });
        await logRun(rule.id, 'SUCCESS');
        revalidatePath(`/projects/${target.projectId}`);
        revalidatePath('/my-tasks');
        return;
      }
      case 'CREATE_TASK': {
        if (!rule.targetSectionId) {
          await logRun(rule.id, 'SKIPPED', 'Missing target section');
          return;
        }
        const section = await prisma.section.findUnique({ where: { id: rule.targetSectionId } });
        if (!section) {
          await logRun(rule.id, 'SKIPPED', 'Target section not found');
          return;
        }
        const lastTask = await prisma.task.findFirst({
          where: { sectionId: section.id, parentTaskId: null },
          orderBy: { order: 'desc' },
        });
        const created = await prisma.task.create({
          data: {
            title: rule.newTaskTitle || 'Untitled task',
            description: rule.newTaskDescription,
            projectId: section.projectId,
            sectionId: section.id,
            assignees: rule.newTaskAssigneeId ? { connect: { id: rule.newTaskAssigneeId } } : undefined,
            priority: rule.newTaskPriority ?? 'MEDIUM',
            order: (lastTask?.order ?? -1) + 1,
          },
        });
        if (rule.newTaskAssigneeId) {
          const project = await prisma.project.findUnique({ where: { id: created.projectId } });
          await createNotification({
            type: 'TASK_ASSIGNED',
            recipientId: rule.newTaskAssigneeId,
            message: `An automation assigned you to "${created.title}" in ${project?.name}`,
            link: `/projects/${created.projectId}?task=${created.id}`,
            emailSubject: `New task assigned: ${created.title}`,
          });
        }
        await logRun(rule.id, 'SUCCESS');
        revalidatePath(`/projects/${created.projectId}`);
        revalidatePath('/my-tasks');
        return;
      }
    }
  } catch (err) {
    await logRun(rule.id, 'FAILED', err instanceof Error ? err.message : 'Unknown error');
  }
}
