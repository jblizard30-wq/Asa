import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSection, updateSection, deleteSection, reorderSections } from './sections';

const mockState = vi.hoisted(() => ({
  session: {
    user: { id: 'user-1', role: 'USER', name: 'Elder Bob', email: 'bob@chespres.org' },
  } as { user: { id: string; role: string; name: string; email: string } } | null,
  projectMembers: [] as any[],
  sections: [] as any[],
  tasks: [] as any[],
  automationRules: [] as any[],
  intakeForms: [] as any[],
  serviceTemplateRuns: [] as any[],
  taskProjects: [] as any[],
  taskRecurrences: [] as any[],
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => mockState.session),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    projectMember: {
      findUnique: vi.fn(async ({ where }: any) => {
        const { projectId, userId } = where.projectId_userId || {};
        return (
          mockState.projectMembers.find((m) => m.projectId === projectId && m.userId === userId) ?? null
        );
      }),
    },
    section: {
      findUnique: vi.fn(async ({ where }: any) => {
        return mockState.sections.find((s) => s.id === where.id) ?? null;
      }),
      findFirst: vi.fn(async ({ where, orderBy }: any) => {
        let results = mockState.sections.filter((s) => {
          if (where?.projectId && s.projectId !== where.projectId) return false;
          if (where?.id?.not && s.id === where.id.not) return false;
          return true;
        });
        if (orderBy?.order === 'desc') {
          results.sort((a, b) => b.order - a.order);
        } else if (orderBy?.order === 'asc') {
          results.sort((a, b) => a.order - b.order);
        }
        return results[0] ?? null;
      }),
      findMany: vi.fn(async ({ where, orderBy }: any) => {
        let results = mockState.sections.filter((s) => {
          if (where?.projectId && s.projectId !== where.projectId) return false;
          return true;
        });
        if (orderBy?.order === 'asc') {
          results.sort((a, b) => a.order - b.order);
        }
        return results;
      }),
      count: vi.fn(async ({ where }: any) => {
        return mockState.sections.filter((s) => !where?.projectId || s.projectId === where.projectId).length;
      }),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `sec-${mockState.sections.length + 1}`, ...data };
        mockState.sections.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = mockState.sections.findIndex((s) => s.id === where.id);
        if (idx === -1) throw new Error('Section not found');
        mockState.sections[idx] = { ...mockState.sections[idx], ...data };
        return mockState.sections[idx];
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = mockState.sections.findIndex((s) => s.id === where.id);
        if (idx !== -1) mockState.sections.splice(idx, 1);
        return {};
      }),
    },
    task: {
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const t of mockState.tasks) {
          if (where.sectionId && t.sectionId === where.sectionId) {
            Object.assign(t, data);
            count++;
          }
        }
        return { count };
      }),
    },
    taskProject: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    taskRecurrence: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    intakeForm: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    serviceTemplateRun: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    automationRule: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    $transaction: vi.fn(async (cbOrArray: any) => {
      if (Array.isArray(cbOrArray)) {
        return Promise.all(cbOrArray);
      }
      return cbOrArray({
        section: {
          findMany: vi.fn(async ({ where, orderBy }: any) => {
            let results = mockState.sections.filter((s) => s.projectId === where.projectId);
            if (orderBy?.order === 'asc') results.sort((a, b) => a.order - b.order);
            return results;
          }),
          update: vi.fn(async ({ where, data }: any) => {
            const idx = mockState.sections.findIndex((s) => s.id === where.id);
            if (idx !== -1) mockState.sections[idx] = { ...mockState.sections[idx], ...data };
            return mockState.sections[idx];
          }),
          delete: vi.fn(async ({ where }: any) => {
            const idx = mockState.sections.findIndex((s) => s.id === where.id);
            if (idx !== -1) mockState.sections.splice(idx, 1);
            return {};
          }),
        },
        task: {
          updateMany: vi.fn(async ({ where, data }: any) => {
            for (const t of mockState.tasks) {
              if (where.sectionId && t.sectionId === where.sectionId) {
                Object.assign(t, data);
              }
            }
            return { count: 1 };
          }),
        },
        taskProject: { updateMany: vi.fn(async () => ({ count: 0 })) },
        taskRecurrence: { updateMany: vi.fn(async () => ({ count: 0 })) },
        intakeForm: { updateMany: vi.fn(async () => ({ count: 0 })) },
        serviceTemplateRun: { updateMany: vi.fn(async () => ({ count: 0 })) },
        automationRule: { updateMany: vi.fn(async () => ({ count: 0 })) },
      });
    }),
  },
}));

describe('Section actions', () => {
  beforeEach(() => {
    mockState.session = {
      user: { id: 'user-1', role: 'USER', name: 'Elder Bob', email: 'bob@chespres.org' },
    };
    mockState.projectMembers = [{ projectId: 'proj-1', userId: 'user-1' }];
    mockState.sections = [
      { id: 'sec-1', name: 'To Do', projectId: 'proj-1', order: 0 },
      { id: 'sec-2', name: 'In Progress', projectId: 'proj-1', order: 1 },
      { id: 'sec-3', name: 'Done', projectId: 'proj-1', order: 2 },
    ];
    mockState.tasks = [
      { id: 'task-1', title: 'Prepare bulletin', sectionId: 'sec-1', projectId: 'proj-1' },
      { id: 'task-2', title: 'Tune piano', sectionId: 'sec-2', projectId: 'proj-1' },
    ];
  });

  describe('createSection', () => {
    it('creates a custom section and increments order', async () => {
      const res = await createSection('proj-1', 'Needs Review');
      expect(res.success).toBe(true);
      expect(res.name).toBe('Needs Review');
      expect(res.order).toBe(3);
      expect(mockState.sections).toHaveLength(4);
    });

    it('validates empty name', async () => {
      const res = await createSection('proj-1', '   ');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Column name cannot be empty');
    });

    it('rejects unauthenticated or non-member user', async () => {
      mockState.session = null;
      await expect(createSection('proj-1', 'Backlog')).rejects.toThrow('Not authenticated');

      mockState.session = {
        user: { id: 'user-unknown', role: 'USER', name: 'Stranger', email: 'stranger@example.com' },
      };
      await expect(createSection('proj-1', 'Backlog')).rejects.toThrow('You are not a member of this project');
    });
  });

  describe('updateSection', () => {
    it('renames an existing section (e.g. replacing default "To Do" with a custom label)', async () => {
      const res = await updateSection('sec-1', 'Liturgical Prep');
      expect(res.success).toBe(true);
      expect(res.section?.name).toBe('Liturgical Prep');
      expect(mockState.sections.find((s) => s.id === 'sec-1')?.name).toBe('Liturgical Prep');
    });

    it('returns error if section not found', async () => {
      const res = await updateSection('sec-nonexistent', 'Something');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Column not found');
    });
  });

  describe('deleteSection', () => {
    it('deletes a section and reassigns its tasks to destination section', async () => {
      const res = await deleteSection('sec-1', 'sec-2');
      expect(res.success).toBe(true);
      expect(mockState.sections.find((s) => s.id === 'sec-1')).toBeUndefined();
      // task-1 should have been moved to sec-2
      const task1 = mockState.tasks.find((t) => t.id === 'task-1');
      expect(task1?.sectionId).toBe('sec-2');
    });

    it('automatically picks remaining sibling if destination not specified', async () => {
      const res = await deleteSection('sec-1');
      expect(res.success).toBe(true);
      expect(mockState.sections.find((s) => s.id === 'sec-1')).toBeUndefined();
      const task1 = mockState.tasks.find((t) => t.id === 'task-1');
      expect(task1?.sectionId).toBe('sec-2');
    });

    it('refuses to delete if it is the only remaining section in the project', async () => {
      mockState.sections = [{ id: 'sec-only', name: 'General', projectId: 'proj-1', order: 0 }];
      const res = await deleteSection('sec-only');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Cannot delete the only column in a project.');
    });
  });

  describe('reorderSections', () => {
    it('updates order for all specified section IDs', async () => {
      const res = await reorderSections('proj-1', ['sec-3', 'sec-1', 'sec-2']);
      expect(res.success).toBe(true);
      expect(mockState.sections.find((s) => s.id === 'sec-3')?.order).toBe(0);
      expect(mockState.sections.find((s) => s.id === 'sec-1')?.order).toBe(1);
      expect(mockState.sections.find((s) => s.id === 'sec-2')?.order).toBe(2);
    });
  });
});

