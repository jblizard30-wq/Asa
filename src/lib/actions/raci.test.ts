import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  session: {
    user: { id: 'user-admin', role: 'ADMIN', name: 'Admin User', email: 'admin@example.org' },
  } as { user: { id: string; role: string; name: string; email: string } } | null,
  raciEnabled: true,
  charts: new Map<string, any>(),
  steps: new Map<string, any>(),
  people: new Map<string, any>(),
  assignments: new Map<string, any>(),
  shares: new Map<string, any>(),
  teams: new Map<string, any>(),
  teamMembers: [] as Array<{ teamId: string; userId: string }>,
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => mockState.session),
}));

vi.mock('@/lib/modules', () => ({
  isModuleEnabled: vi.fn((key: string) => (key === 'raci' ? mockState.raciEnabled : false)),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/prisma', () => {
  return {
    prisma: {
      $transaction: vi.fn(async (callbackOrArray) => {
        if (Array.isArray(callbackOrArray)) {
          return Promise.all(callbackOrArray);
        }
        if (typeof callbackOrArray === 'function') {
          return callbackOrArray({
            raciStep: {
              create: vi.fn(async ({ data }: any) => {
                const row = { id: `step-${Date.now()}-${Math.random()}`, ...data };
                mockState.steps.set(row.id, row);
                return row;
              }),
              update: vi.fn(async ({ where, data }: any) => {
                const s = mockState.steps.get(where.id);
                if (s) Object.assign(s, data);
                return s;
              }),
            },
            raciPerson: {
              update: vi.fn(async ({ where, data }: any) => {
                const p = mockState.people.get(where.id);
                if (p) Object.assign(p, data);
                return p;
              }),
            },
          });
        }
      }),
      raciChart: {
        create: vi.fn(async ({ data }: any) => {
          const id = `chart-${mockState.charts.size + 1}`;
          const chart = { id, createdAt: new Date(), updatedAt: new Date(), archivedAt: null, shares: [], ...data };
          mockState.charts.set(id, chart);
          return chart;
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          const c = mockState.charts.get(where.id);
          if (!c) return null;
          const chartShares = Array.from(mockState.shares.values()).filter((s) => s.chartId === c.id);
          return { ...c, shares: chartShares };
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const c = mockState.charts.get(where.id);
          if (!c) throw new Error('Chart not found');
          Object.assign(c, data, { updatedAt: new Date() });
          return c;
        }),
      },
      raciChartShare: {
        upsert: vi.fn(async ({ where, create, update }: any) => {
          const id = `share-${mockState.shares.size + 1}`;
          const existingKey = where.chartId_userId
            ? `u-${where.chartId_userId.chartId}-${where.chartId_userId.userId}`
            : `t-${where.chartId_teamId.chartId}-${where.chartId_teamId.teamId}`;

          const existing = mockState.shares.get(existingKey);
          if (existing) {
            Object.assign(existing, update);
            return existing;
          }
          const row = { id, ...create };
          mockState.shares.set(existingKey, row);
          return row;
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          for (const s of mockState.shares.values()) {
            if (s.id === where.id) return s;
          }
          return null;
        }),
        delete: vi.fn(async ({ where }: any) => {
          for (const [key, s] of mockState.shares.entries()) {
            if (s.id === where.id) {
              mockState.shares.delete(key);
              return s;
            }
          }
          return null;
        }),
      },
      teamMember: {
        findMany: vi.fn(async ({ where }: any) => {
          return mockState.teamMembers.filter((tm) => tm.userId === where.userId);
        }),
      },
      raciStep: {
        findFirst: vi.fn(async ({ where, orderBy }: any) => {
          const chartSteps = Array.from(mockState.steps.values()).filter((s) => s.chartId === where.chartId);
          if (chartSteps.length === 0) return null;
          chartSteps.sort((a, b) => b.stepOrder - a.stepOrder);
          return chartSteps[0];
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          return mockState.steps.get(where.id) || null;
        }),
        create: vi.fn(async ({ data }: any) => {
          const id = `step-${mockState.steps.size + 1}`;
          const row = { id, ...data };
          mockState.steps.set(id, row);
          return row;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const s = mockState.steps.get(where.id);
          if (!s) throw new Error('Step not found');
          Object.assign(s, data);
          return s;
        }),
        delete: vi.fn(async ({ where }: any) => {
          const s = mockState.steps.get(where.id);
          mockState.steps.delete(where.id);
          return s;
        }),
      },
      raciPerson: {
        findFirst: vi.fn(async ({ where }: any) => {
          const people = Array.from(mockState.people.values()).filter((p) => p.chartId === where.chartId);
          if (people.length === 0) return null;
          people.sort((a, b) => b.personOrder - a.personOrder);
          return people[0];
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          return mockState.people.get(where.id) || null;
        }),
        create: vi.fn(async ({ data }: any) => {
          const id = `person-${mockState.people.size + 1}`;
          const row = { id, ...data };
          mockState.people.set(id, row);
          return row;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const p = mockState.people.get(where.id);
          if (!p) throw new Error('Person not found');
          Object.assign(p, data);
          return p;
        }),
        delete: vi.fn(async ({ where }: any) => {
          const p = mockState.people.get(where.id);
          mockState.people.delete(where.id);
          return p;
        }),
      },
      raciAssignment: {
        deleteMany: vi.fn(async ({ where }: any) => {
          const key = `${where.stepId}-${where.personId}`;
          mockState.assignments.delete(key);
          return { count: 1 };
        }),
        upsert: vi.fn(async ({ where, create, update }: any) => {
          const key = `${where.stepId_personId.stepId}-${where.stepId_personId.personId}`;
          const existing = mockState.assignments.get(key);
          if (existing) {
            Object.assign(existing, update);
            return existing;
          }
          const row = { ...create };
          mockState.assignments.set(key, row);
          return row;
        }),
      },
    },
  };
});

import {
  createRaciChart,
  updateRaciChart,
  shareRaciChart,
  removeRaciChartShare,
  addRaciStep,
  bulkAddRaciSteps,
  updateRaciStep,
  deleteRaciStep,
  addRaciPerson,
  updateRaciPerson,
  deleteRaciPerson,
  setRaciCell,
  canUserEditChart,
} from './raci';

describe('RACI Server Actions', () => {
  beforeEach(() => {
    mockState.session = {
      user: { id: 'user-admin', role: 'ADMIN', name: 'Admin User', email: 'admin@example.org' },
    };
    mockState.raciEnabled = true;
    mockState.charts.clear();
    mockState.steps.clear();
    mockState.people.clear();
    mockState.assignments.clear();
    mockState.shares.clear();
    mockState.teams.clear();
    mockState.teamMembers = [];
  });

  it('creates a chart with cleaned tags and visibility setting', async () => {
    const res = await createRaciChart({
      processName: 'Sunday Service Setup',
      owner: 'Worship Lead',
      tags: ['#Sunday', 'Worship', ' Sunday ', ''],
      isPublic: true,
    });

    expect(res.success).toBe(true);
    if (!res.success) return;

    const chart = mockState.charts.get(res.chartId);
    expect(chart).toBeDefined();
    expect(chart.processName).toBe('Sunday Service Setup');
    expect(chart.tags).toEqual(['Sunday', 'Worship']);
    expect(chart.isPublic).toBe(true);
    expect(chart.createdById).toBe('user-admin');
  });

  it('shares chart with a profile (user) and team with VIEW/EDIT access', async () => {
    const chartRes = await createRaciChart({
      processName: 'Easter Production',
      isPublic: false,
    });
    if (!chartRes.success) throw new Error('Setup failed');

    // Share with user
    const userShareRes = await shareRaciChart({
      chartId: chartRes.chartId,
      targetType: 'USER',
      targetId: 'volunteer-1',
      access: 'EDIT',
    });
    expect(userShareRes.success).toBe(true);

    // Share with team
    const teamShareRes = await shareRaciChart({
      chartId: chartRes.chartId,
      targetType: 'TEAM',
      targetId: 'team-worship',
      access: 'VIEW',
    });
    expect(teamShareRes.success).toBe(true);

    // Verify permissions calculation
    const canVolunteerEdit = await canUserEditChart('volunteer-1', 'USER', chartRes.chartId);
    expect(canVolunteerEdit).toBe(true);

    // User in team-worship has VIEW only
    mockState.teamMembers = [{ teamId: 'team-worship', userId: 'user-tech' }];
    const canTechEdit = await canUserEditChart('user-tech', 'USER', chartRes.chartId);
    expect(canTechEdit).toBe(false);

    // Remove user share
    if (userShareRes.success) {
      await removeRaciChartShare({ shareId: userShareRes.shareId });
      const canVolunteerEditAfter = await canUserEditChart('volunteer-1', 'USER', chartRes.chartId);
      expect(canVolunteerEditAfter).toBe(false);
    }
  });

  it('supports rapid bulk addition of steps from pasted list', async () => {
    const chartRes = await createRaciChart({ processName: 'Capital Project' });
    if (!chartRes.success) throw new Error('Setup failed');

    const bulkRes = await bulkAddRaciSteps({
      chartId: chartRes.chartId,
      stepNames: [
        '1. Vendor RFP submission',
        '2. Architectural review',
        '3. Session approval',
        '',
        '   ',
      ],
    });

    expect(bulkRes.success).toBe(true);
    if (bulkRes.success) {
      expect(bulkRes.count).toBe(3);
    }
    expect(mockState.steps.size).toBe(3);
  });

  it('allows inline editing and deletion of steps and persons', async () => {
    const chartRes = await createRaciChart({ processName: 'Test Process' });
    if (!chartRes.success) throw new Error('Setup failed');

    const stepRes = await addRaciStep({ chartId: chartRes.chartId, stepName: 'Initial Step' });
    if (!stepRes.success) throw new Error('Step add failed');

    const personRes = await addRaciPerson({ chartId: chartRes.chartId, name: 'Alice', roleTitle: 'Director' });
    if (!personRes.success) throw new Error('Person add failed');

    // Update step
    const updateStepRes = await updateRaciStep({ stepId: stepRes.stepId, stepName: 'Renamed Step' });
    expect(updateStepRes.success).toBe(true);
    expect(mockState.steps.get(stepRes.stepId).stepName).toBe('Renamed Step');

    // Update person
    const updatePersonRes = await updateRaciPerson({
      personId: personRes.personId,
      name: 'Alice Smith',
      roleTitle: 'Executive Director',
    });
    expect(updatePersonRes.success).toBe(true);
    expect(mockState.people.get(personRes.personId).name).toBe('Alice Smith');
    expect(mockState.people.get(personRes.personId).roleTitle).toBe('Executive Director');

    // Delete step
    const delStepRes = await deleteRaciStep({ stepId: stepRes.stepId });
    expect(delStepRes.success).toBe(true);
    expect(mockState.steps.has(stepRes.stepId)).toBe(false);

    // Delete person
    const delPersonRes = await deleteRaciPerson({ personId: personRes.personId });
    expect(delPersonRes.success).toBe(true);
    expect(mockState.people.has(personRes.personId)).toBe(false);
  });

  it('sets and clears matrix cells with RACI roles', async () => {
    const chartRes = await createRaciChart({ processName: 'Matrix Test' });
    if (!chartRes.success) throw new Error('Setup failed');

    const stepRes = await addRaciStep({ chartId: chartRes.chartId, stepName: 'Task 1' });
    const personRes = await addRaciPerson({ chartId: chartRes.chartId, name: 'Bob' });
    if (!stepRes.success || !personRes.success) throw new Error('Setup failed');

    // Set cell to R and A
    const setRes = await setRaciCell({
      stepId: stepRes.stepId,
      personId: personRes.personId,
      designations: ['RESPONSIBLE', 'ACCOUNTABLE'],
    });
    expect(setRes.success).toBe(true);
    if (setRes.success) expect(setRes.cleared).toBe(false);

    const cell = mockState.assignments.get(`${stepRes.stepId}-${personRes.personId}`);
    expect(cell.designations).toEqual(['RESPONSIBLE', 'ACCOUNTABLE']);

    // Clear cell
    const clearRes = await setRaciCell({
      stepId: stepRes.stepId,
      personId: personRes.personId,
      designations: [],
    });
    expect(clearRes.success).toBe(true);
    if (clearRes.success) expect(clearRes.cleared).toBe(true);
    expect(mockState.assignments.has(`${stepRes.stepId}-${personRes.personId}`)).toBe(false);
  });
});

