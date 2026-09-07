'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireManagerOrAdmin } from '@/lib/permissions';
import { isModuleEnabled } from '@/lib/modules';
import { getToolDefinition } from '@/lib/tools/registry';
import { getStarterDataForTool, getDefaultDataForPrimitive } from '@/lib/tools/starterTemplates';
import type { Prisma } from '@prisma/client';

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

// ---------------------------------------------------------------------------
// Strategic Frameworks Lifecycle & Packet Bundling
// ---------------------------------------------------------------------------

export interface BoardPacketItemRef {
  id: string;
  type: 'framework' | 'cover' | 'raci' | 'note';
  frameworkId?: string;
  toolId?: string;
  title: string;
  notes?: string | null;
  order: number;
}

export async function createStrategicFramework(input: {
  toolId: string;
  title?: string;
  useTemplate?: boolean;
  packetId?: string;
}): Promise<ActionResult<{ frameworkId: string }>> {
  try {
    const gate = requireXpModule();
    if (gate) return { success: false, error: gate };
    const session = await requireManagerOrAdmin();

    const def = getToolDefinition(input.toolId);
    if (!def) {
      return { success: false, error: `Unknown strategic framework: ${input.toolId}` };
    }

    const title = input.title?.trim() || `New ${def.name}`;
    let initialData: unknown = null;

    if (input.useTemplate) {
      initialData = getStarterDataForTool(input.toolId);
    }
    if (!initialData) {
      initialData = getDefaultDataForPrimitive(def.primitive, def.config);
    }

    const framework = await prisma.strategicFramework.create({
      data: {
        toolId: input.toolId,
        title,
        data: initialData as Prisma.InputJsonValue,
        status: 'draft',
        packetId: input.packetId || null,
        createdById: session.user.id,
      },
    });

    // If attached to a packet directly on creation, update the packet's items list
    if (input.packetId) {
      const packet = await prisma.boardPacket.findUnique({
        where: { id: input.packetId },
      });
      if (packet) {
        const items = Array.isArray(packet.items) ? (packet.items as unknown as BoardPacketItemRef[]) : [];
        const newItem: BoardPacketItemRef = {
          id: framework.id,
          type: 'framework',
          frameworkId: framework.id,
          toolId: framework.toolId,
          title: framework.title,
          notes: null,
          order: items.length,
        };
        await prisma.boardPacket.update({
          where: { id: packet.id },
          data: { items: [...items, newItem] as unknown as Prisma.InputJsonValue },
        });
        revalidatePath(`/xp/packets/${packet.id}`);
      }
    }

    revalidatePath('/xp');
    revalidatePath(`/xp/frameworks/${framework.id}`);
    return { success: true, frameworkId: framework.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not create framework' };
  }
}

export async function updateStrategicFramework(input: {
  id: string;
  title?: string;
  status?: string;
  data?: unknown;
}): Promise<ActionResult> {
  try {
    const gate = requireXpModule();
    if (gate) return { success: false, error: gate };
    await requireManagerOrAdmin();

    const updateData: Prisma.StrategicFrameworkUpdateInput = {};
    if (input.title !== undefined) updateData.title = input.title.trim();
    if (input.status !== undefined) updateData.status = input.status;
    if (input.data !== undefined) updateData.data = input.data as Prisma.InputJsonValue;

    const framework = await prisma.strategicFramework.update({
      where: { id: input.id },
      data: updateData,
    });

    // If title changed and framework is in a packet, update title in packet items as well
    if (input.title !== undefined && framework.packetId) {
      const packet = await prisma.boardPacket.findUnique({ where: { id: framework.packetId } });
      if (packet && Array.isArray(packet.items)) {
        const items = (packet.items as unknown as BoardPacketItemRef[]).map((item) =>
          item.frameworkId === framework.id ? { ...item, title: framework.title } : item
        );
        await prisma.boardPacket.update({
          where: { id: packet.id },
          data: { items: items as unknown as Prisma.InputJsonValue },
        });
        revalidatePath(`/xp/packets/${packet.id}`);
      }
    }

    revalidatePath('/xp');
    revalidatePath(`/xp/frameworks/${framework.id}`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not update framework' };
  }
}

export async function deleteStrategicFramework(id: string): Promise<ActionResult> {
  try {
    const gate = requireXpModule();
    if (gate) return { success: false, error: gate };
    await requireManagerOrAdmin();

    const framework = await prisma.strategicFramework.findUnique({ where: { id } });
    if (!framework) return { success: false, error: 'Framework not found' };

    if (framework.packetId) {
      const packet = await prisma.boardPacket.findUnique({ where: { id: framework.packetId } });
      if (packet && Array.isArray(packet.items)) {
        const items = (packet.items as unknown as BoardPacketItemRef[]).filter(
          (item) => item.frameworkId !== framework.id
        );
        await prisma.boardPacket.update({
          where: { id: packet.id },
          data: { items: items as unknown as Prisma.InputJsonValue },
        });
        revalidatePath(`/xp/packets/${packet.id}`);
      }
    }

    await prisma.strategicFramework.delete({ where: { id } });

    revalidatePath('/xp');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not delete framework' };
  }
}

export async function addFrameworkToBoardPacket(input: {
  frameworkId: string;
  packetId: string;
  notes?: string;
}): Promise<ActionResult> {
  try {
    const gate = requireXpModule();
    if (gate) return { success: false, error: gate };
    await requireManagerOrAdmin();

    const framework = await prisma.strategicFramework.findUnique({ where: { id: input.frameworkId } });
    if (!framework) return { success: false, error: 'Strategic framework not found' };

    const packet = await prisma.boardPacket.findUnique({ where: { id: input.packetId } });
    if (!packet) return { success: false, error: 'Board packet not found' };

    const items = Array.isArray(packet.items) ? (packet.items as unknown as BoardPacketItemRef[]) : [];
    const alreadyExists = items.some((i) => i.frameworkId === framework.id);

    let updatedItems = items;
    if (!alreadyExists) {
      const newItem: BoardPacketItemRef = {
        id: framework.id,
        type: 'framework',
        frameworkId: framework.id,
        toolId: framework.toolId,
        title: framework.title,
        notes: input.notes?.trim() || null,
        order: items.length,
      };
      updatedItems = [...items, newItem];
    } else if (input.notes) {
      updatedItems = items.map((i) =>
        i.frameworkId === framework.id ? { ...i, notes: input.notes?.trim() || null } : i
      );
    }

    await Promise.all([
      prisma.boardPacket.update({
        where: { id: packet.id },
        data: { items: updatedItems as unknown as Prisma.InputJsonValue },
      }),
      prisma.strategicFramework.update({
        where: { id: framework.id },
        data: { packetId: packet.id },
      }),
    ]);

    revalidatePath('/xp');
    revalidatePath(`/xp/packets/${packet.id}`);
    revalidatePath(`/xp/frameworks/${framework.id}`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not add framework to packet' };
  }
}

export async function removeFrameworkFromBoardPacket(input: {
  packetId: string;
  frameworkId: string;
}): Promise<ActionResult> {
  try {
    const gate = requireXpModule();
    if (gate) return { success: false, error: gate };
    await requireManagerOrAdmin();

    const packet = await prisma.boardPacket.findUnique({ where: { id: input.packetId } });
    if (!packet) return { success: false, error: 'Board packet not found' };

    const items = Array.isArray(packet.items) ? (packet.items as unknown as BoardPacketItemRef[]) : [];
    const updatedItems = items
      .filter((i) => i.frameworkId !== input.frameworkId && i.id !== input.frameworkId)
      .map((item, idx) => ({ ...item, order: idx }));

    await Promise.all([
      prisma.boardPacket.update({
        where: { id: packet.id },
        data: { items: updatedItems as unknown as Prisma.InputJsonValue },
      }),
      prisma.strategicFramework.updateMany({
        where: { id: input.frameworkId, packetId: input.packetId },
        data: { packetId: null },
      }),
    ]);

    revalidatePath('/xp');
    revalidatePath(`/xp/packets/${packet.id}`);
    revalidatePath(`/xp/frameworks/${input.frameworkId}`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not remove framework from packet' };
  }
}

export async function createBoardPacketWithFramework(input: {
  packetTitle: string;
  meetingDate: string;
  frameworkId: string;
  notes?: string;
}): Promise<ActionResult<{ packetId: string }>> {
  try {
    const gate = requireXpModule();
    if (gate) return { success: false, error: gate };
    await requireManagerOrAdmin();

    const framework = await prisma.strategicFramework.findUnique({ where: { id: input.frameworkId } });
    if (!framework) return { success: false, error: 'Framework not found' };

    const item: BoardPacketItemRef = {
      id: framework.id,
      type: 'framework',
      frameworkId: framework.id,
      toolId: framework.toolId,
      title: framework.title,
      notes: input.notes?.trim() || null,
      order: 0,
    };

    const packet = await prisma.boardPacket.create({
      data: {
        title: input.packetTitle.trim(),
        meetingDate: new Date(input.meetingDate),
        items: [item] as unknown as Prisma.InputJsonValue,
      },
    });

    await prisma.strategicFramework.update({
      where: { id: framework.id },
      data: { packetId: packet.id },
    });

    revalidatePath('/xp');
    revalidatePath(`/xp/packets/${packet.id}`);
    revalidatePath(`/xp/frameworks/${framework.id}`);
    return { success: true, packetId: packet.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not create packet with framework' };
  }
}

export async function listBoardPackets(): Promise<
  Array<{ id: string; title: string; meetingDate: string; status: string; itemsCount: number }>
> {
  const gate = requireXpModule();
  if (gate) return [];

  const packets = await prisma.boardPacket.findMany({
    orderBy: { meetingDate: 'desc' },
    take: 50,
  });

  return packets.map((p) => {
    const items = Array.isArray(p.items) ? (p.items as unknown as BoardPacketItemRef[]) : [];
    return {
      id: p.id,
      title: p.title,
      meetingDate: p.meetingDate.toISOString(),
      status: p.status,
      itemsCount: items.length,
    };
  });
}

