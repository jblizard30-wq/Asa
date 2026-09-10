import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveOnboardingBlueprint,
  createOnboardingCase,
  toggleOnboardingItemComplete,
  completeOnboardingAndCreateUser,
  updateOnboardingCaseStatus,
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
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
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
    vi.mocked(prisma.onboardingBlueprint.findUnique).mockResolvedValue({
      id: 'bp-1',
      role: 'PASTORAL_STAFF',
      items: [
        {
          id: 'bpi-1',
          category: 'PAPERWORK',
          title: 'W-4 Form',
          docTemplateUrl: 'https://docs.google.com/w4/copy',
          estimatedCost: null,
          costCadence: null,
          provisioningType: 'MANUAL_TASK',
          sortOrder: 0,
        },
        {
          id: 'bpi-2',
          category: 'HARDWARE',
          title: 'MacBook Pro',
          docTemplateUrl: null,
          estimatedCost: 2400 as any,
          costCadence: 'ONE_TIME',
          provisioningType: 'MANUAL_TASK',
          sortOrder: 1,
        },
      ],
    } as any);

    vi.mocked(prisma.onboardingCase.create).mockResolvedValue({
      id: 'case-123',
      personName: 'Jane Smith',
      personEmail: 'jane@example.com',
      role: 'PASTORAL_STAFF',
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

