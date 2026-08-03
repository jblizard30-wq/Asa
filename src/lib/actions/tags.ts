'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireProjectMember } from '@/lib/actions/tasks';
import { TAG_COLORS } from '@/lib/format';

const createTagSchema = z.object({
  name: z.string().min(1, 'Name is required').max(40),
  color: z.enum(TAG_COLORS),
});

export async function createTag(projectId: string, input: z.infer<typeof createTagSchema>) {
  await requireProjectMember(projectId);

  const parsed = createTagSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const existing = await prisma.tag.findUnique({
    where: { projectId_name: { projectId, name: parsed.data.name } },
  });
  if (existing) return { success: false, error: 'A tag with that name already exists.' };

  const lastTag = await prisma.tag.findFirst({ where: { projectId }, orderBy: { order: 'desc' } });
  const tag = await prisma.tag.create({
    data: {
      projectId,
      name: parsed.data.name,
      color: parsed.data.color,
      order: (lastTag?.order ?? -1) + 1,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, tagId: tag.id };
}

const updateTagSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  color: z.enum(TAG_COLORS).optional(),
});

export async function updateTag(tagId: string, input: z.infer<typeof updateTagSchema>) {
  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!tag) return { success: false, error: 'Tag not found' };
  await requireProjectMember(tag.projectId);

  const parsed = updateTagSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  if (parsed.data.name) {
    const duplicate = await prisma.tag.findFirst({
      where: { projectId: tag.projectId, name: parsed.data.name, id: { not: tagId } },
    });
    if (duplicate) return { success: false, error: 'A tag with that name already exists.' };
  }

  await prisma.tag.update({ where: { id: tagId }, data: parsed.data });
  revalidatePath(`/projects/${tag.projectId}`);
  return { success: true };
}

export async function deleteTag(tagId: string) {
  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!tag) return { success: false, error: 'Tag not found' };
  await requireProjectMember(tag.projectId);

  await prisma.tag.delete({ where: { id: tagId } });
  revalidatePath(`/projects/${tag.projectId}`);
  return { success: true };
}

/** Replaces the full set of tags on a task — used by the tag picker in the detail modal and grid view. */
export async function setTaskTags(taskId: string, tagIds: string[]) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { success: false, error: 'Task not found' };
  await requireProjectMember(task.projectId);

  const validTags = await prisma.tag.findMany({
    where: { id: { in: tagIds }, projectId: task.projectId },
    select: { id: true },
  });
  if (validTags.length !== tagIds.length) {
    return { success: false, error: 'One or more tags are not in this project.' };
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { tags: { set: validTags.map((t) => ({ id: t.id })) } },
  });

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath('/my-tasks');
  return { success: true };
}
