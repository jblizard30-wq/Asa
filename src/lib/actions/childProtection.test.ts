import { beforeEach, describe, expect, it, vi } from 'vitest';

type Session = { user: { id: string; role: string } } | null;

const mockState = vi.hoisted(() => ({
  session: null as { user: { id: string; role: string } } | null,
  childProtectionEnabled: true,
  shares: [] as Array<{ userId: string | null; teamId: string | null; access: 'VIEW' | 'EDIT' }>,
  teamMembers: [] as Array<{ userId: string; teamId: string }>,
  records: new Map<string, any>(),
  projectMembers: new Set<string>(),
  users: new Map<string, { id: string; role: string; memberships: string[] }>(),
  tasks: [] as any[],
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => mockState.session),
}));

vi.mock('@/lib/modules', () => ({
  isModuleEnabled: vi.fn((key: string) => (key === 'child_protection' ? mockState.childProtectionEnabled : false)),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    childProtectionShare: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.userId) return mockState.shares.find((s) => s.userId === where.userId) ?? null;
        return null;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        const teamIds: string[] = where?.teamId?.in ?? [];
        return mockState.shares
          .filter((s) => s.teamId && teamIds.includes(s.teamId))
          .map((s) => ({ access: s.access }));
      }),
    },
    teamMember: {
      findMany: vi.fn(async ({ where }: any) => mockState.teamMembers.filter((t) => t.userId === where.userId)),
    },
    childProtectionRecord: {
      create: vi.fn(async ({ data }: any) => {
        const id = `record-${mockState.records.size + 1}`;
        const row = { id, archivedAt: null, ...data };
        mockState.records.set(id, row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: any) => mockState.records.get(where.id) ?? null),
      findMany: vi.fn(async ({ where }: any) => {
        const ids: string[] = where?.id?.in ?? [];
        return ids
          .map((id) => mockState.records.get(id))
          .filter(Boolean)
          .map((r) => ({ id: r.id, archivedAt: r.archivedAt }));
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const existing = mockState.records.get(where.id);
        const updated = { ...existing, ...data };
        mockState.records.set(where.id, updated);
        return updated;
      }),
    },
    projectMember: {
      findUnique: vi.fn(async ({ where }: any) => {
        const key = `${where.projectId_userId.projectId}:${where.projectId_userId.userId}`;
        return mockState.projectMembers.has(key) ? { id: 'pm-1', ...where.projectId_userId } : null;
      }),
    },
    user: {
      findMany: vi.fn(async ({ where }: any) => {
        const ids: string[] = where?.id?.in ?? [];
        const projectId = where?.OR?.[1]?.memberships?.some?.projectId;
        return ids
          .map((id) => mockState.users.get(id))
          .filter(Boolean)
          .filter((u: any) => u.role === 'ADMIN' || u.memberships.includes(projectId))
          .map((u: any) => ({ id: u.id }));
      }),
    },
    task: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: any) => {
        const task = { id: `task-${mockState.tasks.length + 1}`, ...data };
        mockState.tasks.push(task);
        return task;
      }),
    },
    $transaction: vi.fn(async (arr: Promise<any>[]) => Promise.all(arr)),
  },
}));

import {
  createChildProtectionRecord,
  updateChildProtectionRecord,
  batchUpdateChildProtectionRecords,
  archiveChildProtectionRecord,
  importChildProtectionRecords,
  createRenewalReviewTask,
} from './childProtection';

const ADMIN: Session = { user: { id: 'admin-1', role: 'ADMIN' } };
const NO_ACCESS_USER: Session = { user: { id: 'user-1', role: 'USER' } };
const VIEW_USER: Session = { user: { id: 'user-2', role: 'USER' } };
const EDIT_USER: Session = { user: { id: 'user-3', role: 'USER' } };

function seedRecord(overrides: Partial<any> = {}) {
  const id = overrides.id ?? `record-${mockState.records.size + 1}`;
  const row = {
    name: 'Jane Doe',
    email: null,
    ministries: [],
    docusignSigned: false,
    docusignSignedAt: null,
    docusignUrl: null,
    ministrySafeCompletedAt: null,
    ministrySafeExpiresAt: null,
    ministrySafeUrl: null,
    backgroundCheckCompletedAt: null,
    backgroundCheckExpiresAt: null,
    backgroundCheckUrl: null,
    notes: null,
    userId: null,
    createdById: null,
    archivedAt: null,
    ...overrides,
    id,
  };
  mockState.records.set(id, row);
  return row;
}

beforeEach(() => {
  mockState.session = null;
  mockState.childProtectionEnabled = true;
  mockState.shares = [];
  mockState.teamMembers = [];
  mockState.records = new Map();
  mockState.projectMembers = new Set();
  mockState.users = new Map();
  mockState.tasks = [];
});

describe('Child Protection mutating actions — authorization', () => {
  const mutations: Array<[string, () => Promise<{ success: boolean; error?: string }>]> = [
    ['createChildProtectionRecord', () => createChildProtectionRecord({ name: 'New Volunteer' })],
    ['updateChildProtectionRecord', () => updateChildProtectionRecord('record-1', { name: 'Updated' })],
    ['batchUpdateChildProtectionRecords', () => batchUpdateChildProtectionRecords([{ id: 'record-1', data: { name: 'Updated' } }])],
    ['archiveChildProtectionRecord', () => archiveChildProtectionRecord('record-1')],
    ['importChildProtectionRecords', () => importChildProtectionRecords('Imported')],
  ];

  it.each(mutations)('%s rejects an unauthenticated caller', async (_name, action) => {
    seedRecord({ id: 'record-1' });
    mockState.session = null;
    const result = await action();
    expect(result.success).toBe(false);
  });

  it.each(mutations)('%s rejects a caller with no ChildProtectionShare', async (_name, action) => {
    seedRecord({ id: 'record-1' });
    mockState.session = NO_ACCESS_USER;
    const result = await action();
    expect(result.success).toBe(false);
  });

  it.each(mutations)('%s rejects a VIEW-only share', async (_name, action) => {
    seedRecord({ id: 'record-1' });
    mockState.session = VIEW_USER;
    mockState.shares.push({ userId: VIEW_USER!.user.id, teamId: null, access: 'VIEW' });
    const result = await action();
    expect(result.success).toBe(false);
  });

  it('allows an EDIT share to create a record', async () => {
    mockState.session = EDIT_USER;
    mockState.shares.push({ userId: EDIT_USER!.user.id, teamId: null, access: 'EDIT' });
    const result = await createChildProtectionRecord({ name: 'New Volunteer' });
    expect(result.success).toBe(true);
  });

  it('allows a global ADMIN to create a record with no explicit share', async () => {
    mockState.session = ADMIN;
    const result = await createChildProtectionRecord({ name: 'New Volunteer' });
    expect(result.success).toBe(true);
  });
});

describe('checkChildProtectionAccess resolution via server actions', () => {
  it('grants the most permissive (EDIT) access when a user is on two shared teams', async () => {
    mockState.session = EDIT_USER;
    mockState.teamMembers.push({ userId: EDIT_USER!.user.id, teamId: 'team-view' });
    mockState.teamMembers.push({ userId: EDIT_USER!.user.id, teamId: 'team-edit' });
    mockState.shares.push({ userId: null, teamId: 'team-view', access: 'VIEW' });
    mockState.shares.push({ userId: null, teamId: 'team-edit', access: 'EDIT' });

    const result = await createChildProtectionRecord({ name: 'New Volunteer' });
    expect(result.success).toBe(true);
  });
});

describe('batchUpdateChildProtectionRecords — archived record guard', () => {
  beforeEach(() => {
    mockState.session = EDIT_USER;
    mockState.shares.push({ userId: EDIT_USER!.user.id, teamId: null, access: 'EDIT' });
  });

  it('rejects the whole batch if any target record has been archived', async () => {
    seedRecord({ id: 'active-1', archivedAt: null });
    seedRecord({ id: 'archived-1', archivedAt: new Date('2026-01-01') });

    const result = await batchUpdateChildProtectionRecords([
      { id: 'active-1', data: { name: 'Still valid' } },
      { id: 'archived-1', data: { name: 'Should not apply' } },
    ]);

    expect(result.success).toBe(false);
    expect(mockState.records.get('archived-1').name).toBe('Jane Doe');
  });

  it('rejects the batch if a target record does not exist', async () => {
    seedRecord({ id: 'active-1' });
    const result = await batchUpdateChildProtectionRecords([{ id: 'missing-1', data: { name: 'x' } }]);
    expect(result.success).toBe(false);
  });

  it('applies the batch atomically when every record is active', async () => {
    seedRecord({ id: 'active-1' });
    seedRecord({ id: 'active-2' });
    const result = await batchUpdateChildProtectionRecords([
      { id: 'active-1', data: { name: 'Updated 1' } },
      { id: 'active-2', data: { name: 'Updated 2' } },
    ]);
    expect(result.success).toBe(true);
    expect(mockState.records.get('active-1').name).toBe('Updated 1');
    expect(mockState.records.get('active-2').name).toBe('Updated 2');
  });
});

describe('createRenewalReviewTask — project scoping', () => {
  beforeEach(() => {
    mockState.session = EDIT_USER;
    mockState.shares.push({ userId: EDIT_USER!.user.id, teamId: null, access: 'EDIT' });
    seedRecord({ id: 'record-1' });
  });

  it('rejects a VIEW-only caller even if they belong to the target project', async () => {
    mockState.session = VIEW_USER;
    mockState.shares = [{ userId: VIEW_USER!.user.id, teamId: null, access: 'VIEW' }];
    mockState.projectMembers.add('project-1:user-2');

    const result = await createRenewalReviewTask({
      recordId: 'record-1',
      projectId: 'project-1',
      sectionId: 'section-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/edit access/i);
    expect(mockState.tasks).toHaveLength(0);
  });

  it('rejects a caller who is not a member of the target project', async () => {
    const result = await createRenewalReviewTask({
      recordId: 'record-1',
      projectId: 'project-1',
      sectionId: 'section-1',
    });

    expect(result.success).toBe(false);
    expect(mockState.tasks).toHaveLength(0);
  });

  it('succeeds for a project member and drops an assignee who is not eligible for that project', async () => {
    mockState.projectMembers.add('project-1:user-3');
    mockState.users.set('outsider-1', { id: 'outsider-1', role: 'USER', memberships: [] });

    const result: any = await createRenewalReviewTask({
      recordId: 'record-1',
      projectId: 'project-1',
      sectionId: 'section-1',
      assigneeId: 'outsider-1',
    });

    expect(result.success).toBe(true);
    expect(mockState.tasks[0].assignees).toBeUndefined();
  });

  it('connects an assignee who is a member of the target project', async () => {
    mockState.projectMembers.add('project-1:user-3');
    mockState.users.set('teammate-1', { id: 'teammate-1', role: 'USER', memberships: ['project-1'] });

    const result: any = await createRenewalReviewTask({
      recordId: 'record-1',
      projectId: 'project-1',
      sectionId: 'section-1',
      assigneeId: 'teammate-1',
    });

    expect(result.success).toBe(true);
    expect(mockState.tasks[0].assignees.connect).toEqual([{ id: 'teammate-1' }]);
  });
});

describe('Child Protection module gating', () => {
  it('rejects every mutation when the module is disabled, even for an admin', async () => {
    mockState.childProtectionEnabled = false;
    mockState.session = ADMIN;

    const result = await createChildProtectionRecord({ name: 'New Volunteer' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not enabled/i);
  });
});
