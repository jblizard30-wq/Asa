import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveOnboardingBlueprint,
  createOnboardingCase,
  toggleOnboardingItemComplete,
  completeOnboardingAndCreateUser,
  updateOnboardingCaseStatus,
  assignOnboardingItem,
  batchAssignOnboardingCategory,
} from './onboarding';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/modules';

vi.mock('@/lib/modules', () => ({
  isModuleEnabled: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  requireAdmin: vi.fn().mockResolvedValue({
    user: { id: 'u-admin', name: 'Admin', email: 'admin@church.org', role: 'ADMIN' },
  }),
  requireSession: vi.fn().mockResolvedValue({
    user: { id: 'u-admin', name: 'Admin', email: 'admin@church.org', role: 'ADMIN' },
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/prisma', () => {
  const mockPrisma: any = {
    onboardingBlueprint: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    onboardingBlueprintItem: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    onboardingCase: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    onboardingCaseItem: {
      createMany: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

describe('Onboarding Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isModuleEnabled).mockReturnValue(true);
  });

  it('rejects calls when the onboarding module is disabled', async () => {
    vi.mocked(isModuleEnabled).mockReturnValue(false);

    await expect(
      createOnboardingCase({
        personName: 'John Doe',
        role: 'PASTORAL_STAFF',
      })
    ).rejects.toThrow('Onboarding module is not enabled');
  });

  it('saves blueprint with items in a transaction', async () => {
    vi.mocked(prisma.onboardingBlueprint.upsert).mockResolvedValue({
      id: 'bp-1',
      role: 'PASTORAL_STAFF',
      description: 'Pastoral setup',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const res = await saveOnboardingBlueprint({
      role: 'PASTORAL_STAFF',
      description: 'Pastoral setup',
      items: [
        {
          category: 'HARDWARE',
          title: 'MacBook Pro 16',
          estimatedCost: 2499,
          costCadence: 'ONE_TIME',
        },
      ],
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.blueprintId).toBe('bp-1');
    }
    expect(prisma.onboardingBlueprintItem.deleteMany).toHaveBeenCalledWith({
      where: { blueprintId: 'bp-1' },
    });
    expect(prisma.onboardingBlueprintItem.createMany).toHaveBeenCalled();
  });

  it('snapshot-copies items from blueprint when creating an onboarding case', async () => {
    vi.mocked(prisma.onboardingBlueprint.findMany).mockResolvedValue([
      {
        id: 'bp-1',
        role: 'PASTORAL_STAFF',
        description: 'Pastoral',
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: 'bpi-1',
            blueprintId: 'bp-1',
            category: 'PAPERWORK',
            title: 'W-4 Form',
            description: null,
            docTemplateUrl: 'https://docs.google.com/w4/copy',
            estimatedCost: null,
            costCadence: null,
            provisioningType: 'MANUAL_TASK',
            sortOrder: 0,
          },
          {
            id: 'bpi-2',
            blueprintId: 'bp-1',
            category: 'HARDWARE',
            title: 'MacBook Pro',
            description: null,
            docTemplateUrl: null,
            estimatedCost: 2400 as any,
            costCadence: 'ONE_TIME',
            provisioningType: 'MANUAL_TASK',
            sortOrder: 1,
          },
        ],
      },
    ] as any);

    vi.mocked(prisma.onboardingCase.create).mockResolvedValue({
      id: 'case-123',
      personName: 'Jane Smith',
      personEmail: 'jane@example.com',
      role: 'PASTORAL_STAFF',
      roles: ['PASTORAL_STAFF'],
      status: 'DRAFT',
    } as any);

    vi.mocked(prisma.onboardingCaseItem.findMany).mockResolvedValue([
      { cost: 2400, costCadence: 'ONE_TIME' },
    ] as any);

    const res = await createOnboardingCase({
      personName: 'Jane Smith',
      personEmail: 'jane@example.com',
      role: 'PASTORAL_STAFF',
    });

    expect(res.success).toBe(true);
    expect(prisma.onboardingCaseItem.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          caseId: 'case-123',
          title: 'W-4 Form',
          category: 'PAPERWORK',
        }),
        expect.objectContaining({
          caseId: 'case-123',
          title: 'MacBook Pro',
          category: 'HARDWARE',
          procurementStatus: 'NEEDED',
        }),
      ]),
    });
  });

  it('merges multiple role blueprints and deduplicates identical items', async () => {
    vi.mocked(prisma.onboardingBlueprint.findMany).mockResolvedValue([
      {
        id: 'bp-pastoral',
        role: 'PASTORAL_STAFF',
        description: 'Pastoral',
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: 'item-w4-1',
            blueprintId: 'bp-pastoral',
            category: 'PAPERWORK',
            title: 'Federal W-4 Form',
            description: 'Tax withholding',
            docTemplateUrl: null,
            estimatedCost: null,
            costCadence: null,
            provisioningType: 'MANUAL_TASK',
            sortOrder: 0,
          },
          {
            id: 'item-mbp',
            blueprintId: 'bp-pastoral',
            category: 'HARDWARE',
            title: 'MacBook Pro 16-inch',
            description: 'Laptop',
            docTemplateUrl: null,
            estimatedCost: 2499 as any,
            costCadence: 'ONE_TIME',
            provisioningType: 'MANUAL_TASK',
            sortOrder: 1,
          },
        ],
      },
      {
        id: 'bp-youth',
        role: 'CHILDRENS_YOUTH',
        description: 'Youth',
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          // Duplicate W-4 Form across roles
          {
            id: 'item-w4-2',
            blueprintId: 'bp-youth',
            category: 'PAPERWORK',
            title: 'Federal W-4 Form',
            description: 'Tax form',
            docTemplateUrl: null,
            estimatedCost: null,
            costCadence: null,
            provisioningType: 'MANUAL_TASK',
            sortOrder: 0,
          },
          // Unique youth item
          {
            id: 'item-bg-check',
            blueprintId: 'bp-youth',
            category: 'PAPERWORK',
            title: 'MinistrySafe Background Check',
            description: 'Safety compliance',
            docTemplateUrl: null,
            estimatedCost: 35 as any,
            costCadence: 'ONE_TIME',
            provisioningType: 'MANUAL_TASK',
            sortOrder: 1,
          },
        ],
      },
    ] as any);

    vi.mocked(prisma.onboardingCase.create).mockResolvedValue({
      id: 'case-youth-pastor',
      personName: 'Alex Pastor',
      role: 'PASTORAL_STAFF',
      roles: ['PASTORAL_STAFF', 'CHILDRENS_YOUTH'],
      status: 'DRAFT',
    } as any);

    vi.mocked(prisma.onboardingCaseItem.findMany).mockResolvedValue([
      { cost: 2499, costCadence: 'ONE_TIME' },
      { cost: 35, costCadence: 'ONE_TIME' },
    ] as any);

    const res = await createOnboardingCase({
      personName: 'Alex Pastor',
      roles: ['PASTORAL_STAFF', 'CHILDRENS_YOUTH'],
    });

    expect(res.success).toBe(true);
    // Verified createMany called with exactly 3 deduplicated items (W-4 once, MacBook Pro, MinistrySafe)
    expect(prisma.onboardingCaseItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          caseId: 'case-youth-pastor',
          title: 'Federal W-4 Form',
          category: 'PAPERWORK',
        }),
        expect.objectContaining({
          caseId: 'case-youth-pastor',
          title: 'MacBook Pro 16-inch',
          category: 'HARDWARE',
        }),
        expect.objectContaining({
          caseId: 'case-youth-pastor',
          title: 'MinistrySafe Background Check',
          category: 'PAPERWORK',
        }),
      ],
    });
  });

  it('applies category-level workflow assignee defaults to items upon creation', async () => {
    vi.mocked(prisma.onboardingBlueprint.findMany).mockResolvedValue([
      {
        id: 'bp-1',
        role: 'PASTORAL_STAFF',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: 'item-1',
            blueprintId: 'bp-1',
            category: 'PAPERWORK',
            title: 'W-4 Form',
            description: null,
            docTemplateUrl: null,
            estimatedCost: null,
            costCadence: null,
            provisioningType: 'MANUAL_TASK',
            sortOrder: 0,
          },
          {
            id: 'item-2',
            blueprintId: 'bp-1',
            category: 'HARDWARE',
            title: 'Laptop',
            description: null,
            docTemplateUrl: null,
            estimatedCost: 1200 as any,
            costCadence: 'ONE_TIME',
            provisioningType: 'MANUAL_TASK',
            sortOrder: 1,
          },
        ],
      },
    ] as any);

    vi.mocked(prisma.onboardingCase.create).mockResolvedValue({
      id: 'case-assigned',
      personName: 'Sam Tech',
      role: 'PASTORAL_STAFF',
      roles: ['PASTORAL_STAFF'],
      status: 'DRAFT',
    } as any);

    vi.mocked(prisma.onboardingCaseItem.findMany).mockResolvedValue([]);

    const res = await createOnboardingCase({
      personName: 'Sam Tech',
      role: 'PASTORAL_STAFF',
      categoryAssignees: {
        PAPERWORK: 'user-hr-director',
        HARDWARE: 'user-it-lead',
      },
    });

    expect(res.success).toBe(true);
    expect(prisma.onboardingCaseItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          category: 'PAPERWORK',
          assignedToUserId: 'user-hr-director',
        }),
        expect.objectContaining({
          category: 'HARDWARE',
          assignedToUserId: 'user-it-lead',
        }),
      ],
    });
  });

  it('assigns an onboarding item directly to a user', async () => {
    vi.mocked(prisma.onboardingCaseItem.update).mockResolvedValue({
      id: 'item-1',
      caseId: 'case-123',
      assignedToUserId: 'user-it',
    } as any);

    const res = await assignOnboardingItem('item-1', 'user-it');
    expect(res.success).toBe(true);
    expect(prisma.onboardingCaseItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { assignedToUserId: 'user-it' },
      select: { caseId: true },
    });
  });

  it('batch assigns an entire category to a user', async () => {
    vi.mocked(prisma.onboardingCaseItem.updateMany).mockResolvedValue({
      count: 5,
    } as any);

    const res = await batchAssignOnboardingCategory('case-123', 'PAPERWORK', 'user-hr');
    expect(res.success).toBe(true);
    expect(prisma.onboardingCaseItem.updateMany).toHaveBeenCalledWith({
      where: { caseId: 'case-123', category: 'PAPERWORK' },
      data: { assignedToUserId: 'user-hr' },
    });
  });

  it('toggles item completion with user stamping', async () => {
    vi.mocked(prisma.onboardingCaseItem.findUnique).mockResolvedValue({
      caseId: 'case-123',
    } as any);

    const res = await toggleOnboardingItemComplete('item-1', true, 'Filed in HR drawer');
    expect(res.success).toBe(true);
    expect(prisma.onboardingCaseItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: expect.objectContaining({
        completedByUserId: 'u-admin',
        completedLocationNote: 'Filed in HR drawer',
      }),
    });
  });

  it('completes onboarding and creates User account with a securely generated password', async () => {
    vi.mocked(prisma.onboardingCase.findUnique).mockResolvedValue({
      id: 'case-123',
      createdUserId: null,
      status: 'READY_FOR_DAY_ONE',
    } as any);

    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'user-new',
      name: 'Jane Smith',
      email: 'jane@church.org',
      role: 'USER',
    } as any);

    const res = await completeOnboardingAndCreateUser('case-123', {
      name: 'Jane Smith',
      email: 'jane@church.org',
      role: 'USER',
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.userId).toBe('user-new');
      // crypto.randomBytes(24).toString('hex') -> 48 lowercase hex chars; Math.random()'s
      // base-36 output would never match this shape.
      expect(res.data.temporaryPassword).toMatch(/^[0-9a-f]{48}$/);
    }
    expect(prisma.onboardingCase.update).toHaveBeenCalledWith({
      where: { id: 'case-123' },
      data: {
        createdUserId: 'user-new',
        status: 'COMPLETED',
      },
    });
  });

  it('rejects completing onboarding when the email already belongs to an existing user', async () => {
    vi.mocked(prisma.onboardingCase.findUnique).mockResolvedValue({
      id: 'case-123',
      createdUserId: null,
      status: 'READY_FOR_DAY_ONE',
    } as any);

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-existing',
      email: 'jane@church.org',
    } as any);

    const res = await completeOnboardingAndCreateUser('case-123', {
      name: 'Jane Smith',
      email: 'jane@church.org',
      role: 'USER',
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toMatch(/already exists/i);
    }
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.onboardingCase.update).not.toHaveBeenCalled();
  });

  it('rejects re-completing a case that already has a linked user (idempotency guard)', async () => {
    vi.mocked(prisma.onboardingCase.findUnique).mockResolvedValue({
      id: 'case-123',
      createdUserId: 'user-already-created',
      status: 'COMPLETED',
    } as any);

    const res = await completeOnboardingAndCreateUser('case-123', {
      name: 'Jane Smith',
      email: 'jane-typo@church.org',
      role: 'USER',
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toMatch(/already been completed/i);
    }
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects setting status to COMPLETED when no staff account has been linked', async () => {
    vi.mocked(prisma.onboardingCase.findUnique).mockResolvedValue({
      createdUserId: null,
    } as any);

    const res = await updateOnboardingCaseStatus('case-123', 'COMPLETED');

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toMatch(/creating a staff account first/i);
    }
    expect(prisma.onboardingCase.update).not.toHaveBeenCalled();
  });

  it('allows setting status to COMPLETED once a staff account is linked', async () => {
    vi.mocked(prisma.onboardingCase.findUnique).mockResolvedValue({
      createdUserId: 'user-new',
    } as any);

    const res = await updateOnboardingCaseStatus('case-123', 'COMPLETED');

    expect(res.success).toBe(true);
    expect(prisma.onboardingCase.update).toHaveBeenCalledWith({
      where: { id: 'case-123' },
      data: { status: 'COMPLETED' },
    });
  });

  it('allows setting non-COMPLETED statuses without checking for a linked user', async () => {
    const res = await updateOnboardingCaseStatus('case-123', 'IN_PROGRESS');

    expect(res.success).toBe(true);
    expect(prisma.onboardingCase.findUnique).not.toHaveBeenCalled();
    expect(prisma.onboardingCase.update).toHaveBeenCalledWith({
      where: { id: 'case-123' },
      data: { status: 'IN_PROGRESS' },
    });
  });
});

