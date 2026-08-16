import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

// Models the (recurrenceId, occurrenceDate) unique index that makes materializePeriodicOccurrence
// idempotent: a second create for an occurrence that already exists throws the same
// PrismaClientKnownRequestError (P2002) a real duplicate insert would raise.
const state = vi.hoisted(() => ({
  recurrence: {
    id: 'rec-1',
    title: 'Water plants',
    description: null as string | null,
    projectId: 'proj-1',
    sectionId: 'sec-1',
    rrule: 'FREQ=DAILY;INTERVAL=1',
    timezone: 'America/Chicago',
    mode: 'PERIODIC' as const,
    nextRunAt: new Date('2026-01-01T06:00:00.000Z'), // midnight Chicago (CST, -06:00), Jan 1 2026
    // Cuts the nightly catch-up loop off right after the first occurrence, regardless of the
    // real wall-clock time the test happens to run at.
    endsAt: new Date('2026-01-01T18:00:00.000Z'),
  },
  tasks: [] as { recurrenceId: string; occurrenceDate: string }[],
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    taskRecurrence: {
      findMany: async () => [{ ...state.recurrence }],
      findUnique: ({ where }: any) => {
        const result: any = Promise.resolve(where.id === state.recurrence.id ? { ...state.recurrence } : null);
        result.assignees = async () => [];
        return result;
      },
      update: async ({ where, data }: any) => {
        if (where.id === state.recurrence.id) Object.assign(state.recurrence, data);
        return { ...state.recurrence };
      },
    },
    task: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        const occurrenceKey = new Date(data.occurrenceDate).toISOString();
        if (state.tasks.some((t) => t.recurrenceId === data.recurrenceId && t.occurrenceDate === occurrenceKey)) {
          throw new Prisma.PrismaClientKnownRequestError(
            'Unique constraint failed on the fields: (`recurrenceId`,`occurrenceDate`)',
            { code: 'P2002', clientVersion: '0.0.0' },
          );
        }
        state.tasks.push({ recurrenceId: data.recurrenceId, occurrenceDate: occurrenceKey });
        return { id: `task-${state.tasks.length}`, title: data.title, status: 'TODO' };
      },
    },
  },
}));

vi.mock('@/lib/webhooks/dispatch', () => ({
  dispatchWebhooks: async () => {},
}));

import { GET } from './route';

function cronRequest() {
  return new Request('http://localhost/api/cron/materialize-recurrence', {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
}

describe('materialize-recurrence cron idempotency', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret';
    state.recurrence.nextRunAt = new Date('2026-01-01T06:00:00.000Z');
    state.tasks.length = 0;
  });

  it('creates exactly one task when two overlapping cron invocations race the same due occurrence', async () => {
    // Both invocations read the same pre-update recurrence row (nextRunAt: Jan 1) before either
    // one advances it, the same way two overlapping Vercel Cron firings would overlap in production.
    const [resA, resB] = await Promise.all([GET(cronRequest()), GET(cronRequest())]);
    const [bodyA, bodyB] = await Promise.all([resA.json(), resB.json()]);

    expect(state.tasks).toHaveLength(1);
    expect([bodyA.materialized, bodyB.materialized].sort()).toEqual([0, 1]);
    // Both invocations converge on the same next occurrence despite the race.
    expect(state.recurrence.nextRunAt.toISOString()).toBe('2026-01-02T06:00:00.000Z');
  });
});
