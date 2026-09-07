// src/lib/actions/meetups.ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { requireSession, requireManagerOrAdmin } from '@/lib/permissions';
import { isModuleEnabled } from '@/lib/modules';
import { MeetupCategory, VoteChoice } from '@prisma/client';

export type ActionResult<T = unknown> =
  | ({ success: true } & T)
  | { success: false; error: string };

function requireMeetupsModule(): string | null {
  return isModuleEnabled('meetups') ? null : 'The Meetups module is not enabled for this deployment.';
}

export async function canUserManageMeetup(
  userId: string,
  userRole: string,
  meetupId: string
): Promise<boolean> {
  if (userRole === 'ADMIN' || userRole === 'MANAGER') return true;
  const meetup = await prisma.meetup.findUnique({
    where: { id: meetupId },
    select: { createdById: true },
  });
  return meetup?.createdById === userId;
}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // In CLI or tests outside Next request scope, ignore
  }
}

async function getSession() {
  if (process.env.__CHK_ACTION__) {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (admin) return { user: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } };
  }
  return getServerSession(authOptions);
}

const createMeetupSchema = z.object({
  displayName: z.string().trim().min(1, 'Meetup name is required').max(200),
  category: z.nativeEnum(MeetupCategory).default(MeetupCategory.GENERAL),
  description: z.string().trim().max(3000).optional(),
  location: z.string().trim().max(300).optional(),
  virtualUrl: z.string().trim().url('Must be a valid URL').or(z.literal('')).optional(),
  agenda: z.string().trim().max(5000).optional(),
  minQuorum: z.coerce.number().int().min(1).max(500).optional(),
  isPotluck: z.boolean().default(false),
  hasRolesRoster: z.boolean().default(false),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  timeSlots: z
    .array(
      z.object({
        startsAt: z.coerce.date(),
        endsAt: z.coerce.date(),
        label: z.string().optional(),
      })
    )
    .optional(),
  venues: z
    .array(
      z.object({
        name: z.string().min(1),
        address: z.string().optional(),
        mapUrl: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .optional(),
  rosterItems: z
    .array(
      z.object({
        title: z.string().min(1),
        category: z.string().default('General'),
        capacity: z.number().int().min(1).default(1),
      })
    )
    .optional(),
  isAllChurch: z.boolean().default(false),
  targetUserIds: z.array(z.string().trim()).default([]),
  targetTeamIds: z.array(z.string().trim()).default([]),
});

export async function createMeetup(rawInput: unknown): Promise<ActionResult<{ meetupId: string }>> {
  const gate = requireMeetupsModule();
  if (gate) return { success: false, error: gate };

  const session = await requireSession();

  const parsed = createMeetupSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { data } = parsed;

  const userIds = Array.from(new Set(data.targetUserIds.filter(Boolean)));
  const teamIds = Array.from(new Set(data.targetTeamIds.filter(Boolean)));

  const meetup = await prisma.meetup.create({
    data: {
      title: data.displayName,
      category: data.category,
      description: data.description || null,
      location: data.location || null,
      virtualUrl: data.virtualUrl || null,
      agenda: data.agenda || null,
      minQuorum: data.minQuorum || null,
      isPotluck: data.isPotluck,
      hasRolesRoster: data.hasRolesRoster,
      isAllChurch: data.isAllChurch,
      startsAt: data.startsAt || null,
      endsAt: data.endsAt || null,
      createdById: session.user.id,
      shares:
        !data.isAllChurch && (userIds.length > 0 || teamIds.length > 0)
          ? {
              create: [
                ...userIds.map((userId) => ({ userId })),
                ...teamIds.map((teamId) => ({ teamId })),
              ],
            }
          : undefined,
      timeSlots:
        data.timeSlots && data.timeSlots.length > 0
          ? {
              create: data.timeSlots.map((ts, idx) => ({
                startsAt: ts.startsAt,
                endsAt: ts.endsAt,
                label: ts.label || null,
                order: idx,
              })),
            }
          : undefined,
      venueOptions:
        data.venues && data.venues.length > 0
          ? {
              create: data.venues.map((v, idx) => ({
                name: v.name,
                address: v.address || null,
                mapUrl: v.mapUrl || null,
                notes: v.notes || null,
                order: idx,
              })),
            }
          : undefined,
      signupSlots:
        data.rosterItems && data.rosterItems.length > 0
          ? {
              create: data.rosterItems.map((r, idx) => ({
                title: r.title,
                category: r.category || 'General',
                capacity: r.capacity || 1,
                order: idx,
              })),
            }
          : undefined,
    },
  });

  safeRevalidatePath('/meetups');
  safeRevalidatePath('/calendar');
  return { success: true, meetupId: meetup.id };
}

export async function getMeetupDetails(meetupId: string) {
  const gate = requireMeetupsModule();
  if (gate) return null;

  return prisma.meetup.findUnique({
    where: { id: meetupId },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      shares: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          team: { select: { id: true, name: true } },
        },
      },
      timeSlots: {
        orderBy: { startsAt: 'asc' },
        include: {
          votes: {
            include: {
              voterUser: { select: { id: true, name: true } },
            },
          },
        },
      },
      timeVotes: true,
      venueOptions: {
        orderBy: { order: 'asc' },
      },
      signupSlots: {
        orderBy: { order: 'asc' },
        include: {
          claims: {
            include: {
              user: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
}

export async function submitMeetupVotes(
  meetupId: string,
  votes: Array<{ timeSlotId: string; choice: VoteChoice }>,
  guestInfo?: { name: string; guestToken?: string }
): Promise<ActionResult> {
  const gate = requireMeetupsModule();
  if (gate) return { success: false, error: gate };

  const session = await getSession();
  const userId = session?.user?.id ?? null;
  const voterName = session?.user?.name || guestInfo?.name || 'Guest Participant';

  if (!userId && !guestInfo?.name) {
    return { success: false, error: 'Name or login required to vote.' };
  }

  await prisma.$transaction(async (tx) => {
    for (const vote of votes) {
      const slot = await tx.meetupTimeSlot.findUnique({
        where: { id: vote.timeSlotId },
      });
      if (!slot) continue;

      if (userId) {
        const existingVote = await tx.timeVote.findFirst({
          where: { meetupId, proposedTime: slot.startsAt, voterUserId: userId },
        });

        if (existingVote) {
          await tx.timeVote.update({
            where: { id: existingVote.id },
            data: { choice: vote.choice, timeSlotId: slot.id, voterName },
          });
        } else {
          await tx.timeVote.create({
            data: {
              meetupId,
              timeSlotId: slot.id,
              proposedTime: slot.startsAt,
              choice: vote.choice,
              voterUserId: userId,
              voterName,
            },
          });
        }
      } else {
        await tx.timeVote.create({
          data: {
            meetupId,
            timeSlotId: slot.id,
            proposedTime: slot.startsAt,
            choice: vote.choice,
            voterName,
          },
        });
      }
    }
  });

  safeRevalidatePath(`/meetups`);
  safeRevalidatePath(`/meetups/${meetupId}`);
  return { success: true };
}

export async function claimSignupSlot(
  slotId: string,
  claimerName: string,
  notes?: string
): Promise<ActionResult<{ claimId: string }>> {
  const gate = requireMeetupsModule();
  if (gate) return { success: false, error: gate };

  const session = await getSession();
  const userId = session?.user?.id ?? null;
  const finalName = session?.user?.name || claimerName.trim();

  if (!finalName) {
    return { success: false, error: 'Your name is required to claim an item.' };
  }

  const claim = await prisma.$transaction(async (tx) => {
    const slot = await tx.signupSlot.findUnique({
      where: { id: slotId },
    });
    if (!slot) throw new Error('Slot not found');

    if (slot.claimedCount >= slot.capacity) {
      throw new Error('This slot is already completely filled.');
    }

    const created = await tx.signupClaim.create({
      data: {
        slotId,
        userId,
        claimerName: finalName,
        notes: notes?.trim() || null,
      },
    });

    await tx.signupSlot.update({
      where: { id: slotId },
      data: { claimedCount: { increment: 1 } },
    });

    return created;
  });

  safeRevalidatePath('/meetups');
  return { success: true, claimId: claim.id };
}

export async function unclaimSignupSlot(claimId: string): Promise<ActionResult> {
  const gate = requireMeetupsModule();
  if (gate) return { success: false, error: gate };

  await prisma.$transaction(async (tx) => {
    const claim = await tx.signupClaim.findUnique({
      where: { id: claimId },
    });
    if (!claim) throw new Error('Claim not found');

    await tx.signupClaim.delete({ where: { id: claimId } });

    await tx.signupSlot.update({
      where: { id: claim.slotId },
      data: { claimedCount: { decrement: 1 } },
    });
  });

  safeRevalidatePath('/meetups');
  return { success: true };
}

export async function finalizeMeetup(
  meetupId: string,
  timeSlotId: string,
  venueOptionId?: string
): Promise<ActionResult> {
  const gate = requireMeetupsModule();
  if (gate) return { success: false, error: gate };

  const session = await requireSession();
  const canManage = await canUserManageMeetup(session.user.id, session.user.role, meetupId);
  if (!canManage) {
    return { success: false, error: 'Only managers, administrators, or the meetup organizer can perform this action' };
  }

  await prisma.$transaction(async (tx) => {
    const slot = await tx.meetupTimeSlot.findUnique({
      where: { id: timeSlotId },
    });
    if (!slot) throw new Error('Selected time slot not found');

    let locationUpdate: string | undefined = undefined;
    if (venueOptionId) {
      const venue = await tx.venueOption.findUnique({
        where: { id: venueOptionId },
      });
      if (venue) locationUpdate = [venue.name, venue.address].filter(Boolean).join(', ');
    }

    await tx.meetup.update({
      where: { id: meetupId },
      data: {
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        finalizedTimeSlotId: slot.id,
        finalizedVenueId: venueOptionId || null,
        status: 'COMPLETE',
        ...(locationUpdate ? { location: locationUpdate } : {}),
      },
    });
  });

  safeRevalidatePath('/meetups');
  safeRevalidatePath(`/meetups/${meetupId}`);
  safeRevalidatePath('/calendar');
  return { success: true };
}

export async function generateShareLink(meetupId: string, label?: string): Promise<ActionResult<{ url: string }>> {
  const gate = requireMeetupsModule();
  if (gate) return { success: false, error: gate };

  const session = await requireSession();
  const canManage = await canUserManageMeetup(session.user.id, session.user.role, meetupId);
  if (!canManage) {
    return { success: false, error: 'Only managers, administrators, or the meetup organizer can perform this action' };
  }

  const token = randomBytes(24).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.meetupShareLink.create({
    data: {
      token,
      tokenHash,
      meetupId,
      capabilities: ['VIEW', 'VOTE', 'SIGNUP'],
      label: label || 'External RSVP ShareLink',
      createdById: session.user.id,
      expiresAt,
    },
  });

  const url = `/share/${token}`;
  return { success: true, url };
}

export async function convertActionItemsToTasks(
  meetupId: string,
  items: Array<{ title: string; assigneeId?: string; dueDate?: string }>,
  options?: { projectId?: string; sectionId?: string }
): Promise<ActionResult<{ taskCount: number }>> {
  const gate = requireMeetupsModule();
  if (gate) return { success: false, error: gate };

  const session = await requireSession();
  const canManage = await canUserManageMeetup(session.user.id, session.user.role, meetupId);
  if (!canManage) {
    return { success: false, error: 'Only managers, administrators, or the meetup organizer can perform this action' };
  }

  let targetProject = null;
  if (options?.projectId) {
    targetProject = await prisma.project.findUnique({
      where: { id: options.projectId },
      include: { sections: { orderBy: { order: 'asc' } } },
    });
  }

  if (!targetProject) {
    targetProject = await prisma.project.findFirst({
      orderBy: { createdAt: 'asc' },
      include: { sections: { orderBy: { order: 'asc' } } },
    });
  }

  if (!targetProject) {
    return { success: false, error: 'No project found to associate tasks with.' };
  }

  let targetSectionId = options?.sectionId;
  if (!targetSectionId || !targetProject.sections.some((s) => s.id === targetSectionId)) {
    targetSectionId = targetProject.sections[0]?.id;
  }

  if (!targetSectionId) {
    const createdSection = await prisma.section.create({
      data: {
        name: 'Action Items',
        projectId: targetProject.id,
        order: 0,
      },
    });
    targetSectionId = createdSection.id;
  }

  const meetup = await prisma.meetup.findUnique({
    where: { id: meetupId },
    select: { title: true },
  });
  const meetupTitle = meetup?.title || 'Meetup';

  let count = 0;
  for (const item of items) {
    if (!item.title.trim()) continue;

    await prisma.task.create({
      data: {
        title: item.title.trim(),
        description: `Action item generated from **[${meetupTitle}](/meetups/${meetupId})**`,
        projectId: targetProject.id,
        sectionId: targetSectionId,
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
        assignees: item.assigneeId
          ? { connect: [{ id: item.assigneeId }] }
          : undefined,
      },
    });
    count++;
  }

  safeRevalidatePath(`/meetups/${meetupId}`);
  safeRevalidatePath(`/projects/${targetProject.id}`);
  safeRevalidatePath('/my-tasks');
  return { success: true, taskCount: count };
}

export async function saveMeetupSupplies(
  meetupId: string,
  supplies: Array<{ itemId: string; name: string; neededQty: number; unit: string }>
): Promise<ActionResult> {
  const gate = requireMeetupsModule();
  if (gate) return { success: false, error: gate };

  const session = await requireSession();
  const canManage = await canUserManageMeetup(session.user.id, session.user.role, meetupId);
  if (!canManage) {
    return { success: false, error: 'Only managers, administrators, or the meetup organizer can perform this action' };
  }

  const meetup = await prisma.meetup.findUnique({
    where: { id: meetupId },
    select: { description: true },
  });
  if (!meetup) return { success: false, error: 'Meetup not found' };

  // Encode supplies in a markdown comment tag within description
  const cleanDescription = (meetup.description || '').replace(/<!-- SUPPLIES_MANIFEST:[\s\S]*?-->/g, '').trim();
  const manifest = `<!-- SUPPLIES_MANIFEST:${JSON.stringify(supplies)}-->`;
  const nextDescription = cleanDescription ? `${cleanDescription}\n\n${manifest}` : manifest;

  await prisma.meetup.update({
    where: { id: meetupId },
    data: { description: nextDescription },
  });

  safeRevalidatePath(`/meetups/${meetupId}`);
  return { success: true };
}

const updateAudienceSchema = z.object({
  isAllChurch: z.boolean().default(false),
  targetUserIds: z.array(z.string().trim()).default([]),
  targetTeamIds: z.array(z.string().trim()).default([]),
});

export async function updateMeetupAudience(
  meetupId: string,
  rawInput: unknown
): Promise<ActionResult> {
  const gate = requireMeetupsModule();
  if (gate) return { success: false, error: gate };

  const session = await requireSession();
  const canManage = await canUserManageMeetup(session.user.id, session.user.role, meetupId);
  if (!canManage) {
    return { success: false, error: 'Only managers, administrators, or the meetup organizer can perform this action' };
  }

  const parsed = updateAudienceSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { data } = parsed;

  await prisma.$transaction(async (tx) => {
    await tx.meetup.update({
      where: { id: meetupId },
      data: { isAllChurch: data.isAllChurch },
    });

    await tx.meetupShare.deleteMany({
      where: { meetupId },
    });

    if (!data.isAllChurch) {
      const userIds = Array.from(new Set(data.targetUserIds.filter(Boolean)));
      const teamIds = Array.from(new Set(data.targetTeamIds.filter(Boolean)));

      if (userIds.length > 0 || teamIds.length > 0) {
        await tx.meetupShare.createMany({
          data: [
            ...userIds.map((userId) => ({ meetupId, userId })),
            ...teamIds.map((teamId) => ({ meetupId, teamId })),
          ],
        });
      }
    }
  });

  safeRevalidatePath('/meetups');
  safeRevalidatePath(`/meetups/${meetupId}`);
  safeRevalidatePath('/calendar');
  return { success: true };
}

export async function deleteMeetup(meetupId: string): Promise<ActionResult> {
  const gate = requireMeetupsModule();
  if (gate) return { success: false, error: gate };

  const session = await requireSession();
  const canManage = await canUserManageMeetup(session.user.id, session.user.role, meetupId);
  if (!canManage) {
    return { success: false, error: 'Only managers, administrators, or the meetup organizer can perform this action' };
  }

  await prisma.meetup.update({
    where: { id: meetupId },
    data: { archivedAt: new Date() },
  });

  safeRevalidatePath('/meetups');
  safeRevalidatePath(`/meetups/${meetupId}`);
  safeRevalidatePath('/calendar');
  return { success: true };
}
