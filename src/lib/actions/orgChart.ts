'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin, isSelfOrAncestorManager } from '@/lib/permissions';

const setUserManagerSchema = z.object({
  userId: z.string().min(1),
  managerId: z.string().min(1).nullable(),
});

export async function setUserManager(userId: string, managerId: string | null) {
  await requireAdmin();

  const parsed = setUserManagerSchema.safeParse({ userId, managerId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  if (parsed.data.managerId) {
    if (parsed.data.managerId === parsed.data.userId) {
      return { success: false, error: 'A person cannot report to themselves.' };
    }
    if (await isSelfOrAncestorManager(parsed.data.userId, parsed.data.managerId)) {
      return { success: false, error: 'That would create a reporting loop.' };
    }
  }

  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { managerId: parsed.data.managerId },
  });

  revalidatePath('/org-chart');
  return { success: true };
}
