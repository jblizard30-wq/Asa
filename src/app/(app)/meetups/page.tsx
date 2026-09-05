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

  const isAdmin = session.user.role === 'ADMIN';

  const userTeams = await prisma.teamMember.findMany({
    where: { userId: session.user.id },
    select: { teamId: true },
  });
  const userTeamIds = userTeams.map((t) => t.teamId);

  const [meetups, availableTeams, availableUsers] = await Promise.all([
    prisma.meetup.findMany({
      where: {
        archivedAt: null,
        ...(isAdmin
          ? {}
          : {
              OR: [
                { isAllChurch: true },
                { createdById: session.user.id },
                { shares: { some: { userId: session.user.id } } },
                ...(userTeamIds.length > 0
                  ? [{ shares: { some: { teamId: { in: userTeamIds } } } }]
                  : []),
              ],
            }),
      },
      include: {
        shares: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            team: { select: { id: true, name: true } },
          },
        },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { timeVotes: true, venueOptions: true, signupSlots: true } },
      },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.team.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
  ]);

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
    isAllChurch: m.isAllChurch,
    createdById: m.createdById,
    createdByName: m.createdBy?.name || null,
    canManage: isAdmin || session.user.role === 'MANAGER' || m.createdById === session.user.id,
    finalizedTimeSlotId: m.finalizedTimeSlotId,
    venueOptionCount: m._count.venueOptions,
    signupSlotCount: m._count.signupSlots,
    timeVoteCount: m._count.timeVotes,
    sharedTeams: m.shares.filter((s) => s.team).map((s) => ({ id: s.team!.id, name: s.team!.name })),
    sharedUsers: m.shares.filter((s) => s.user).map((s) => ({ id: s.user!.id, name: s.user!.name, email: s.user!.email })),
  }));

  return (
    <MeetupsListClient
      meetups={shapedMeetups}
      availableTeams={availableTeams}
      availableUsers={availableUsers}
      currentUserId={session.user.id}
    />
  );
}
