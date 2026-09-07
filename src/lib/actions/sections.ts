'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireProjectMember } from '@/lib/actions/tasks';

const sectionNameSchema = z
  .string()
  .trim()
  .min(1, 'Column name cannot be empty')
  .max(60, 'Column name must be 60 characters or fewer');

export async function createSection(projectId: string, name: string) {
  await requireProjectMember(projectId);

  const parsed = sectionNameSchema.safeParse(name);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid column name' };
  }

  const lastSection = await prisma.section.findFirst({
    where: { projectId },
    orderBy: { order: 'desc' },
  });

  const section = await prisma.section.create({
    data: {
      projectId,
      name: parsed.data,
      order: (lastSection?.order ?? -1) + 1,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, sectionId: section.id, name: section.name, order: section.order };
}

export async function updateSection(sectionId: string, name: string) {
  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section) return { success: false, error: 'Column not found' };

  await requireProjectMember(section.projectId);

  const parsed = sectionNameSchema.safeParse(name);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid column name' };
  }

  const updated = await prisma.section.update({
    where: { id: sectionId },
    data: { name: parsed.data },
  });

  revalidatePath(`/projects/${section.projectId}`);
  return { success: true, section: { id: updated.id, name: updated.name, order: updated.order } };
}

export async function deleteSection(sectionId: string, targetSectionId?: string) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { _count: { select: { tasks: { where: { deletedAt: null } } } } },
  });
  if (!section) return { success: false, error: 'Column not found' };

  await requireProjectMember(section.projectId);

  const totalSections = await prisma.section.count({ where: { projectId: section.projectId } });
  if (totalSections <= 1) {
    return { success: false, error: 'Cannot delete the only column in a project.' };
  }

  let destinationSectionId = targetSectionId;
  if (destinationSectionId) {
    if (destinationSectionId === sectionId) {
      return { success: false, error: 'Target destination cannot be the column being deleted.' };
    }
    const dest = await prisma.section.findFirst({
      where: { id: destinationSectionId, projectId: section.projectId },
    });
    if (!dest) {
      return { success: false, error: 'Target column does not exist in this project.' };
    }
  } else {
    // Pick the first remaining section as destination
    const sibling = await prisma.section.findFirst({
      where: { projectId: section.projectId, id: { not: sectionId } },
      orderBy: { order: 'asc' },
    });
    if (!sibling) {
      return { success: false, error: 'No other column available to receive tasks.' };
    }
    destinationSectionId = sibling.id;
  }

  await prisma.$transaction(async (tx) => {
    // Reassign tasks to destination
    await tx.task.updateMany({
      where: { sectionId },
      data: { sectionId: destinationSectionId },
    });

    // Reassign extra homed tasks
    await tx.taskProject.updateMany({
      where: { sectionId },
      data: { sectionId: destinationSectionId },
    });

    // Reassign recurring task templates
    await tx.taskRecurrence.updateMany({
      where: { sectionId },
      data: { sectionId: destinationSectionId },
    });

    // Reassign intake forms
    await tx.intakeForm.updateMany({
      where: { sectionId },
      data: { sectionId: destinationSectionId },
    });

    // Reassign service template runs
    await tx.serviceTemplateRun.updateMany({
      where: { sectionId },
      data: { sectionId: destinationSectionId },
    });

    // Reassign automation rules
    await tx.automationRule.updateMany({
      where: { targetSectionId: sectionId },
      data: { targetSectionId: destinationSectionId },
    });

    // Delete the section
    await tx.section.delete({ where: { id: sectionId } });

    // Normalize ordering of remaining sections
    const remaining = await tx.section.findMany({
      where: { projectId: section.projectId },
      orderBy: { order: 'asc' },
    });
    await Promise.all(
      remaining.map((s, index) =>
        tx.section.update({
          where: { id: s.id },
          data: { order: index },
        }),
      ),
    );
  });

  revalidatePath(`/projects/${section.projectId}`);
  return { success: true, movedToSectionId: destinationSectionId };
}

export async function reorderSections(projectId: string, orderedSectionIds: string[]) {
  await requireProjectMember(projectId);

  if (!orderedSectionIds || orderedSectionIds.length === 0) {
    return { success: false, error: 'No columns specified' };
  }

  await prisma.$transaction(
    orderedSectionIds.map((id, index) =>
      prisma.section.update({
        where: { id },
        data: { order: index },
      }),
    ),
  );

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

