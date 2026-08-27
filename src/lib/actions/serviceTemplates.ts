'use server';

import { revalidatePath } from 'next/cache';
import { addDays, format } from 'date-fns';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireProjectMember } from '@/lib/actions/tasks';
import { getLiturgicalSeason } from '@/lib/liturgicalCalendar';
import { getCalendarDayString } from '@/lib/dateUtils';
import type { LiturgicalSeason, Priority } from '@prisma/client';

export interface ServiceTemplateItemInput {
  title: string;
  description?: string;
  dueOffsetDays?: number;
  season?: LiturgicalSeason | null;
  defaultPriority?: Priority;
}

export async function listServiceTemplates(projectId: string) {
  await requireProjectMember(projectId);

  return prisma.serviceTemplate.findMany({
    where: { projectId },
    include: {
      items: { orderBy: { order: 'asc' } },
      runs: { orderBy: { occurrenceDate: 'desc' }, take: 5 },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createServiceTemplate(
  projectId: string,
  data: {
    name: string;
    description?: string;
    items: ServiceTemplateItemInput[];
  },
) {
  const session = await requireProjectMember(projectId);

  const template = await prisma.serviceTemplate.create({
    data: {
      name: data.name,
      description: data.description,
      projectId,
      createdById: session.user.id,
      items: {
        create: data.items.map((item, index) => ({
          title: item.title,
          description: item.description,
          order: index,
          dueOffsetDays: item.dueOffsetDays ?? 0,
          season: item.season,
          defaultPriority: item.defaultPriority ?? 'MEDIUM',
        })),
      },
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, templateId: template.id };
}

export async function deleteServiceTemplate(templateId: string) {
  const template = await prisma.serviceTemplate.findUnique({
    where: { id: templateId },
    select: { projectId: true },
  });
  if (!template) return { success: false, error: 'Template not found' };

  await requireProjectMember(template.projectId);

  await prisma.serviceTemplate.delete({
    where: { id: templateId },
  });

  revalidatePath(`/projects/${template.projectId}`);
  return { success: true };
}

/**
 * Materializes a full Sunday Service batch into a project section, dynamically swapping in
 * liturgical season items matching the occurrence date. Idempotent on (templateId, occurrenceDate).
 */
export async function applyServiceTemplate(templateId: string, occurrenceDate: string | Date) {
  const template = await prisma.serviceTemplate.findUnique({
    where: { id: templateId },
    include: { items: { orderBy: { order: 'asc' } } },
  });
  if (!template) return { success: false, error: 'Template not found' };

  await requireProjectMember(template.projectId);

  const dateStr = getCalendarDayString(occurrenceDate);
  const [year, month, day] = dateStr.split('-').map(Number);
  const serviceDate = new Date(Date.UTC(year, month - 1, day));

  const season = getLiturgicalSeason(serviceDate);

  // Check if run already materialized (idempotency guard)
  const existingRun = await prisma.serviceTemplateRun.findUnique({
    where: {
      serviceTemplateId_occurrenceDate: {
        serviceTemplateId: template.id,
        occurrenceDate: serviceDate,
      },
    },
  });

  if (existingRun) {
    return { success: false, error: `This service template has already been generated for ${dateStr}.` };
  }

  // Filter items applicable to this liturgical season (all-season items OR season-specific items)
  const activeItems = template.items.filter((item) => !item.season || item.season === season);

  // Create section for this Sunday service
  const sectionTitle = `${template.name} – ${format(serviceDate, 'MMM d, yyyy')} (${season.replace('_', ' ')})`;

  const lastSection = await prisma.section.findFirst({
    where: { projectId: template.projectId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const section = await tx.section.create({
        data: {
          name: sectionTitle,
          projectId: template.projectId,
          order: (lastSection?.order ?? -1) + 1,
        },
      });

      // Create tasks for active template items
      for (let i = 0; i < activeItems.length; i++) {
        const item = activeItems[i];
        const taskDueDate = item.dueOffsetDays !== null ? addDays(serviceDate, item.dueOffsetDays) : serviceDate;

        await tx.task.create({
          data: {
            title: item.title,
            description: item.description,
            projectId: template.projectId,
            sectionId: section.id,
            priority: item.defaultPriority,
            dueDate: taskDueDate,
            order: i,
          },
        });
      }

      // Record template run — the (serviceTemplateId, occurrenceDate) unique constraint is the
      // real idempotency guard; the existingRun check above is only a fast path for the common
      // case, since two concurrent calls could both pass it before either commits.
      await tx.serviceTemplateRun.create({
        data: {
          serviceTemplateId: template.id,
          occurrenceDate: serviceDate,
          season,
          sectionId: section.id,
        },
      });

      return section;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { success: false, error: `This service template has already been generated for ${dateStr}.` };
    }
    throw err;
  }

  revalidatePath(`/projects/${template.projectId}`);
  revalidatePath('/my-tasks');
  return { success: true, sectionId: result.id, season };
}
