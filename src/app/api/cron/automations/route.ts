import { subDays, isSameDay } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { applyAutomationAction } from '@/lib/automations';

export const dynamic = 'force-dynamic';

/**
 * Daily check for DUE_DATE_APPROACHING rules (Vercel Cron, see vercel.json). Not user-session
 * authenticated since it's invoked externally — guarded by a shared secret instead.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const today = new Date();
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const rules = await prisma.automationRule.findMany({
    where: { enabled: true, triggerType: 'DUE_DATE_APPROACHING' },
    include: { sourceTask: true },
  });

  let firedCount = 0;
  for (const rule of rules) {
    if (!rule.sourceTask.dueDate || rule.triggerDaysBefore == null) continue;

    const triggerDate = subDays(rule.sourceTask.dueDate, rule.triggerDaysBefore);
    if (!isSameDay(triggerDate, today)) continue;

    // Idempotency guard: only fire once per calendar day even if the cron is invoked more than once.
    const alreadyRanToday = await prisma.automationRun.findFirst({
      where: { ruleId: rule.id, createdAt: { gte: midnight } },
    });
    if (alreadyRanToday) continue;

    await applyAutomationAction(rule, 0);
    firedCount++;
  }

  return Response.json({ checked: rules.length, fired: firedCount });
}
