import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMeetup,
  claimSignupSlot,
  unclaimSignupSlot,
  finalizeMeetup,
  generateShareLink,
  updateMeetupAudience,
  deleteMeetup,
} from './meetups';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/modules';
import { requireSession } from '@/lib/permissions';

vi.mock('@/lib/modules', () => ({
  isModuleEnabled: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: 'u-admin', name: 'Admin User', email: 'admin@church.org', role: 'ADMIN' },
  }),
  requireManagerOrAdmin: vi.fn().mockResolvedValue({
    user: { id: 'u-admin', name: 'Admin User', email: 'admin@church.org', role: 'ADMIN' },
  }),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: 'u-admin', name: 'Admin User', email: 'admin@church.org', role: 'ADMIN' },
  }),
}));

vi.mock('@/lib/prisma', () => {
  const mockPrisma: any = {
    meetup: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    meetupShare: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    meetupTimeSlot: {
      findUnique: vi.fn(),
    },
    venueOption: {
      findUnique: vi.fn(),
    },
    signupSlot: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    signupClaim: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    meetupShareLink: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

describe('Meetups Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isModuleEnabled as any).mockReturnValue(true);
    (requireSession as any).mockResolvedValue({
      user: { id: 'u-admin', name: 'Admin User', email: 'admin@church.org', role: 'ADMIN' },
    });
  });

  it('refuses to create a meetup if the module is disabled', async () => {
    (isModuleEnabled as any).mockReturnValue(false);
    const res = await createMeetup({ displayName: 'Staff Retreat' });
    expect(res.success).toBe(false);
    expect((res as any).error).toContain('not enabled');
  });

  it('allows any user with a login to create a meetup with person & team targeting', async () => {
    (requireSession as any).mockResolvedValue({
      user: { id: 'u-regular', name: 'Regular Member', email: 'user@church.org', role: 'USER' },
    });
    (prisma.meetup.create as any).mockResolvedValue({ id: 'm-123', title: 'Worship Rehearsal' });

    const res = await createMeetup({
      displayName: 'Worship Rehearsal',
      category: 'WORSHIP_REHEARSAL',
      isAllChurch: false,
      targetTeamIds: ['team-worship'],
      targetUserIds: ['user-sound-tech'],
      timeSlots: [
        { startsAt: new Date('2026-10-01T18:00:00Z'), endsAt: new Date('2026-10-01T20:00:00Z') },
      ],
    });

    expect(res.success).toBe(true);
    expect((res as any).meetupId).toBe('m-123');
    expect(prisma.meetup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Worship Rehearsal',
          category: 'WORSHIP_REHEARSAL',
          createdById: 'u-regular',
          isAllChurch: false,
          shares: {
            create: [
              { userId: 'user-sound-tech' },
              { teamId: 'team-worship' },
            ],
          },
        }),
      })
    );
  });

  it('creates a staff-wide meetup with isAllChurch true', async () => {
    (prisma.meetup.create as any).mockResolvedValue({ id: 'm-456', title: 'All Hands Staff' });

    const res = await createMeetup({
      displayName: 'All Hands Staff',
      category: 'STAFF_MEETING',
      isAllChurch: true,
    });

    expect(res.success).toBe(true);
    expect(prisma.meetup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'All Hands Staff',
          isAllChurch: true,
          shares: undefined,
        }),
      })
    );
  });

  it('allows the creator (even role USER) to finalize their own meetup', async () => {
    (requireSession as any).mockResolvedValue({
      user: { id: 'u-regular', name: 'Regular Member', email: 'user@church.org', role: 'USER' },
    });
    (prisma.meetup.findUnique as any).mockResolvedValue({
      id: 'm-123',
      createdById: 'u-regular',
    });
    (prisma.meetupTimeSlot.findUnique as any).mockResolvedValue({
      id: 'slot-1',
      startsAt: new Date('2026-10-01T09:00:00Z'),
      endsAt: new Date('2026-10-01T12:00:00Z'),
    });

    const res = await finalizeMeetup('m-123', 'slot-1');
    expect(res.success).toBe(true);
    expect(prisma.meetup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm-123' },
        data: expect.objectContaining({
          finalizedTimeSlotId: 'slot-1',
          status: 'COMPLETE',
        }),
      })
    );
  });

  it('rejects a non-creator USER from finalizing someone elses meetup', async () => {
    (requireSession as any).mockResolvedValue({
      user: { id: 'u-stranger', name: 'Other User', email: 'other@church.org', role: 'USER' },
    });
    (prisma.meetup.findUnique as any).mockResolvedValue({
      id: 'm-123',
      createdById: 'u-organizer',
    });

    const res = await finalizeMeetup('m-123', 'slot-1');
    expect(res.success).toBe(false);
    expect((res as any).error).toContain('Only managers, administrators, or the meetup organizer');
  });

  it('claims a signup slot if capacity remains', async () => {
    (prisma.signupSlot.findUnique as any).mockResolvedValue({
      id: 'slot-1',
      capacity: 2,
      claimedCount: 1,
    });
    (prisma.signupClaim.create as any).mockResolvedValue({
      id: 'claim-1',
      slotId: 'slot-1',
      claimerName: 'Volunteer Jane',
    });

    const res = await claimSignupSlot('slot-1', 'Volunteer Jane');
    expect(res.success).toBe(true);
    expect((res as any).claimId).toBe('claim-1');
    expect(prisma.signupSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'slot-1' },
        data: { claimedCount: { increment: 1 } },
      })
    );
  });

  it('updates meetup audience and targets', async () => {
    (prisma.meetup.findUnique as any).mockResolvedValue({
      id: 'm-123',
      createdById: 'u-admin',
    });

    const res = await updateMeetupAudience('m-123', {
      isAllChurch: false,
      targetTeamIds: ['team-session'],
      targetUserIds: ['user-pastor'],
    });

    expect(res.success).toBe(true);
    expect(prisma.meetup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm-123' },
        data: { isAllChurch: false },
      })
    );
    expect(prisma.meetupShare.deleteMany).toHaveBeenCalledWith({
      where: { meetupId: 'm-123' },
    });
    expect(prisma.meetupShare.createMany).toHaveBeenCalledWith({
      data: [
        { meetupId: 'm-123', userId: 'user-pastor' },
        { meetupId: 'm-123', teamId: 'team-session' },
      ],
    });
  });

  it('generates a public RSVP share link', async () => {
    (prisma.meetup.findUnique as any).mockResolvedValue({
      id: 'm-123',
      createdById: 'u-admin',
    });
    (prisma.meetupShareLink.create as any).mockResolvedValue({
      id: 'share-1',
      token: 'tok_abc',
    });

    const res = await generateShareLink('m-123', 'Youth Night');
    expect(res.success).toBe(true);
    expect((res as any).url).toMatch(/^\/share\/.+/);
  });

  it('refuses to delete a meetup if the module is disabled', async () => {
    (isModuleEnabled as any).mockReturnValue(false);
    const res = await deleteMeetup('m-123');
    expect(res.success).toBe(false);
    expect((res as any).error).toContain('not enabled');
  });

  it('allows the creator (role USER) to delete their own meetup', async () => {
    (requireSession as any).mockResolvedValue({
      user: { id: 'u-regular', name: 'Regular Member', email: 'user@church.org', role: 'USER' },
    });
    (prisma.meetup.findUnique as any).mockResolvedValue({
      id: 'm-123',
      createdById: 'u-regular',
    });
    (prisma.meetup.update as any).mockResolvedValue({
      id: 'm-123',
      archivedAt: new Date(),
    });

    const res = await deleteMeetup('m-123');
    expect(res.success).toBe(true);
    expect(prisma.meetup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm-123' },
        data: expect.objectContaining({
          archivedAt: expect.any(Date),
        }),
      })
    );
  });

  it('rejects a non-creator USER from deleting someone elses meetup', async () => {
    (requireSession as any).mockResolvedValue({
      user: { id: 'u-stranger', name: 'Other User', email: 'other@church.org', role: 'USER' },
    });
    (prisma.meetup.findUnique as any).mockResolvedValue({
      id: 'm-123',
      createdById: 'u-organizer',
    });

    const res = await deleteMeetup('m-123');
    expect(res.success).toBe(false);
    expect((res as any).error).toContain('Only managers, administrators, or the meetup organizer');
  });

  it('allows an ADMIN to delete any meetup', async () => {
    (requireSession as any).mockResolvedValue({
      user: { id: 'u-admin', name: 'Admin User', email: 'admin@church.org', role: 'ADMIN' },
    });
    (prisma.meetup.update as any).mockResolvedValue({
      id: 'm-123',
      archivedAt: new Date(),
    });

    const res = await deleteMeetup('m-123');
    expect(res.success).toBe(true);
    expect(prisma.meetup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm-123' },
        data: expect.objectContaining({
          archivedAt: expect.any(Date),
        }),
      })
    );
  });
});
