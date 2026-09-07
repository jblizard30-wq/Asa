'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/permissions';
import { isModuleEnabled } from '@/lib/modules';
import { RaciAccessLevel, RaciRole } from '@prisma/client';

export type ActionResult<T = unknown> =
  | ({ success: true } & T)
  | { success: false; error: string };

/**
 * Server actions are reachable by URL even when the module's pages are not
 * rendered, so the gate is re-checked here rather than relying on the route.
 */
function requireRaciModule(): string | null {
  return isModuleEnabled('raci') ? null : 'The RACI module is not enabled for this deployment.';
}

export async function canUserEditChart(
  userId: string,
  userRole: string,
  chartId: string
): Promise<boolean> {
  if (userRole === 'ADMIN') return true;

  const chart = await prisma.raciChart.findUnique({
    where: { id: chartId },
    include: { shares: true },
  });
  if (!chart) return false;

  if (chart.createdById === userId) return true;
  if (userRole === 'MANAGER' && chart.isPublic) return true;

  const directShare = chart.shares.find((s) => s.userId === userId);
  if (directShare && directShare.access === 'EDIT') return true;

  const userTeams = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });
  const userTeamIds = new Set(userTeams.map((t) => t.teamId));

  const teamShare = chart.shares.find(
    (s) => s.teamId && userTeamIds.has(s.teamId) && s.access === 'EDIT'
  );
  if (teamShare) return true;

  return false;
}

const createChartSchema = z.object({
  processName: z.string().trim().min(1, 'Process name is required'),
  owner: z.string().trim().default(''),
  trigger: z.string().trim().default(''),
  ministryArea: z.string().trim().optional(),
  tags: z.array(z.string().trim()).default([]),
  isPublic: z.boolean().default(true),
});

export async function createRaciChart(input: {
  processName: string;
  owner?: string;
  trigger?: string;
  ministryArea?: string;
  tags?: string[];
  isPublic?: boolean;
}): Promise<ActionResult<{ chartId: string }>> {
  try {
    const gate = requireRaciModule();
    if (gate) return { success: false, error: gate };
    const session = await requireSession();

    const parsed = createChartSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid chart input' };
    }

    // Clean tags: trim, lowercase or normalize, remove duplicates and empties
    const cleanedTags = Array.from(
      new Set(parsed.data.tags.map((t) => t.trim().replace(/^#+/, '')).filter(Boolean))
    );

    const chart = await prisma.raciChart.create({
      data: {
        processName: parsed.data.processName,
        owner: parsed.data.owner ?? '',
        trigger: parsed.data.trigger ?? '',
        ministryArea: parsed.data.ministryArea || null,
        tags: cleanedTags,
        isPublic: parsed.data.isPublic,
        createdById: session.user.id,
      },
    });

    revalidatePath('/raci');
    return { success: true, chartId: chart.id };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Could not create the chart.' };
  }
}

const updateChartSchema = z.object({
  chartId: z.string().min(1),
  processName: z.string().trim().min(1).optional(),
  owner: z.string().trim().optional(),
  trigger: z.string().trim().optional(),
  ministryArea: z.string().trim().nullable().optional(),
  tags: z.array(z.string().trim()).optional(),
  isPublic: z.boolean().optional(),
});

export async function updateRaciChart(input: {
  chartId: string;
  processName?: string;
  owner?: string;
  trigger?: string;
  ministryArea?: string | null;
  tags?: string[];
  isPublic?: boolean;
}): Promise<ActionResult> {
  try {
    const gate = requireRaciModule();
    if (gate) return { success: false, error: gate };
    const session = await requireSession();

    const parsed = updateChartSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid update input' };
    }

    const canEdit = await canUserEditChart(session.user.id, session.user.role, parsed.data.chartId);
    if (!canEdit) {
      return { success: false, error: 'You do not have permission to edit this chart.' };
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.processName !== undefined) data.processName = parsed.data.processName;
    if (parsed.data.owner !== undefined) data.owner = parsed.data.owner;
    if (parsed.data.trigger !== undefined) data.trigger = parsed.data.trigger;
    if (parsed.data.ministryArea !== undefined) data.ministryArea = parsed.data.ministryArea;
    if (parsed.data.isPublic !== undefined) data.isPublic = parsed.data.isPublic;
    if (parsed.data.tags !== undefined) {
      data.tags = Array.from(
        new Set(parsed.data.tags.map((t) => t.trim().replace(/^#+/, '')).filter(Boolean))
      );
    }

    await prisma.raciChart.update({
      where: { id: parsed.data.chartId },
      data,
    });

    revalidatePath('/raci');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Could not update the chart.' };
  }
}

export async function archiveRaciChart(input: { chartId: string }): Promise<ActionResult> {
  try {
    const gate = requireRaciModule();
    if (gate) return { success: false, error: gate };
    const session = await requireSession();

    const canEdit = await canUserEditChart(session.user.id, session.user.role, input.chartId);
    if (!canEdit) {
      return { success: false, error: 'You do not have permission to delete this chart.' };
    }

    await prisma.raciChart.update({
      where: { id: input.chartId },
      data: { archivedAt: new Date() },
    });

    revalidatePath('/raci');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Could not archive the chart.' };
  }
}

const shareChartSchema = z.object({
  chartId: z.string().min(1),
  targetType: z.enum(['USER', 'TEAM']),
  targetId: z.string().min(1),
  access: z.enum(['VIEW', 'EDIT']),
});

export async function shareRaciChart(input: {
  chartId: string;
  targetType: 'USER' | 'TEAM';
  targetId: string;
  access: 'VIEW' | 'EDIT';
}): Promise<ActionResult<{ shareId: string }>> {
  try {
    const gate = requireRaciModule();
    if (gate) return { success: false, error: gate };
    const session = await requireSession();

    const parsed = shareChartSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid share input' };
    }

    const canEdit = await canUserEditChart(session.user.id, session.user.role, parsed.data.chartId);
    if (!canEdit) {
      return { success: false, error: 'You do not have permission to manage shares for this chart.' };
    }

    const accessLevel = parsed.data.access as RaciAccessLevel;

    let share;
    if (parsed.data.targetType === 'USER') {
      share = await prisma.raciChartShare.upsert({
        where: {
          chartId_userId: {
            chartId: parsed.data.chartId,
            userId: parsed.data.targetId,
          },
        },
        create: {
          chartId: parsed.data.chartId,
          userId: parsed.data.targetId,
          access: accessLevel,
        },
        update: {
          access: accessLevel,
        },
      });
    } else {
      share = await prisma.raciChartShare.upsert({
        where: {
          chartId_teamId: {
            chartId: parsed.data.chartId,
            teamId: parsed.data.targetId,
          },
        },
        create: {
          chartId: parsed.data.chartId,
          teamId: parsed.data.targetId,
          access: accessLevel,
        },
        update: {
          access: accessLevel,
        },
      });
    }

    revalidatePath('/raci');
    return { success: true, shareId: share.id };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Could not share the chart.' };
  }
}

export async function removeRaciChartShare(input: { shareId: string }): Promise<ActionResult> {
  try {
    const gate = requireRaciModule();
    if (gate) return { success: false, error: gate };
    const session = await requireSession();

    const existing = await prisma.raciChartShare.findUnique({
      where: { id: input.shareId },
    });
    if (!existing) return { success: true };

    const canEdit = await canUserEditChart(session.user.id, session.user.role, existing.chartId);
    if (!canEdit) {
      return { success: false, error: 'You do not have permission to remove shares for this chart.' };
    }

    await prisma.raciChartShare.delete({
      where: { id: input.shareId },
    });

    revalidatePath('/raci');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Could not remove the share.' };
  }
}

const addStepSchema = z.object({
  chartId: z.string().min(1),
  stepName: z.string().trim().min(1, 'Step name is required'),
});

export async function addRaciStep(input: {
  chartId: string;
  stepName: string;
}): Promise<ActionResult<{ stepId: string }>> {
  try {
    const gate = requireRaciModule();
    if (gate) return { success: false, error: gate };
    const session = await requireSession();

    const parsed = addStepSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid step input' };
    }

    const canEdit = await canUserEditChart(session.user.id, session.user.role, parsed.data.chartId);
    if (!canEdit) {
      return { success: false, error: 'You do not have permission to edit this chart.' };
    }

    const last = await prisma.raciStep.findFirst({
      where: { chartId: parsed.data.chartId },
      orderBy: { stepOrder: 'desc' },
      select: { stepOrder: true },
    });

    const step = await prisma.raciStep.create({
      data: {
        chartId: parsed.data.chartId,
        stepName: parsed.data.stepName,
        stepOrder: (last?.stepOrder ?? -1) + 1,
      },
    });

    revalidatePath('/raci');
    return { success: true, stepId: step.id };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Could not add the step.' };
  }
}

export async function bulkAddRaciSteps(input: {
  chartId: string;
  stepNames: string[];
}): Promise<ActionResult<{ count: number }>> {
  try {
    const gate = requireRaciModule();
    if (gate) return { success: false, error: gate };
    const session = await requireSession();

    const validNames = input.stepNames.map((s) => s.trim()).filter(Boolean);
    if (validNames.length === 0) {
      return { success: false, error: 'No valid step names provided.' };
    }

    const canEdit = await canUserEditChart(session.user.id, session.user.role, input.chartId);
    if (!canEdit) {
      return { success: false, error: 'You do not have permission to edit this chart.' };
    }

    const last = await prisma.raciStep.findFirst({
      where: { chartId: input.chartId },
      orderBy: { stepOrder: 'desc' },
      select: { stepOrder: true },
    });

    let currentOrder = (last?.stepOrder ?? -1) + 1;
    await prisma.$transaction(
      validNames.map((name) =>
        prisma.raciStep.create({
          data: {
            chartId: input.chartId,
            stepName: name,
            stepOrder: currentOrder++,
          },
        })
      )
    );

    revalidatePath('/raci');
    return { success: true, count: validNames.length };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Could not add steps.' };
  }
}

export async function updateRaciStep(input: {
  stepId: string;
  stepName: string;
}): Promise<ActionResult> {
  try {
    const gate = requireRaciModule();
    if (gate) return { success: false, error: gate };
    const session = await requireSession();

    const step = await prisma.raciStep.findUnique({
      where: { id: input.stepId },
      select: { chartId: true },
    });
    if (!step) return { success: false, error: 'Step not found.' };

    const canEdit = await canUserEditChart(session.user.id, session.user.role, step.chartId);
    if (!canEdit) {
      return { success: false, error: 'You do not have permission to edit this step.' };
    }

    await prisma.raciStep.update({
      where: { id: input.stepId },
      data: { stepName: input.stepName.trim() },
    });

    revalidatePath('/raci');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Could not update the step.' };
  }
}

export async function deleteRaciStep(input: { stepId: string }): Promise<ActionResult> {
  try {
    const gate = requireRaciModule();
    if (gate) return { success: false, error: gate };
    const session = await requireSession();

    const step = await prisma.raciStep.findUnique({
      where: { id: input.stepId },
      select: { chartId: true },
    });
    if (!step) return { success: true };

    const canEdit = await canUserEditChart(session.user.id, session.user.role, step.chartId);
    if (!canEdit) {
      return { success: false, error: 'You do not have permission to delete this step.' };
    }

    await prisma.raciStep.delete({
      where: { id: input.stepId },
    });

    revalidatePath('/raci');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Could not delete the step.' };
  }
}

export async function reorderRaciSteps(input: {
  chartId: string;
  stepIds: string[];
}): Promise<ActionResult> {
  try {
    const gate = requireRaciModule();
    if (gate) return { success: false, error: gate };
    const session = await requireSession();

    const canEdit = await canUserEditChart(session.user.id, session.user.role, input.chartId);
    if (!canEdit) {
      return { success: false, error: 'You do not have permission to reorder steps.' };
    }

    await prisma.$transaction(
      input.stepIds.map((id, index) =>
        prisma.raciStep.update({
          where: { id },
          data: { stepOrder: index },
        })
      )
    );

    revalidatePath('/raci');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Could not reorder steps.' };
  }
}

const addPersonSchema = z.object({
  chartId: z.string().min(1),
  name: z.string().trim().min(1, 'Name is required'),
  roleTitle: z.string().trim().default(''),
  userId: z.string().optional().nullable(),
});

export async function addRaciPerson(input: {
  chartId: string;
  name: string;
  roleTitle?: string;
  userId?: string | null;
}): Promise<ActionResult<{ personId: string }>> {
  try {
    const gate = requireRaciModule();
    if (gate) return { success: false, error: gate };
    const session = await requireSession();

    const parsed = addPersonSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid person input' };
    }

    const canEdit = await canUserEditChart(session.user.id, session.user.role, parsed.data.chartId);
    if (!canEdit) {
      return { success: false, error: 'You do not have permission to edit this chart.' };
    }

    // Try auto-linking userId if not explicitly provided but matches existing user name
    let resolvedUserId = parsed.data.userId || null;
    if (!resolvedUserId && prisma.user?.findFirst) {
      const match = await prisma.user.findFirst({
        where: { name: { equals: parsed.data.name, mode: 'insensitive' } },
        select: { id: true },
      });
      if (match) resolvedUserId = match.id;
    }

    const last = await prisma.raciPerson.findFirst({
      where: { chartId: parsed.data.chartId },
      orderBy: { personOrder: 'desc' },
      select: { personOrder: true },
    });

    const person = await prisma.raciPerson.create({
      data: {
        chartId: parsed.data.chartId,
        name: parsed.data.name,
        roleTitle: parsed.data.roleTitle ?? '',
        userId: resolvedUserId,
        personOrder: (last?.personOrder ?? -1) + 1,
      },
    });

    revalidatePath('/raci');
    return { success: true, personId: person.id };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Could not add the person.' };
  }
}

export async function updateRaciPerson(input: {
  personId: string;
  name: string;
  roleTitle?: string;
  userId?: string | null;
}): Promise<ActionResult> {
  try {
    const gate = requireRaciModule();
    if (gate) return { success: false, error: gate };
    const session = await requireSession();

    const person = await prisma.raciPerson.findUnique({
      where: { id: input.personId },
      select: { chartId: true },
    });
    if (!person) return { success: false, error: 'Person/Role not found.' };

    const canEdit = await canUserEditChart(session.user.id, session.user.role, person.chartId);
    if (!canEdit) {
      return { success: false, error: 'You do not have permission to edit this column.' };
    }

    let resolvedUserId = input.userId;
    if (resolvedUserId === undefined && prisma.user?.findFirst) {
      const match = await prisma.user.findFirst({
        where: { name: { equals: input.name.trim(), mode: 'insensitive' } },
        select: { id: true },
      });
      if (match) resolvedUserId = match.id;
    }

    await prisma.raciPerson.update({
      where: { id: input.personId },
      data: {
        name: input.name.trim(),
        roleTitle: (input.roleTitle ?? '').trim(),
        ...(resolvedUserId !== undefined ? { userId: resolvedUserId } : {}),
      },
    });

    revalidatePath('/raci');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Could not update the person.' };
  }
}

export async function deleteRaciPerson(input: { personId: string }): Promise<ActionResult> {
  try {
    const gate = requireRaciModule();
    if (gate) return { success: false, error: gate };
    const session = await requireSession();

    const person = await prisma.raciPerson.findUnique({
      where: { id: input.personId },
      select: { chartId: true },
    });
    if (!person) return { success: true };

    const canEdit = await canUserEditChart(session.user.id, session.user.role, person.chartId);
    if (!canEdit) {
      return { success: false, error: 'You do not have permission to delete this column.' };
    }

    await prisma.raciPerson.delete({
      where: { id: input.personId },
    });

    revalidatePath('/raci');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Could not delete the person.' };
  }
}

export async function reorderRaciPeople(input: {
  chartId: string;
  personIds: string[];
}): Promise<ActionResult> {
  try {
    const gate = requireRaciModule();
    if (gate) return { success: false, error: gate };
    const session = await requireSession();

    const canEdit = await canUserEditChart(session.user.id, session.user.role, input.chartId);
    if (!canEdit) {
      return { success: false, error: 'You do not have permission to reorder columns.' };
    }

    await prisma.$transaction(
      input.personIds.map((id, index) =>
        prisma.raciPerson.update({
          where: { id },
          data: { personOrder: index },
        })
      )
    );

    revalidatePath('/raci');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Could not reorder columns.' };
  }
}

const RACI_ROLES = ['RESPONSIBLE', 'ACCOUNTABLE', 'CONSULTED', 'INFORMED'] as const;

const setCellSchema = z.object({
  stepId: z.string().min(1),
  personId: z.string().min(1),
  designations: z.array(z.enum(RACI_ROLES)),
});

/**
 * Writes one matrix cell. An empty `designations` list deletes the cell rather
 * than storing an empty array, so "no relationship" and "a relationship with no
 * letters" cannot drift apart.
 */
export async function setRaciCell(input: {
  stepId: string;
  personId: string;
  designations: string[];
}): Promise<ActionResult<{ cleared: boolean }>> {
  try {
    const gate = requireRaciModule();
    if (gate) return { success: false, error: gate };
    const session = await requireSession();

    const step = await prisma.raciStep.findUnique({
      where: { id: input.stepId },
      select: { chartId: true },
    });
    if (!step) return { success: false, error: 'Step not found.' };

    const canEdit = await canUserEditChart(session.user.id, session.user.role, step.chartId);
    if (!canEdit) {
      return { success: false, error: 'You do not have permission to edit this chart.' };
    }

    const parsed = setCellSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid cell input' };
    }

    const { stepId, personId, designations } = parsed.data;

    if (designations.length === 0) {
      await prisma.raciAssignment.deleteMany({ where: { stepId, personId } });
      revalidatePath('/raci');
      return { success: true, cleared: true };
    }

    await prisma.raciAssignment.upsert({
      where: { stepId_personId: { stepId, personId } },
      create: { stepId, personId, designations: designations as RaciRole[] },
      update: { designations: designations as RaciRole[] },
    });

    revalidatePath('/raci');
    return { success: true, cleared: false };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Could not update the cell.' };
  }
}

export async function instantiateRaciAsProject(
  chartId: string
): Promise<ActionResult<{ projectId: string }>> {
  try {
    const gate = requireRaciModule();
    if (gate) return { success: false, error: gate };
    const session = await requireSession();

    const chart = await prisma.raciChart.findUnique({
      where: { id: chartId },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
          include: {
            assignments: {
              include: {
                person: true,
              },
            },
          },
        },
        people: {
          orderBy: { personOrder: 'asc' },
        },
      },
    });

    if (!chart || chart.archivedAt) {
      return { success: false, error: 'RACI chart not found.' };
    }

    const canEdit = await canUserEditChart(session.user.id, session.user.role, chartId);
    if (!canEdit) {
      return { success: false, error: 'You do not have permission to instantiate this chart.' };
    }

    // Create the Project with standard operational sections
    const project = await prisma.project.create({
      data: {
        name: `${chart.processName} (Execution)`,
        description: `Operational project instantiated from RACI matrix: ${chart.processName}.\nOwner: ${chart.owner || 'Unassigned'}\nTrigger: ${chart.trigger || 'Standard Rhythm'}`,
        createdById: session.user.id,
        members: {
          create: {
            userId: session.user.id,
            isManager: true,
          },
        },
        sections: {
          create: [
            { name: 'To Do', order: 0 },
            { name: 'In Progress', order: 1 },
            { name: 'Review & Sign-Off', order: 2 },
            { name: 'Completed', order: 3 },
          ],
        },
      },
      include: {
        sections: true,
      },
    });

    const todoSection = project.sections.find((s) => s.name === 'To Do') || project.sections[0];
    const projectMemberIds = new Set<string>([session.user.id]);

    for (const step of chart.steps) {
      const rPeople = step.assignments.filter((a) => a.designations.includes('RESPONSIBLE')).map((a) => a.person);
      const aPeople = step.assignments.filter((a) => a.designations.includes('ACCOUNTABLE')).map((a) => a.person);
      const cPeople = step.assignments.filter((a) => a.designations.includes('CONSULTED')).map((a) => a.person);
      const iPeople = step.assignments.filter((a) => a.designations.includes('INFORMED')).map((a) => a.person);

      const rNames = rPeople.map((p) => p.name).join(', ') || 'Unassigned';
      const aNames = aPeople.map((p) => p.name).join(', ') || 'None designated';
      const cNames = cPeople.map((p) => p.name).join(', ') || 'None';
      const iNames = iPeople.map((p) => p.name).join(', ') || 'None';

      const breakdown = [
        `**RACI Matrix Breakdown** (from [${chart.processName}](/raci)):`,
        `- **Responsible (R)**: ${rNames}`,
        `- **Accountable (A)**: ${aNames}`,
        `- **Consulted (C)**: ${cNames}`,
        `- **Informed (I)**: ${iNames}`,
      ].join('\n');

      const primaryResponsibleUserId = rPeople.find((p) => p.userId)?.userId;
      if (primaryResponsibleUserId) {
        projectMemberIds.add(primaryResponsibleUserId);
      }

      await prisma.task.create({
        data: {
          title: step.stepName,
          description: breakdown,
          projectId: project.id,
          sectionId: todoSection.id,
          order: step.stepOrder,
          priority: 'MEDIUM',
          assignees: primaryResponsibleUserId
            ? { connect: [{ id: primaryResponsibleUserId }] }
            : undefined,
        },
      });
    }

    for (const memberId of projectMemberIds) {
      if (memberId !== session.user.id) {
        await prisma.projectMember.create({
          data: {
            projectId: project.id,
            userId: memberId,
            isManager: false,
          },
        }).catch(() => {});
      }
    }

    revalidatePath('/projects');
    revalidatePath(`/projects/${project.id}`);
    revalidatePath(`/raci/${chartId}`);
    return { success: true, projectId: project.id };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Could not instantiate project from RACI chart.' };
  }
}

