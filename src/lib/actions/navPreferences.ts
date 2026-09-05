'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NAV_ITEMS, defaultOrderOf } from '@/lib/navItems';

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Not authenticated');
  return session;
}

const VALID_KEYS = new Set(NAV_ITEMS.map((item) => item.key));

export async function saveNavOrder(itemKeys: string[]) {
  const session = await requireSession();
  const orderedKeys = itemKeys.filter((key) => VALID_KEYS.has(key));

  await prisma.$transaction(
    orderedKeys.map((key, index) =>
      prisma.navPreference.upsert({
        where: { userId_itemKey: { userId: session.user.id, itemKey: key } },
        create: { userId: session.user.id, itemKey: key, order: index },
        update: { order: index },
      })
    )
  );

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function setNavItemHidden(itemKey: string, hidden: boolean) {
  const session = await requireSession();
  if (!VALID_KEYS.has(itemKey)) {
    return { success: false, error: 'Unknown navigation item' };
  }

  await prisma.navPreference.upsert({
    where: { userId_itemKey: { userId: session.user.id, itemKey } },
    create: { userId: session.user.id, itemKey, hidden, order: defaultOrderOf(itemKey) },
    update: { hidden },
  });

  revalidatePath('/', 'layout');
  return { success: true };
}

export interface GroupInput {
  name: string;
  itemKeys: string[];
}

export async function saveNavGroups(groups: GroupInput[]) {
  const session = await requireSession();

  const operations = [];
  for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
    const group = groups[groupIdx];
    for (let itemIdx = 0; itemIdx < group.itemKeys.length; itemIdx++) {
      const key = group.itemKeys[itemIdx];
      if (VALID_KEYS.has(key)) {
        operations.push(
          prisma.navPreference.upsert({
            where: { userId_itemKey: { userId: session.user.id, itemKey: key } },
            create: {
              userId: session.user.id,
              itemKey: key,
              groupName: group.name.trim() || 'General',
              groupOrder: groupIdx,
              order: itemIdx,
            },
            update: {
              groupName: group.name.trim() || 'General',
              groupOrder: groupIdx,
              order: itemIdx,
            },
          })
        );
      }
    }
  }

  if (operations.length > 0) {
    await prisma.$transaction(operations);
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function resetNavPreferences() {
  const session = await requireSession();
  await prisma.navPreference.deleteMany({ where: { userId: session.user.id } });
  revalidatePath('/', 'layout');
  return { success: true };
}

