import { beforeEach, describe, expect, it, vi } from 'vitest';

// Models just enough of ProjectMember/User/Project/Task to exercise the atomic-claim guard in
// route.ts: `updateMany` only succeeds when `where.lastUnassignedDigestSentAt` still matches the
// value currently stored, exactly like Postgres evaluating an UPDATE ... WHERE clause.
const state = vi.hoisted(() => ({
  owner: {
    id: 'owner-1',
    email: 'owner1@example.com',
    name: 'Owner One',
    lastUnassignedDigestSentAt: null as Date | null,
    createdAt: new Date('2020-01-01T00:00:00.000Z'),
  },
  project: { id: 'project-1', name: 'Bulletin' },
  unassignedTask: { title: 'Print bulletin covers', projectId: 'project-1' },
  sentEmails: [] as { to: string; subject: string; body: string }[],
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    projectMember: {
      findMany: async () => [{ userId: state.owner.id, projectId: state.project.id }],
    },
    user: {
      findMany: async () => [{ ...state.owner }],
      updateMany: async ({ where, data }: any) => {
        if (where.id !== state.owner.id || where.lastUnassignedDigestSentAt !== state.owner.lastUnassignedDigestSentAt) {
          return { count: 0 };
        }
        state.owner.lastUnassignedDigestSentAt = data.lastUnassignedDigestSentAt;
        return { count: 1 };
      },
    },
    project: {
      findMany: async () => [{ ...state.project }],
    },
    task: {
      findMany: async () => [{ ...state.unassignedTask }],
    },
  },
}));

vi.mock('@/lib/email', () => ({
  sendNotificationEmail: async (to: string, subject: string, body: string) => {
    state.sentEmails.push({ to, subject, body });
  },
}));

import { GET } from './route';

function cronRequest() {
  return new Request('http://localhost/api/cron/unassigned-digest', {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
}

describe('unassigned-digest cron idempotency', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret';
    state.owner.lastUnassignedDigestSentAt = null;
    state.sentEmails.length = 0;
  });

  it('sends exactly one digest when two overlapping cron invocations race the same owner', async () => {
    const [resA, resB] = await Promise.all([GET(cronRequest()), GET(cronRequest())]);
    const [bodyA, bodyB] = await Promise.all([resA.json(), resB.json()]);

    expect(state.sentEmails).toHaveLength(1);
    expect([bodyA.sent, bodyB.sent].sort()).toEqual([0, 1]);
    expect(state.owner.lastUnassignedDigestSentAt).not.toBeNull();
  });

  it('lists the unassigned task and project name in the email body', async () => {
    await GET(cronRequest());

    expect(state.sentEmails[0].body).toContain('Bulletin (1 unassigned)');
    expect(state.sentEmails[0].body).toContain('Print bulletin covers');
  });
});
