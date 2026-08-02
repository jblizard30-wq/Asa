'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireManagerOrAdmin } from '@/lib/permissions';
import { createNotification } from '@/lib/notifications';

const sendReminderSchema = z.object({
  recipientId: z.string().min(1),
  taskId: z.string().optional(),
  message: z.string().min(1, 'Reminder message is required').max(1000),
});

export async function sendReminder(formData: FormData) {
  const session = await requireManagerOrAdmin();

  const parsed = sendReminderSchema.safeParse({
    recipientId: formData.get('recipientId'),
    taskId: formData.get('taskId') || undefined,
    message: formData.get('message'),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // Managers may only remind users on a team they manage; admins may remind anyone.
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

  let task = null;
  if (parsed.data.taskId) {
    task = await prisma.task.findUnique({ where: { id: parsed.data.taskId } });
  }

  const reminder = await prisma.reminder.create({
    data: {
      recipientId: parsed.data.recipientId,
      senderId: session.user.id,
      taskId: parsed.data.taskId || null,
      message: parsed.data.message,
    },
  });

  await createNotification({
    type: 'REMINDER',
    recipientId: parsed.data.recipientId,
    actorId: session.user.id,
    message: parsed.data.message,
    link: task ? `/projects/${task.projectId}?task=${task.id}` : undefined,
    emailSubject: task ? `Reminder: ${task.title}` : `Reminder from ${session.user.name}`,
  });

  return { success: true, reminderId: reminder.id };
}
