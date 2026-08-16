import { beforeEach, describe, expect, it, vi } from 'vitest';

// Models a single `ScheduledReminder` row well enough to exercise the atomic-claim guard in
// route.ts: `updateMany` only succeeds when `where.sentAt` still matches the value currently
// stored, exactly like Postgres evaluating an UPDATE ... WHERE clause.
const state = vi.hoisted(() => ({
  reminder: {
    id: 'rem-1',
    taskId: null as string | null,
    task: null as { projectId: string; id: string; title: string } | null,
    recipientId: 'user-1',
    recipient: { id: 'user-1', name: 'User One', email: 'user1@example.com' },
    createdById: 'user-2',
    createdBy: { id: 'user-2', name: 'User Two', email: 'user2@example.com' },
    message: 'Reminder message',
    deliverAt: new Date('2020-01-01T00:00:00.000Z'),
    sentAt: null as Date | null,
  },
  notificationsCreated: [] as any[],
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    scheduledReminder: {
      findMany: async () => [{ ...state.reminder }],
      updateMany: async ({ where, data }: any) => {
        if (where.id !== state.reminder.id || where.sentAt !== state.reminder.sentAt) {
          return { count: 0 };
        }
        state.reminder.sentAt = data.sentAt;
        return { count: 1 };
      },
    },
  },
}));

vi.mock('@/lib/notifications', () => ({
  createNotification: async (args: any) => {
    state.notificationsCreated.push(args);
  },
}));

import { GET } from './route';

function cronRequest() {
  return new Request('http://localhost/api/cron/send-reminders', {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
}

describe('send-reminders cron idempotency', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret';
    state.reminder.sentAt = null;
    state.notificationsCreated.length = 0;
  });

  it('delivers exactly one notification when two overlapping cron invocations race the same reminder', async () => {
    // Both invocations read the same pre-claim row (sentAt: null) before either writes.
    const [resA, resB] = await Promise.all([GET(cronRequest()), GET(cronRequest())]);
    const [bodyA, bodyB] = await Promise.all([resA.json(), resB.json()]);

    expect(state.notificationsCreated).toHaveLength(1);
    expect([bodyA.sent, bodyB.sent].sort()).toEqual([0, 1]);
    expect(state.reminder.sentAt).not.toBeNull();
  });
});
