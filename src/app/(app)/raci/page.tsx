import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/modules';
import { RaciClient } from '@/components/RaciClient';

export default async function RaciPage() {
  if (!isModuleEnabled('raci')) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/sign-in');
  }

  const isAdmin = session.user.role === 'ADMIN';
  const isManager = session.user.role === 'MANAGER';
  const canCreate = isAdmin || isManager;

  const userTeams = await prisma.teamMember.findMany({
    where: { userId: session.user.id },
    select: { teamId: true },
  });
  const userTeamIds = userTeams.map((t) => t.teamId);

  const charts = await prisma.raciChart.findMany({
    where: {
      archivedAt: null,
      ...(isAdmin
        ? {}
        : {
            OR: [
              { isPublic: true },
              { createdById: session.user.id },
              { shares: { some: { userId: session.user.id } } },
              ...(userTeamIds.length > 0
                ? [{ shares: { some: { teamId: { in: userTeamIds } } } }]
                : []),
            ],
          }),
    },
    include: {
      steps: { orderBy: { stepOrder: 'asc' }, include: { assignments: true } },
      people: { orderBy: { personOrder: 'asc' } },
      shares: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          team: { select: { id: true, name: true } },
        },
      },
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const [availableTeams, availableUsers] = await Promise.all([
    prisma.team.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const shaped = charts.map((c) => {
    const isOwner = c.createdById === session.user.id;
    const directShare = c.shares.find((s) => s.userId === session.user.id);
    const hasTeamEdit = c.shares.some(
      (s) => s.teamId && userTeamIds.includes(s.teamId) && s.access === 'EDIT'
    );

    const canEdit =
      isAdmin ||
      isOwner ||
      (isManager && c.isPublic) ||
      (directShare?.access === 'EDIT') ||
      hasTeamEdit;

    return {
      id: c.id,
      processName: c.processName,
      owner: c.owner,
      trigger: c.trigger,
      ministryArea: c.ministryArea,
      tags: c.tags,
      isPublic: c.isPublic,
      createdById: c.createdById,
      createdByName: c.createdBy?.name || c.createdBy?.email || 'Unknown',
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      canEdit,
      shares: c.shares.map((s) => ({
        id: s.id,
        targetType: s.userId ? ('USER' as const) : ('TEAM' as const),
        targetId: s.userId || s.teamId || '',
        name: s.user ? s.user.name || s.user.email : s.team?.name || 'Unknown',
        access: s.access as 'VIEW' | 'EDIT',
      })),
      people: c.people.map((p) => ({
        id: p.id,
        name: p.name,
        roleTitle: p.roleTitle,
        personOrder: p.personOrder,
      })),
      steps: c.steps.map((s) => ({
        id: s.id,
        stepName: s.stepName,
        stepOrder: s.stepOrder,
        cells: Object.fromEntries(
          s.assignments.map((a) => [a.personId, a.designations as string[]])
        ),
      })),
    };
  });

  return (
    <RaciClient
      canCreate={canCreate}
      currentUserId={session.user.id}
      charts={shaped}
      availableTeams={availableTeams}
      availableUsers={availableUsers}
    />
  );
}
