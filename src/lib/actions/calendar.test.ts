import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSermonPrepTask } from './calendar';

const mockState = vi.hoisted(() => ({
  session: {
    user: { id: 'pastor-1', role: 'ADMIN', name: 'Rev. Dr. Thomas Calvin', email: 'tcalvin@chespres.org' },
  } as { user: { id: string; role: string; name: string; email: string } } | null,
  projects: [] as any[],
  sections: [] as any[],
  tasks: [] as any[],
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => mockState.session),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/actions/projects', () => ({
  getOrCreatePersonalProject: vi.fn(async () => 'proj-personal-1'),
}));

vi.mock('@/lib/prisma', () => {
  return {
    prisma: {
      project: {
        findFirst: vi.fn(async () => {
          if (mockState.projects.length === 0) return null;
          return mockState.projects[0];
        }),
      },
      section: {
        findFirst: vi.fn(async () => {
          if (mockState.sections.length === 0) return null;
          return mockState.sections[0];
        }),
        create: vi.fn(async ({ data }: any) => {
          const row = { id: `sec-${mockState.sections.length + 1}`, ...data };
          mockState.sections.push(row);
          return row;
        }),
      },
      task: {
        findFirst: vi.fn(async ({ where }: any) => {
          return mockState.tasks.find((t: any) => {
            if (where.title && t.title !== where.title) return false;
            if (where.projectId && t.projectId !== where.projectId) return false;
            return true;
          }) ?? null;
        }),
        create: vi.fn(async ({ data }: any) => {
          const row = { id: `task-${mockState.tasks.length + 1}`, ...data };
          mockState.tasks.push(row);
          return row;
        }),
      },
    },
  };
});

describe('createSermonPrepTask', () => {
  beforeEach(() => {
    mockState.projects = [
      {
        id: 'proj-worship-1',
        name: 'Preaching & Worship',
        sections: [{ id: 'sec-worship-todo', name: 'To Do', order: 0 }],
      },
    ];
    mockState.sections = [{ id: 'sec-worship-todo', name: 'To Do', order: 0, projectId: 'proj-worship-1' }];
    mockState.tasks = [];
  });

  it('creates a sermon prep task with the 4 canonical Revised Common Lectionary texts', async () => {
    // Easter Sunday 2026 (April 5, 2026 - Year A)
    const result = await createSermonPrepTask('2026-04-05');

    expect(result.success).toBe(true);
    expect(result.taskId).toBe('task-1');
    expect(result.projectId).toBe('proj-worship-1');
    expect(result.readingSet).toBeDefined();
    expect(result.readingSet?.cycle).toBe('A');
    expect(result.readingSet?.gospel).toBe('Matthew 28:1-10');

    expect(mockState.tasks).toHaveLength(1);
    const created = mockState.tasks[0];
    expect(created.title).toContain('Sermon Prep:');
    expect(created.title).toContain('Matthew 28:1-10');
    expect(created.priority).toBe('HIGH');
    expect(created.status).toBe('TODO');

    // Verify task description includes all 4 canonical texts
    expect(created.description).toContain('Canonical Scripture Readings');
    expect(created.description).toContain('Acts 10:34-43');
    expect(created.description).toContain('Psalm 118:1-2, 14-24');
    expect(created.description).toContain('Colossians 3:1-4');
    expect(created.description).toContain('Matthew 28:1-10');
    expect(created.description).toContain('Pastoral Preparation Workflow');
  });

  it('is idempotent when clicked multiple times for the same date', async () => {
    const res1 = await createSermonPrepTask('2026-04-05');
    expect(res1.success).toBe(true);
    expect(mockState.tasks).toHaveLength(1);

    const res2 = await createSermonPrepTask('2026-04-05');
    expect(res2.success).toBe(true);
    expect(res2.taskId).toBe(res1.taskId);
    expect(mockState.tasks).toHaveLength(1); // No duplicate task inserted
  });

  it('requires authentication', async () => {
    mockState.session = null;
    const res = await createSermonPrepTask('2026-04-05');
    expect(res.success).toBe(false);
    expect(res.error).toContain('signed in');
    mockState.session = {
      user: { id: 'pastor-1', role: 'ADMIN', name: 'Rev. Dr. Thomas Calvin', email: 'tcalvin@chespres.org' },
    };
  });
});

