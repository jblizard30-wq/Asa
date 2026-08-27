import { prisma } from '@/lib/prisma';
import { sendNotificationEmail } from '@/lib/email';
import { nextLocalClockInstant, startOfLocalDay } from '@/lib/digestSchedule';
import { isAuthorizedCronRequest } from '@/lib/cronAuth';
import { daysFromToday } from '@/lib/dateUtils';

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ITEMS = 20;
const APP_TIMEZONE = 'America/Chicago';
const LOOKAHEAD_DAYS = 7;

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIMEZONE,
  month: 'short',
  day: 'numeric',
});

/**
 * Buckets tasks against local-calendar days via daysFromToday (calendar-day-string diff), not a
 * raw instant-vs-instant comparison — dueDate can be stored as either UTC-midnight (the
 * <input type="date"> path) or Chicago-midnight (the grid-paste path, see gridCoercion.ts) of
 * the picked day, and only a calendar-day comparison gets both right. Comparing raw instants
 * against Chicago-midnight boundaries mislabeled a same-day UTC-midnight due date as overdue for
 * the first several hours of its actual due day.
 */
function bucketByDueDate<T extends { dueDate: Date | null }>(tasks: T[], now: Date, lookaheadDays: number) {
  const overdue: T[] = [];
  const dueToday: T[] = [];
  const dueSoon: T[] = [];
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const diff = daysFromToday(task.dueDate, now); // positive = overdue, 0 = today, negative = future
    if (diff > 0) overdue.push(task);
    else if (diff === 0) dueToday.push(task);
    else if (diff >= -lookaheadDays) dueSoon.push(task);
  }
  return { overdue, dueToday, dueSoon };
}

/** Loads a user's assigned, undone, non-deleted tasks due within the lookahead window. */
async function loadDueTaskBuckets(userId: string, now: Date) {
  const lookaheadEnd = startOfLocalDay(now, APP_TIMEZONE, 1 + LOOKAHEAD_DAYS);

  const tasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      status: { not: 'DONE' },
      dueDate: { lt: lookaheadEnd },
      assignees: { some: { id: userId } },
    },
    orderBy: { dueDate: 'asc' },
    select: { title: true, dueDate: true },
  });

  return bucketByDueDate(tasks, now, LOOKAHEAD_DAYS);
}

/**
 * Executive-summary audience: ADMIN sees every project org-wide; MANAGER sees only projects
 * where they're flagged isManager on ProjectMember (a per-project designation, distinct from
 * the global MANAGER role, which just grants the capability). Plain USER gets none.
 */
async function loadManagedProjectIds(userId: string, role: string): Promise<string[]> {
  if (role === 'ADMIN') {
    const projects = await prisma.project.findMany({ select: { id: true } });
    return projects.map((p) => p.id);
  }
  if (role === 'MANAGER') {
    const memberships = await prisma.projectMember.findMany({
      where: { userId, isManager: true },
      select: { projectId: true },
    });
    return memberships.map((m) => m.projectId);
  }
  return [];
}

/** Per-project task counts, independent of who a task is assigned to. */
async function loadProjectSummaries(projectIds: string[], now: Date) {
  if (projectIds.length === 0) return [];

  const lookaheadEnd = startOfLocalDay(now, APP_TIMEZONE, 1 + LOOKAHEAD_DAYS);

  const [projects, tasks] = await Promise.all([
    prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, name: true } }),
    prisma.task.findMany({
      where: { deletedAt: null, status: { not: 'DONE' }, dueDate: { lt: lookaheadEnd }, projectId: { in: projectIds } },
      select: { projectId: true, dueDate: true },
    }),
  ]);

  return projects
    .map((project) => {
      const projectTasks = tasks.filter((t) => t.projectId === project.id);
      const buckets = bucketByDueDate(projectTasks, now, LOOKAHEAD_DAYS);
      return {
        name: project.name,
        overdue: buckets.overdue.length,
        dueToday: buckets.dueToday.length,
        dueSoon: buckets.dueSoon.length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Digest cron (Vercel Cron). Guarded by the same shared-secret bearer pattern as
 * /api/cron/automations rather than a user session.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const now = new Date();

  const users = await prisma.user.findMany({
    where: { digestFrequency: { not: 'OFF' } },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      digestFrequency: true,
      lastDigestSentAt: true,
      createdAt: true,
      preferredDigestHour: true,
    },
  });

  let sent = 0;
  for (const user of users) {
    const intervalMs = user.digestFrequency === 'DAILY' ? DAY_MS : 7 * DAY_MS;
    const referencePoint = user.lastDigestSentAt ?? user.createdAt;
    const dueAt = user.lastDigestSentAt ? new Date(user.lastDigestSentAt.getTime() + intervalMs) : null;
    if (dueAt && dueAt > now) continue;

    // Enough time has elapsed since the last send, but also wait until this user's own
    // preferred local hour has arrived today — otherwise a DAILY user would get pinged the
    // instant the cron fires rather than around their chosen time.
    const nextLocalHour = nextLocalClockInstant(user.preferredDigestHour, 0, APP_TIMEZONE, referencePoint);
    if (nextLocalHour > now) continue;

    const since = user.lastDigestSentAt ?? user.createdAt;
    const managedProjectIds = await loadManagedProjectIds(user.id, user.role);
    const [notifications, dueBuckets, projectSummaries] = await Promise.all([
      prisma.notification.findMany({
        where: { recipientId: user.id, read: false, createdAt: { gte: since } },
        orderBy: { createdAt: 'asc' },
      }),
      loadDueTaskBuckets(user.id, now),
      loadProjectSummaries(managedProjectIds, now),
    ]);

    const taskCount = dueBuckets.overdue.length + dueBuckets.dueToday.length + dueBuckets.dueSoon.length;
    if (notifications.length === 0 && taskCount === 0 && projectSummaries.length === 0) continue;

    const sections: string[] = [];

    if (taskCount > 0) {
      sections.push('YOUR TASKS');
      if (dueBuckets.overdue.length > 0) {
        sections.push('Overdue:');
        dueBuckets.overdue.forEach((t) => sections.push(`- ${t.title} (was due ${dateFormatter.format(t.dueDate!)})`));
      }
      if (dueBuckets.dueToday.length > 0) {
        sections.push('Due today:');
        dueBuckets.dueToday.forEach((t) => sections.push(`- ${t.title}`));
      }
      if (dueBuckets.dueSoon.length > 0) {
        sections.push(`Due in the next ${LOOKAHEAD_DAYS} days:`);
        dueBuckets.dueSoon.forEach((t) => sections.push(`- ${t.title} (due ${dateFormatter.format(t.dueDate!)})`));
      }
    }

    if (projectSummaries.length > 0) {
      if (sections.length > 0) sections.push('');
      sections.push(user.role === 'ADMIN' ? 'PROJECT SUMMARY (all projects)' : 'PROJECT SUMMARY (projects you manage)');
      projectSummaries.forEach((p) =>
        sections.push(`- ${p.name}: ${p.overdue} overdue, ${p.dueToday} due today, ${p.dueSoon} due in next ${LOOKAHEAD_DAYS} days`)
      );
    }

    if (notifications.length > 0) {
      if (sections.length > 0) sections.push('');
      sections.push('OTHER UPDATES');
      const shown = notifications.slice(0, MAX_ITEMS);
      const remaining = notifications.length - shown.length;
      shown.forEach((n) => sections.push(`- ${n.message}`));
      if (remaining > 0) sections.push(`- +${remaining} more`);
    }

    const frequencyLabel = user.digestFrequency === 'DAILY' ? 'Daily' : 'Weekly';
    const subjectParts: string[] = [];
    if (taskCount > 0) subjectParts.push(`${taskCount} task${taskCount === 1 ? '' : 's'} due`);
    if (projectSummaries.length > 0) subjectParts.push(`${projectSummaries.length} project summar${projectSummaries.length === 1 ? 'y' : 'ies'}`);
    if (notifications.length > 0) subjectParts.push(`${notifications.length} update${notifications.length === 1 ? '' : 's'}`);

    // Atomically claim this user's send before delivering: conditioning the write on
    // lastDigestSentAt still matching the value this loop iteration read means a second,
    // overlapping cron invocation that read the same stale value will find its own claim
    // fails (count === 0) instead of both invocations emailing the same digest twice.
    const claim = await prisma.user.updateMany({
      where: { id: user.id, lastDigestSentAt: user.lastDigestSentAt },
      data: { lastDigestSentAt: now },
    });
    if (claim.count === 0) continue;

    await sendNotificationEmail(
      user.email,
      `${frequencyLabel} digest: ${subjectParts.join(', ')}`,
      sections.join('\n')
    );

    sent++;
  }

  return Response.json({ checked: users.length, sent });
}
