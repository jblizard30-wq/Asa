import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
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
        const target = await prisma.task.update({
          where: { id: rule.targetTaskId },
          data: { status: rule.actionStatus },
        });
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
        let assigneeId: string | null = rule.actionAssigneeId ?? null;
        if (rule.assigneeMode === 'SAME_AS_SOURCE') {
          const source = await prisma.task.findUnique({ where: { id: rule.sourceTaskId } });
          assigneeId = source?.assigneeId ?? null;
        }
        const target = await prisma.task.update({
          where: { id: rule.targetTaskId },
          data: { assigneeId },
        });
        if (assigneeId) {
          const project = await prisma.project.findUnique({ where: { id: target.projectId } });
          await createNotification({
            type: 'TASK_ASSIGNED',
            recipientId: assigneeId,
            message: `An automation assigned you to "${target.title}" in ${project?.name}`,
            link: `/projects/${target.projectId}?task=${target.id}`,
            emailSubject: `New task assigned: ${target.title}`,
          });
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
            assigneeId: rule.newTaskAssigneeId,
            priority: rule.newTaskPriority ?? 'MEDIUM',
            order: (lastTask?.order ?? -1) + 1,
          },
        });
        if (created.assigneeId) {
          const project = await prisma.project.findUnique({ where: { id: created.projectId } });
          await createNotification({
            type: 'TASK_ASSIGNED',
            recipientId: created.assigneeId,
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
