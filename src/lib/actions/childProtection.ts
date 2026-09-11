'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/modules';
import { requireProjectMember, filterToAssignableUsers } from '@/lib/actions/tasks';
import {
  computeRecordStatus,
  computeMinistrySafeExpiry,
  computeBackgroundCheckExpiry,
  checkChildProtectionAccess,
  parseChildProtectionImportRows,
  detectRenewalOverwrite,
  buildRenewalTaskContent,
  type SerializedChildProtectionRecord,
  type ChildProtectionStatus,
  type ParsedChildProtectionImportRow,
  type RenewalAuditEntry,
} from '@/lib/childProtection';

/**
 * The six cert columns `detectRenewalOverwrite` compares against. Every write path that
 * can overwrite a renewal in place must select these before building its update, or the
 * prior values are gone before there's a chance to archive them.
 */
const CERT_AUDIT_SELECT = {
  ministrySafeCompletedAt: true,
  ministrySafeExpiresAt: true,
  ministrySafeUrl: true,
  backgroundCheckCompletedAt: true,
  backgroundCheckExpiresAt: true,
  backgroundCheckUrl: true,
} as const;

type CertAuditFields = {
  ministrySafeCompletedAt: Date | null;
  ministrySafeExpiresAt: Date | null;
  ministrySafeUrl: string | null;
  backgroundCheckCompletedAt: Date | null;
  backgroundCheckExpiresAt: Date | null;
  backgroundCheckUrl: string | null;
};

function collectRenewalAudits(
  existing: CertAuditFields,
  incoming: {
    ministrySafeCompletedAt?: string | Date | null;
    ministrySafeUrl?: string | null;
    backgroundCheckCompletedAt?: string | Date | null;
    backgroundCheckUrl?: string | null;
  }
): RenewalAuditEntry[] {
  return [
    detectRenewalOverwrite(
      {
        completedAt: existing.ministrySafeCompletedAt,
        expiresAt: existing.ministrySafeExpiresAt,
        url: existing.ministrySafeUrl,
      },
      { completedAt: incoming.ministrySafeCompletedAt, url: incoming.ministrySafeUrl },
      'MINISTRY_SAFE'
    ),
    detectRenewalOverwrite(
      {
        completedAt: existing.backgroundCheckCompletedAt,
        expiresAt: existing.backgroundCheckExpiresAt,
        url: existing.backgroundCheckUrl,
      },
      { completedAt: incoming.backgroundCheckCompletedAt, url: incoming.backgroundCheckUrl },
      'BACKGROUND_CHECK'
    ),
  ].filter((entry): entry is RenewalAuditEntry => entry !== null);
}

export interface ChildProtectionMetrics {
  total: number;
  compliant: number;
  expiringSoon: number;
  expired: number;
  incomplete: number;
}

export interface ChildProtectionResponse {
  records: SerializedChildProtectionRecord[];
  metrics: ChildProtectionMetrics;
  userAccess: 'VIEW' | 'EDIT' | null;
  availableProjects: { id: string; name: string; defaultSectionId: string }[];
  assignableUsers: { id: string; name: string; email: string }[];
}

export async function listChildProtectionData(): Promise<{
  success: boolean;
  data?: ChildProtectionResponse;
  error?: string;
}> {
  if (!isModuleEnabled('child_protection')) {
    return { success: false, error: 'Child Protection module is not enabled.' };
  }

  const session = await getServerSession(authOptions);
  const { allowed, access } = await checkChildProtectionAccess(session);

  if (!allowed || !access) {
    return { success: false, error: 'Unauthorized. You do not have access to Child Protection records.' };
  }

  const rawRecords = await prisma.childProtectionRecord.findMany({
    where: { archivedAt: null },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { name: 'asc' },
  });

  const now = new Date();
  const metrics: ChildProtectionMetrics = {
    total: rawRecords.length,
    compliant: 0,
    expiringSoon: 0,
    expired: 0,
    incomplete: 0,
  };

  const records: SerializedChildProtectionRecord[] = rawRecords.map((r) => {
    const { status, daysUntilMinistrySafeExpires, daysUntilBackgroundCheckExpires, daysUntilNextRenewal } =
      computeRecordStatus({
        docusignSigned: r.docusignSigned,
        ministrySafeCompletedAt: r.ministrySafeCompletedAt,
        ministrySafeExpiresAt: r.ministrySafeExpiresAt,
        backgroundCheckCompletedAt: r.backgroundCheckCompletedAt,
        backgroundCheckExpiresAt: r.backgroundCheckExpiresAt,
        now,
      });

    if (status === 'COMPLIANT') metrics.compliant += 1;
    else if (status === 'EXPIRING_SOON') metrics.expiringSoon += 1;
    else if (status === 'EXPIRED') metrics.expired += 1;
    else if (status === 'INCOMPLETE') metrics.incomplete += 1;

    return {
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      ministries: r.ministries,
      docusignSigned: r.docusignSigned,
      docusignSignedAt: r.docusignSignedAt ? r.docusignSignedAt.toISOString() : null,
      docusignUrl: r.docusignUrl,
      ministrySafeCompletedAt: r.ministrySafeCompletedAt ? r.ministrySafeCompletedAt.toISOString() : null,
      ministrySafeExpiresAt: r.ministrySafeExpiresAt ? r.ministrySafeExpiresAt.toISOString() : null,
      ministrySafeUrl: r.ministrySafeUrl,
      backgroundCheckCompletedAt: r.backgroundCheckCompletedAt ? r.backgroundCheckCompletedAt.toISOString() : null,
      backgroundCheckExpiresAt: r.backgroundCheckExpiresAt ? r.backgroundCheckExpiresAt.toISOString() : null,
      backgroundCheckUrl: r.backgroundCheckUrl,
      notes: r.notes,
      userId: r.userId,
      user: r.user,
      status,
      daysUntilMinistrySafeExpires,
      daysUntilBackgroundCheckExpires,
      daysUntilNextRenewal,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });

  // Fetch available projects for review task generation
  const projects = await prisma.project.findMany({
    where: { isPersonal: false },
    select: {
      id: true,
      name: true,
      sections: { select: { id: true }, orderBy: { order: 'asc' }, take: 1 },
    },
    orderBy: { name: 'asc' },
  });

  const availableProjects = projects
    .filter((p) => p.sections.length > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      defaultSectionId: p.sections[0].id,
    }));

  // Fetch active users for task assignment
  const assignableUsers = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });

  return {
    success: true,
    data: {
      records,
      metrics,
      userAccess: access,
      availableProjects,
      assignableUsers,
    },
  };
}

export interface UpsertChildProtectionRecordInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  ministries?: string[];
  docusignSigned?: boolean;
  docusignSignedAt?: string | null;
  docusignUrl?: string | null;
  ministrySafeCompletedAt?: string | null;
  ministrySafeUrl?: string | null;
  backgroundCheckCompletedAt?: string | null;
  backgroundCheckUrl?: string | null;
  notes?: string | null;
  userId?: string | null;
}

export async function createChildProtectionRecord(input: UpsertChildProtectionRecordInput) {
  if (!isModuleEnabled('child_protection')) {
    return { success: false, error: 'Child Protection module is not enabled.' };
  }

  const session = await getServerSession(authOptions);
  const { allowed, access } = await checkChildProtectionAccess(session);
  if (!allowed || access !== 'EDIT') {
    return { success: false, error: 'Unauthorized. You must have edit access to add records.' };
  }

  if (!input.name || !input.name.trim()) {
    return { success: false, error: 'Name is required.' };
  }

  const msCompletedAt = input.ministrySafeCompletedAt ? new Date(input.ministrySafeCompletedAt) : null;
  const msExpiresAt = msCompletedAt ? computeMinistrySafeExpiry(msCompletedAt) : null;

  const bgCompletedAt = input.backgroundCheckCompletedAt ? new Date(input.backgroundCheckCompletedAt) : null;
  const bgExpiresAt = bgCompletedAt ? computeBackgroundCheckExpiry(bgCompletedAt) : null;

  const docSignedAt = input.docusignSignedAt ? new Date(input.docusignSignedAt) : input.docusignSigned ? new Date() : null;

  const record = await prisma.childProtectionRecord.create({
    data: {
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      ministries: input.ministries ?? [],
      docusignSigned: input.docusignSigned ?? false,
      docusignSignedAt: docSignedAt,
      docusignUrl: input.docusignUrl?.trim() || null,
      ministrySafeCompletedAt: msCompletedAt,
      ministrySafeExpiresAt: msExpiresAt,
      ministrySafeUrl: input.ministrySafeUrl?.trim() || null,
      backgroundCheckCompletedAt: bgCompletedAt,
      backgroundCheckExpiresAt: bgExpiresAt,
      backgroundCheckUrl: input.backgroundCheckUrl?.trim() || null,
      notes: input.notes?.trim() || null,
      userId: input.userId || null,
      createdById: session?.user?.id || null,
    },
  });

  revalidatePath('/admin/child-protection');
  return { success: true, data: record };
}

export async function updateChildProtectionRecord(id: string, input: Partial<UpsertChildProtectionRecordInput>) {
  if (!isModuleEnabled('child_protection')) {
    return { success: false, error: 'Child Protection module is not enabled.' };
  }

  const session = await getServerSession(authOptions);
  const { allowed, access } = await checkChildProtectionAccess(session);
  if (!allowed || access !== 'EDIT') {
    return { success: false, error: 'Unauthorized. You must have edit access to update records.' };
  }

  const existing = await prisma.childProtectionRecord.findUnique({
    where: { id },
  });

  if (!existing || existing.archivedAt) {
    return { success: false, error: 'Record not found.' };
  }

  const data: Record<string, any> = {};

  if (input.name !== undefined) data.name = input.name.trim();
  if (input.email !== undefined) data.email = input.email ? input.email.trim() : null;
  if (input.phone !== undefined) data.phone = input.phone ? input.phone.trim() : null;
  if (input.ministries !== undefined) data.ministries = input.ministries;
  if (input.notes !== undefined) data.notes = input.notes ? input.notes.trim() : null;
  if (input.userId !== undefined) data.userId = input.userId || null;

  // DocuSign
  if (input.docusignSigned !== undefined) {
    data.docusignSigned = input.docusignSigned;
    if (input.docusignSigned && !existing.docusignSignedAt && !input.docusignSignedAt) {
      data.docusignSignedAt = new Date();
    } else if (!input.docusignSigned) {
      data.docusignSignedAt = null;
    }
  }
  if (input.docusignSignedAt !== undefined) {
    data.docusignSignedAt = input.docusignSignedAt ? new Date(input.docusignSignedAt) : null;
  }
  if (input.docusignUrl !== undefined) {
    data.docusignUrl = input.docusignUrl ? input.docusignUrl.trim() : null;
  }

  // MinistrySafe (3-year renewal overwrite)
  if (input.ministrySafeCompletedAt !== undefined) {
    const msDate = input.ministrySafeCompletedAt ? new Date(input.ministrySafeCompletedAt) : null;
    data.ministrySafeCompletedAt = msDate;
    data.ministrySafeExpiresAt = msDate ? computeMinistrySafeExpiry(msDate) : null;
  }
  if (input.ministrySafeUrl !== undefined) {
    data.ministrySafeUrl = input.ministrySafeUrl ? input.ministrySafeUrl.trim() : null;
  }

  // Background Check (5-year renewal overwrite)
  if (input.backgroundCheckCompletedAt !== undefined) {
    const bgDate = input.backgroundCheckCompletedAt ? new Date(input.backgroundCheckCompletedAt) : null;
    data.backgroundCheckCompletedAt = bgDate;
    data.backgroundCheckExpiresAt = bgDate ? computeBackgroundCheckExpiry(bgDate) : null;
  }
  if (input.backgroundCheckUrl !== undefined) {
    data.backgroundCheckUrl = input.backgroundCheckUrl ? input.backgroundCheckUrl.trim() : null;
  }

  const auditEntries = collectRenewalAudits(existing, input);

  // The archive insert rides in the update's transaction: a renewal must not be able to
  // land with its predecessor unrecorded.
  const [updated] = await prisma.$transaction([
    prisma.childProtectionRecord.update({ where: { id }, data }),
    ...auditEntries.map((entry) =>
      prisma.childProtectionRenewalAudit.create({
        data: { recordId: id, changedById: session?.user?.id || null, ...entry },
      })
    ),
  ]);

  revalidatePath('/admin/child-protection');
  return { success: true, data: updated };
}

export async function batchUpdateChildProtectionRecords(
  updates: Array<{ id: string; data: Partial<UpsertChildProtectionRecordInput> }>
) {
  if (!isModuleEnabled('child_protection')) {
    return { success: false, error: 'Child Protection module is not enabled.' };
  }

  const session = await getServerSession(authOptions);
  const { allowed, access } = await checkChildProtectionAccess(session);
  if (!allowed || access !== 'EDIT') {
    return { success: false, error: 'Unauthorized. You must have edit access to update records.' };
  }

  const ids = updates.map((u) => u.id);
  const existingRecords = await prisma.childProtectionRecord.findMany({
    where: { id: { in: ids } },
    select: { id: true, archivedAt: true, docusignSignedAt: true, ...CERT_AUDIT_SELECT },
  });
  const existingById = new Map(existingRecords.map((r) => [r.id, r]));
  const hasMissingOrArchived = ids.some((id) => {
    const existing = existingById.get(id);
    return !existing || existing.archivedAt;
  });
  if (hasMissingOrArchived) {
    return { success: false, error: 'One or more records were not found or have been archived.' };
  }

  const ops: Prisma.PrismaPromise<unknown>[] = [];

  for (const { id, data } of updates) {
    const updatePayload: Record<string, any> = {};
    const existing = existingById.get(id)!;

    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.email !== undefined) updatePayload.email = data.email?.trim() || null;
    if (data.ministries !== undefined) updatePayload.ministries = data.ministries;
    if (data.docusignUrl !== undefined) updatePayload.docusignUrl = data.docusignUrl?.trim() || null;

    // DocuSign — mirrors updateChildProtectionRecord: stamp the signed date only
    // when newly signing with no existing date on file, and clear it on unsign.
    if (data.docusignSigned !== undefined) {
      updatePayload.docusignSigned = data.docusignSigned;
      if (data.docusignSigned && !existing.docusignSignedAt && data.docusignSignedAt === undefined) {
        updatePayload.docusignSignedAt = new Date();
      } else if (!data.docusignSigned) {
        updatePayload.docusignSignedAt = null;
      }
    }
    if (data.docusignSignedAt !== undefined) {
      updatePayload.docusignSignedAt = data.docusignSignedAt ? new Date(data.docusignSignedAt) : null;
    }

    if (data.ministrySafeCompletedAt !== undefined) {
      const msDate = data.ministrySafeCompletedAt ? new Date(data.ministrySafeCompletedAt) : null;
      updatePayload.ministrySafeCompletedAt = msDate;
      updatePayload.ministrySafeExpiresAt = msDate ? computeMinistrySafeExpiry(msDate) : null;
    }
    if (data.ministrySafeUrl !== undefined) {
      updatePayload.ministrySafeUrl = data.ministrySafeUrl?.trim() || null;
    }

    if (data.backgroundCheckCompletedAt !== undefined) {
      const bgDate = data.backgroundCheckCompletedAt ? new Date(data.backgroundCheckCompletedAt) : null;
      updatePayload.backgroundCheckCompletedAt = bgDate;
      updatePayload.backgroundCheckExpiresAt = bgDate ? computeBackgroundCheckExpiry(bgDate) : null;
    }
    if (data.backgroundCheckUrl !== undefined) {
      updatePayload.backgroundCheckUrl = data.backgroundCheckUrl?.trim() || null;
    }

    ops.push(
      prisma.childProtectionRecord.update({
        where: { id },
        data: updatePayload,
      })
    );

    for (const entry of collectRenewalAudits(existing, data)) {
      ops.push(
        prisma.childProtectionRenewalAudit.create({
          data: { recordId: id, changedById: session?.user?.id || null, ...entry },
        })
      );
    }
  }

  await prisma.$transaction(ops);

  revalidatePath('/admin/child-protection');
  return { success: true };
}

export async function archiveChildProtectionRecord(id: string) {
  if (!isModuleEnabled('child_protection')) {
    return { success: false, error: 'Child Protection module is not enabled.' };
  }

  const session = await getServerSession(authOptions);
  const { allowed, access } = await checkChildProtectionAccess(session);
  if (!allowed || access !== 'EDIT') {
    return { success: false, error: 'Unauthorized. You must have edit access.' };
  }

  await prisma.childProtectionRecord.update({
    where: { id },
    data: { archivedAt: new Date() },
  });

  revalidatePath('/admin/child-protection');
  return { success: true };
}

export async function createRenewalReviewTask(input: {
  recordId: string;
  projectId: string;
  sectionId: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  customNote?: string | null;
}) {
  if (!isModuleEnabled('child_protection')) {
    return { success: false, error: 'Child Protection module is not enabled.' };
  }

  const session = await getServerSession(authOptions);
  const { allowed, access } = await checkChildProtectionAccess(session);
  if (!allowed || access !== 'EDIT') {
    return { success: false, error: 'Unauthorized. You must have edit access to create review tasks.' };
  }

  // Child Protection access does not imply membership in the target project — task
  // visibility is scoped by project, not by ChildProtectionShare, so both the creator
  // and the assignee must be validated against it independently (mirrors requireProjectMember
  // / filterToAssignableUsers in actions/tasks.ts).
  try {
    await requireProjectMember(input.projectId);
  } catch {
    return { success: false, error: 'You are not a member of the selected project.' };
  }

  const record = await prisma.childProtectionRecord.findUnique({
    where: { id: input.recordId },
  });

  if (!record || record.archivedAt) {
    return { success: false, error: 'Record not found.' };
  }

  const { status, daysUntilMinistrySafeExpires, daysUntilBackgroundCheckExpires } = computeRecordStatus({
    docusignSigned: record.docusignSigned,
    ministrySafeCompletedAt: record.ministrySafeCompletedAt,
    ministrySafeExpiresAt: record.ministrySafeExpiresAt,
    backgroundCheckCompletedAt: record.backgroundCheckCompletedAt,
    backgroundCheckExpiresAt: record.backgroundCheckExpiresAt,
  });

  const { title, description, priority } = buildRenewalTaskContent(
    record,
    status,
    daysUntilMinistrySafeExpires,
    daysUntilBackgroundCheckExpires,
    input.customNote
  );

  const lastTask = await prisma.task.findFirst({
    where: { sectionId: input.sectionId, parentTaskId: null, deletedAt: null },
    orderBy: { order: 'desc' },
  });
  const order = (lastTask?.order ?? -1) + 1;

  const assigneeIds = input.assigneeId
    ? await filterToAssignableUsers(input.projectId, [input.assigneeId])
    : [];

  const task = await prisma.task.create({
    data: {
      title,
      description,
      projectId: input.projectId,
      sectionId: input.sectionId,
      priority,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      order,
      assignees: assigneeIds.length > 0 ? { connect: assigneeIds.map((id) => ({ id })) } : undefined,
    },
  });

  return { success: true, data: task };
}

/**
 * Builds a Prisma update payload for a row matched to an existing record.
 * Only fields present on `row` (i.e. non-blank in the pasted sheet) are
 * included — a blank cell never clobbers data the record already has.
 */
function buildImportUpdatePayload(
  row: ParsedChildProtectionImportRow,
  existing: { docusignSignedAt: Date | null }
): Record<string, any> {
  const data: Record<string, any> = { name: row.name };

  if (row.email !== undefined) data.email = row.email;
  if (row.ministries !== undefined) data.ministries = row.ministries;

  if (row.docusignSigned !== undefined) {
    data.docusignSigned = row.docusignSigned;
    if (row.docusignSigned) {
      if (!existing.docusignSignedAt) data.docusignSignedAt = new Date();
    } else {
      data.docusignSignedAt = null;
    }
  }

  if (row.ministrySafeCompletedAt !== undefined) {
    const msDate = new Date(row.ministrySafeCompletedAt);
    data.ministrySafeCompletedAt = msDate;
    data.ministrySafeExpiresAt = computeMinistrySafeExpiry(msDate);
  }
  if (row.backgroundCheckCompletedAt !== undefined) {
    const bgDate = new Date(row.backgroundCheckCompletedAt);
    data.backgroundCheckCompletedAt = bgDate;
    data.backgroundCheckExpiresAt = computeBackgroundCheckExpiry(bgDate);
  }

  return data;
}

export async function importChildProtectionRecords(rawText: string): Promise<
  | { success: true; count: number; created: number; updated: number; warnings: string[] }
  | { success: false; error: string; warnings?: string[] }
> {
  if (!isModuleEnabled('child_protection')) {
    return { success: false, error: 'Child Protection module is not enabled.' };
  }

  const session = await getServerSession(authOptions);
  const { allowed, access } = await checkChildProtectionAccess(session);
  if (!allowed || access !== 'EDIT') {
    return { success: false, error: 'Unauthorized. You must have edit access to import records.' };
  }

  const { records, warnings } = parseChildProtectionImportRows(rawText);

  if (records.length === 0) {
    return {
      success: false,
      error: 'No valid rows could be parsed. Check that rows contain at least a volunteer name.',
      warnings,
    };
  }

  // Match against active records by email (case-insensitive) first, falling back to an
  // exact case-insensitive name match only when it's unambiguous — a name shared by more
  // than one active record is treated as no match rather than guessing which one to update.
  const existing = await prisma.childProtectionRecord.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true, email: true, docusignSignedAt: true, ...CERT_AUDIT_SELECT },
  });

  const byEmail = new Map<string, (typeof existing)[number]>();
  const byName = new Map<string, (typeof existing)[number]>();
  const nameCount = new Map<string, number>();
  for (const rec of existing) {
    if (rec.email) {
      const emailKey = rec.email.trim().toLowerCase();
      if (!byEmail.has(emailKey)) byEmail.set(emailKey, rec);
    }
    const nameKey = rec.name.trim().toLowerCase();
    nameCount.set(nameKey, (nameCount.get(nameKey) ?? 0) + 1);
    byName.set(nameKey, rec);
  }

  let createdCount = 0;
  let updatedCount = 0;

  const ops: Prisma.PrismaPromise<unknown>[] = [];

  for (const row of records) {
    const emailKey = row.email ? row.email.trim().toLowerCase() : null;
    const nameKey = row.name.trim().toLowerCase();
    const match = (emailKey && byEmail.get(emailKey)) || (nameCount.get(nameKey) === 1 ? byName.get(nameKey) : undefined);

    if (match) {
      updatedCount += 1;
      ops.push(
        prisma.childProtectionRecord.update({
          where: { id: match.id },
          data: buildImportUpdatePayload(row, match),
        })
      );

      // A pasted sheet is the likeliest way a renewal actually gets recorded, so the
      // import path needs the same archive the single-record edit gets.
      for (const entry of collectRenewalAudits(match, row)) {
        ops.push(
          prisma.childProtectionRenewalAudit.create({
            data: { recordId: match.id, changedById: session?.user?.id || null, ...entry },
          })
        );
      }
      continue;
    }

    createdCount += 1;
    const msCompletedAt = row.ministrySafeCompletedAt ? new Date(row.ministrySafeCompletedAt) : null;
    const bgCompletedAt = row.backgroundCheckCompletedAt ? new Date(row.backgroundCheckCompletedAt) : null;

    ops.push(
      prisma.childProtectionRecord.create({
        data: {
          name: row.name,
          email: row.email ?? null,
          ministries: row.ministries ?? [],
          docusignSigned: row.docusignSigned ?? false,
          docusignSignedAt: row.docusignSigned ? new Date() : null,
          ministrySafeCompletedAt: msCompletedAt,
          ministrySafeExpiresAt: msCompletedAt ? computeMinistrySafeExpiry(msCompletedAt) : null,
          backgroundCheckCompletedAt: bgCompletedAt,
          backgroundCheckExpiresAt: bgCompletedAt ? computeBackgroundCheckExpiry(bgCompletedAt) : null,
          createdById: session?.user?.id || null,
        },
      })
    );
  }

  await prisma.$transaction(ops);

  revalidatePath('/admin/child-protection');
  return { success: true, count: records.length, created: createdCount, updated: updatedCount, warnings };
}

// Share management. Deliberately gated on the ADMIN role rather than
// checkChildProtectionAccess: holding EDIT on the records is permission to maintain
// compliance data, not permission to widen who can see it.
export async function listChildProtectionShares() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return { success: false, error: 'Only admins can view access shares.' };
  }

  const shares = await prisma.childProtectionShare.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      team: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return { success: true, data: shares };
}

export async function createChildProtectionShare(input: {
  userId?: string;
  teamId?: string;
  access: 'VIEW' | 'EDIT';
}) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return { success: false, error: 'Only admins can grant access shares.' };
  }

  if (input.userId && input.teamId) {
    return { success: false, error: 'Provide either a person or a team, not both.' };
  }
  if (!input.userId && !input.teamId) {
    return { success: false, error: 'Must provide either userId or teamId.' };
  }

  const include = {
    user: { select: { id: true, name: true, email: true } },
    team: { select: { id: true, name: true } },
  };

  // Upsert, not create: userId and teamId are each @unique, so re-granting to someone who
  // already has a share is how an admin changes VIEW to EDIT — that has to update the row
  // rather than fail the insert.
  const share = input.userId
    ? await prisma.childProtectionShare.upsert({
        where: { userId: input.userId },
        create: { userId: input.userId, access: input.access },
        update: { access: input.access },
        include,
      })
    : await prisma.childProtectionShare.upsert({
        where: { teamId: input.teamId! },
        create: { teamId: input.teamId!, access: input.access },
        update: { access: input.access },
        include,
      });

  revalidatePath('/admin/child-protection');
  return { success: true, data: share };
}

export async function deleteChildProtectionShare(id: string) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return { success: false, error: 'Only admins can revoke access shares.' };
  }

  await prisma.childProtectionShare.delete({ where: { id } });

  revalidatePath('/admin/child-protection');
  return { success: true };
}
