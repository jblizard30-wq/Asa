import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Not authenticated');
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== 'ADMIN') throw new Error('Only administrators can perform this action');
  return session;
}

export async function requireManagerOrAdmin() {
  const session = await requireSession();
  if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') {
    throw new Error('Only managers and administrators can perform this action');
  }
  return session;
}

/** True if the given user manages the given team, or is an admin (who can manage any team). */
export async function canManageTeam(userId: string, role: string, teamId: string): Promise<boolean> {
  if (role === 'ADMIN') return true;
  if (role !== 'MANAGER') return false;
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  return team?.managerId === userId;
}
