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
  const configuredSectionId = process.env.CHILD_PROTECTION_CRON_SECTION_ID;

  // Fail closed, like cronAuth does with an unset secret: with nowhere defined to file
  // tasks, do nothing rather than guess at a project. Returns 200 so Vercel doesn't retry.
  if (!projectId) {
    console.warn('[cron/child-protection-renewals] CHILD_PROTECTION_CRON_PROJECT_ID not set — skipping.');
    return Response.json({ checked: 0, created: 0, skipped: 'not_configured' });
  }

  // The section is optional: without an explicit override, file into the project's first
  // section, which is the same default the on-demand flow uses (availableProjects'
  // defaultSectionId). A section id isn't surfaced anywhere in the UI, so requiring one
  // made this configurable only by someone willing to query the database.
  const section = configuredSectionId
    ? await prisma.section.findUnique({
        where: { id: configuredSectionId },
        select: { id: true, projectId: true },
      })
    : await prisma.section.findFirst({
        where: { projectId },
        orderBy: { order: 'asc' },
        select: { id: true, projectId: true },
      });

  // Validate before claiming anything. A stale or mistyped id would otherwise stamp
  // lastAutoReviewTaskAt and only then fail creating the task, suppressing that record for
  // the next 30 days with nothing filed for it. Comparing the section's parent also catches
  // a real section belonging to some other project, where tasks would land unseen.
  if (!section || section.projectId !== projectId) {
    console.error(
      '[cron/child-protection-renewals] no section resolved for CHILD_PROTECTION_CRON_PROJECT_ID (project missing, has no sections, or the configured section belongs elsewhere) — refusing to run.'
    );
    return Response.json({ checked: 0, created: 0, skipped: 'invalid_target' }, { status: 500 });
  }

  const sectionId = section.id;

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

    // Claim and create share a transaction so a failed create rolls the claim back and the
    // record is picked up again next week, rather than being marked notified for nothing.
    const task = await prisma.$transaction(async (tx) => {
      const claim = await tx.childProtectionRecord.updateMany({
        where: {
          id: record.id,
          OR: [{ lastAutoReviewTaskAt: null }, { lastAutoReviewTaskAt: { lt: renotifyCutoff } }],
        },
        data: { lastAutoReviewTaskAt: now },
      });
      if (claim.count === 0) return null;

      const { title, description, priority } = buildRenewalTaskContent(
        record,
        status,
        daysUntilMinistrySafeExpires,
        daysUntilBackgroundCheckExpires
      );

      const lastTask = await tx.task.findFirst({
        where: { sectionId, parentTaskId: null, deletedAt: null },
        orderBy: { order: 'desc' },
      });

      return tx.task.create({
        data: {
          title,
          description,
          projectId,
          sectionId,
          priority,
          order: (lastTask?.order ?? -1) + 1,
        },
      });
    });

    if (task) created += 1;
  }

  return Response.json({ checked: records.length, created });
}
