import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TeamsManager } from '@/components/TeamsManager';

export default async function TeamsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/sign-in');
  if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') redirect('/my-tasks');

  const isAdmin = session.user.role === 'ADMIN';

  const [teams, allTeams, allUsers, managers] = await Promise.all([
    prisma.team.findMany({
      where: isAdmin ? {} : { managerId: session.user.id },
      orderBy: { name: 'asc' },
      include: {
        manager: { select: { name: true } },
        members: { include: { user: { select: { id: true, name: true } } } },
      },
    }),
    prisma.team.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.user.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, email: true } }),
    prisma.user.findMany({
      where: { role: 'MANAGER' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <TeamsManager
      isAdmin={isAdmin}
      managers={managers}
      allUsers={allUsers}
      allTeamOptions={allTeams}
      teams={teams.map((t) => ({
        id: t.id,
        name: t.name,
        managerId: t.managerId,
        managerName: t.manager?.name ?? null,
        members: t.members.map((m) => ({ id: m.user.id, name: m.user.name })),
      }))}
    />
  );
}
