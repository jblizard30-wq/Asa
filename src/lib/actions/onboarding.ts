'use server';

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireSession } from '@/lib/permissions';
import { isModuleEnabled } from '@/lib/modules';
import {
  OnboardingRole,
  OnboardingItemCategory,
  OnboardingCostCadence,
  OnboardingProvisioningType,
  OnboardingStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { calculateOnboardingBudget } from '@/lib/onboardingBudget';

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

function ensureModuleEnabled() {
  if (!isModuleEnabled('onboarding')) {
    throw new Error('Onboarding module is not enabled for this church deployment.');
  }
}

/**
 * Recomputes OnboardingCase estimatedCapex and estimatedMonthlyOpex
 * within the given transaction.
 */
async function recomputeCaseTotals(tx: Prisma.TransactionClient, caseId: string) {
  const items = await tx.onboardingCaseItem.findMany({
    where: { caseId },
    select: { cost: true, costCadence: true },
  });

  const budget = calculateOnboardingBudget(items);

  await tx.onboardingCase.update({
    where: { id: caseId },
    data: {
      estimatedCapex: new Prisma.Decimal(budget.capexTotal),
      estimatedMonthlyOpex: new Prisma.Decimal(budget.monthlyOpexTotal),
    },
  });
}

// ============================================================================
// BLUEPRINT TEMPLATES (Admin only)
// ============================================================================

export async function getOnboardingBlueprints() {
  ensureModuleEnabled();
  await requireAdmin();

  return prisma.onboardingBlueprint.findMany({
    include: {
      items: {
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { role: 'asc' },
  });
}

export async function getOnboardingBlueprintByRole(role: OnboardingRole) {
  ensureModuleEnabled();
  await requireAdmin();

  return prisma.onboardingBlueprint.findUnique({
    where: { role },
    include: {
      items: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
}

export async function saveOnboardingBlueprint(input: {
  role: OnboardingRole;
  description?: string | null;
  items: Array<{
    id?: string;
    category: OnboardingItemCategory;
    title: string;
    description?: string | null;
    docTemplateUrl?: string | null;
    estimatedCost?: number | null;
    costCadence?: OnboardingCostCadence | null;
    provisioningType?: OnboardingProvisioningType;
    sortOrder?: number;
  }>;
}): Promise<ActionResult<{ blueprintId: string }>> {
  ensureModuleEnabled();
  await requireAdmin();

  if (!input.role) {
    return { success: false, error: 'Role is required.' };
  }

  try {
    const blueprint = await prisma.$transaction(async (tx) => {
      const bp = await tx.onboardingBlueprint.upsert({
        where: { role: input.role },
        create: {
          role: input.role,
          description: input.description ?? null,
        },
        update: {
          description: input.description ?? null,
        },
      });

      // Clear existing items and re-insert fresh snapshot list
      await tx.onboardingBlueprintItem.deleteMany({
        where: { blueprintId: bp.id },
      });

      if (input.items && input.items.length > 0) {
        await tx.onboardingBlueprintItem.createMany({
          data: input.items.map((item, idx) => ({
            blueprintId: bp.id,
            category: item.category,
            title: item.title.trim(),
            description: item.description?.trim() || null,
            docTemplateUrl: item.docTemplateUrl?.trim() || null,
            estimatedCost: item.estimatedCost !== null && item.estimatedCost !== undefined
              ? new Prisma.Decimal(item.estimatedCost)
              : null,
            costCadence: item.costCadence ?? null,
            provisioningType: item.provisioningType ?? 'MANUAL_TASK',
            sortOrder: item.sortOrder ?? idx,
          })),
        });
      }

      return bp;
    });

    revalidatePath('/admin/onboarding');
    revalidatePath('/admin/onboarding/templates');
    return { success: true, data: { blueprintId: blueprint.id } };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to save blueprint.' };
  }
}

// ============================================================================
// ONBOARDING CASES (Roster & Individual Hires)
// ============================================================================

export async function listOnboardingCases(filter?: {
  role?: OnboardingRole;
  status?: OnboardingStatus;
}) {
  ensureModuleEnabled();
  await requireAdmin();

  const where: Prisma.OnboardingCaseWhereInput = {};
  if (filter?.role) where.role = filter.role;
  if (filter?.status) where.status = filter.status;

  const cases = await prisma.onboardingCase.findMany({
    where,
    include: {
      createdUser: {
        select: { id: true, name: true, email: true },
      },
      items: {
        select: {
          id: true,
          category: true,
          cost: true,
          costCadence: true,
          completedAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return cases.map((c) => {
    const totalItems = c.items.length;
    const completedItems = c.items.filter((i) => i.completedAt !== null).length;
    const budget = calculateOnboardingBudget(c.items);

    return {
      id: c.id,
      personName: c.personName,
      personEmail: c.personEmail,
      role: c.role,
      startDate: c.startDate ? c.startDate.toISOString() : null,
      status: c.status,
      templateSnapshotAt: c.templateSnapshotAt ? c.templateSnapshotAt.toISOString() : null,
      totalItems,
      completedItems,
      isComplete: totalItems > 0 && completedItems === totalItems,
      createdUser: c.createdUser,
      createdAt: c.createdAt.toISOString(),
      capexTotal: budget.capexTotal,
      monthlyOpexTotal: budget.monthlyOpexTotal,
      formattedCapex: budget.formattedCapex,
      formattedMonthlyOpex: budget.formattedMonthlyOpex,
      formattedFirstYearTotal: budget.formattedFirstYearTotal,
    };
  });
}

export async function getOnboardingCase(id: string) {
  ensureModuleEnabled();
  await requireAdmin();

  const c = await prisma.onboardingCase.findUnique({
    where: { id },
    include: {
      createdUser: {
        select: { id: true, name: true, email: true, role: true },
      },
      items: {
        include: {
          completedBy: { select: { id: true, name: true } },
          inventoryItem: { select: { id: true, name: true, onHandQty: true, unit: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!c) return null;

  const budget = calculateOnboardingBudget(c.items);

  return {
    id: c.id,
    personName: c.personName,
    personEmail: c.personEmail,
    role: c.role,
    startDate: c.startDate ? c.startDate.toISOString() : null,
    status: c.status,
    templateSnapshotAt: c.templateSnapshotAt ? c.templateSnapshotAt.toISOString() : null,
    createdUser: c.createdUser,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    budget,
    items: c.items.map((item) => ({
      id: item.id,
      caseId: item.caseId,
      category: item.category,
      title: item.title,
      description: item.description,
      docTemplateUrl: item.docTemplateUrl,
      cost: item.cost ? Number(item.cost) : null,
      costCadence: item.costCadence,
      provisioningType: item.provisioningType,
      sortOrder: item.sortOrder,
      inventoryItemId: item.inventoryItemId,
      inventoryItem: item.inventoryItem,
      procurementVendor: item.procurementVendor,
      procurementPoNumber: item.procurementPoNumber,
      procurementUrl: item.procurementUrl,
      procurementStatus: item.procurementStatus,
      completedAt: item.completedAt ? item.completedAt.toISOString() : null,
      completedBy: item.completedBy,
      completedLocationNote: item.completedLocationNote,
    })),
  };
}

export async function createOnboardingCase(input: {
  personName: string;
  personEmail?: string | null;
  role: OnboardingRole;
  startDate?: string | null;
}): Promise<ActionResult<{ caseId: string }>> {
  ensureModuleEnabled();
  await requireAdmin();

  if (!input.personName?.trim()) {
    return { success: false, error: 'Person name is required.' };
  }
  if (!input.role) {
    return { success: false, error: 'Role is required.' };
  }

  try {
    const newCase = await prisma.$transaction(async (tx) => {
      // 1. Fetch blueprint template for this role
      const blueprint = await tx.onboardingBlueprint.findUnique({
        where: { role: input.role },
        include: {
          items: { orderBy: { sortOrder: 'asc' } },
        },
      });

      // 2. Create the case
      const createdCase = await tx.onboardingCase.create({
        data: {
          personName: input.personName.trim(),
          personEmail: input.personEmail?.trim().toLowerCase() || null,
          role: input.role,
          startDate: input.startDate ? new Date(input.startDate) : null,
          status: 'DRAFT',
          templateSnapshotAt: new Date(),
        },
      });

      // 3. Snapshot copy items if blueprint exists
      if (blueprint && blueprint.items.length > 0) {
        await tx.onboardingCaseItem.createMany({
          data: blueprint.items.map((item, idx) => ({
            caseId: createdCase.id,
            category: item.category,
            title: item.title,
            description: item.description,
            docTemplateUrl: item.docTemplateUrl,
            cost: item.estimatedCost,
            costCadence: item.costCadence,
            provisioningType: item.provisioningType,
            sortOrder: item.sortOrder ?? idx,
            procurementStatus: item.category === 'HARDWARE' ? 'NEEDED' : 'NOT_REQUIRED',
          })),
        });

        // 4. Recompute initial totals
        await recomputeCaseTotals(tx, createdCase.id);
      }

      return createdCase;
    });

    revalidatePath('/admin/onboarding');
    return { success: true, data: { caseId: newCase.id } };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create onboarding case.' };
  }
}

export async function updateOnboardingCaseStatus(
  caseId: string,
  status: OnboardingStatus
): Promise<ActionResult> {
  ensureModuleEnabled();
  await requireAdmin();

  try {
    if (status === 'COMPLETED') {
      // COMPLETED is only reachable via completeOnboardingAndCreateUser, which atomically
      // provisions the staff account this status implies exists — never set it bare here.
      const existing = await prisma.onboardingCase.findUnique({
        where: { id: caseId },
        select: { createdUserId: true },
      });
      if (!existing?.createdUserId) {
        return {
          success: false,
          error: 'Completing a case requires creating a staff account first — use "Finalize & Create Staff Account".',
        };
      }
    }

    await prisma.onboardingCase.update({
      where: { id: caseId },
      data: { status },
    });

    revalidatePath('/admin/onboarding');
    revalidatePath(`/admin/onboarding/${caseId}`);
    return { success: true, data: undefined };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update status.' };
  }
}

export async function deleteOnboardingCase(caseId: string): Promise<ActionResult> {
  ensureModuleEnabled();
  await requireAdmin();

  try {
    await prisma.onboardingCase.delete({
      where: { id: caseId },
    });

    revalidatePath('/admin/onboarding');
    return { success: true, data: undefined };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete case.' };
  }
}

// ============================================================================
// CHECKLIST ITEM MUTATIONS & FULFILLMENT
// ============================================================================

export async function toggleOnboardingItemComplete(
  itemId: string,
  completed: boolean,
  locationNote?: string | null
): Promise<ActionResult> {
  ensureModuleEnabled();
  const session = await requireAdmin();

  try {
    const existing = await prisma.onboardingCaseItem.findUnique({
      where: { id: itemId },
      select: { caseId: true },
    });

    if (!existing) {
      return { success: false, error: 'Item not found.' };
    }

    await prisma.onboardingCaseItem.update({
      where: { id: itemId },
      data: {
        completedAt: completed ? new Date() : null,
        completedByUserId: completed ? session.user.id : null,
        ...(locationNote !== undefined ? { completedLocationNote: locationNote?.trim() || null } : {}),
      },
    });

    revalidatePath(`/admin/onboarding/${existing.caseId}`);
    revalidatePath('/admin/onboarding');
    return { success: true, data: undefined };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to toggle completion.' };
  }
}

export async function updateOnboardingItem(
  itemId: string,
  data: {
    title?: string;
    description?: string | null;
    docTemplateUrl?: string | null;
    cost?: number | null;
    costCadence?: OnboardingCostCadence | null;
    inventoryItemId?: string | null;
    procurementVendor?: string | null;
    procurementPoNumber?: string | null;
    procurementUrl?: string | null;
    procurementStatus?: string;
    completedLocationNote?: string | null;
  }
): Promise<ActionResult> {
  ensureModuleEnabled();
  await requireAdmin();

  try {
    const item = await prisma.onboardingCaseItem.findUnique({
      where: { id: itemId },
      select: { caseId: true },
    });

    if (!item) {
      return { success: false, error: 'Item not found.' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.onboardingCaseItem.update({
        where: { id: itemId },
        data: {
          ...(data.title !== undefined ? { title: data.title.trim() } : {}),
          ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
          ...(data.docTemplateUrl !== undefined ? { docTemplateUrl: data.docTemplateUrl?.trim() || null } : {}),
          ...(data.cost !== undefined
            ? { cost: data.cost !== null ? new Prisma.Decimal(data.cost) : null }
            : {}),
          ...(data.costCadence !== undefined ? { costCadence: data.costCadence } : {}),
          ...(data.inventoryItemId !== undefined ? { inventoryItemId: data.inventoryItemId || null } : {}),
          ...(data.procurementVendor !== undefined ? { procurementVendor: data.procurementVendor?.trim() || null } : {}),
          ...(data.procurementPoNumber !== undefined ? { procurementPoNumber: data.procurementPoNumber?.trim() || null } : {}),
          ...(data.procurementUrl !== undefined ? { procurementUrl: data.procurementUrl?.trim() || null } : {}),
          ...(data.procurementStatus !== undefined ? { procurementStatus: data.procurementStatus } : {}),
          ...(data.completedLocationNote !== undefined ? { completedLocationNote: data.completedLocationNote?.trim() || null } : {}),
        },
      });

      await recomputeCaseTotals(tx, item.caseId);
    });

    revalidatePath(`/admin/onboarding/${item.caseId}`);
    revalidatePath('/admin/onboarding');
    return { success: true, data: undefined };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update item.' };
  }
}

export async function addOnboardingItem(
  caseId: string,
  data: {
    category: OnboardingItemCategory;
    title: string;
    description?: string | null;
    docTemplateUrl?: string | null;
    cost?: number | null;
    costCadence?: OnboardingCostCadence | null;
    provisioningType?: OnboardingProvisioningType;
    inventoryItemId?: string | null;
  }
): Promise<ActionResult<{ itemId: string }>> {
  ensureModuleEnabled();
  await requireAdmin();

  if (!data.title?.trim()) {
    return { success: false, error: 'Title is required.' };
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const highestSort = await tx.onboardingCaseItem.findFirst({
        where: { caseId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });

      const nextOrder = (highestSort?.sortOrder ?? -1) + 1;

      const item = await tx.onboardingCaseItem.create({
        data: {
          caseId,
          category: data.category,
          title: data.title.trim(),
          description: data.description?.trim() || null,
          docTemplateUrl: data.docTemplateUrl?.trim() || null,
          cost: data.cost !== null && data.cost !== undefined ? new Prisma.Decimal(data.cost) : null,
          costCadence: data.costCadence ?? null,
          provisioningType: data.provisioningType ?? 'MANUAL_TASK',
          inventoryItemId: data.inventoryItemId || null,
          sortOrder: nextOrder,
          procurementStatus: data.category === 'HARDWARE' ? 'NEEDED' : 'NOT_REQUIRED',
        },
      });

      await recomputeCaseTotals(tx, caseId);
      return item;
    });

    revalidatePath(`/admin/onboarding/${caseId}`);
    revalidatePath('/admin/onboarding');
    return { success: true, data: { itemId: created.id } };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to add item.' };
  }
}

export async function deleteOnboardingItem(itemId: string): Promise<ActionResult> {
  ensureModuleEnabled();
  await requireAdmin();

  try {
    const item = await prisma.onboardingCaseItem.findUnique({
      where: { id: itemId },
      select: { caseId: true },
    });

    if (!item) {
      return { success: false, error: 'Item not found.' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.onboardingCaseItem.delete({ where: { id: itemId } });
      await recomputeCaseTotals(tx, item.caseId);
    });

    revalidatePath(`/admin/onboarding/${item.caseId}`);
    revalidatePath('/admin/onboarding');
    return { success: true, data: undefined };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete item.' };
  }
}

// ============================================================================
// COMPLETE ONBOARDING & ATOMICALLY CREATE USER ACCOUNT
// ============================================================================

export async function completeOnboardingAndCreateUser(
  caseId: string,
  input: {
    name: string;
    email: string;
    role: Role;
    temporaryPassword?: string;
  }
): Promise<ActionResult<{ userId: string; temporaryPassword: string }>> {
  ensureModuleEnabled();
  await requireAdmin();

  const email = input.email.toLowerCase().trim();
  if (!email || !input.name.trim()) {
    return { success: false, error: 'Name and a valid email are required.' };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const c = await tx.onboardingCase.findUnique({
        where: { id: caseId },
        select: { id: true, createdUserId: true, status: true },
      });

      if (!c) {
        throw new Error('Onboarding case not found.');
      }

      // Idempotency guard: this function is the only path that may create/link a User for a
      // case, so a case that already has one (or is already COMPLETED) must never run this
      // again — re-provisioning would create a second, orphaned User account.
      if (c.createdUserId || c.status === 'COMPLETED') {
        throw new Error('This case has already been completed.');
      }

      const existing = await tx.user.findUnique({ where: { email } });
      if (existing) {
        throw new Error('An account with that email already exists.');
      }

      // Generate a cryptographically secure temporary password if one wasn't provided.
      const plainPassword = input.temporaryPassword || crypto.randomBytes(24).toString('hex');
      const passwordHash = await bcrypt.hash(plainPassword, 10);

      const user = await tx.user.create({
        data: {
          name: input.name.trim(),
          email,
          passwordHash,
          role: input.role || 'USER',
        },
      });

      // Link User to OnboardingCase and mark COMPLETED
      await tx.onboardingCase.update({
        where: { id: caseId },
        data: {
          createdUserId: user.id,
          status: 'COMPLETED',
        },
      });

      return { user, plainPassword };
    });

    revalidatePath(`/admin/onboarding/${caseId}`);
    revalidatePath('/admin/onboarding');
    revalidatePath('/admin/users');
    return { success: true, data: { userId: result.user.id, temporaryPassword: result.plainPassword } };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to complete onboarding.' };
  }
}

