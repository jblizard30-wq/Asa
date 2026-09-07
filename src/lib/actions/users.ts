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

export interface CsvUserPreviewRow {
  rowNumber: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'USER';
  password?: string;
  status: 'valid' | 'already_exists' | 'duplicate_in_file' | 'invalid';
  error?: string;
}

export interface CsvUserPreviewResult {
  rows: CsvUserPreviewRow[];
  totalRows: number;
  validCount: number;
  existingCount: number;
  duplicateCount: number;
  invalidCount: number;
}

export function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        field += char;
        i++;
        continue;
      }
    }

    if (char === '"') {
      inQuotes = true;
      i++;
    } else if (char === ',') {
      row.push(field.trim());
      field = '';
      i++;
    } else if (char === '\r') {
      if (i + 1 < text.length && text[i + 1] === '\n') i++;
      row.push(field.trim());
      if (row.some((c) => c.length > 0)) {
        records.push(row);
      }
      row = [];
      field = '';
      i++;
    } else if (char === '\n') {
      row.push(field.trim());
      if (row.some((c) => c.length > 0)) {
        records.push(row);
      }
      row = [];
      field = '';
      i++;
    } else {
      field += char;
      i++;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((c) => c.length > 0)) {
      records.push(row);
    }
  }

  return records;
}

export async function parseAndPreviewUsersCsv(csvContent: string): Promise<CsvUserPreviewResult> {
  await requireAdmin();

  const records = parseCsvRecords(csvContent);
  if (records.length === 0) {
    return {
      rows: [],
      totalRows: 0,
      validCount: 0,
      existingCount: 0,
      duplicateCount: 0,
      invalidCount: 0,
    };
  }

  // Detect header row if present
  let nameCol = 0;
  let emailCol = 1;
  let roleCol = 2;
  let passwordCol = -1;

  const firstRow = records[0].map((c) => c.toLowerCase());
  const isHeader = firstRow.some((col) =>
    ['name', 'full name', 'email', 'e-mail', 'role', 'permission'].includes(col)
  );

  if (isHeader) {
    firstRow.forEach((col, idx) => {
      if (col.includes('name')) nameCol = idx;
      else if (col.includes('email') || col.includes('e-mail')) emailCol = idx;
      else if (col.includes('role') || col.includes('permission') || col.includes('access')) roleCol = idx;
      else if (col.includes('pass')) passwordCol = idx;
    });
  }

  const dataRecords = isHeader ? records.slice(1) : records;

  // Gather all unique emails to check against DB
  const rawEmailsToCheck = dataRecords
    .map((cols) => (cols[emailCol] || '').toLowerCase().trim())
    .filter((e) => e.length > 0 && e.includes('@'));

  const existingUsers =
    rawEmailsToCheck.length > 0
      ? await prisma.user.findMany({
          where: { email: { in: rawEmailsToCheck } },
          select: { email: true },
        })
      : [];
  const existingEmailSet = new Set(existingUsers.map((u) => u.email.toLowerCase()));

  const seenEmailsInFile = new Set<string>();
  const rows: CsvUserPreviewRow[] = [];

  let validCount = 0;
  let existingCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  dataRecords.forEach((cols, idx) => {
    const rowNumber = (isHeader ? 2 : 1) + idx;
    const name = (cols[nameCol] || '').trim();
    const rawEmail = (cols[emailCol] || '').trim();
    const email = rawEmail.toLowerCase();
    const rawRole = (cols[roleCol] || '').trim().toUpperCase();
    const password = passwordCol >= 0 && cols[passwordCol] ? cols[passwordCol].trim() : undefined;

    // Validate role
    let role: 'ADMIN' | 'MANAGER' | 'USER' = 'USER';
    let roleInvalid = false;
    if (rawRole) {
      if (rawRole === 'ADMIN' || rawRole === 'MANAGER' || rawRole === 'USER') {
        role = rawRole;
      } else {
        roleInvalid = true;
      }
    }

    // Validation checks
    let status: CsvUserPreviewRow['status'] = 'valid';
    let error: string | undefined;

    if (!name) {
      status = 'invalid';
      error = 'Name is required';
    } else if (name.length > 120) {
      status = 'invalid';
      error = 'Name exceeds 120 characters';
    } else if (!email || !emailRegex.test(email)) {
      status = 'invalid';
      error = 'Valid email address required';
    } else if (roleInvalid) {
      status = 'invalid';
      error = `Invalid role "${rawRole}". Must be ADMIN, MANAGER, or USER`;
    } else if (password && password.length < 8) {
      status = 'invalid';
      error = 'Password must be at least 8 characters';
    } else if (seenEmailsInFile.has(email)) {
      status = 'duplicate_in_file';
      error = 'Duplicate email within CSV';
    } else if (existingEmailSet.has(email)) {
      status = 'already_exists';
      error = 'Account already exists in system';
    }

    if (email && emailRegex.test(email)) {
      seenEmailsInFile.add(email);
    }

    if (status === 'valid') validCount++;
    else if (status === 'already_exists') existingCount++;
    else if (status === 'duplicate_in_file') duplicateCount++;
    else invalidCount++;

    rows.push({
      rowNumber,
      name,
      email,
      role,
      password,
      status,
      error,
    });
  });

  return {
    rows,
    totalRows: dataRecords.length,
    validCount,
    existingCount,
    duplicateCount,
    invalidCount,
  };
}

const importUsersCsvSchema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        email: z.string().email(),
        role: z.enum(['ADMIN', 'MANAGER', 'USER']),
        password: z.string().min(8).optional().or(z.literal('')),
      })
    )
    .min(1, 'No users to import'),
  sendInvites: z.boolean().default(true),
});

export async function importUsersCsv(input: {
  rows: Array<{ name: string; email: string; role: 'ADMIN' | 'MANAGER' | 'USER'; password?: string }>;
  sendInvites: boolean;
}) {
  await requireAdmin();

  const parsed = importUsersCsvSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input', importedCount: 0, results: [] };
  }

  const { rows, sendInvites } = parsed.data;

  // Filter out any accounts that already exist
  const emails = rows.map((r) => r.email.toLowerCase().trim());
  const existing = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { email: true },
  });
  const existingEmailSet = new Set(existing.map((u) => u.email.toLowerCase()));

  const createdResults: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    inviteUrl?: string;
    temporaryPassword?: string;
  }> = [];

  for (const row of rows) {
    const email = row.email.toLowerCase().trim();
    if (existingEmailSet.has(email)) continue;

    const providedPassword =
      typeof row.password === 'string' && row.password.trim().length > 0 ? row.password.trim() : undefined;
    const effectivePassword = providedPassword || crypto.randomBytes(12).toString('base64url');
    const passwordHash = await bcrypt.hash(effectivePassword, 10);

    const user = await prisma.user.create({
      data: {
        name: row.name,
        email,
        passwordHash,
        role: row.role,
      },
    });

    let inviteUrl: string | undefined;
    if (sendInvites) {
      const token = generateAuthToken(user, 'INVITE');
      inviteUrl = `${getBaseUrl()}/set-password?token=${token}`;
      void sendInviteEmail(email, user.name, inviteUrl, providedPassword ? undefined : effectivePassword);
    }

    createdResults.push({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      inviteUrl,
      temporaryPassword: providedPassword ? undefined : effectivePassword,
    });
  }

  revalidatePath('/admin/users');
  return {
    success: true,
    importedCount: createdResults.length,
    results: createdResults,
  };
}
