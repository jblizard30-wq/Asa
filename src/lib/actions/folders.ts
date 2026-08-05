'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

export async function moveProjectToFolder(projectId: string, folderId: string | null, destIndex?: number) {
  const session = await requireSession();

  // Same visibility rule as createFolderFromProjects: admins can organize any project, everyone
  // else only their own memberships — without this, any signed-in user could link an arbitrary
  // (including inaccessible) project into their own folder.
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      isPersonal: false,
      ...(session.user.role === 'ADMIN' ? {} : { members: { some: { userId: session.user.id } } }),
    },
  });
  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  await prisma.projectFolderItem.deleteMany({
    where: { projectId, folder: { userId: session.user.id } },
  });

  if (folderId) {
    const folder = await prisma.projectFolder.findUnique({ where: { id: folderId }, include: { items: true } });
    if (!folder || folder.userId !== session.user.id) {
      return { success: false, error: 'Folder not found' };
    }

    // Insert at the dropped position rather than always appending: reorder the whole folder in
    // one transaction, same idiom as reorderFolderItems.
    const existingIds = folder.items
      .filter((item) => item.projectId !== projectId)
      .sort((a, b) => a.order - b.order)
      .map((item) => item.projectId);
    const insertAt = destIndex === undefined ? existingIds.length : Math.min(Math.max(destIndex, 0), existingIds.length);
    const orderedIds = [...existingIds.slice(0, insertAt), projectId, ...existingIds.slice(insertAt)];

    await prisma.projectFolderItem.create({ data: { folderId, projectId, order: existingIds.length } });
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.projectFolderItem.updateMany({ where: { folderId, projectId: id }, data: { order: index } }),
      ),
    );
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function reorderFolders(orderedFolderIds: string[]) {
  const session = await requireSession();

  const folders = await prisma.projectFolder.findMany({
    where: { userId: session.user.id },
    select: { id: true },
  });
  const validIds = new Set(folders.map((f) => f.id));
  if (orderedFolderIds.length === 0 || !orderedFolderIds.every((id) => validIds.has(id))) {
    return { success: false, error: 'Folder not found' };
  }

  await prisma.$transaction(
    orderedFolderIds.map((id, index) => prisma.projectFolder.update({ where: { id }, data: { order: index } })),
  );

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function reorderFolderItems(folderId: string, orderedProjectIds: string[]) {
  const session = await requireSession();

  const folder = await prisma.projectFolder.findUnique({
    where: { id: folderId },
    include: { items: true },
  });
  if (!folder || folder.userId !== session.user.id) {
    return { success: false, error: 'Folder not found' };
  }

  const itemIdByProjectId = new Map(folder.items.map((item) => [item.projectId, item.id]));
  if (orderedProjectIds.length === 0 || !orderedProjectIds.every((id) => itemIdByProjectId.has(id))) {
    return { success: false, error: 'Project not found in folder' };
  }

  await prisma.$transaction(
    orderedProjectIds.map((projectId, index) =>
      prisma.projectFolderItem.update({ where: { id: itemIdByProjectId.get(projectId)! }, data: { order: index } }),
    ),
  );

  revalidatePath('/', 'layout');
  return { success: true };
}

/** Finds the first name in `{userId, name}` that isn't already taken, appending " (2)", " (3)", etc. */
async function nextAvailableFolderName(userId: string, baseName: string): Promise<string> {
  const existing = await prisma.projectFolder.findMany({ where: { userId }, select: { name: true } });
  const taken = new Set(existing.map((f) => f.name));
  if (!taken.has(baseName)) return baseName;

  for (let n = 2; n < 100; n++) {
    const suffix = ` (${n})`;
    const candidate =
      baseName.length + suffix.length > 60 ? `${baseName.slice(0, 60 - suffix.length)}${suffix}` : `${baseName}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${baseName.slice(0, 40)} (${Date.now()})`;
}

/** Drag-one-project-onto-another sidebar gesture: creates a new folder containing both in one transaction. */
export async function createFolderFromProjects(projectIds: string[], name?: string) {
  const session = await requireSession();

  const uniqueIds = [...new Set(projectIds)];
  if (uniqueIds.length < 2) {
    return { success: false, error: 'Select at least two projects to combine.' };
  }

  // Same visibility rule the sidebar itself uses to decide which projects a user can see
  // (layout.tsx): admins can organize any project, not just ones they're a member of.
  const projects = await prisma.project.findMany({
    where: {
      id: { in: uniqueIds },
      isPersonal: false,
      ...(session.user.role === 'ADMIN' ? {} : { members: { some: { userId: session.user.id } } }),
    },
  });
  if (projects.length !== uniqueIds.length) {
    return { success: false, error: 'Project not found' };
  }

  const baseName = (name?.trim() || projects.map((p) => p.name).join(' & ')).slice(0, 60);
  const parsedBase = folderNameSchema.safeParse(baseName);
  if (!parsedBase.success) {
    return { success: false, error: parsedBase.error.issues[0]?.message ?? 'Invalid name' };
  }
  const finalName = await nextAvailableFolderName(session.user.id, parsedBase.data);

  const maxOrder = await prisma.projectFolder.aggregate({
    where: { userId: session.user.id },
    _max: { order: true },
  });

  const folder = await prisma.$transaction(async (tx) => {
    const created = await tx.projectFolder.create({
      data: { name: finalName, userId: session.user.id, order: (maxOrder._max.order ?? -1) + 1 },
    });
    await tx.projectFolderItem.deleteMany({
      where: { projectId: { in: uniqueIds }, folder: { userId: session.user.id } },
    });
    await tx.projectFolderItem.createMany({
      data: uniqueIds.map((projectId, index) => ({ folderId: created.id, projectId, order: index })),
    });
    return created;
  });

  revalidatePath('/', 'layout');
  return { success: true, folderId: folder.id, folderName: folder.name };
}
