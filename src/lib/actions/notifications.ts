'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function markNotificationRead(notificationId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false };

  await prisma.notification.updateMany({
    where: { id: notificationId, recipientId: session.user.id },
    data: { read: true },
  });

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function markAllNotificationsRead() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false };

  await prisma.notification.updateMany({
    where: { recipientId: session.user.id, read: false },
    data: { read: true },
  });

  revalidatePath('/', 'layout');
  return { success: true };
}
