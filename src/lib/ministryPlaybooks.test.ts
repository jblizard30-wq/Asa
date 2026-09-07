import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MINISTRY_PLAYBOOKS,
  listMinistryPlaybooks,
  getMinistryPlaybook,
  instantiatePlaybook,
} from './ministryPlaybooks';
import { addDays } from 'date-fns';

const mockDb = vi.hoisted(() => ({
  projects: [] as any[],
  sections: [] as any[],
  tasks: [] as any[],
  raciCharts: [] as any[],
  sessionUser: {
    id: 'pastor-1',
    name: 'Rev. Dr. Thomas Calvin',
    email: 'tcalvin@chespres.org',
    role: 'ADMIN',
  },
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => ({
    user: mockDb.sessionUser,
  })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/modules', () => ({
  isModuleEnabled: vi.fn((mod: string) => mod === 'raci'),
}));

vi.mock('@/lib/prisma', () => {
  return {
    prisma: {
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
        const tx = {
          project: {
            create: vi.fn(async ({ data }: any) => {
              const row = { id: `proj-${mockDb.projects.length + 1}`, ...data };
              mockDb.projects.push(row);
              return row;
            }),
          },
          section: {
            create: vi.fn(async ({ data }: any) => {
              const row = { id: `sec-${mockDb.sections.length + 1}`, ...data };
              mockDb.sections.push(row);
              return row;
            }),
          },
          task: {
            create: vi.fn(async ({ data }: any) => {
              const row = { id: `task-${mockDb.tasks.length + 1}`, ...data };
              mockDb.tasks.push(row);
              return row;
            }),
          },
          raciChart: {
            create: vi.fn(async ({ data }: any) => {
              const row = { id: `raci-${mockDb.raciCharts.length + 1}`, ...data };
              mockDb.raciCharts.push(row);
              return row;
            }),
          },
        };
        return cb(tx);
      }),
    },
  };
});

describe('Ministry Playbook Library', () => {
  beforeEach(() => {
    mockDb.projects = [];
    mockDb.sections = [];
    mockDb.tasks = [];
    mockDb.raciCharts = [];
  });

  it('provides all 4 pre-configured church templates with comprehensive specifications', () => {
    const playbooks = listMinistryPlaybooks();
    expect(playbooks).toHaveLength(4);

    const ids = playbooks.map((p) => p.id);
    expect(ids).toContain('easter-sunday-intensive');
    expect(ids).toContain('vacation-bible-school');
    expect(ids).toContain('annual-stewardship');
    expect(ids).toContain('confirmation-inquirers');
  });

  it('configures Easter Sunday Intensive across 6 weeks with facilities, choir, AV tech, lilies, communion, and ushers', () => {
    const easter = getMinistryPlaybook('easter-sunday-intensive');
    expect(easter).toBeDefined();
    expect(easter?.estimatedWeeks).toBe(6);
    expect(easter?.category).toBe('Worship & Liturgy');

    const sectionNames = easter?.sections.map((s) => s.name);
    expect(sectionNames).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Facilities'),
        expect.stringContaining('Choir'),
        expect.stringContaining('Audio/Visual'),
        expect.stringContaining('Altar Guild'),
        expect.stringContaining('Communion'),
        expect.stringContaining('Ushers'),
      ])
    );

    // Verify all tasks have valid RACI metadata and relative offsets
    for (const sec of easter!.sections) {
      expect(sec.tasks.length).toBeGreaterThan(0);
      for (const task of sec.tasks) {
        expect(task.title).toBeTruthy();
        expect(task.dueOffsetDays).toBeGreaterThanOrEqual(0);
        expect(task.dueOffsetDays).toBeLessThanOrEqual(50);
        expect(task.raci.responsible).toBeTruthy();
        expect(task.raci.accountable).toBeTruthy();
        expect(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).toContain(task.priority);
      }
    }
  });

  it('configures Vacation Bible School (VBS) with curriculum, volunteer recruitment, background checks, registration, and snacks', () => {
    const vbs = getMinistryPlaybook('vacation-bible-school');
    expect(vbs).toBeDefined();
    expect(vbs?.category).toBe('Children & Family');
    expect(vbs?.estimatedWeeks).toBe(8);

    const sectionNames = vbs?.sections.map((s) => s.name);
    expect(sectionNames).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Curriculum'),
        expect.stringContaining('Volunteer Recruitment'),
        expect.stringContaining('Safety, Background Checks'),
        expect.stringContaining('Student Registration'),
        expect.stringContaining('Snacks'),
      ])
    );

    // Background checks task must be URGENT priority
    const safetySec = vbs?.sections.find((s) => s.name.includes('Background Checks'));
    expect(safetySec).toBeDefined();
    const bgTask = safetySec?.tasks.find((t) => t.title.toLowerCase().includes('background'));
    expect(bgTask).toBeDefined();
    expect(bgTask?.priority).toBe('URGENT');
    expect(bgTask?.raci.responsible).toBe('Child Protection Officer');
  });

  it('configures Annual Stewardship & Capital Campaign with committee kickoff, pledge cards, congregational dinner, and follow-up', () => {
    const stewardship = getMinistryPlaybook('annual-stewardship');
    expect(stewardship).toBeDefined();
    expect(stewardship?.category).toBe('Stewardship & Governance');

    const sectionNames = stewardship?.sections.map((s) => s.name);
    expect(sectionNames).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Campaign Leadership'),
        expect.stringContaining('Pledge Cards'),
        expect.stringContaining('Dinner'),
        expect.stringContaining('Commitment Sunday'),
        expect.stringContaining('Follow-Up'),
      ])
    );
  });

  it('configures Inquirers & Confirmation Class with sponsor pairings, elder interviews, and baptism prep', () => {
    const confirmation = getMinistryPlaybook('confirmation-inquirers');
    expect(confirmation).toBeDefined();
    expect(confirmation?.category).toBe('Discipleship & Formation');

    const sectionNames = confirmation?.sections.map((s) => s.name);
    expect(sectionNames).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Course Planning'),
        expect.stringContaining('Mentor & Sponsor Pairings'),
        expect.stringContaining('Curriculum Sessions'),
        expect.stringContaining('Elder Interviews'),
        expect.stringContaining('Confirmation Sunday & Baptism Preparation'),
      ])
    );
  });

  it('instantiates a playbook calculating relative calendar offsets from the start date', async () => {
    const kickoff = new Date('2026-03-01T00:00:00.000Z');
    const result = await instantiatePlaybook('easter-sunday-intensive', kickoff, {
      projectName: 'Easter 2026 Campaign',
    });

    expect(result.success).toBe(true);
    expect(result.projectId).toBe('proj-1');
    expect(mockDb.projects).toHaveLength(1);
    expect(mockDb.projects[0].name).toBe('Easter 2026 Campaign');

    // Sections created
    const easter = getMinistryPlaybook('easter-sunday-intensive')!;
    expect(mockDb.sections).toHaveLength(easter.sections.length);

    // Tasks created
    expect(mockDb.tasks.length).toBeGreaterThan(20);

    // Verify task dates match addDays(kickoff, dueOffsetDays)
    const firstTask = mockDb.tasks.find((t: any) =>
      t.title.includes('Sanctuary & Campus Walkthrough')
    );
    expect(firstTask).toBeDefined();
    expect(firstTask.dueDate.toISOString().slice(0, 10)).toBe('2026-03-01'); // offset 0
    expect(firstTask.description).toContain('RACI Matrix');
    expect(firstTask.description).toContain('Facilities Director');

    // Verify later task with offset
    const dressRehearsalTask = mockDb.tasks.find((t: any) =>
      t.title.includes('Dress Rehearsal')
    );
    expect(dressRehearsalTask).toBeDefined();
    const expectedDressDate = addDays(kickoff, 40).toISOString().slice(0, 10);
    expect(dressRehearsalTask.dueDate.toISOString().slice(0, 10)).toBe(expectedDressDate);
  });

  it('returns an error when an invalid playbook ID is requested', async () => {
    const result = await instantiatePlaybook('non-existent-playbook', new Date());
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns an error when an invalid start date is provided', async () => {
    const result = await instantiatePlaybook('easter-sunday-intensive', 'not-a-valid-date');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid start date');
  });
});

