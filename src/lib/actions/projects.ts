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

const inviteMemberSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

export async function inviteMemberToProject(projectId: string, formData: FormData) {
  const session = await requireAdmin();

  const parsed = inviteMemberSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { success: false, error: 'No user found with that email. They need to sign up first.' };
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
  return { success: true };
}

export async function removeMemberFromProject(projectId: string, userId: string) {
  await requireAdmin();
  await prisma.projectMember.deleteMany({ where: { projectId, userId } });
  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}
