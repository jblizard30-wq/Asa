import { prisma } from '@/lib/prisma';
import { materializePeriodicOccurrence } from '@/lib/materializeRecurrence';

export const dynamic = 'force-dynamic';

// Bounds how many occurrences a single recurrence can catch up on in one cron run (e.g. if the
// job was down for a while) — high enough to fully catch up a daily rule after a year of
// downtime, low enough to guarantee the request can't hang indefinitely.
const MAX_CATCHUP_PER_RECURRENCE = 366;

/**
 * Nightly materializer for 'PERIODIC' recurrences (Vercel Cron, see vercel.json) — creates the
 * due occurrence(s) and advances next_run_at via rrule. 'AFTER_COMPLETION' recurrences are
 * handled inline wherever a task is marked done (see materializeAfterCompletion), not here.
 * Idempotent: the (recurrenceId, occurrenceDate) unique index on Task makes a duplicate insert
 * from a retried run a no-op rather than a double-created task.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const now = new Date();
  const due = await prisma.taskRecurrence.findMany({
    where: {
      mode: 'PERIODIC',
      nextRunAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gte: now } }],
    },
  });

  let materializedCount = 0;
  for (const recurrence of due) {
    let current = recurrence;
    for (let i = 0; i < MAX_CATCHUP_PER_RECURRENCE; i++) {
      if (current.nextRunAt > now) break;
      if (current.endsAt && current.nextRunAt > current.endsAt) break;

      const task = await materializePeriodicOccurrence(current);
      if (task) materializedCount++; // null means this occurrence already existed (retried run) — not a new task

      const refreshed = await prisma.taskRecurrence.findUnique({ where: { id: current.id } });
      if (!refreshed) break;
      current = refreshed;
    }
  }

  return Response.json({ checked: due.length, materialized: materializedCount });
}
