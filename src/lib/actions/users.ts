'use server';

import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/permissions';

const updateUserRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['ADMIN', 'MANAGER', 'USER']),
});

export async function updateUserRole(userId: string, role: string) {
  const session = await requireAdmin();

  const parsed = updateUserRoleSchema.safeParse({ userId, role });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  if (parsed.data.userId === session.user.id && parsed.data.role !== 'ADMIN') {
    return { success: false, error: 'You cannot remove your own administrator access.' };
  }

  await prisma.user.update({ where: { id: parsed.data.userId }, data: { role: parsed.data.role } });

  revalidatePath('/admin/users');
  return { success: true };
}

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['ADMIN', 'MANAGER', 'USER']),
});

export async function createUser(formData: FormData) {
  await requireAdmin();

  const parsed = createUserSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: formData.get('role') || 'USER',
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: 'An account with that email already exists.' };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: { name: parsed.data.name, email, passwordHash, role: parsed.data.role },
  });

  revalidatePath('/admin/users');
  return { success: true };
}

const updateUserSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1, 'Name is required').max(120),
  email: z.string().email('Enter a valid email address'),
  password: z.union([z.string().min(8, 'Password must be at least 8 characters'), z.literal('')]).optional(),
});

export async function updateUser(userId: string, formData: FormData) {
  await requireAdmin();

  const parsed = updateUserSchema.safeParse({
    userId,
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password') || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== parsed.data.userId) {
    return { success: false, error: 'Another account already uses that email address.' };
  }

  const data: { name: string; email: string; passwordHash?: string } = { name: parsed.data.name, email };
  if (parsed.data.password) {
    data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }

  await prisma.user.update({ where: { id: parsed.data.userId }, data });

  revalidatePath('/admin/users');
  return { success: true };
}

const deleteUserSchema = z.object({
  userId: z.string().min(1),
});

export async function deleteUser(userId: string) {
  const session = await requireAdmin();

  const parsed = deleteUserSchema.safeParse({ userId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  if (parsed.data.userId === session.user.id) {
    return { success: false, error: 'You cannot delete your own account.' };
  }

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) {
    return { success: false, error: 'User not found.' };
  }

  // Records the deleted user created or owns via a required foreign key are reassigned to the
  // admin performing the deletion, since those relations can't be null and shouldn't be lost.
  await prisma.$transaction([
    prisma.project.updateMany({ where: { createdById: parsed.data.userId }, data: { createdById: session.user.id } }),
    prisma.comment.updateMany({ where: { userId: parsed.data.userId }, data: { userId: session.user.id } }),
    prisma.reminder.updateMany({ where: { senderId: parsed.data.userId }, data: { senderId: session.user.id } }),
    prisma.automationRule.updateMany({
      where: { createdById: parsed.data.userId },
      data: { createdById: session.user.id },
    }),
    prisma.attachment.updateMany({
      where: { uploadedById: parsed.data.userId },
      data: { uploadedById: session.user.id },
    }),
    prisma.intakeForm.updateMany({
      where: { createdById: parsed.data.userId },
      data: { createdById: session.user.id },
    }),
    prisma.workflow.updateMany({ where: { createdById: parsed.data.userId }, data: { createdById: session.user.id } }),
    prisma.taskGuestLink.updateMany({
      where: { createdById: parsed.data.userId },
      data: { createdById: session.user.id },
    }),
    prisma.scheduledReminder.updateMany({
      where: { createdById: parsed.data.userId },
      data: { createdById: session.user.id },
    }),
    prisma.user.delete({ where: { id: parsed.data.userId } }),
  ]);

  revalidatePath('/admin/users');
  return { success: true };
}
