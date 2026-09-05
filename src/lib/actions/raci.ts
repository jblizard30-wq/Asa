'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSession, requireManagerOrAdmin } from '@/lib/permissions';
import { isModuleEnabled } from '@/lib/modules';

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

const createChartSchema = z.object({
  processName: z.string().trim().min(1, 'Process name is required'),
  owner: z.string().trim().default(''),
  trigger: z.string().trim().default(''),
  ministryArea: z.string().trim().optional(),
});

export async function createRaciChart(input: {
  processName: string;
  owner?: string;
  trigger?: string;
  ministryArea?: string;
}): Promise<ActionResult<{ chartId: string }>> {
  try {
    const gate = requireRaciModule();
    if (gate) return { success: false, error: gate };
    await requireManagerOrAdmin();

    const parsed = createChartSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid chart input' };
    }

    const chart = await prisma.raciChart.create({
      data: {
        processName: parsed.data.processName,
        owner: parsed.data.owner ?? '',
        trigger: parsed.data.trigger ?? '',
        ministryArea: parsed.data.ministryArea || null,
      },
    });

    revalidatePath('/raci');
    return { success: true, chartId: chart.id };
  } catch {
    return { success: false, error: 'Could not create the chart.' };
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
    await requireManagerOrAdmin();

    const parsed = addStepSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid step input' };
    }

    // Append to the end of the chart rather than renumbering existing rows.
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
  } catch {
    return { success: false, error: 'Could not add the step.' };
  }
}

const addPersonSchema = z.object({
  chartId: z.string().min(1),
  name: z.string().trim().min(1, 'Name is required'),
  roleTitle: z.string().trim().default(''),
});

export async function addRaciPerson(input: {
  chartId: string;
  name: string;
  roleTitle?: string;
}): Promise<ActionResult<{ personId: string }>> {
  try {
    const gate = requireRaciModule();
    if (gate) return { success: false, error: gate };
    await requireManagerOrAdmin();

    const parsed = addPersonSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid person input' };
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
        personOrder: (last?.personOrder ?? -1) + 1,
      },
    });

    revalidatePath('/raci');
    return { success: true, personId: person.id };
  } catch {
    return { success: false, error: 'Could not add the person.' };
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
    await requireSession();

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
      create: { stepId, personId, designations },
      update: { designations },
    });

    revalidatePath('/raci');
    return { success: true, cleared: false };
  } catch {
    return { success: false, error: 'Could not update the cell.' };
  }
}
