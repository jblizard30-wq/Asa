import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserManagement } from '@/components/UserManagement';

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/sign-in');
  if (session.user.role !== 'ADMIN') redirect('/my-tasks');

  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' },
    include: {
      teamMemberships: { include: { team: { select: { name: true } } } },
    },
  });

  return (
    <UserManagement
      currentUserId={session.user.id}
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
        teams: u.teamMemberships.map((m) => m.team.name),
      }))}
    />
  );
}
