import { Prisma, type Priority, type RecurrenceMode } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { nextRunAfter } from '@/lib/recurrence';
import { dispatchWebhooks } from '@/lib/webhooks/dispatch';

type RecurrenceRow = {
  id: string;
  title: string;
  description: string | null;
  projectId: string;
  sectionId: string;
  priority: Priority;
  rrule: string;
  timezone: string;
  mode: RecurrenceMode;
  nextRunAt: Date;
  endsAt: Date | null;
};

async function createOccurrence(recurrence: RecurrenceRow, occurrenceDate: Date) {
  const [lastTask, assignees] = await Promise.all([
    prisma.task.findFirst({
      where: { sectionId: recurrence.sectionId, parentTaskId: null, deletedAt: null },
      orderBy: { order: 'desc' },
    }),
    prisma.taskRecurrence.findUnique({ where: { id: recurrence.id } }).assignees(),
  ]);

  try {
    const task = await prisma.task.create({
      data: {
        title: recurrence.title,
        description: recurrence.description,
        projectId: recurrence.projectId,
        sectionId: recurrence.sectionId,
        priority: recurrence.priority,
        dueDate: occurrenceDate,
        order: (lastTask?.order ?? -1) + 1,
        recurrenceId: recurrence.id,
        occurrenceDate,
        assignees: assignees && assignees.length > 0 ? { connect: assignees.map((a) => ({ id: a.id })) } : undefined,
      },
    });
    void dispatchWebhooks('TASK_CREATED', { taskId: task.id, projectId: recurrence.projectId, title: task.title, status: task.status });
    return task;
  } catch (err) {
    // (recurrenceId, occurrenceDate) is unique — a duplicate insert (e.g. a retried cron run,
    // or completing the same task twice in a race) is a no-op, not an error.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return null;
    throw err;
  }
}

/** Materializes a periodic recurrence's due occurrence and advances its schedule. Called by the nightly cron. */
export async function materializePeriodicOccurrence(recurrence: RecurrenceRow) {
  const occurrenceDate = recurrence.nextRunAt;
  const task = await createOccurrence(recurrence, occurrenceDate);

  const next = nextRunAfter(recurrence.rrule, occurrenceDate, recurrence.timezone);
  await prisma.taskRecurrence.update({
    where: { id: recurrence.id },
    data: { nextRunAt: next ?? occurrenceDate },
  });

  return task;
}

/**
 * Materializes the next occurrence of an after-completion recurrence, dated relative to when the
 * current one was actually completed. Called inline wherever a task's status flips to DONE.
 * Returns null if the task isn't part of an active after-completion series.
 */
export async function materializeAfterCompletion(taskId: string, completedAt: Date) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { taskRecurrence: true },
  });
  const recurrence = task?.taskRecurrence;
  if (!recurrence || recurrence.mode !== 'AFTER_COMPLETION') return null;
  if (recurrence.endsAt && recurrence.endsAt <= completedAt) return null;

  const occurrenceDate = nextRunAfter(recurrence.rrule, completedAt, recurrence.timezone);
  if (!occurrenceDate) return null;
  if (recurrence.endsAt && occurrenceDate > recurrence.endsAt) return null;

  const created = await createOccurrence(recurrence, occurrenceDate);
  if (created) {
    await prisma.taskRecurrence.update({ where: { id: recurrence.id }, data: { nextRunAt: occurrenceDate } });
  }
  return created;
}
