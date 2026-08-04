'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { requireSession } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { EMPTY_TASK_FILTERS, type TaskFilters } from '@/lib/taskFilters';

export interface SavedFilterDTO {
  id: string;
  name: string;
  scope: string;
  projectId: string | null;
  filters: TaskFilters;
  order: number;
}

function toDTO(row: { id: string; name: string; scope: string; projectId: string | null; filters: unknown; order: number }): SavedFilterDTO {
  return {
    id: row.id,
    name: row.name,
    scope: row.scope,
    projectId: row.projectId,
    // Stored as-is when saved; merge over EMPTY_TASK_FILTERS so older rows missing newer keys still work.
    filters: { ...EMPTY_TASK_FILTERS, ...(row.filters as Partial<TaskFilters>) },
    order: row.order,
  };
}

/** Revalidate whichever page could be showing this scope's filter bar. */
function revalidateScope(scope: string, projectId?: string | null) {
  if (scope === 'project' && projectId) revalidatePath(`/projects/${projectId}`);
  else if (scope === 'my-tasks') revalidatePath('/my-tasks');
  else if (scope === 'calendar') revalidatePath('/calendar');
}

export async function listSavedFilters(scope: string, projectId?: string): Promise<SavedFilterDTO[]> {
  const session = await requireSession();

  const rows = await prisma.savedFilter.findMany({
    where: { userId: session.user.id, scope, projectId: projectId ?? null },
    orderBy: { order: 'asc' },
  });

  return rows.map(toDTO);
}

const saveFilterSchema = z.object({
  name: z.string().min(1, 'Name is required').max(60),
  scope: z.string().min(1).max(40),
  projectId: z.string().optional(),
});

export async function saveFilter(
  name: string,
  scope: string,
  filters: TaskFilters,
  projectId?: string,
): Promise<{ success: true; filter: SavedFilterDTO } | { success: false; error: string }> {
  const session = await requireSession();

  const parsed = saveFilterSchema.safeParse({ name, scope, projectId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid saved filter' };
  }

  const maxOrder = await prisma.savedFilter.aggregate({
    where: { userId: session.user.id, scope: parsed.data.scope, projectId: parsed.data.projectId ?? null },
    _max: { order: true },
  });

  const row = await prisma.savedFilter.create({
    data: {
      userId: session.user.id,
      name: parsed.data.name,
      scope: parsed.data.scope,
      projectId: parsed.data.projectId ?? null,
      filters: filters as unknown as Prisma.InputJsonValue,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  revalidateScope(parsed.data.scope, parsed.data.projectId);
  return { success: true, filter: toDTO(row) };
}

export async function deleteSavedFilter(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await requireSession();

  const existing = await prisma.savedFilter.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return { success: false, error: 'Saved filter not found' };
  }

  await prisma.savedFilter.delete({ where: { id } });
  revalidateScope(existing.scope, existing.projectId);
  return { success: true };
}

/** Persists a new order for the caller's saved filters within a single scope; ids the caller doesn't own are ignored. */
export async function reorderSavedFilters(ids: string[]): Promise<{ success: boolean }> {
  const session = await requireSession();

  const owned = await prisma.savedFilter.findMany({
    where: { id: { in: ids }, userId: session.user.id },
    select: { id: true, scope: true, projectId: true },
  });
  const ownedIds = new Set(owned.map((o) => o.id));

  await Promise.all(
    ids
      .filter((id) => ownedIds.has(id))
      .map((id, index) => prisma.savedFilter.update({ where: { id }, data: { order: index } })),
  );

  for (const { scope, projectId } of owned) revalidateScope(scope, projectId);
  return { success: true };
}
