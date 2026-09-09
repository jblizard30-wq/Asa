import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addMemberToProject, inviteMemberToProject, searchAssignableUsers } from './projects';

const mockState = vi.hoisted(() => ({
  session: {
    user: { id: 'user-admin', role: 'ADMIN', name: 'Admin User', email: 'admin@example.org' },
  } as { user: { id: string; role: string; name: string; email: string } } | null,
  projects: new Map<string, any>(),
  projectMembers: new Map<string, any>(),
  users: new Map<string, any>(),
  notifications: [] as any[],
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => mockState.session),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn(async (payload) => {
    mockState.notifications.push(payload);
  }),
}));

vi.mock('@/lib/prisma', () => {
  return {
    prisma: {
      project: {
        findUnique: vi.fn(async ({ where }: any) => {
          return mockState.projects.get(where.id) ?? null;
        }),
      },
      user: {
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.id) return mockState.users.get(where.id) ?? null;
          if (where.email) {
            for (const u of mockState.users.values()) {
              if (u.email.toLowerCase() === where.email.toLowerCase()) return u;
            }
          }
          return null;
        }),
        findMany: vi.fn(async ({ where, take }: any) => {
          const excludedIds = new Set(where?.id?.notIn ?? []);
          const list = [...mockState.users.values()].filter((u) => !excludedIds.has(u.id));

          if (where?.OR) {
            return list
              .filter((u) => {
                return where.OR.some((condition: any) => {
                  if (condition.name?.contains) {
                    return u.name.toLowerCase().includes(condition.name.contains.toLowerCase());
                  }
                  if (condition.email?.contains) {
                    return u.email.toLowerCase().includes(condition.email.contains.toLowerCase());
                  }
                  return false;
                });
              })
              .slice(0, take ?? 10);
          }

          return list.slice(0, take ?? 10);
        }),
      },
      projectMember: {
        findMany: vi.fn(async ({ where }: any) => {
          const res: any[] = [];
          for (const pm of mockState.projectMembers.values()) {
            if (pm.projectId === where.projectId) {
              res.push({ userId: pm.userId });
            }
          }
          return res;
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          const key = `${where.projectId_userId.projectId}_${where.projectId_userId.userId}`;
          return mockState.projectMembers.get(key) ?? null;
        }),
        create: vi.fn(async ({ data }: any) => {
          const key = `${data.projectId}_${data.userId}`;
          const record = { id: `pm-${Date.now()}`, ...data };
          mockState.projectMembers.set(key, record);
          return record;
        }),
      },
    },
  };
});

describe('Project Member Actions', () => {
  beforeEach(() => {
    mockState.session = {
      user: { id: 'user-admin', role: 'ADMIN', name: 'Admin User', email: 'admin@example.org' },
    };
    mockState.projects.clear();
    mockState.projectMembers.clear();
    mockState.users.clear();
    mockState.notifications = [];

    // Seed test project
    mockState.projects.set('proj-1', { id: 'proj-1', name: 'Worship Sunday Prep' });

    // Seed test users
    mockState.users.set('u-1', { id: 'u-1', name: 'Sarah Jenkins', email: 'sarah@example.org', role: 'USER' });
    mockState.users.set('u-2', { id: 'u-2', name: 'John Doe', email: 'john@example.org', role: 'MANAGER' });
    mockState.users.set('u-3', { id: 'u-3', name: 'Alice Smith', email: 'alice@example.org', role: 'USER' });

    // u-1 is already a member of proj-1
    mockState.projectMembers.set('proj-1_u-1', { projectId: 'proj-1', userId: 'u-1' });
  });

  describe('searchAssignableUsers', () => {
    it('returns assignable users excluding existing members', async () => {
      const results = await searchAssignableUsers('proj-1', '');
      const ids = results.map((r) => r.id);

      expect(ids).not.toContain('u-1');
      expect(ids).toContain('u-2');
      expect(ids).toContain('u-3');
    });

    it('filters users by query name or email', async () => {
      const results = await searchAssignableUsers('proj-1', 'john');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('John Doe');

      const emailResults = await searchAssignableUsers('proj-1', 'alice@');
      expect(emailResults).toHaveLength(1);
      expect(emailResults[0].email).toBe('alice@example.org');
    });

    it('requires admin privileges', async () => {
      mockState.session = {
        user: { id: 'user-normal', role: 'USER', name: 'Normal User', email: 'user@example.org' },
      };

      await expect(searchAssignableUsers('proj-1', '')).rejects.toThrow('Only admins can perform this action');
    });
  });

  describe('addMemberToProject', () => {
    it('adds a user to the project by userId and creates a notification', async () => {
      const res = await addMemberToProject('proj-1', { userId: 'u-2' });

      expect(res.success).toBe(true);
      expect(mockState.projectMembers.has('proj-1_u-2')).toBe(true);
      expect(mockState.notifications).toHaveLength(1);
      expect(mockState.notifications[0].type).toBe('PROJECT_INVITE');
      expect(mockState.notifications[0].recipientId).toBe('u-2');
      expect(mockState.notifications[0].message).toContain('Admin User added you to the project');
    });

    it('adds a user to the project by email', async () => {
      const res = await addMemberToProject('proj-1', { email: 'alice@example.org' });

      expect(res.success).toBe(true);
      expect(mockState.projectMembers.has('proj-1_u-3')).toBe(true);
      expect(mockState.notifications).toHaveLength(1);
      expect(mockState.notifications[0].recipientId).toBe('u-3');
    });

    it('adds a user via FormData with userId', async () => {
      const formData = new FormData();
      formData.set('userId', 'u-2');

      const res = await addMemberToProject('proj-1', formData);
      expect(res.success).toBe(true);
      expect(mockState.projectMembers.has('proj-1_u-2')).toBe(true);
    });

    it('returns error if user is already a member', async () => {
      const res = await addMemberToProject('proj-1', { userId: 'u-1' });

      expect(res.success).toBe(false);
      expect(res.error).toBe('That user is already a member of this project.');
    });

    it('returns error if user not found', async () => {
      const res = await addMemberToProject('proj-1', { userId: 'non-existent' });

      expect(res.success).toBe(false);
      expect(res.error).toBe('User not found.');
    });

    it('returns error if input is empty', async () => {
      const res = await addMemberToProject('proj-1', {});

      expect(res.success).toBe(false);
      expect(res.error).toBe('Please select a user to add.');
    });

    it('inviteMemberToProject works as an alias', async () => {
      const res = await inviteMemberToProject('proj-1', { userId: 'u-2' });

      expect(res.success).toBe(true);
      expect(mockState.projectMembers.has('proj-1_u-2')).toBe(true);
    });
  });
});
