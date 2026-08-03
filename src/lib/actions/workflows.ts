'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/permissions';
import { requireProjectMember } from '@/lib/actions/tasks';

const PRIORITY_VALUES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

// ---------- Admin: workflow list / CRUD ----------

export async function getWorkflowsForAdmin() {
  await requireAdmin();

  const workflows = await prisma.workflow.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      team: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      stages: { select: { id: true, taskTemplates: { select: { id: true } } } },
    },
  });

  return workflows.map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    isTemplate: w.isTemplate,
    team: w.team,
    createdByName: w.createdBy.name,
    stageCount: w.stages.length,
    taskCount: w.stages.reduce((sum, s) => sum + s.taskTemplates.length, 0),
  }));
}

export async function getTeamsForWorkflowPicker() {
  await requireAdmin();
  return prisma.team.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });
}

const workflowSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  description: z.string().max(2000).optional(),
  teamId: z.string().optional(),
  isTemplate: z.boolean().optional(),
});

export async function createWorkflow(input: z.infer<typeof workflowSchema>) {
  const session = await requireAdmin();

  const parsed = workflowSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const workflow = await prisma.workflow.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      teamId: parsed.data.teamId || null,
      isTemplate: parsed.data.isTemplate ?? false,
      createdById: session.user.id,
    },
  });

  revalidatePath('/admin/workflows');
  return { success: true, workflowId: workflow.id };
}

export async function updateWorkflow(workflowId: string, input: Partial<z.infer<typeof workflowSchema>>) {
  await requireAdmin();

  const parsed = workflowSchema.partial().safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  await prisma.workflow.update({
    where: { id: workflowId },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description || null } : {}),
      ...(parsed.data.teamId !== undefined ? { teamId: parsed.data.teamId || null } : {}),
      ...(parsed.data.isTemplate !== undefined ? { isTemplate: parsed.data.isTemplate } : {}),
    },
  });

  revalidatePath('/admin/workflows');
  return { success: true };
}

export async function deleteWorkflow(workflowId: string): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  await prisma.workflow.delete({ where: { id: workflowId } });
  revalidatePath('/admin/workflows');
  return { success: true };
}

/** Deep-clones a workflow's stages/task-templates/subtask-templates into a brand new workflow — the templating mechanism. */
export async function duplicateWorkflow(workflowId: string, newName: string) {
  const session = await requireAdmin();

  const source = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
      stages: {
        orderBy: { order: 'asc' },
        include: {
          taskTemplates: {
            where: { parentId: null },
            orderBy: { order: 'asc' },
            include: { subtasks: { orderBy: { order: 'asc' } } },
          },
        },
      },
    },
  });
  if (!source) return { success: false, error: 'Workflow not found' };

  const name = newName.trim() || `${source.name} (copy)`;

  const newWorkflowId = await prisma.$transaction(async (tx) => {
    const clone = await tx.workflow.create({
      data: {
        name,
        description: source.description,
        teamId: source.teamId,
        isTemplate: false,
        createdById: session.user.id,
      },
    });

    for (const stage of source.stages) {
      const newStage = await tx.workflowStage.create({
        data: { workflowId: clone.id, name: stage.name, order: stage.order },
      });

      for (const template of stage.taskTemplates) {
        const newTemplate = await tx.workflowTaskTemplate.create({
          data: {
            stageId: newStage.id,
            title: template.title,
            description: template.description,
            order: template.order,
            defaultPriority: template.defaultPriority,
          },
        });

        for (const sub of template.subtasks) {
          await tx.workflowTaskTemplate.create({
            data: {
              stageId: newStage.id,
              parentId: newTemplate.id,
              title: sub.title,
              description: sub.description,
              order: sub.order,
              defaultPriority: sub.defaultPriority,
            },
          });
        }
      }
    }

    return clone.id;
  });

  revalidatePath('/admin/workflows');
  return { success: true, workflowId: newWorkflowId };
}

export async function getWorkflowDetail(workflowId: string) {
  await requireAdmin();

  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
      team: { select: { id: true, name: true } },
      stages: {
        orderBy: { order: 'asc' },
        include: {
          taskTemplates: {
            where: { parentId: null },
            orderBy: { order: 'asc' },
            include: { subtasks: { orderBy: { order: 'asc' } } },
          },
        },
      },
    },
  });
  if (!workflow) return null;

  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    isTemplate: workflow.isTemplate,
    teamId: workflow.teamId,
    team: workflow.team,
    stages: workflow.stages.map((s) => ({
      id: s.id,
      name: s.name,
      taskTemplates: s.taskTemplates.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        defaultPriority: t.defaultPriority,
        subtasks: t.subtasks.map((sub) => ({
          id: sub.id,
          title: sub.title,
          description: sub.description,
          defaultPriority: sub.defaultPriority,
        })),
      })),
    })),
  };
}

// ---------- Admin: stage CRUD ----------

export async function addStage(workflowId: string, name: string) {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: 'Stage name is required' };

  const last = await prisma.workflowStage.findFirst({ where: { workflowId }, orderBy: { order: 'desc' } });
  await prisma.workflowStage.create({ data: { workflowId, name: trimmed, order: (last?.order ?? -1) + 1 } });

  revalidatePath('/admin/workflows');
  return { success: true };
}

export async function renameStage(stageId: string, name: string) {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: 'Stage name is required' };

  await prisma.workflowStage.update({ where: { id: stageId }, data: { name: trimmed } });
  revalidatePath('/admin/workflows');
  return { success: true };
}

export async function deleteStage(stageId: string): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  await prisma.workflowStage.delete({ where: { id: stageId } });
  revalidatePath('/admin/workflows');
  return { success: true };
}

export async function moveStage(stageId: string, direction: 'up' | 'down') {
  await requireAdmin();

  const stage = await prisma.workflowStage.findUnique({ where: { id: stageId } });
  if (!stage) return { success: false, error: 'Stage not found' };

  const neighbor = await prisma.workflowStage.findFirst({
    where: { workflowId: stage.workflowId, order: direction === 'up' ? { lt: stage.order } : { gt: stage.order } },
    orderBy: { order: direction === 'up' ? 'desc' : 'asc' },
  });
  if (!neighbor) return { success: true };

  await prisma.$transaction([
    prisma.workflowStage.update({ where: { id: stage.id }, data: { order: neighbor.order } }),
    prisma.workflowStage.update({ where: { id: neighbor.id }, data: { order: stage.order } }),
  ]);

  revalidatePath('/admin/workflows');
  return { success: true };
}

// ---------- Admin: task-template CRUD ----------

const taskTemplateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  defaultPriority: z.enum(PRIORITY_VALUES).optional(),
  parentId: z.string().optional(),
});

export async function addTaskTemplate(stageId: string, input: z.infer<typeof taskTemplateSchema>) {
  await requireAdmin();

  const parsed = taskTemplateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const last = await prisma.workflowTaskTemplate.findFirst({
    where: parsed.data.parentId ? { parentId: parsed.data.parentId } : { stageId, parentId: null },
    orderBy: { order: 'desc' },
  });

  await prisma.workflowTaskTemplate.create({
    data: {
      stageId,
      parentId: parsed.data.parentId || null,
      title: parsed.data.title,
      description: parsed.data.description || null,
      defaultPriority: parsed.data.defaultPriority ?? 'MEDIUM',
      order: (last?.order ?? -1) + 1,
    },
  });

  revalidatePath('/admin/workflows');
  return { success: true };
}

export async function updateTaskTemplate(id: string, input: Partial<z.infer<typeof taskTemplateSchema>>) {
  await requireAdmin();

  const parsed = taskTemplateSchema.partial().safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  await prisma.workflowTaskTemplate.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description || null } : {}),
      ...(parsed.data.defaultPriority !== undefined ? { defaultPriority: parsed.data.defaultPriority } : {}),
    },
  });

  revalidatePath('/admin/workflows');
  return { success: true };
}

export async function deleteTaskTemplate(id: string): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  await prisma.workflowTaskTemplate.delete({ where: { id } });
  revalidatePath('/admin/workflows');
  return { success: true };
}

export async function moveTaskTemplate(id: string, direction: 'up' | 'down') {
  await requireAdmin();

  const template = await prisma.workflowTaskTemplate.findUnique({ where: { id } });
  if (!template) return { success: false, error: 'Task not found' };

  const neighbor = await prisma.workflowTaskTemplate.findFirst({
    where: {
      stageId: template.stageId,
      parentId: template.parentId,
      order: direction === 'up' ? { lt: template.order } : { gt: template.order },
    },
    orderBy: { order: direction === 'up' ? 'desc' : 'asc' },
  });
  if (!neighbor) return { success: true };

  await prisma.$transaction([
    prisma.workflowTaskTemplate.update({ where: { id: template.id }, data: { order: neighbor.order } }),
    prisma.workflowTaskTemplate.update({ where: { id: neighbor.id }, data: { order: template.order } }),
  ]);

  revalidatePath('/admin/workflows');
  return { success: true };
}

// ---------- Project-facing: apply workflow + branch map ----------

export async function getWorkflowOptionsForProject(projectId: string) {
  await requireProjectMember(projectId);

  const workflows = await prisma.workflow.findMany({
    orderBy: [{ isTemplate: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, isTemplate: true, team: { select: { name: true } } },
  });

  return workflows.map((w) => ({ id: w.id, name: w.name, isTemplate: w.isTemplate, teamName: w.team?.name ?? null }));
}

/** Instantiates a workflow's stages/task-templates as real Sections/Tasks in the given project. */
export async function applyWorkflowToProject(projectId: string, workflowId: string) {
  await requireProjectMember(projectId);

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { success: false, error: 'Project not found' };
  if (project.workflowId) return { success: false, error: 'This project already has a workflow applied.' };

  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
      stages: {
        orderBy: { order: 'asc' },
        include: {
          taskTemplates: {
            where: { parentId: null },
            orderBy: { order: 'asc' },
            include: { subtasks: { orderBy: { order: 'asc' } } },
          },
        },
      },
    },
  });
  if (!workflow) return { success: false, error: 'Workflow not found' };

  const lastSection = await prisma.section.findFirst({ where: { projectId }, orderBy: { order: 'desc' } });
  let sectionOrder = (lastSection?.order ?? -1) + 1;

  await prisma.$transaction(async (tx) => {
    for (const stage of workflow.stages) {
      const section = await tx.section.create({ data: { projectId, name: stage.name, order: sectionOrder++ } });

      let taskOrder = 0;
      for (const template of stage.taskTemplates) {
        const task = await tx.task.create({
          data: {
            projectId,
            sectionId: section.id,
            title: template.title,
            description: template.description,
            priority: template.defaultPriority,
            order: taskOrder++,
          },
        });

        let subtaskOrder = 0;
        for (const sub of template.subtasks) {
          await tx.task.create({
            data: {
              projectId,
              sectionId: section.id,
              parentTaskId: task.id,
              title: sub.title,
              description: sub.description,
              priority: sub.defaultPriority,
              order: subtaskOrder++,
            },
          });
        }
      }
    }

    await tx.project.update({ where: { id: projectId }, data: { workflowId } });
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/workflow`);
  return { success: true };
}

/** Composes a factual, editable summary of the project's settings — the starting point for the print write-up. */
export async function generateSettingsWriteup(projectId: string) {
  await requireProjectMember(projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      workflow: { include: { team: { select: { name: true } } } },
      members: { include: { user: { select: { name: true } } } },
      customFields: { select: { name: true, type: true } },
      tags: { select: { name: true } },
      sections: { select: { id: true } },
    },
  });
  if (!project) return { success: false, error: 'Project not found' };

  const [taskCount, automationRules] = await Promise.all([
    prisma.task.count({ where: { projectId, deletedAt: null } }),
    prisma.automationRule.findMany({
      where: { OR: [{ sourceTask: { projectId } }, { targetTask: { projectId } }, { targetSection: { projectId } }] },
      select: { name: true, enabled: true },
    }),
  ]);

  const lines: string[] = [];
  lines.push(`Project: ${project.name}`);
  if (project.description) lines.push(project.description);
  if (project.workflow) {
    lines.push(`Workflow: ${project.workflow.name}${project.workflow.team ? ` (${project.workflow.team.name} team)` : ''}`);
  }
  lines.push('');
  lines.push(`Members (${project.members.length}): ${project.members.map((m) => m.user.name).join(', ') || 'None'}`);
  lines.push(`Sections: ${project.sections.length}, Tasks: ${taskCount}`);
  if (project.customFields.length > 0) {
    lines.push(`Custom fields: ${project.customFields.map((f) => `${f.name} (${f.type})`).join(', ')}`);
  }
  if (project.tags.length > 0) {
    lines.push(`Tags: ${project.tags.map((t) => t.name).join(', ')}`);
  }
  if (automationRules.length > 0) {
    lines.push(`Automation rules: ${automationRules.map((r) => `${r.name}${r.enabled ? '' : ' (disabled)'}`).join(', ')}`);
  }

  return { success: true, text: lines.join('\n') };
}

export async function saveSettingsWriteup(projectId: string, text: string): Promise<{ success: boolean; error?: string }> {
  await requireProjectMember(projectId);
  await prisma.project.update({ where: { id: projectId }, data: { settingsWriteup: text } });
  revalidatePath(`/projects/${projectId}/workflow`);
  return { success: true };
}

export async function getBranchMapData(projectId: string) {
  await requireProjectMember(projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      workflow: { include: { team: { select: { name: true } } } },
      sections: {
        orderBy: { order: 'asc' },
        include: {
          tasks: {
            where: { deletedAt: null, parentTaskId: null },
            orderBy: { order: 'asc' },
            include: {
              assignee: { select: { name: true } },
              subtasks: {
                where: { deletedAt: null },
                orderBy: { order: 'asc' },
                include: { assignee: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!project) return null;

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    settingsWriteup: project.settingsWriteup,
    workflow: project.workflow
      ? { id: project.workflow.id, name: project.workflow.name, teamName: project.workflow.team?.name ?? null }
      : null,
    sections: project.sections.map((s) => ({
      id: s.id,
      name: s.name,
      tasks: s.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        assigneeName: t.assignee?.name ?? null,
        subtasks: t.subtasks.map((sub) => ({
          id: sub.id,
          title: sub.title,
          status: sub.status,
          priority: sub.priority,
          assigneeName: sub.assignee?.name ?? null,
        })),
      })),
    })),
  };
}
