'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireManagerOrAdmin } from '@/lib/permissions';
import { isModuleEnabled } from '@/lib/modules';

export type ActionResult<T = unknown> =
  | ({ success: true } & T)
  | { success: false; error: string };

function requireXpModule(): string | null {
  return isModuleEnabled('xp') ? null : 'The XP module is not enabled for this deployment.';
}

const snapshotSchema = z.object({
  periodDate: z.string().min(1, 'Period date is required'),
  unrestrictedCash: z.coerce.number().min(0),
  annualRevenue: z.coerce.number().min(0),
  annualExpense: z.coerce.number().min(0),
  programExpense: z.coerce.number().min(0),
  personnelCost: z.coerce.number().min(0),
  varianceNote: z.string().trim().optional(),
});

export async function createFinancialSnapshot(input: {
  periodDate: string;
  unrestrictedCash: number;
  annualRevenue: number;
  annualExpense: number;
  programExpense: number;
  personnelCost: number;
  varianceNote?: string;
}): Promise<ActionResult<{ snapshotId: string }>> {
  try {
    const gate = requireXpModule();
    if (gate) return { success: false, error: gate };
    // Financial oversight is leadership-only, matching the module's intent.
    await requireManagerOrAdmin();

    const parsed = snapshotSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid snapshot input' };
    }

    const d = parsed.data;
    const snapshot = await prisma.financialSnapshot.create({
      data: {
        periodDate: new Date(d.periodDate),
        unrestrictedCash: d.unrestrictedCash,
        annualRevenue: d.annualRevenue,
        annualExpense: d.annualExpense,
        programExpense: d.programExpense,
        personnelCost: d.personnelCost,
        varianceNote: d.varianceNote || null,
      },
    });

    revalidatePath('/xp');
    return { success: true, snapshotId: snapshot.id };
  } catch {
    return { success: false, error: 'Could not save the snapshot.' };
  }
}

const budgetLineSchema = z.object({
  fiscalYear: z.coerce.number().int().min(1900).max(2999),
  category: z.string().trim().min(1, 'Category is required'),
  allocatedAmount: z.coerce.number(),
  spentAmount: z.coerce.number().default(0),
  notes: z.string().trim().optional(),
});

export async function createBudgetLine(input: {
  fiscalYear: number;
  category: string;
  allocatedAmount: number;
  spentAmount?: number;
  notes?: string;
}): Promise<ActionResult<{ budgetLineId: string }>> {
  try {
    const gate = requireXpModule();
    if (gate) return { success: false, error: gate };
    await requireManagerOrAdmin();

    const parsed = budgetLineSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid budget line' };
    }

    const line = await prisma.budgetLine.create({
      data: {
        fiscalYear: parsed.data.fiscalYear,
        category: parsed.data.category,
        allocatedAmount: parsed.data.allocatedAmount,
        spentAmount: parsed.data.spentAmount ?? 0,
        notes: parsed.data.notes || null,
      },
    });

    revalidatePath('/xp');
    return { success: true, budgetLineId: line.id };
  } catch {
    return { success: false, error: 'Could not create the budget line.' };
  }
}

const boardPacketSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  meetingDate: z.string().min(1, 'Meeting date is required'),
  summaryNotes: z.string().trim().optional(),
});

export async function createBoardPacket(input: {
  title: string;
  meetingDate: string;
  summaryNotes?: string;
}): Promise<ActionResult<{ packetId: string }>> {
  try {
    const gate = requireXpModule();
    if (gate) return { success: false, error: gate };
    await requireManagerOrAdmin();

    const parsed = boardPacketSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid packet input' };
    }

    const packet = await prisma.boardPacket.create({
      data: {
        title: parsed.data.title,
        meetingDate: new Date(parsed.data.meetingDate),
        summaryNotes: parsed.data.summaryNotes || null,
      },
    });

    revalidatePath('/xp');
    return { success: true, packetId: packet.id };
  } catch {
    return { success: false, error: 'Could not create the board packet.' };
  }
}

export async function requestPacketPrintTask(input: {
  packetId: string;
  packetTitle: string;
  copies: number;
  paperStock: string;
  bindingType: string;
  dueDateTime: string;
  deliverTo: string;
  notes?: string;
}): Promise<ActionResult<{ taskId: string }>> {
  try {
    const gate = requireXpModule();
    if (gate) return { success: false, error: gate };
    const session = await requireManagerOrAdmin();

    let project = await prisma.project.findFirst({
      where: {
        OR: [
          { name: { contains: 'Administration', mode: 'insensitive' } },
          { name: { contains: 'Operations', mode: 'insensitive' } },
          { name: { contains: 'Staff', mode: 'insensitive' } },
        ],
      },
      include: { sections: true },
    });

    if (!project) {
      project = await prisma.project.findFirst({ include: { sections: true } });
    }

    if (!project) {
      return { success: false, error: 'No active project found to assign task to' };
    }

    const todoSection =
      project.sections.find((s) => s.name.toUpperCase() === 'TODO' || s.name.toUpperCase() === 'TO DO') ||
      project.sections[0];

    if (!todoSection) {
      return { success: false, error: 'No section found in project' };
    }

    const taskTitle = `Print & Bind Elder Packet: ${input.packetTitle} (${input.copies} Copies)`;

    const description = `**Elder Board Packet Print Order**
Requested by: **${session.user.name || session.user.email}**

### Production Specifications:
- **Quantity:** ${input.copies} copies
- **Paper Stock:** ${input.paperStock}
- **Binding / Finishing:** ${input.bindingType}
- **Deliver To:** ${input.deliverTo}
- **Deadline:** ${input.dueDateTime}
${input.notes ? `\n**Special Instructions:**\n${input.notes}\n` : ''}
---
[View Board Packet in XP Hub](/xp)`;

    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        sectionId: todoSection.id,
        title: taskTitle,
        description,
        priority: 'HIGH',
        status: 'TODO',
        dueDate: input.dueDateTime ? new Date(input.dueDateTime) : undefined,
      },
    });

    revalidatePath('/xp');
    revalidatePath('/inbox');
    revalidatePath('/dashboard');

    return { success: true, taskId: task.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create print task' };
  }
}
