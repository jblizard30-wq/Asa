import { prisma } from '@/lib/prisma';
import { isAuthorizedCronRequest } from '@/lib/cronAuth';
import { isModuleEnabled } from '@/lib/modules';
import {
  computeRecordStatus,
  buildRenewalTaskContent,
  RENEWAL_RENOTIFY_DAYS,
} from '@/lib/childProtection';

export const dynamic = 'force-dynamic';

/**
 * Weekly sweep that files a compliance review task for anyone whose MinistrySafe or
 * background check has lapsed or is inside the 45-day renewal window — the same task the
 * clipboard icon creates on demand, minus someone having to notice.
 *
 * Vercel Cron can invoke a route more than once for one trigger, so each record is claimed
 * atomically via a conditional updateMany on lastAutoReviewTaskAt before its task is
 * created — never "create then stamp", which would double-file on a duplicate invocation.
 * The same stamp doubles as the re-notify throttle.
 *
 * Unlike createRenewalReviewTask this runs with no acting user, so it can't reuse that
 * action's requireProjectMember/assignee checks. It creates the task unassigned in a
 * preconfigured project instead, which needs no per-user authorization.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!isModuleEnabled('child_protection')) {
    return Response.json({ checked: 0, created: 0, skipped: 'module_disabled' });
  }

  const projectId = process.env.CHILD_PROTECTION_CRON_PROJECT_ID;
  const sectionId = process.env.CHILD_PROTECTION_CRON_SECTION_ID;

  // Fail closed, like cronAuth does with an unset secret: with nowhere defined to file
  // tasks, do nothing rather than guess at a project. Returns 200 so Vercel doesn't retry.
  if (!projectId || !sectionId) {
    console.warn(
      '[cron/child-protection-renewals] CHILD_PROTECTION_CRON_PROJECT_ID / _SECTION_ID not set — skipping.'
    );
    return Response.json({ checked: 0, created: 0, skipped: 'not_configured' });
  }

  const now = new Date();
  const renotifyCutoff = new Date(now.getTime() - RENEWAL_RENOTIFY_DAYS * 24 * 60 * 60 * 1000);

  const records = await prisma.childProtectionRecord.findMany({
    where: { archivedAt: null },
  });

  let created = 0;

  // Sequential on purpose: each task's order comes from the current max in the section, so
  // concurrent creates would hand out the same order value.
  for (const record of records) {
    const { status, daysUntilMinistrySafeExpires, daysUntilBackgroundCheckExpires } = computeRecordStatus({
      docusignSigned: record.docusignSigned,
      ministrySafeCompletedAt: record.ministrySafeCompletedAt,
      ministrySafeExpiresAt: record.ministrySafeExpiresAt,
      backgroundCheckCompletedAt: record.backgroundCheckCompletedAt,
      backgroundCheckExpiresAt: record.backgroundCheckExpiresAt,
      now,
    });

    if (status !== 'EXPIRING_SOON' && status !== 'EXPIRED') continue;

    const claim = await prisma.childProtectionRecord.updateMany({
      where: {
        id: record.id,
        OR: [{ lastAutoReviewTaskAt: null }, { lastAutoReviewTaskAt: { lt: renotifyCutoff } }],
      },
      data: { lastAutoReviewTaskAt: now },
    });
    if (claim.count === 0) continue;

    const { title, description, priority } = buildRenewalTaskContent(
      record,
      status,
      daysUntilMinistrySafeExpires,
      daysUntilBackgroundCheckExpires
    );

    const lastTask = await prisma.task.findFirst({
      where: { sectionId, parentTaskId: null, deletedAt: null },
      orderBy: { order: 'desc' },
    });

    await prisma.task.create({
      data: {
        title,
        description,
        projectId,
        sectionId,
        priority,
        order: (lastTask?.order ?? -1) + 1,
      },
    });

    created += 1;
  }

  return Response.json({ checked: records.length, created });
}
