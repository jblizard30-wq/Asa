'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireProjectMember } from '@/lib/actions/tasks';

/** Projects the current user can pick from when building a rule (all projects if ADMIN). */
export async function getAutomationOptions() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Not authenticated');

  const projects = await prisma.project.findMany({
    where: session.user.role === 'ADMIN' ? {} : { members: { some: { userId: session.user.id } } },
    orderBy: { name: 'asc' },
    include: {
      members: { include: { user: { select: { id: true, name: true } } } },
      sections: {
        orderBy: { order: 'asc' },
        include: {
          tasks: {
            where: { deletedAt: null, parentTaskId: null },
            orderBy: { order: 'asc' },
            select: { id: true, title: true, recurrenceId: true },
          },
        },
      },
    },
  });

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    members: p.members.map((m) => ({ id: m.user.id, name: m.user.name })),
    sections: p.sections.map((s) => ({
      id: s.id,
      name: s.name,
      // `recurring` flags tasks materialized from a TaskRecurrence — picking one binds the
      // rule to the whole series (see createAutomationRule), not just this occurrence.
      tasks: s.tasks.map((t) => ({ id: t.id, title: t.title, recurring: t.recurrenceId != null })),
    })),
  }));
}

export async function getAutomationRulesForProject(projectId: string) {
  await requireProjectMember(projectId);

  const rules = await prisma.automationRule.findMany({
    where: {
      OR: [{ sourceTask: { projectId } }, { targetTask: { projectId } }, { targetSection: { projectId } }],
    },
    include: {
      sourceTask: { select: { id: true, title: true, project: { select: { name: true } } } },
      sourceRecurrence: { select: { id: true, title: true, project: { select: { name: true } } } },
      targetTask: { select: { id: true, title: true, project: { select: { name: true } } } },
      targetRecurrence: { select: { id: true, title: true, project: { select: { name: true } } } },
      targetSection: { select: { id: true, name: true, project: { select: { name: true } } } },
      actionAssignee: { select: { id: true, name: true } },
      newTaskAssignee: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      runs: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
    orderBy: { createdAt: 'desc' },
  });

  return rules.map((r) => ({
    id: r.id,
    name: r.name,
    enabled: r.enabled,
    createdByName: r.createdBy.name,
    triggerType: r.triggerType,
    triggerStatus: r.triggerStatus,
    triggerDaysBefore: r.triggerDaysBefore,
    actionType: r.actionType,
    actionStatus: r.actionStatus,
    assigneeMode: r.assigneeMode,
    actionAssignee: r.actionAssignee,
    newTaskTitle: r.newTaskTitle,
    newTaskAssignee: r.newTaskAssignee,
    // A recurrence-bound rule shows the series' own title/project (stable across occurrences)
    // instead of the literal, possibly long-completed task it was created from.
    sourceTask: r.sourceRecurrence
      ? { id: r.sourceRecurrence.id, title: r.sourceRecurrence.title, projectName: r.sourceRecurrence.project.name, recurring: true }
      : r.sourceTask
        ? { id: r.sourceTask.id, title: r.sourceTask.title, projectName: r.sourceTask.project.name, recurring: false }
        : null,
    targetTask: r.targetRecurrence
      ? { id: r.targetRecurrence.id, title: r.targetRecurrence.title, projectName: r.targetRecurrence.project.name, recurring: true }
      : r.targetTask
        ? { id: r.targetTask.id, title: r.targetTask.title, projectName: r.targetTask.project.name, recurring: false }
        : null,
    targetSection: r.targetSection
      ? { id: r.targetSection.id, name: r.targetSection.name, projectName: r.targetSection.project.name }
      : null,
    runs: r.runs.map((run) => ({
      id: run.id,
      status: run.status,
      detail: run.detail,
      createdAt: run.createdAt.toISOString(),
    })),
  }));
}

const createAutomationRuleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  sourceTaskId: z.string().min(1, 'Select a source task'),
  triggerType: z.enum(['STATUS_CHANGED', 'ASSIGNEE_CHANGED', 'DUE_DATE_APPROACHING']),
  triggerStatus: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  triggerDaysBefore: z.coerce.number().int().min(0).max(365).optional(),
  actionType: z.enum(['SET_STATUS', 'SET_ASSIGNEE', 'MOVE_SECTION', 'CREATE_TASK']),
  targetTaskId: z.string().optional(),
  actionStatus: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  assigneeMode: z.enum(['SPECIFIC_USER', 'SAME_AS_SOURCE']).optional(),
  actionAssigneeId: z.string().optional(),
  targetSectionId: z.string().optional(),
  newTaskTitle: z.string().max(200).optional(),
  newTaskDescription: z.string().max(4000).optional(),
  newTaskPriority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  newTaskAssigneeId: z.string().optional(),
});

type CreateAutomationRuleInput = z.infer<typeof createAutomationRuleSchema>;

/** Checks the fields required for the chosen trigger/action combination, beyond what zod alone can express. */
function validateRuleShape(data: CreateAutomationRuleInput): string | null {
  if (data.triggerType === 'STATUS_CHANGED' && !data.triggerStatus) {
    return 'Choose the status that triggers this rule';
  }
  if (data.triggerType === 'DUE_DATE_APPROACHING' && data.triggerDaysBefore == null) {
    return 'Enter how many days before the due date this should trigger';
  }
  if (data.actionType === 'SET_STATUS' && (!data.targetTaskId || !data.actionStatus)) {
    return 'Choose a target task and the status to set';
  }
  if (data.actionType === 'SET_ASSIGNEE') {
    if (!data.targetTaskId) return 'Choose a target task';
    if (!data.assigneeMode) return 'Choose how to pick the assignee';
    if (data.assigneeMode === 'SPECIFIC_USER' && !data.actionAssigneeId) return 'Choose who to assign';
  }
  if (data.actionType === 'MOVE_SECTION' && (!data.targetTaskId || !data.targetSectionId)) {
    return 'Choose a target task and a destination section';
  }
  if (data.actionType === 'CREATE_TASK' && (!data.targetSectionId || !data.newTaskTitle)) {
    return 'Choose a destination section and a title for the new task';
  }
  return null;
}

export async function createAutomationRule(input: CreateAutomationRuleInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: 'Not authenticated' };

  const parsed = createAutomationRuleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const data = parsed.data;

  const shapeError = validateRuleShape(data);
  if (shapeError) return { success: false, error: shapeError };

  const sourceTask = await prisma.task.findUnique({ where: { id: data.sourceTaskId } });
  if (!sourceTask) return { success: false, error: 'Source task not found' };
  await requireProjectMember(sourceTask.projectId);

  let targetTask = null;
  if (data.targetTaskId) {
    targetTask = await prisma.task.findUnique({ where: { id: data.targetTaskId } });
    if (!targetTask) return { success: false, error: 'Target task not found' };
    await requireProjectMember(targetTask.projectId);
  }
  if (data.targetSectionId) {
    const targetSection = await prisma.section.findUnique({ where: { id: data.targetSectionId } });
    if (!targetSection) return { success: false, error: 'Target section not found' };
    await requireProjectMember(targetSection.projectId);
  }

  const needsTargetTask = data.actionType === 'SET_STATUS' || data.actionType === 'SET_ASSIGNEE' || data.actionType === 'MOVE_SECTION';

  const rule = await prisma.automationRule.create({
    data: {
      name: data.name,
      createdById: session.user.id,
      sourceTaskId: data.sourceTaskId,
      // Binding to the series (when the picked task recurs) is what lets the rule keep firing
      // past the first completed occurrence — see the doc comment on the schema field.
      sourceRecurrenceId: sourceTask.recurrenceId,
      triggerType: data.triggerType,
      triggerStatus: data.triggerType === 'STATUS_CHANGED' ? data.triggerStatus : null,
      triggerDaysBefore: data.triggerType === 'DUE_DATE_APPROACHING' ? data.triggerDaysBefore : null,
      actionType: data.actionType,
      targetTaskId: needsTargetTask ? data.targetTaskId || null : null,
      targetRecurrenceId: needsTargetTask ? (targetTask?.recurrenceId ?? null) : null,
      actionStatus: data.actionType === 'SET_STATUS' ? data.actionStatus : null,
      assigneeMode: data.actionType === 'SET_ASSIGNEE' ? data.assigneeMode : null,
      actionAssigneeId:
        data.actionType === 'SET_ASSIGNEE' && data.assigneeMode === 'SPECIFIC_USER' ? data.actionAssigneeId : null,
      targetSectionId:
        data.actionType === 'MOVE_SECTION' || data.actionType === 'CREATE_TASK' ? data.targetSectionId : null,
      newTaskTitle: data.actionType === 'CREATE_TASK' ? data.newTaskTitle : null,
      newTaskDescription: data.actionType === 'CREATE_TASK' ? data.newTaskDescription : null,
      newTaskPriority: data.actionType === 'CREATE_TASK' ? (data.newTaskPriority ?? 'MEDIUM') : null,
      newTaskAssigneeId: data.actionType === 'CREATE_TASK' ? data.newTaskAssigneeId : null,
    },
  });

  revalidatePath(`/projects/${sourceTask.projectId}/automations`);
  return { success: true, ruleId: rule.id };
}

export async function toggleAutomationRule(ruleId: string, enabled: boolean) {
  const rule = await prisma.automationRule.findUnique({ where: { id: ruleId }, include: { sourceTask: true } });
  if (!rule) return { success: false, error: 'Rule not found' };
  await requireProjectMember(rule.sourceTask.projectId);

  await prisma.automationRule.update({ where: { id: ruleId }, data: { enabled } });
  revalidatePath(`/projects/${rule.sourceTask.projectId}/automations`);
  return { success: true };
}

export async function deleteAutomationRule(ruleId: string) {
  const rule = await prisma.automationRule.findUnique({ where: { id: ruleId }, include: { sourceTask: true } });
  if (!rule) return { success: false, error: 'Rule not found' };
  await requireProjectMember(rule.sourceTask.projectId);

  await prisma.automationRule.delete({ where: { id: ruleId } });
  revalidatePath(`/projects/${rule.sourceTask.projectId}/automations`);
  return { success: true };
}
