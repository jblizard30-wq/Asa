'use server';

import crypto from 'crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { hashKey } from '@/lib/apiAuth';

const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
});

export async function createApiKey(name: string) {
  const session = await requireSession();
  const parsed = createApiKeySchema.safeParse({ name });
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const rawKey = crypto.randomBytes(32).toString('hex');
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 8);

  await prisma.apiKey.create({
    data: { userId: session.user.id, name: parsed.data.name, keyHash, keyPrefix },
  });

  revalidatePath('/settings/developer');
  // Raw key is only ever available here — it is not derivable from the stored hash.
  return { success: true as const, rawKey };
}

export async function listApiKeys() {
  const session = await requireSession();
  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, revokedAt: true, createdAt: true },
  });
  return keys.map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    revokedAt: k.revokedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  }));
}

export async function revokeApiKey(id: string) {
  const session = await requireSession();
  const key = await prisma.apiKey.findUnique({ where: { id } });
  if (!key || key.userId !== session.user.id) {
    return { success: false, error: 'API key not found.' };
  }

  await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  revalidatePath('/settings/developer');
  return { success: true };
}
