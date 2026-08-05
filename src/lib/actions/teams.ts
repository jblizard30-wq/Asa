'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireManagerOrAdmin, canManageTeam } from '@/lib/permissions';

const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(120),
  managerId: z.string().optional(),
});

export async function createTeam(formData: FormData) {
  await requireAdmin();

  const parsed = createTeamSchema.safeParse({
    name: formData.get('name'),
    managerId: formData.get('managerId') || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const existing = await prisma.team.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return { success: false, error: 'A team with that name already exists.' };
  }

  const team = await prisma.team.create({
    data: {
      name: parsed.data.name,
      managerId: parsed.data.managerId || null,
    },
  });

  revalidatePath('/teams');
  return { success: true, teamId: team.id };
}

export async function deleteTeam(teamId: string) {
  await requireAdmin();
  await prisma.team.delete({ where: { id: teamId } });
  revalidatePath('/teams');
  return { success: true };
}

export async function setTeamManager(teamId: string, managerId: string | null) {
  await requireAdmin();
  await prisma.team.update({ where: { id: teamId }, data: { managerId } });
  revalidatePath('/teams');
  return { success: true };
}

export async function addTeamMember(teamId: string, userId: string) {
  const session = await requireManagerOrAdmin();
  if (!(await canManageTeam(session.user.id, session.user.role, teamId))) {
    return { success: false, error: 'You do not manage this team.' };
  }

  const existing = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  if (existing) {
    return { success: false, error: 'That user is already on this team.' };
  }

  await prisma.teamMember.create({ data: { teamId, userId } });
  revalidatePath('/teams');
  return { success: true };
}

export async function removeTeamMember(teamId: string, userId: string) {
  const session = await requireManagerOrAdmin();
  if (!(await canManageTeam(session.user.id, session.user.role, teamId))) {
    return { success: false, error: 'You do not manage this team.' };
  }

  await prisma.teamMember.deleteMany({ where: { teamId, userId } });
  revalidatePath('/teams');
  return { success: true };
}

/** Moves a user from one team to another. The acting manager must manage at least one side. */
export async function moveTeamMember(userId: string, fromTeamId: string, toTeamId: string) {
  const session = await requireManagerOrAdmin();

  // A move is a remove-from-A plus an add-to-B, so it requires the same authority each of those
  // would individually need: managing A alone (or B alone) isn't enough, or a manager of A could
  // dump a member into a team B they have no say over, bypassing addTeamMember's own check.
  const [managesFrom, managesTo] = await Promise.all([
    canManageTeam(session.user.id, session.user.role, fromTeamId),
    canManageTeam(session.user.id, session.user.role, toTeamId),
  ]);
  if (!managesFrom || !managesTo) {
    return { success: false, error: 'You do not manage both teams involved in this move.' };
  }

  await prisma.$transaction([
    prisma.teamMember.deleteMany({ where: { teamId: fromTeamId, userId } }),
    prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: toTeamId, userId } },
      update: {},
      create: { teamId: toTeamId, userId },
    }),
  ]);

  revalidatePath('/teams');
  return { success: true };
}
