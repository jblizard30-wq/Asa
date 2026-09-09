'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';

const DEFAULT_SECTIONS = ['To Do', 'In Progress', 'Done'];

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Not authenticated');
  return session;
}

async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== 'ADMIN') throw new Error('Only admins can perform this action');
  return session;
}

const PERSONAL_PROJECT_NAME = 'Personal Tasks';

export async function getOrCreatePersonalProject() {
  const session = await requireSession();

  const existing = await prisma.project.findFirst({
    where: { createdById: session.user.id, isPersonal: true },
  });
  if (existing) return existing.id;

  const project = await prisma.project.create({
    data: {
      name: PERSONAL_PROJECT_NAME,
      isPersonal: true,
      createdById: session.user.id,
      members: { create: [{ userId: session.user.id }] },
      sections: {
        create: DEFAULT_SECTIONS.map((name, order) => ({ name, order })),
      },
    },
  });

  return project.id;
}

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(120),
  description: z.string().max(1000).optional(),
});

export async function createProject(formData: FormData) {
  const session = await requireAdmin();

  const parsed = createProjectSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      createdById: session.user.id,
      members: { create: [{ userId: session.user.id }] },
      sections: {
        create: DEFAULT_SECTIONS.map((name, order) => ({ name, order })),
      },
    },
  });

  revalidatePath('/projects');
  return { success: true, projectId: project.id };
}

export async function searchAssignableUsers(projectId: string, query: string = '') {
  await requireAdmin();
  const trimmed = query.trim();

  const existingMembers = await prisma.projectMember.findMany({
    where: { projectId },
    select: { userId: true },
  });
  const memberUserIds = existingMembers.map((m) => m.userId);

  const users = await prisma.user.findMany({
    where: {
      id: { notIn: memberUserIds },
      ...(trimmed
        ? {
            OR: [
              { name: { contains: trimmed, mode: 'insensitive' } },
              { email: { contains: trimmed, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: 'asc' },
    take: 10,
  });

  return users;
}

const addMemberSchema = z.object({
  userId: z.string().min(1).optional(),
  email: z.string().email('Enter a valid email address').optional(),
});

export async function addMemberToProject(
  projectId: string,
  input: FormData | { userId?: string; email?: string }
) {
  const session = await requireAdmin();

  let rawUserId: string | undefined;
  let rawEmail: string | undefined;

  if (input instanceof FormData) {
    const uId = input.get('userId');
    const em = input.get('email');
    if (typeof uId === 'string' && uId.trim()) rawUserId = uId.trim();
    if (typeof em === 'string' && em.trim()) rawEmail = em.trim();
  } else if (input && typeof input === 'object') {
    if (input.userId?.trim()) rawUserId = input.userId.trim();
    if (input.email?.trim()) rawEmail = input.email.trim();
  }

  const parsed = addMemberSchema.safeParse({ userId: rawUserId, email: rawEmail });
  if (!parsed.success || (!parsed.data.userId && !parsed.data.email)) {
    return { success: false, error: parsed.error?.issues[0]?.message ?? 'Please select a user to add.' };
  }

  const user = parsed.data.userId
    ? await prisma.user.findUnique({ where: { id: parsed.data.userId } })
    : await prisma.user.findUnique({ where: { email: parsed.data.email!.toLowerCase().trim() } });

  if (!user) {
    return { success: false, error: 'User not found.' };
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { success: false, error: 'Project not found' };

  const existingMembership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (existingMembership) {
    return { success: false, error: 'That user is already a member of this project.' };
  }

  await prisma.projectMember.create({ data: { projectId, userId: user.id } });

  await createNotification({
    type: 'PROJECT_INVITE',
    recipientId: user.id,
    actorId: session.user.id,
    message: `${session.user.name} added you to the project "${project.name}"`,
    link: `/projects/${projectId}`,
    emailSubject: `You've been added to "${project.name}"`,
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, member: { id: user.id, name: user.name, email: user.email } };
}

export const inviteMemberToProject = addMemberToProject;

export async function removeMemberFromProject(projectId: string, userId: string) {
  await requireAdmin();
  await prisma.projectMember.deleteMany({ where: { projectId, userId } });
  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

/** Flags/unflags a member as this project's manager, for the project exec-summary digest. */
export async function setProjectManager(projectId: string, userId: string, isManager: boolean) {
  await requireAdmin();
  await prisma.projectMember.update({
    where: { projectId_userId: { projectId, userId } },
    data: { isManager },
  });
  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}
