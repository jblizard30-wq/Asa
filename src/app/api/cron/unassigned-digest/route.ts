import { prisma } from '@/lib/prisma';
import { sendNotificationEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TASKS_PER_PROJECT = 10;

/**
 * Weekly digest (Vercel Cron) reminding each project's owner — ProjectMember.isManager, not the
 * global MANAGER Role — which of their projects' tasks have no assignee yet. Independent of the
 * personal digestFrequency preference in /api/cron/digest: a manager who has turned their own
 * task digest OFF still owns projects that can silently accumulate unassigned work.
 *
 * Guarded by the same shared-secret bearer pattern as the other cron routes.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const now = new Date();

  const ownerships = await prisma.projectMember.findMany({
    where: { isManager: true },
    select: { userId: true, projectId: true },
  });

  const projectIdsByOwner = new Map<string, string[]>();
  for (const { userId, projectId } of ownerships) {
    const existing = projectIdsByOwner.get(userId);
    if (existing) existing.push(projectId);
    else projectIdsByOwner.set(userId, [projectId]);
  }

  if (projectIdsByOwner.size === 0) {
    return Response.json({ checked: 0, sent: 0 });
  }

  const owners = await prisma.user.findMany({
    where: { id: { in: [...projectIdsByOwner.keys()] } },
    select: { id: true, email: true, name: true, lastUnassignedDigestSentAt: true, createdAt: true },
  });

  let sent = 0;
  for (const owner of owners) {
    const referencePoint = owner.lastUnassignedDigestSentAt ?? owner.createdAt;
    const dueAt = new Date(referencePoint.getTime() + WEEK_MS);
    if (dueAt > now) continue;

    const projectIds = projectIdsByOwner.get(owner.id) ?? [];
    const [projects, unassignedTasks] = await Promise.all([
      prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, name: true } }),
      prisma.task.findMany({
        where: { projectId: { in: projectIds }, deletedAt: null, status: { not: 'DONE' }, assignees: { none: {} } },
        select: { title: true, projectId: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (unassignedTasks.length === 0) continue;

    const projectNameById = new Map(projects.map((p) => [p.id, p.name]));
    const tasksByProject = new Map<string, string[]>();
    for (const task of unassignedTasks) {
      const list = tasksByProject.get(task.projectId);
      if (list) list.push(task.title);
      else tasksByProject.set(task.projectId, [task.title]);
    }

    const sections: string[] = ['UNASSIGNED TASKS IN PROJECTS YOU MANAGE'];
    for (const [projectId, titles] of tasksByProject) {
      const projectName = projectNameById.get(projectId) ?? 'Unknown project';
      sections.push('', `${projectName} (${titles.length} unassigned):`);
      const shown = titles.slice(0, MAX_TASKS_PER_PROJECT);
      const remaining = titles.length - shown.length;
      shown.forEach((title) => sections.push(`- ${title}`));
      if (remaining > 0) sections.push(`- +${remaining} more`);
    }

    // Atomically claim this owner's send before delivering, so two overlapping cron
    // invocations for the same week can't both find the row due and both email it.
    const claim = await prisma.user.updateMany({
      where: { id: owner.id, lastUnassignedDigestSentAt: owner.lastUnassignedDigestSentAt },
      data: { lastUnassignedDigestSentAt: now },
    });
    if (claim.count === 0) continue;

    await sendNotificationEmail(
      owner.email,
      `Weekly unassigned tasks digest: ${unassignedTasks.length} task${unassignedTasks.length === 1 ? '' : 's'} across ${tasksByProject.size} project${tasksByProject.size === 1 ? '' : 's'}`,
      sections.join('\n'),
    );

    sent++;
  }

  return Response.json({ checked: owners.length, sent });
}
