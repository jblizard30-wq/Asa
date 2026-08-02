'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireProjectMember } from '@/lib/actions/tasks';

const CUSTOM_FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX'] as const;

const createFieldSchema = z.object({
  name: z.string().min(1, 'Name is required').max(60),
  type: z.enum(CUSTOM_FIELD_TYPES),
  options: z.array(z.string().min(1).max(60)).max(50).optional(),
});

export async function createCustomField(projectId: string, input: z.infer<typeof createFieldSchema>) {
  await requireProjectMember(projectId);

  const parsed = createFieldSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const lastField = await prisma.customField.findFirst({ where: { projectId }, orderBy: { order: 'desc' } });

  const field = await prisma.customField.create({
    data: {
      projectId,
      name: parsed.data.name,
      type: parsed.data.type,
      order: (lastField?.order ?? -1) + 1,
      options:
        parsed.data.type === 'SELECT' && parsed.data.options
          ? { create: parsed.data.options.map((label, index) => ({ label, order: index })) }
          : undefined,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, fieldId: field.id };
}

export async function renameCustomField(fieldId: string, name: string) {
  const field = await prisma.customField.findUnique({ where: { id: fieldId } });
  if (!field) return { success: false, error: 'Field not found' };
  await requireProjectMember(field.projectId);

  const parsed = z.string().min(1).max(60).safeParse(name);
  if (!parsed.success) return { success: false, error: 'Invalid name' };

  await prisma.customField.update({ where: { id: fieldId }, data: { name: parsed.data } });
  revalidatePath(`/projects/${field.projectId}`);
  return { success: true };
}

export async function addCustomFieldOption(fieldId: string, label: string) {
  const field = await prisma.customField.findUnique({ where: { id: fieldId } });
  if (!field) return { success: false, error: 'Field not found' };
  await requireProjectMember(field.projectId);

  const parsed = z.string().min(1).max(60).safeParse(label);
  if (!parsed.success) return { success: false, error: 'Invalid option' };

  const lastOption = await prisma.customFieldOption.findFirst({ where: { customFieldId: fieldId }, orderBy: { order: 'desc' } });
  const option = await prisma.customFieldOption.create({
    data: { customFieldId: fieldId, label: parsed.data, order: (lastOption?.order ?? -1) + 1 },
  });

  revalidatePath(`/projects/${field.projectId}`);
  return { success: true, optionId: option.id };
}

export async function deleteCustomField(fieldId: string) {
  const field = await prisma.customField.findUnique({ where: { id: fieldId } });
  if (!field) return { success: false, error: 'Field not found' };
  await requireProjectMember(field.projectId);

  await prisma.customField.delete({ where: { id: fieldId } });
  revalidatePath(`/projects/${field.projectId}`);
  return { success: true };
}

export async function reorderCustomFields(projectId: string, orderedFieldIds: string[]) {
  await requireProjectMember(projectId);

  await prisma.$transaction(
    orderedFieldIds.map((id, index) =>
      prisma.customField.update({ where: { id }, data: { order: index } }),
    ),
  );

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

const valueSchema = z.object({
  textValue: z.string().max(4000).optional().nullable(),
  numberValue: z.coerce.number().optional().nullable(),
  dateValue: z.string().optional().nullable(),
  boolValue: z.boolean().optional().nullable(),
  optionId: z.string().optional().nullable(),
});

/** Upserts a single task's value for one custom field; called from inline List/Modal editors. */
export async function setTaskCustomFieldValue(taskId: string, fieldId: string, input: z.infer<typeof valueSchema>) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { success: false, error: 'Task not found' };
  await requireProjectMember(task.projectId);

  const parsed = valueSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const data = {
    textValue: parsed.data.textValue ?? null,
    numberValue: parsed.data.numberValue ?? null,
    dateValue: parsed.data.dateValue ? new Date(parsed.data.dateValue) : null,
    boolValue: parsed.data.boolValue ?? null,
    optionId: parsed.data.optionId ?? null,
  };

  await prisma.taskCustomFieldValue.upsert({
    where: { taskId_customFieldId: { taskId, customFieldId: fieldId } },
    create: { taskId, customFieldId: fieldId, ...data },
    update: data,
  });

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath('/my-tasks');
  return { success: true };
}
