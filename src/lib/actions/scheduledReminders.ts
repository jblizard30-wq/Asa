'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { fromZonedTime } from 'date-fns-tz';
import { prisma } from '@/lib/prisma';
import { requireManagerOrAdmin, requireSession } from '@/lib/permissions';

const APP_TIMEZONE = 'America/Chicago';

const scheduleReminderSchema = z.object({
  recipientId: z.string().min(1),
  taskId: z.string().optional(),
  message: z.string().min(1, 'Reminder message is required').max(1000),
  deliverAt: z.string().min(1, 'Delivery time is required'),
});

const DATETIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Parses an HTML `datetime-local` value (no timezone info, e.g. "2026-08-05T14:00") by treating its
 * year/month/day/hour/minute as wall-clock components in APP_TIMEZONE and returning the equivalent
 * UTC instant — same building blocks as gridCoercion.ts's parseDueDate and recurrence.ts's
 * fromFloating. Never `new Date(rawString)`, which JS would interpret ambiguously depending on
 * whatever timezone the runtime happens to treat the string as.
 */
function parseDeliverAt(raw: string): Date | null {
  const match = raw.match(DATETIME_LOCAL_PATTERN);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const wallClock = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    second ? Number(second) : 0,
  );
  return fromZonedTime(wallClock, APP_TIMEZONE);
}

/**
 * Schedules a future (single-send) reminder for a task or freeform message. Distinct from
 * sendReminder in reminders.ts, which nudges immediately with no time dimension.
 */
export async function scheduleReminder(formData: FormData) {
  const session = await requireManagerOrAdmin();

  const parsed = scheduleReminderSchema.safeParse({
    recipientId: formData.get('recipientId'),
    taskId: formData.get('taskId') || undefined,
    message: formData.get('message'),
    deliverAt: formData.get('deliverAt'),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // Managers may only schedule reminders for users on a team they manage; admins may target anyone.
  if (session.user.role === 'MANAGER') {
    const managed = await prisma.teamMember.findFirst({
      where: {
        userId: parsed.data.recipientId,
        team: { managerId: session.user.id },
      },
    });
    if (!managed) {
      return { success: false, error: 'You can only send reminders to members of your team.' };
    }
  }

  const deliverAt = parseDeliverAt(parsed.data.deliverAt);
  if (!deliverAt) {
    return { success: false, error: 'Invalid delivery time' };
  }
  if (deliverAt.getTime() <= new Date().getTime()) {
    return { success: false, error: 'Delivery time must be in the future' };
  }

  const scheduledReminder = await prisma.scheduledReminder.create({
    data: {
      recipientId: parsed.data.recipientId,
      createdById: session.user.id,
      taskId: parsed.data.taskId || null,
      message: parsed.data.message,
      channel: 'EMAIL',
      deliverAt,
    },
  });

  // Best-effort — scheduling has already succeeded regardless of whether this revalidate lands.
  if (parsed.data.taskId) {
    const task = await prisma.task.findUnique({ where: { id: parsed.data.taskId } });
    if (task) revalidatePath(`/projects/${task.projectId}`);
  }

  return { success: true, scheduledReminderId: scheduledReminder.id };
}

const scheduleSelfReminderSchema = z.object({
  taskId: z.string().min(1),
  deliverAt: z.string().min(1, 'Delivery time is required'),
});

/**
 * Self-serve opt-in: any assignee can schedule a future reminder for themselves on a task
 * they're assigned to, with no manager/admin gate — distinct from scheduleReminder above, which
 * is a manager/admin nudging someone else. The daily digest already surfaces due/overdue tasks
 * on its own cadence; this is the escape valve for the rare time-critical task that shouldn't
 * wait for tomorrow's digest.
 */
export async function scheduleSelfReminder(formData: FormData) {
  const session = await requireSession();

  const parsed = scheduleSelfReminderSchema.safeParse({
    taskId: formData.get('taskId'),
    deliverAt: formData.get('deliverAt'),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const task = await prisma.task.findUnique({
    where: { id: parsed.data.taskId },
    include: { assignees: { select: { id: true } } },
  });
  if (!task || task.deletedAt) {
    return { success: false, error: 'Task not found' };
  }
  if (!task.assignees.some((a) => a.id === session.user.id)) {
    return { success: false, error: 'You can only schedule reminders for tasks assigned to you.' };
  }

  const deliverAt = parseDeliverAt(parsed.data.deliverAt);
  if (!deliverAt) {
    return { success: false, error: 'Invalid delivery time' };
  }
  if (deliverAt.getTime() <= new Date().getTime()) {
    return { success: false, error: 'Delivery time must be in the future' };
  }

  const scheduledReminder = await prisma.scheduledReminder.create({
    data: {
      recipientId: session.user.id,
      createdById: session.user.id,
      taskId: task.id,
      message: `Reminder: ${task.title}`,
      channel: 'EMAIL',
      deliverAt,
    },
  });

  revalidatePath(`/projects/${task.projectId}`);
  return { success: true, scheduledReminderId: scheduledReminder.id };
}

/**
 * Cancels a not-yet-sent scheduled reminder. Admins may cancel any; everyone else (including a
 * plain USER who scheduled a self-serve reminder) may only cancel reminders they themselves
 * scheduled — this intentionally starts from requireSession, not requireManagerOrAdmin, since
 * self-serve reminders are created by plain USERs too.
 */
export async function cancelScheduledReminder(id: string) {
  const session = await requireSession();

  const scheduledReminder = await prisma.scheduledReminder.findUnique({ where: { id } });
  if (!scheduledReminder) {
    return { success: false, error: 'Not found' };
  }
  if (scheduledReminder.sentAt) {
    return { success: false, error: 'Already sent' };
  }
  if (session.user.role !== 'ADMIN' && session.user.id !== scheduledReminder.createdById) {
    return { success: false, error: 'You can only cancel reminders you scheduled yourself.' };
  }

  await prisma.scheduledReminder.delete({ where: { id } });

  // Best-effort — cancellation has already succeeded regardless of whether this revalidate lands.
  if (scheduledReminder.taskId) {
    const task = await prisma.task.findUnique({ where: { id: scheduledReminder.taskId } });
    if (task) revalidatePath(`/projects/${task.projectId}`);
  }

  return { success: true };
}
