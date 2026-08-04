'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { NotificationType, DigestFrequency } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/permissions';

export async function getPreferences(): Promise<{
  emailByType: Record<NotificationType, boolean>;
  digestFrequency: DigestFrequency;
  preferredDigestHour: number;
}> {
  const session = await requireSession();

  const [rows, user] = await Promise.all([
    prisma.notificationPreference.findMany({ where: { userId: session.user.id } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { digestFrequency: true, preferredDigestHour: true },
    }),
  ]);

  const overrides = new Map(rows.map((r) => [r.type, r.emailEnabled]));
  const emailByType = Object.fromEntries(
    Object.values(NotificationType).map((type) => [type, overrides.get(type) ?? true])
  ) as Record<NotificationType, boolean>;

  return {
    emailByType,
    digestFrequency: user?.digestFrequency ?? 'OFF',
    preferredDigestHour: user?.preferredDigestHour ?? 7,
  };
}

const setPreferenceSchema = z.object({
  type: z.nativeEnum(NotificationType),
  emailEnabled: z.boolean(),
});

export async function setPreference(type: NotificationType, emailEnabled: boolean) {
  const session = await requireSession();
  const parsed = setPreferenceSchema.safeParse({ type, emailEnabled });
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  await prisma.notificationPreference.upsert({
    where: { userId_type: { userId: session.user.id, type: parsed.data.type } },
    create: { userId: session.user.id, type: parsed.data.type, emailEnabled: parsed.data.emailEnabled },
    update: { emailEnabled: parsed.data.emailEnabled },
  });

  revalidatePath('/settings/notifications');
  return { success: true };
}

export async function setDigestFrequency(frequency: DigestFrequency) {
  const session = await requireSession();
  const parsed = z.nativeEnum(DigestFrequency).safeParse(frequency);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  await prisma.user.update({ where: { id: session.user.id }, data: { digestFrequency: parsed.data } });

  revalidatePath('/settings/notifications');
  return { success: true };
}

export async function setPreferredDigestHour(hour: number) {
  const session = await requireSession();
  const parsed = z.number().int().min(0).max(23).safeParse(hour);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  await prisma.user.update({ where: { id: session.user.id }, data: { preferredDigestHour: parsed.data } });

  revalidatePath('/settings/notifications');
  return { success: true };
}
