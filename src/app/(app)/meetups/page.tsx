import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/modules';
import { MeetupsListClient } from '@/components/MeetupsListClient';

export default async function MeetupsPage() {
  if (!isModuleEnabled('meetups')) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/sign-in');
  }

  const canManage = session.user.role === 'ADMIN' || session.user.role === 'MANAGER';

  const meetups = await prisma.meetup.findMany({
    where: { archivedAt: null },
    include: {
      _count: { select: { timeVotes: true, venueOptions: true, signupSlots: true } },
    },
    orderBy: [{ startsAt: 'asc' }, { createdAt: 'desc' }],
  });

  const shapedMeetups = meetups.map((m) => ({
    id: m.id,
    displayName: m.title,
    category: m.category,
    status: m.status,
    startsAt: m.startsAt ? m.startsAt.toISOString() : null,
    endsAt: m.endsAt ? m.endsAt.toISOString() : null,
    location: m.location,
    virtualUrl: m.virtualUrl,
    description: m.description,
    isPotluck: m.isPotluck,
    finalizedTimeSlotId: m.finalizedTimeSlotId,
    venueOptionCount: m._count.venueOptions,
    signupSlotCount: m._count.signupSlots,
    timeVoteCount: m._count.timeVotes,
  }));

  return <MeetupsListClient canManage={canManage} meetups={shapedMeetups} />;
}
