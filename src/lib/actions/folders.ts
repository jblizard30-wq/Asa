'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireProjectMember } from '@/lib/actions/tasks';

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Not authenticated');
  return session;
}

const folderNameSchema = z.string().min(1, 'Folder name is required').max(60);

export async function createFolder(name: string) {
  const session = await requireSession();

  const parsed = folderNameSchema.safeParse(name);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid name' };
  }

  const existing = await prisma.projectFolder.findUnique({
    where: { userId_name: { userId: session.user.id, name: parsed.data } },
  });
  if (existing) {
    return { success: false, error: 'A folder with that name already exists.' };
  }

  const maxOrder = await prisma.projectFolder.aggregate({
    where: { userId: session.user.id },
    _max: { order: true },
  });

  const folder = await prisma.projectFolder.create({
    data: {
      name: parsed.data,
      userId: session.user.id,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  revalidatePath('/', 'layout');
  return { success: true, folderId: folder.id };
}

export async function renameFolder(folderId: string, name: string) {
  const session = await requireSession();

  const parsed = folderNameSchema.safeParse(name);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid name' };
  }

  const folder = await prisma.projectFolder.findUnique({ where: { id: folderId } });
  if (!folder || folder.userId !== session.user.id) {
    return { success: false, error: 'Folder not found' };
  }

  await prisma.projectFolder.update({ where: { id: folderId }, data: { name: parsed.data } });
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function deleteFolder(folderId: string) {
  const session = await requireSession();

  const folder = await prisma.projectFolder.findUnique({ where: { id: folderId } });
  if (!folder || folder.userId !== session.user.id) {
    return { success: false, error: 'Folder not found' };
  }

  await prisma.projectFolder.delete({ where: { id: folderId } });
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function moveProjectToFolder(projectId: string, folderId: string | null) {
  const session = await requireSession();
  await requireProjectMember(projectId);

  await prisma.projectFolderItem.deleteMany({
    where: { projectId, folder: { userId: session.user.id } },
  });

  if (folderId) {
    const folder = await prisma.projectFolder.findUnique({ where: { id: folderId } });
    if (!folder || folder.userId !== session.user.id) {
      return { success: false, error: 'Folder not found' };
    }

    const maxOrder = await prisma.projectFolderItem.aggregate({
      where: { folderId },
      _max: { order: true },
    });

    await prisma.projectFolderItem.create({
      data: { folderId, projectId, order: (maxOrder._max.order ?? -1) + 1 },
    });
  }

  revalidatePath('/', 'layout');
  return { success: true };
}
