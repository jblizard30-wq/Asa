'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireProjectMember } from '@/lib/actions/tasks';
import { buildSimpleRRule, nextRunAfter, type SimpleFrequency } from '@/lib/recurrence';

const APP_TIMEZONE = 'America/Chicago';

const setTaskRecurrenceSchema = z.object({
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
  interval: z.coerce.number().int().min(1).max(365),
  mode: z.enum(['PERIODIC', 'AFTER_COMPLETION']),
  endsAt: z.string().optional().nullable(),
});

export type SetTaskRecurrenceInput = {
  frequency: SimpleFrequency;
  interval: number;
  mode: 'PERIODIC' | 'AFTER_COMPLETION';
  endsAt?: string | null;
};

/**
 * Configures, edits, or clears a task's recurrence in one call — there's normally exactly one
 * open occurrence of a series at a time, so editing "this task's" repeat settings edits the
 * series going forward. Passing `null` stops the series (endsAt = now) and detaches this task
 * from it; past materialized occurrences keep their historical recurrenceId link.
 */
export async function setTaskRecurrence(taskId: string, input: SetTaskRecurrenceInput | null) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { assignees: true } });
  if (!task) return { success: false, error: 'Task not found' };
  await requireProjectMember(task.projectId);

  if (input === null) {
    if (task.recurrenceId) {
      await prisma.taskRecurrence.update({ where: { id: task.recurrenceId }, data: { endsAt: new Date() } });
      await prisma.task.update({ where: { id: taskId }, data: { recurrenceId: null, occurrenceDate: null } });
    }
    revalidatePath(`/projects/${task.projectId}`);
    revalidatePath('/my-tasks');
    return { success: true };
  }

  const parsed = setTaskRecurrenceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const rrule = buildSimpleRRule(parsed.data.frequency, parsed.data.interval);
  const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;
  const nextRunAt = nextRunAfter(rrule, new Date(), APP_TIMEZONE) ?? new Date();

  if (task.recurrenceId) {
    await prisma.taskRecurrence.update({
      where: { id: task.recurrenceId },
      data: { rrule, mode: parsed.data.mode, endsAt, nextRunAt },
    });
  } else {
    const recurrence = await prisma.taskRecurrence.create({
      data: {
        title: task.title,
        description: task.description,
        projectId: task.projectId,
        sectionId: task.sectionId,
        rrule,
        timezone: APP_TIMEZONE,
        mode: parsed.data.mode,
        nextRunAt,
        endsAt,
        assignees: { connect: task.assignees.map((a) => ({ id: a.id })) },
      },
    });
    await prisma.task.update({
      where: { id: taskId },
      data: { recurrenceId: recurrence.id, occurrenceDate: task.dueDate ?? new Date() },
    });
  }

  revalidatePath(`/projects/${task.projectId}`);
  revalidatePath('/my-tasks');
  return { success: true };
}
