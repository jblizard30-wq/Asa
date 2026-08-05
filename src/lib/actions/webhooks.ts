'use server';

import crypto from 'crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { WebhookEvent } from '@prisma/client';
import { requireAdmin } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { assertPublicHttpUrl } from '@/lib/urlSafety';

const createWebhookSchema = z.object({
  url: z.string().url('Enter a valid URL'),
  events: z.array(z.nativeEnum(WebhookEvent)).min(1, 'Select at least one event'),
  secret: z.string().min(1).optional(),
});

// Webhooks fire on every matching event across the whole org (not scoped to the creator's own
// projects), so creating one is an admin-level action, not a per-user convenience.
export async function createWebhook(url: string, events: WebhookEvent[], secret?: string) {
  const session = await requireAdmin();
  const parsed = createWebhookSchema.safeParse({ url, events, secret });
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  try {
    await assertPublicHttpUrl(parsed.data.url);
  } catch (err) {
    return { success: false as const, error: err instanceof Error ? err.message : 'Invalid URL' };
  }

  const resolvedSecret = parsed.data.secret ?? crypto.randomBytes(24).toString('hex');

  const webhook = await prisma.webhook.create({
    data: {
      createdById: session.user.id,
      url: parsed.data.url,
      events: parsed.data.events,
      secret: resolvedSecret,
    },
  });

  revalidatePath('/settings/developer');
  return { success: true as const, id: webhook.id, secret: resolvedSecret };
}

// Webhooks are org-wide, not per-creator, so listing/toggling/deleting them is admin-level just
// like creating one — matches the requireAdmin() gate in createWebhook above.
export async function listWebhooks() {
  await requireAdmin();
  const webhooks = await prisma.webhook.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, url: true, events: true, isActive: true, createdAt: true },
  });
  return webhooks.map((w) => ({
    id: w.id,
    url: w.url,
    events: w.events,
    isActive: w.isActive,
    createdAt: w.createdAt.toISOString(),
  }));
}

export async function toggleWebhook(id: string) {
  await requireAdmin();
  const webhook = await prisma.webhook.findUnique({ where: { id } });
  if (!webhook) {
    return { success: false, error: 'Webhook not found.' };
  }

  await prisma.webhook.update({ where: { id }, data: { isActive: !webhook.isActive } });
  revalidatePath('/settings/developer');
  return { success: true };
}

export async function deleteWebhook(id: string) {
  await requireAdmin();
  const webhook = await prisma.webhook.findUnique({ where: { id } });
  if (!webhook) {
    return { success: false, error: 'Webhook not found.' };
  }

  await prisma.webhook.delete({ where: { id } });
  revalidatePath('/settings/developer');
  return { success: true };
}
