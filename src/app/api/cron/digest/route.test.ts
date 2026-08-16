import { beforeEach, describe, expect, it, vi } from 'vitest';

// Models a single row in the `User` table well enough to exercise the atomic-claim guard in
// route.ts: `updateMany` only succeeds when `where.lastDigestSentAt` still matches the value
// currently stored, exactly like Postgres evaluating an UPDATE ... WHERE clause.
const state = vi.hoisted(() => ({
  user: {
    id: 'user-1',
    email: 'user1@example.com',
    name: 'User One',
    role: 'USER',
    digestFrequency: 'DAILY' as const,
    lastDigestSentAt: null as Date | null,
    createdAt: new Date('2020-01-01T00:00:00.000Z'),
    preferredDigestHour: 0,
  },
  notification: {
    id: 'notif-1',
    recipientId: 'user-1',
    read: false,
    createdAt: new Date('2020-01-02T00:00:00.000Z'),
    message: 'Something happened',
  },
  sentEmails: [] as { to: string; subject: string; body: string }[],
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: async () => [{ ...state.user }],
      updateMany: async ({ where, data }: any) => {
        if (where.id !== state.user.id || where.lastDigestSentAt !== state.user.lastDigestSentAt) {
          return { count: 0 };
        }
        state.user.lastDigestSentAt = data.lastDigestSentAt;
        return { count: 1 };
      },
    },
    notification: {
      findMany: async () => [{ ...state.notification }],
    },
    task: {
      findMany: async () => [],
    },
    project: {
      findMany: async () => [],
    },
    projectMember: {
      findMany: async () => [],
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
  return new Request('http://localhost/api/cron/digest', {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
}

describe('digest cron idempotency', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret';
    state.user.lastDigestSentAt = null;
    state.sentEmails.length = 0;
  });

  it('sends exactly one digest when two overlapping cron invocations race the same user', async () => {
    // Both invocations read the same pre-claim row (lastDigestSentAt: null) before either one
    // writes, the same way two overlapping Vercel Cron firings would overlap in production.
    const [resA, resB] = await Promise.all([GET(cronRequest()), GET(cronRequest())]);
    const [bodyA, bodyB] = await Promise.all([resA.json(), resB.json()]);

    expect(state.sentEmails).toHaveLength(1);
    expect([bodyA.sent, bodyB.sent].sort()).toEqual([0, 1]);
    expect(state.user.lastDigestSentAt).not.toBeNull();
  });
});
