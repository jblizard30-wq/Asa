'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

export async function listConnections() {
  const session = await requireSession();
  const connections = await prisma.calendarConnection.findMany({
    where: { userId: session.user.id },
  });
  return connections.map((c) => ({
    id: c.id,
    provider: c.provider,
    externalCalendarId: c.externalCalendarId,
    syncEnabled: c.syncEnabled,
    lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  }));
}

export async function disconnectConnection(id: string) {
  const session = await requireSession();
  const connection = await prisma.calendarConnection.findUnique({ where: { id } });
  if (!connection || connection.userId !== session.user.id) {
    return { success: false, error: 'Connection not found.' };
  }

  await prisma.calendarConnection.delete({ where: { id } });
  revalidatePath('/settings/integrations');
  return { success: true };
}
