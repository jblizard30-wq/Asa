'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { requireProjectMember } from '@/lib/actions/tasks';

const INTAKE_FIELD_TYPES = ['TEXT', 'TEXTAREA', 'EMAIL', 'DATE', 'SELECT'] as const;

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'form';
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomSuffix()}`;
    const existing = await prisma.intakeForm.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  return `${base}-${randomSuffix()}-${randomSuffix()}`;
}

export async function getIntakeFormsForProject(projectId: string) {
  await requireProjectMember(projectId);

  const forms = await prisma.intakeForm.findMany({
    where: { projectId },
    include: {
      section: { select: { id: true, name: true } },
      defaultAssignee: { select: { id: true, name: true } },
      fields: { orderBy: { order: 'asc' }, include: { options: { orderBy: { order: 'asc' } } } },
      _count: { select: { submissions: true } },
      submissions: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { task: { select: { id: true, title: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return forms.map((f) => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
    description: f.description,
    isActive: f.isActive,
    sectionId: f.sectionId,
    sectionName: f.section.name,
    defaultAssigneeId: f.defaultAssigneeId,
    defaultAssigneeName: f.defaultAssignee?.name ?? null,
    submissionCount: f._count.submissions,
    fields: f.fields.map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type,
      required: field.required,
      options: field.options.map((o) => ({ id: o.id, label: o.label })),
    })),
    recentSubmissions: f.submissions.map((s) => ({
      id: s.id,
      submitterName: s.submitterName,
      submitterEmail: s.submitterEmail,
      createdAt: s.createdAt.toISOString(),
      taskId: s.task?.id ?? null,
      taskTitle: s.task?.title ?? null,
    })),
  }));
}

const createFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  description: z.string().max(2000).optional(),
  sectionId: z.string().min(1, 'Choose a destination section'),
  defaultAssigneeId: z.string().optional(),
});

type CreateFormInput = z.infer<typeof createFormSchema>;

export async function createIntakeForm(projectId: string, input: CreateFormInput) {
  const session = await requireProjectMember(projectId);

  const parsed = createFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const section = await prisma.section.findUnique({ where: { id: parsed.data.sectionId } });
  if (!section || section.projectId !== projectId) {
    return { success: false, error: 'Choose a valid section in this project' };
  }

  if (parsed.data.defaultAssigneeId) {
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: parsed.data.defaultAssigneeId } },
    });
    if (!membership) return { success: false, error: 'Default assignee must be a project member' };
  }

  const slug = await generateUniqueSlug(parsed.data.name);

  const form = await prisma.intakeForm.create({
    data: {
      name: parsed.data.name,
      slug,
      description: parsed.data.description || null,
      projectId,
      sectionId: parsed.data.sectionId,
      defaultAssigneeId: parsed.data.defaultAssigneeId || null,
      createdById: session.user.id,
    },
  });

  revalidatePath(`/projects/${projectId}/forms`);
  return { success: true, formId: form.id, slug: form.slug };
}

export async function toggleIntakeForm(formId: string, isActive: boolean) {
  const form = await prisma.intakeForm.findUnique({ where: { id: formId } });
  if (!form) return { success: false, error: 'Form not found' };
  await requireProjectMember(form.projectId);

  await prisma.intakeForm.update({ where: { id: formId }, data: { isActive } });
  revalidatePath(`/projects/${form.projectId}/forms`);
  return { success: true };
}

export async function deleteIntakeForm(formId: string) {
  const form = await prisma.intakeForm.findUnique({ where: { id: formId } });
  if (!form) return { success: false, error: 'Form not found' };
  await requireProjectMember(form.projectId);

  await prisma.intakeForm.delete({ where: { id: formId } });
  revalidatePath(`/projects/${form.projectId}/forms`);
  return { success: true };
}

const addFieldSchema = z.object({
  label: z.string().min(1, 'Label is required').max(120),
  type: z.enum(INTAKE_FIELD_TYPES),
  required: z.boolean().optional(),
  options: z.array(z.string().min(1).max(120)).max(30).optional(),
});

type AddFieldInput = z.infer<typeof addFieldSchema>;

export async function addIntakeFormField(formId: string, input: AddFieldInput) {
  const form = await prisma.intakeForm.findUnique({ where: { id: formId } });
  if (!form) return { success: false, error: 'Form not found' };
  await requireProjectMember(form.projectId);

  const parsed = addFieldSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const lastField = await prisma.intakeFormField.findFirst({ where: { formId }, orderBy: { order: 'desc' } });

  await prisma.intakeFormField.create({
    data: {
      formId,
      label: parsed.data.label,
      type: parsed.data.type,
      required: parsed.data.required ?? false,
      order: (lastField?.order ?? -1) + 1,
      options:
        parsed.data.type === 'SELECT'
          ? { create: (parsed.data.options ?? []).map((label, i) => ({ label, order: i })) }
          : undefined,
    },
  });

  revalidatePath(`/projects/${form.projectId}/forms`);
  return { success: true };
}

export async function deleteIntakeFormField(fieldId: string) {
  const field = await prisma.intakeFormField.findUnique({ where: { id: fieldId }, include: { form: true } });
  if (!field) return { success: false, error: 'Field not found' };
  await requireProjectMember(field.form.projectId);

  await prisma.intakeFormField.delete({ where: { id: fieldId } });
  revalidatePath(`/projects/${field.form.projectId}/forms`);
  return { success: true };
}

const submitSchema = z.object({
  submitterName: z.string().min(1, 'Your name is required').max(200),
  submitterEmail: z.union([z.string().email(), z.literal('')]).optional(),
  answers: z.record(z.string(), z.string().max(4000)).optional(),
  // Hidden field real visitors never see or fill; a non-empty value means a bot filled the form.
  honeypot: z.string().max(200).optional(),
});

/**
 * Public, unauthenticated entry point reachable from /forms/[slug] — creates a Task from a
 * congregation/volunteer submission without requiring the submitter to have an account.
 */
export async function submitIntakeForm(slug: string, input: unknown) {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // Pretend to succeed for bot submissions so scrapers don't learn the honeypot was tripped.
  if (parsed.data.honeypot) return { success: true };

  const form = await prisma.intakeForm.findUnique({
    where: { slug },
    include: { fields: { orderBy: { order: 'asc' } } },
  });
  if (!form || !form.isActive) {
    return { success: false, error: 'This form is not accepting submissions right now.' };
  }

  const answers = parsed.data.answers ?? {};
  for (const field of form.fields) {
    if (field.required && !answers[field.id]?.trim()) {
      return { success: false, error: `"${field.label}" is required.` };
    }
  }

  const answerLines = form.fields
    .filter((f) => answers[f.id]?.trim())
    .map((f) => `${f.label}: ${answers[f.id].trim()}`);
  const description = [
    `Submitted by ${parsed.data.submitterName}${
      parsed.data.submitterEmail ? ` (${parsed.data.submitterEmail})` : ''
    } via the "${form.name}" form.`,
    ...(answerLines.length > 0 ? ['', ...answerLines] : []),
  ].join('\n');

  const lastTask = await prisma.task.findFirst({
    where: { sectionId: form.sectionId, parentTaskId: null, deletedAt: null },
    orderBy: { order: 'desc' },
  });

  const task = await prisma.task.create({
    data: {
      title: `${form.name} — ${parsed.data.submitterName}`,
      description,
      projectId: form.projectId,
      sectionId: form.sectionId,
      assignees: form.defaultAssigneeId ? { connect: { id: form.defaultAssigneeId } } : undefined,
      order: (lastTask?.order ?? -1) + 1,
    },
  });

  const answersByLabel: Record<string, string> = {};
  for (const f of form.fields) {
    const value = answers[f.id]?.trim();
    if (value) answersByLabel[f.label] = value;
  }

  await prisma.intakeSubmission.create({
    data: {
      formId: form.id,
      taskId: task.id,
      submitterName: parsed.data.submitterName,
      submitterEmail: parsed.data.submitterEmail || null,
      answers: answersByLabel,
    },
  });

  const notifyRecipientIds = new Set([form.defaultAssigneeId, form.createdById].filter(Boolean) as string[]);
  await Promise.all(
    [...notifyRecipientIds].map((recipientId) =>
      createNotification({
        type: 'FORM_SUBMITTED',
        recipientId,
        message: `New "${form.name}" submission from ${parsed.data.submitterName}`,
        link: `/projects/${form.projectId}?task=${task.id}`,
        emailSubject: `New ${form.name} submission`,
      }),
    ),
  );

  return { success: true };
}
