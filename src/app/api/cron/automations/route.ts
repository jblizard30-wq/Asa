import { subDays, isSameDay } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { applyAutomationAction } from '@/lib/automations';
import { isAuthorizedCronRequest } from '@/lib/cronAuth';

export const dynamic = 'force-dynamic';

/**
 * Daily check for DUE_DATE_APPROACHING rules (Vercel Cron, see vercel.json). Not user-session
 * authenticated since it's invoked externally — guarded by a shared secret instead.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
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

    // Atomic claim before acting: only fire once per calendar day even if Vercel Cron invokes
    // this route more than once for the same trigger. The where clause requires the row to still
    // be unclaimed for today, so of two concurrent invocations only one update can match.
    const claim = await prisma.automationRule.updateMany({
      where: { id: rule.id, OR: [{ lastDueDateFiredAt: null }, { lastDueDateFiredAt: { lt: midnight } }] },
      data: { lastDueDateFiredAt: midnight },
    });
    if (claim.count === 0) continue;

    await applyAutomationAction(rule, 0);
    firedCount++;
  }

  return Response.json({ checked: rules.length, fired: firedCount });
}
