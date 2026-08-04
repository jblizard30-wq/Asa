import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateApiKey } from '@/lib/apiAuth';
import { createNotification } from '@/lib/notifications';
import { dispatchWebhooks } from '@/lib/webhooks/dispatch';

export const dynamic = 'force-dynamic';

async function accessibleProjectIds(user: { id: string; role: string }): Promise<string[]> {
  const projects = await prisma.project.findMany({
    where: user.role === 'ADMIN' ? {} : { members: { some: { userId: user.id } } },
    select: { id: true },
  });
  return projects.map((p) => p.id);
}

export async function GET(request: NextRequest) {
  const user = await authenticateApiKey(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projectIds = await accessibleProjectIds(user);
  if (projectIds.length === 0) return NextResponse.json({ tasks: [], limit: 0, offset: 0, total: 0 });

  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit')) || 25, 1), 100);
  const offset = Math.max(Number(request.nextUrl.searchParams.get('offset')) || 0, 0);

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where: { projectId: { in: projectIds }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        projectId: true,
        sectionId: true,
        assignees: { select: { id: true, name: true } },
        createdAt: true,
      },
    }),
    prisma.task.count({ where: { projectId: { in: projectIds }, deletedAt: null } }),
  ]);

  return NextResponse.json({ tasks, limit, offset, total });
}

const createTaskSchema = z.object({
  projectId: z.string().min(1),
  sectionId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  assigneeIds: z.array(z.string()).max(50).optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

export async function POST(request: NextRequest) {
  const user = await authenticateApiKey(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = createTaskSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const projectIds = await accessibleProjectIds(user);
  if (!projectIds.includes(parsed.data.projectId)) {
    return NextResponse.json({ error: 'Project not found or not accessible' }, { status: 403 });
  }

  const section = await prisma.section.findUnique({ where: { id: parsed.data.sectionId } });
  if (!section || section.projectId !== parsed.data.projectId) {
    return NextResponse.json({ error: 'Section not found in that project' }, { status: 400 });
  }

  const lastTask = await prisma.task.findFirst({
    where: { sectionId: parsed.data.sectionId, parentTaskId: null, deletedAt: null },
    orderBy: { order: 'desc' },
  });

  const task = await prisma.task.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      projectId: parsed.data.projectId,
      sectionId: parsed.data.sectionId,
      assignees: parsed.data.assigneeIds?.length ? { connect: parsed.data.assigneeIds.map((id) => ({ id })) } : undefined,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      priority: parsed.data.priority ?? 'MEDIUM',
      order: (lastTask?.order ?? -1) + 1,
    },
    include: { assignees: { select: { id: true } } },
  });

  if (task.assignees.length > 0) {
    const project = await prisma.project.findUnique({ where: { id: task.projectId } });
    await Promise.all(
      task.assignees.map((assignee) =>
        createNotification({
          type: 'TASK_ASSIGNED',
          recipientId: assignee.id,
          actorId: user.id,
          message: `${user.name} assigned you to "${task.title}" in ${project?.name}`,
          link: `/projects/${task.projectId}?task=${task.id}`,
          emailSubject: `New task assigned: ${task.title}`,
        }),
      ),
    );
  }

  void dispatchWebhooks('TASK_CREATED', {
    taskId: task.id,
    projectId: task.projectId,
    title: task.title,
    status: task.status,
  });

  return NextResponse.json({ task }, { status: 201 });
}
