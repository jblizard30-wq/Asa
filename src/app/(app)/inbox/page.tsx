import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { InboxView } from '@/components/InboxView';

export default async function InboxPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/sign-in');

  const notifications = await prisma.notification.findMany({
    where: { recipientId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      actor: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return (
    <InboxView
      initialNotifications={notifications.map((n) => ({
        id: n.id,
        type: n.type,
        message: n.message,
        link: n.link,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
        actor: n.actor,
      }))}
    />
  );
}

