import { beforeEach, describe, expect, it, vi } from 'vitest';

// Chicago-local calendar day for "now", formatted the same way route.ts formats todayStr — used
// to build a sourceTask.dueDate that the route's own trigger-day check will match, whatever real
// wall-clock day the test happens to run on.
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Chicago',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const todayStr = dayFormatter.format(new Date());

const state = vi.hoisted(() => ({
  rule: {
    id: 'rule-1',
    enabled: true,
    triggerType: 'DUE_DATE_APPROACHING' as const,
    triggerDaysBefore: 0,
    sourceTask: {
      // Filled in below, outside vi.hoisted, since it depends on today's real calendar date.
      dueDate: null as Date | null,
    },
  },
  runs: [] as { id: string; ruleId: string; status: string; createdAt: Date }[],
  applyCallCount: 0,
}));
state.rule.sourceTask.dueDate = new Date(`${todayStr}T12:00:00.000Z`);

// Models `SELECT ... FOR UPDATE` inside prisma.$transaction: a second transaction against the
// same row blocks until the first one commits, instead of running concurrently — the actual
// mechanism (not just the outcome) that makes claimRuleForToday race-free in production.
let lockTail: Promise<void> = Promise.resolve();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    automationRule: {
      findMany: async () => [{ ...state.rule, sourceTask: { ...state.rule.sourceTask } }],
    },
    $transaction: async (fn: (tx: any) => Promise<any>) => {
      const myTurn = lockTail;
      let release!: () => void;
      lockTail = new Promise((resolve) => { release = resolve; });
      await myTurn;
      try {
        const tx = {
          $queryRaw: async () => [],
          automationRun: {
            findFirst: async ({ where }: any) =>
              state.runs.find((r) => r.ruleId === where.ruleId && r.createdAt.getTime() >= where.createdAt.gte.getTime()) ?? null,
            create: async ({ data }: any) => {
              const run = { id: `run-${state.runs.length + 1}`, ruleId: data.ruleId, status: data.status, createdAt: new Date() };
              state.runs.push(run);
              return run;
            },
          },
        };
        return await fn(tx);
      } finally {
        release();
      }
    },
  },
}));

vi.mock('@/lib/automations', () => ({
  applyAutomationAction: async () => {
    state.applyCallCount++;
  },
}));

import { GET } from './route';

function cronRequest() {
  return new Request('http://localhost/api/cron/automations', {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
}

describe('automations cron idempotency', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret';
    state.runs.length = 0;
    state.applyCallCount = 0;
    lockTail = Promise.resolve();
  });

  it('fires exactly once when two overlapping cron invocations race the same due-date rule', async () => {
    const [resA, resB] = await Promise.all([GET(cronRequest()), GET(cronRequest())]);
    const [bodyA, bodyB] = await Promise.all([resA.json(), resB.json()]);

    expect(state.applyCallCount).toBe(1);
    expect([bodyA.fired, bodyB.fired].sort()).toEqual([0, 1]);
    expect(state.runs).toHaveLength(1);
  });
});
