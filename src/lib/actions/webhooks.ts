'use server';

import crypto from 'crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { WebhookEvent } from '@prisma/client';
import { requireAdmin, requireSession } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { assertPublicHttpUrl } from '@/lib/webhooks/urlSafety';

const createWebhookSchema = z.object({
  url: z.string().url('Enter a valid URL'),
  events: z.array(z.nativeEnum(WebhookEvent)).min(1, 'Select at least one event'),
  secret: z.string().min(1).optional(),
});

// Webhooks fan out every task/comment event org-wide, across every project regardless of the
// creator's membership — an org-wide integration capability, not a per-project one, so creating
// (and thus receiving that firehose) is restricted to admins the same way workflows.ts is.
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

export async function listWebhooks() {
  const session = await requireSession();
  const webhooks = await prisma.webhook.findMany({
    where: { createdById: session.user.id },
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
  const session = await requireSession();
  const webhook = await prisma.webhook.findUnique({ where: { id } });
  if (!webhook || webhook.createdById !== session.user.id) {
    return { success: false, error: 'Webhook not found.' };
  }

  await prisma.webhook.update({ where: { id }, data: { isActive: !webhook.isActive } });
  revalidatePath('/settings/developer');
  return { success: true };
}

export async function deleteWebhook(id: string) {
  const session = await requireSession();
  const webhook = await prisma.webhook.findUnique({ where: { id } });
  if (!webhook || webhook.createdById !== session.user.id) {
    return { success: false, error: 'Webhook not found.' };
  }

  await prisma.webhook.delete({ where: { id } });
  revalidatePath('/settings/developer');
  return { success: true };
}
