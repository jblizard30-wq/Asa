import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { isAuthorizedCronRequest } from '@/lib/cronAuth';

export const dynamic = 'force-dynamic';

/**
 * Scheduled-reminder delivery cron. Guarded by the same shared-secret bearer pattern as
 * /api/cron/digest rather than a user session.
 *
 * Vercel Cron can duplicate an invocation, so each due row is atomically claimed via a conditional
 * update (`sentAt: null` in the where clause) before it is delivered — never "send then stamp",
 * which would risk double-sending a reminder if two invocations raced on the same row.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const now = new Date();

  const dueReminders = await prisma.scheduledReminder.findMany({
    where: { deliverAt: { lte: now }, sentAt: null },
    take: 100,
    include: { recipient: true, task: true, createdBy: true },
  });

  let sent = 0;
  for (const reminder of dueReminders) {
    const claim = await prisma.scheduledReminder.updateMany({
      where: { id: reminder.id, sentAt: null },
      data: { sentAt: now },
    });
    if (claim.count === 0) continue; // another concurrent run already claimed this one

    await createNotification({
      type: 'REMINDER',
      recipientId: reminder.recipientId,
      actorId: reminder.createdById,
      message: reminder.message,
      link: reminder.task ? `/projects/${reminder.task.projectId}?task=${reminder.task.id}` : undefined,
      emailSubject: reminder.task
        ? `Reminder: ${reminder.task.title}`
        : `Reminder from ${reminder.createdBy.name}`,
    });
    sent++;
  }

  return Response.json({ checked: dueReminders.length, sent });
}
