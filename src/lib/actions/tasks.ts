'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';

async function requireProjectMember(projectId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Not authenticated');

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: session.user.id } },
  });
  if (!membership && session.user.role !== 'ADMIN') {
    throw new Error('You are not a member of this project');
  }
  return session;
}

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(4000).optional(),
  sectionId: z.string().min(1),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

export async function createTask(projectId: string, formData: FormData) {
  const session = await requireProjectMember(projectId);

  const parsed = createTaskSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    sectionId: formData.get('sectionId'),
    assigneeId: formData.get('assigneeId') || undefined,
    dueDate: formData.get('dueDate') || undefined,
    priority: formData.get('priority') || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const lastTask = await prisma.task.findFirst({
    where: { sectionId: parsed.data.sectionId },
    orderBy: { order: 'desc' },
  });

  const task = await prisma.task.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      projectId,
      sectionId: parsed.data.sectionId,
      assigneeId: parsed.data.assigneeId || null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      priority: parsed.data.priority ?? 'MEDIUM',
      order: (lastTask?.order ?? -1) + 1,
    },
  });

  if (task.assigneeId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    await createNotification({
      type: 'TASK_ASSIGNED',
      recipientId: task.assigneeId,
      actorId: session.user.id,
      message: `${session.user.name} assigned you to "${task.title}" in ${project?.name}`,
      link: `/projects/${projectId}?task=${task.id}`,
      emailSubject: `New task assigned: ${task.title}`,
    });
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/my-tasks');
  return { success: true, taskId: task.id };
}

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
});

type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export async function updateTask(taskId: string, input: UpdateTaskInput) {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) return { success: false, error: 'Task not found' };

  const session = await requireProjectMember(existing.projectId);

  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if ('dueDate' in parsed.data) {
    data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  }

  const assigneeChanged =
    'assigneeId' in parsed.data && parsed.data.assigneeId !== existing.assigneeId && parsed.data.assigneeId;

  const task = await prisma.task.update({ where: { id: taskId }, data });

  if (assigneeChanged && task.assigneeId) {
    const project = await prisma.project.findUnique({ where: { id: task.projectId } });
    await createNotification({
      type: 'TASK_ASSIGNED',
      recipientId: task.assigneeId,
      actorId: session.user.id,
      message: `${session.user.name} assigned you to "${task.title}" in ${project?.name}`,
      link: `/projects/${task.projectId}?task=${task.id}`,
      emailSubject: `New task assigned: ${task.title}`,
    });
  }

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath('/my-tasks');
  return { success: true };
}

/** Called by the Kanban board on drag-and-drop to persist the new section + position. */
export async function moveTask(taskId: string, destinationSectionId: string, destinationOrder: number) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { success: false, error: 'Task not found' };
  await requireProjectMember(task.projectId);

  const destinationSection = await prisma.section.findUnique({ where: { id: destinationSectionId } });
  if (!destinationSection) return { success: false, error: 'Section not found' };

  const statusForSection = (name: string) => {
    const normalized = name.trim().toLowerCase();
    if (normalized === 'done') return 'DONE' as const;
    if (normalized === 'in progress') return 'IN_PROGRESS' as const;
    return task.status;
  };

  await prisma.$transaction(async (tx) => {
    const siblings = await tx.task.findMany({
      where: { sectionId: destinationSectionId, id: { not: taskId } },
      orderBy: { order: 'asc' },
    });
    siblings.splice(destinationOrder, 0, task);

    await Promise.all(
      siblings.map((t, index) =>
        tx.task.update({
          where: { id: t.id },
          data: {
            order: index,
            sectionId: destinationSectionId,
            status: t.id === taskId ? statusForSection(destinationSection.name) : t.status,
          },
        }),
      ),
    );
  });

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath('/my-tasks');
  return { success: true };
}

export async function getTaskDetail(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignee: true,
      comments: { include: { user: true }, orderBy: { createdAt: 'asc' } },
      project: { include: { members: { include: { user: true } } } },
    },
  });
  if (!task) return null;

  await requireProjectMember(task.projectId);

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    assigneeId: task.assigneeId,
    projectId: task.projectId,
    projectName: task.project.name,
    members: task.project.members.map((m) => ({ id: m.user.id, name: m.user.name })),
    comments: task.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      userName: c.user.name,
      userId: c.userId,
    })),
  };
}

export async function deleteTask(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { success: false, error: 'Task not found' };
  await requireProjectMember(task.projectId);

  await prisma.task.delete({ where: { id: taskId } });

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath('/my-tasks');
  return { success: true };
}
