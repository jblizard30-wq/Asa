import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { materializeAfterCompletion } from '@/lib/materializeRecurrence';
import type { AutomationRule, Task, TaskStatus } from '@prisma/client';

const MAX_CHAIN_DEPTH = 5;

type TaskAutomationEvent = { type: 'STATUS_CHANGED'; status: TaskStatus } | { type: 'ASSIGNEE_CHANGED' };

async function logRun(ruleId: string, status: 'SUCCESS' | 'FAILED' | 'SKIPPED', detail?: string) {
  await prisma.automationRun.create({ data: { ruleId, status, detail } });
}

/**
 * Resolves a rule's source or target side to a live task row. When `recurrenceId` is set on the
 * rule, that always wins: the rule follows the series' current occurrence (the most recently
 * materialized one still around), not the single task row picked when the rule was created —
 * that row stops representing "the current task" the moment it's completed and superseded.
 * Falls back to the literal task id for plain, non-recurring rules.
 */
async function resolveRuleTask(recurrenceId: string | null, taskId: string | null): Promise<Task | null> {
  if (recurrenceId) {
    return prisma.task.findFirst({
      where: { recurrenceId, deletedAt: null },
      orderBy: { occurrenceDate: 'desc' },
    });
  }
  if (taskId) {
    return prisma.task.findUnique({ where: { id: taskId } });
  }
  return null;
}

/**
 * Finds rules whose trigger matches `event` on `taskId` and applies each one's action.
 * A recurrence-bound rule (sourceRecurrenceId set) matches any occurrence in that series, not
 * just the literal task it was created from — that's what lets it survive past the first
 * completed occurrence.
 */
export async function runTaskAutomations(taskId: string, event: TaskAutomationEvent, depth = 0): Promise<void> {
  if (depth >= MAX_CHAIN_DEPTH) return;

  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { recurrenceId: true } });

  const rules = await prisma.automationRule.findMany({
    where: {
      enabled: true,
      triggerType: event.type,
      ...(event.type === 'STATUS_CHANGED' ? { triggerStatus: event.status } : {}),
      OR: [{ sourceTaskId: taskId }, ...(task?.recurrenceId ? [{ sourceRecurrenceId: task.recurrenceId }] : [])],
    },
  });

  for (const rule of rules) {
    await applyAutomationAction(rule, depth, taskId);
  }
}

/**
 * Executes a single rule's action. Exported separately so the due-date cron route can invoke
 * matched DUE_DATE_APPROACHING rules directly, since those aren't dispatched via runTaskAutomations
 * (there's no live "just changed" task — the cron polls dueDate on a schedule instead). In that
 * case `triggeringTaskId` is omitted and the source is resolved from the rule's own configuration.
 */
export async function applyAutomationAction(
  rule: AutomationRule,
  depth: number,
  triggeringTaskId?: string,
): Promise<void> {
  try {
    switch (rule.actionType) {
      case 'SET_STATUS': {
        const target = await resolveRuleTask(rule.targetRecurrenceId, rule.targetTaskId);
        if (!target || !rule.actionStatus) {
          await logRun(rule.id, 'SKIPPED', 'Missing target task or status');
          return;
        }
        let turnedDone = false;
        if (rule.actionStatus === 'DONE') {
          // Atomic conditional claim, same guard as updateTask/moveTask in src/lib/actions/tasks.ts:
          // a plain findUnique-then-update here would let this automation race a concurrent
          // manual completion (or a second concurrent trigger of this same rule) — each computing
          // turnedDone from its own stale snapshot and each materializing the recurrence's next
          // occurrence for one completion event. The updateMany's `where` makes the claim atomic:
          // only the write that actually flips status from non-DONE to DONE gets count > 0. Keyed
          // on target.id (the resolved current occurrence), not rule.targetTaskId, so a
          // recurrence-bound rule claims the series' live row rather than a stale literal one.
          const claim = await prisma.task.updateMany({
            where: { id: target.id, status: { not: 'DONE' } },
            data: { status: 'DONE' },
          });
          if (claim.count === 0) {
            await logRun(rule.id, 'SKIPPED', 'Target already DONE');
            return;
          }
          turnedDone = true;
        } else {
          if (target.status === rule.actionStatus) {
            await logRun(rule.id, 'SKIPPED', 'Target already in that status');
            return;
          }
          await prisma.task.update({ where: { id: target.id }, data: { status: rule.actionStatus } });
        }

        // Same rule as updateTask: an automation that completes a recurring task must still
        // spawn its next occurrence — this used to bypass that entirely by updating the row
        // directly instead of going through updateTask.
        if (turnedDone) {
          await materializeAfterCompletion(target.id, new Date());
        }
        await logRun(rule.id, 'SUCCESS');
        revalidatePath(`/projects/${target.projectId}`);
        revalidatePath('/my-tasks');
        await runTaskAutomations(target.id, { type: 'STATUS_CHANGED', status: rule.actionStatus }, depth + 1);
        return;
      }
      case 'SET_ASSIGNEE': {
        const target = await resolveRuleTask(rule.targetRecurrenceId, rule.targetTaskId);
        if (!target) {
          await logRun(rule.id, 'SKIPPED', 'Missing target task');
          return;
        }
        let assigneeIdsToSet: string[] = rule.actionAssigneeId ? [rule.actionAssigneeId] : [];
        if (rule.assigneeMode === 'SAME_AS_SOURCE') {
          const source = triggeringTaskId
            ? await prisma.task.findUnique({ where: { id: triggeringTaskId } })
            : await resolveRuleTask(rule.sourceRecurrenceId, rule.sourceTaskId);
          const sourceWithAssignees = source
            ? await prisma.task.findUnique({ where: { id: source.id }, include: { assignees: { select: { id: true } } } })
            : null;
          assigneeIdsToSet = sourceWithAssignees?.assignees.map((a) => a.id) ?? [];
        }
        const updated = await prisma.task.update({
          where: { id: target.id },
          data: { assignees: { set: assigneeIdsToSet.map((id) => ({ id })) } },
        });
        if (assigneeIdsToSet.length > 0) {
          const project = await prisma.project.findUnique({ where: { id: updated.projectId } });
          await Promise.all(
            assigneeIdsToSet.map((recipientId) =>
              createNotification({
                type: 'TASK_ASSIGNED',
                recipientId,
                message: `An automation assigned you to "${updated.title}" in ${project?.name}`,
                link: `/projects/${updated.projectId}?task=${updated.id}`,
                emailSubject: `New task assigned: ${updated.title}`,
              }),
            ),
          );
        }
        await logRun(rule.id, 'SUCCESS');
        revalidatePath(`/projects/${updated.projectId}`);
        revalidatePath('/my-tasks');
        await runTaskAutomations(updated.id, { type: 'ASSIGNEE_CHANGED' }, depth + 1);
        return;
      }
      case 'MOVE_SECTION': {
        const target = await resolveRuleTask(rule.targetRecurrenceId, rule.targetTaskId);
        if (!target || !rule.targetSectionId) {
          await logRun(rule.id, 'SKIPPED', 'Missing target task or section');
          return;
        }
        const section = await prisma.section.findUnique({ where: { id: rule.targetSectionId } });
        if (!section) {
          await logRun(rule.id, 'SKIPPED', 'Target section not found');
          return;
        }
        const updated = await prisma.task.update({
          where: { id: target.id },
          data: { sectionId: section.id, projectId: section.projectId },
        });
        await logRun(rule.id, 'SUCCESS');
        revalidatePath(`/projects/${updated.projectId}`);
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

/**
 * Resolves a DUE_DATE_APPROACHING rule's current source task, for the daily cron to read
 * `dueDate` off. Exported so that route doesn't need to know about the recurrence-override
 * convention itself.
 */
export async function resolveAutomationSourceTask(rule: AutomationRule): Promise<Task | null> {
  return resolveRuleTask(rule.sourceRecurrenceId, rule.sourceTaskId);
}
