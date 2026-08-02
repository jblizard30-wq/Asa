'use server';

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
