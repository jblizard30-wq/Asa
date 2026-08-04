import { prisma } from '@/lib/prisma';
import { sendNotificationEmail } from '@/lib/email';
import { NotificationType } from '@prisma/client';

interface CreateNotificationArgs {
  type: NotificationType;
  recipientId: string;
  actorId?: string | null;
  message: string;
  link?: string;
  emailSubject?: string;
}

export async function createNotification({
  type,
  recipientId,
  actorId,
  message,
  link,
  emailSubject,
}: CreateNotificationArgs) {
  // Don't notify users about their own actions.
  if (actorId && actorId === recipientId) return;

  const notification = await prisma.notification.create({
    data: { type, recipientId, actorId, message, link },
  });

  const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
  if (recipient && emailSubject) {
    const preference = await prisma.notificationPreference.findUnique({
      where: { userId_type: { userId: recipientId, type } },
    });
    // No row means the user never touched this preference — schema default is emailEnabled=true.
    const emailEnabled = preference?.emailEnabled ?? true;
    if (emailEnabled) {
      void sendNotificationEmail(recipient.email, emailSubject, message);
    }
  }

  return notification;
}
