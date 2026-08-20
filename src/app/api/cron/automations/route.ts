import { prisma } from '@/lib/prisma';
import { applyAutomationAction, resolveAutomationSourceTask } from '@/lib/automations';
import { startOfLocalDay } from '@/lib/digestSchedule';

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;
// Same fixed-timezone convention as dashboard.ts / digest/route.ts / taskRecurrences.ts — this
// app is one church, not multi-timezone.
const APP_TIMEZONE = 'America/Chicago';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// dueDate is stored as the UTC-midnight instant of whatever calendar day was picked (see
// taskFilters.ts), so its calendar day is just the UTC date part — no timezone conversion
// needed here, only for "today" below.
function toDayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Atomically claims this rule for today's due-date-approaching fire, so two overlapping cron
 * invocations can't both pass the "already ran today?" check and both apply the action.
 * `SELECT ... FOR UPDATE` serializes concurrent transactions on the same rule row, so the
 * check-then-insert below is race-free without needing a dedicated unique index/column.
 */
async function claimRuleForToday(ruleId: string, todayStart: Date): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "AutomationRule" WHERE id = ${ruleId} FOR UPDATE`;
    const alreadyRanToday = await tx.automationRun.findFirst({
      where: { ruleId, createdAt: { gte: todayStart } },
      select: { id: true },
    });
    if (alreadyRanToday) return false;
    await tx.automationRun.create({
      data: { ruleId, status: 'SKIPPED', detail: 'Claimed by due-date-approaching cron' },
    });
    return true;
  });
}

/**
 * Daily check for DUE_DATE_APPROACHING rules (Vercel Cron, see vercel.json). Not user-session
 * authenticated since it's invoked externally — guarded by a shared secret instead.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const now = new Date();
  const todayStart = startOfLocalDay(now, APP_TIMEZONE);
  const todayStr = dayFormatter.format(now);

  const rules = await prisma.automationRule.findMany({
    where: { enabled: true, triggerType: 'DUE_DATE_APPROACHING' },
  });

  let firedCount = 0;
  for (const rule of rules) {
    if (rule.triggerDaysBefore == null) continue;

    // Resolved fresh each run rather than read off a static include: for a recurrence-bound
    // rule the literal sourceTaskId row is often a long-completed occurrence with a stale due
    // date, while the series' current occurrence is a different row entirely.
    const sourceTask = await resolveAutomationSourceTask(rule);
    if (!sourceTask?.dueDate) continue;

    const triggerDay = toDayString(new Date(sourceTask.dueDate.getTime() - rule.triggerDaysBefore * DAY_MS));
    if (triggerDay !== todayStr) continue;

    const claimed = await claimRuleForToday(rule.id, todayStart);
    if (!claimed) continue;

    await applyAutomationAction(rule, 0);
    firedCount++;
  }

  return Response.json({ checked: rules.length, fired: firedCount });
}
