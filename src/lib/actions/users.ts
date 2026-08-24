'use server';

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/permissions';
import { generateAuthToken, verifyAuthToken } from '@/lib/authTokens';
import { sendInviteEmail, sendPasswordResetEmail } from '@/lib/email';
import { getBaseUrl } from '@/lib/site';

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

const bulkUpdateUserRoleSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1),
  role: z.enum(['ADMIN', 'MANAGER', 'USER']),
});

/** Applies the same role to many users at once — the admin users table's multi-select toolbar. */
export async function bulkUpdateUserRole(userIds: string[], role: string) {
  const session = await requireAdmin();

  const parsed = bulkUpdateUserRoleSchema.safeParse({ userIds, role });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // Self is never included — the UI disables selecting your own row so this is just a safety net.
  const targetIds = parsed.data.userIds.filter((id) => id !== session.user.id);
  if (targetIds.length === 0) {
    return { success: false, error: 'You cannot change your own administrator access this way.' };
  }

  const result = await prisma.user.updateMany({ where: { id: { in: targetIds } }, data: { role: parsed.data.role } });

  revalidatePath('/admin/users');
  return { success: true, updatedCount: result.count };
}

const bulkDeleteUsersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1),
});

/** Deletes many users at once, reassigning their owned records to the acting admin in one transaction — mirrors deleteUser's reassignment logic for the multi-select toolbar. */
export async function bulkDeleteUsers(userIds: string[]) {
  const session = await requireAdmin();

  const parsed = bulkDeleteUsersSchema.safeParse({ userIds });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const targetIds = parsed.data.userIds.filter((id) => id !== session.user.id);
  if (targetIds.length === 0) {
    return { success: false, error: 'You cannot delete your own account.' };
  }

  const targets = await prisma.user.findMany({ where: { id: { in: targetIds } } });
  if (targets.length === 0) {
    return { success: false, error: 'No matching users found.' };
  }

  await prisma.$transaction([
    prisma.project.updateMany({ where: { createdById: { in: targetIds } }, data: { createdById: session.user.id } }),
    prisma.comment.updateMany({ where: { userId: { in: targetIds } }, data: { userId: session.user.id } }),
    prisma.reminder.updateMany({ where: { senderId: { in: targetIds } }, data: { senderId: session.user.id } }),
    prisma.automationRule.updateMany({
      where: { createdById: { in: targetIds } },
      data: { createdById: session.user.id },
    }),
    prisma.attachment.updateMany({
      where: { uploadedById: { in: targetIds } },
      data: { uploadedById: session.user.id },
    }),
    prisma.intakeForm.updateMany({
      where: { createdById: { in: targetIds } },
      data: { createdById: session.user.id },
    }),
    prisma.workflow.updateMany({ where: { createdById: { in: targetIds } }, data: { createdById: session.user.id } }),
    prisma.user.deleteMany({ where: { id: { in: targetIds } } }),
  ]);

  revalidatePath('/admin/users');
  return { success: true, deletedCount: targets.length };
}

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  role: z.enum(['ADMIN', 'MANAGER', 'USER']),
  sendInvite: z.boolean().default(true),
});

export async function createUser(formData: FormData) {
  await requireAdmin();

  const rawPassword = formData.get('password');
  const password = typeof rawPassword === 'string' && rawPassword.trim().length > 0 ? rawPassword.trim() : undefined;
  const sendInvite = formData.get('sendInvite') === 'true' || formData.get('sendInvite') === 'on' || formData.get('sendInvite') === null;

  const parsed = createUserSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: password || '',
    role: formData.get('role') || 'USER',
    sendInvite,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: 'An account with that email already exists.' };
  }

  // If no password provided, generate a secure random temporary password hash
  const effectivePassword = password || crypto.randomBytes(24).toString('hex');
  const passwordHash = await bcrypt.hash(effectivePassword, 10);

  const newUser = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash,
      role: parsed.data.role,
    },
  });

  let inviteUrl: string | undefined;

  if (sendInvite) {
    const token = generateAuthToken(newUser, 'INVITE');
    inviteUrl = `${getBaseUrl()}/set-password?token=${token}`;
    void sendInviteEmail(email, newUser.name, inviteUrl, password ? effectivePassword : undefined);
  }

  revalidatePath('/admin/users');
  return { success: true, inviteUrl, userId: newUser.id };
}

/** Sends or resends a first-time login invite email to an existing user. */
export async function sendUserInvite(userId: string) {
  await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { success: false, error: 'User not found.' };
  }

  const token = generateAuthToken(user, 'INVITE');
  const inviteUrl = `${getBaseUrl()}/set-password?token=${token}`;

  await sendInviteEmail(user.email, user.name, inviteUrl);
  return { success: true, inviteUrl, email: user.email };
}

/** Sends a password reset email to a user. */
export async function sendUserPasswordReset(userId: string) {
  await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { success: false, error: 'User not found.' };
  }

  const token = generateAuthToken(user, 'PASSWORD_RESET');
  const resetUrl = `${getBaseUrl()}/set-password?token=${token}`;

  await sendPasswordResetEmail(user.email, user.name, resetUrl);
  return { success: true, resetUrl, email: user.email };
}

const adminResetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/** Allows an admin to manually set a user's password directly. */
export async function adminResetPassword(userId: string, newPassword: string) {
  await requireAdmin();

  const parsed = adminResetPasswordSchema.safeParse({ userId, password: newPassword });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) {
    return { success: false, error: 'User not found.' };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  revalidatePath('/admin/users');
  return { success: true };
}

const setPasswordWithTokenSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/** Public action allowing a user with a valid invite or reset token to set their password. */
export async function setPasswordWithToken(token: string, newPassword: string) {
  const parsed = setPasswordWithTokenSchema.safeParse({ token, password: newPassword });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const verification = await verifyAuthToken(parsed.data.token);
  if (!verification.valid || !verification.user) {
    return { success: false, error: verification.error ?? 'Invalid or expired link.' };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  // Updating the passwordHash automatically and immediately invalidates this token and any other tokens
  await prisma.user.update({
    where: { id: verification.user.id },
    data: { passwordHash },
  });

  return { success: true, email: verification.user.email };
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
    prisma.user.delete({ where: { id: parsed.data.userId } }),
  ]);

  revalidatePath('/admin/users');
  return { success: true };
}
