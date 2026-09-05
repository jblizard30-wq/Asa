import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMeetup,
  claimSignupSlot,
  unclaimSignupSlot,
  finalizeMeetup,
  generateShareLink,
} from './meetups';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/modules';

vi.mock('@/lib/modules', () => ({
  isModuleEnabled: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
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
  });

  it('refuses to create a meetup if the module is disabled', async () => {
    (isModuleEnabled as any).mockReturnValue(false);
    const res = await createMeetup({ displayName: 'Staff Retreat' });
    expect(res.success).toBe(false);
    expect((res as any).error).toContain('not enabled');
  });

  it('creates a meetup with nested time slots and slots', async () => {
    (prisma.meetup.create as any).mockResolvedValue({ id: 'm-123', title: 'Staff Retreat' });

    const res = await createMeetup({
      displayName: 'Staff Retreat',
      category: 'RETREAT',
      timeSlots: [
        { startsAt: new Date('2026-10-01T09:00:00Z'), endsAt: new Date('2026-10-01T12:00:00Z') },
      ],
      rosterItems: [
        { title: 'Morning Coffee & Bagels', category: 'Food', capacity: 2 },
      ],
    });

    expect(res.success).toBe(true);
    expect((res as any).meetupId).toBe('m-123');
    expect(prisma.meetup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Staff Retreat',
          category: 'RETREAT',
        }),
      })
    );
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

  it('finalizes a meetup and locks the chosen time and venue', async () => {
    (prisma.meetupTimeSlot.findUnique as any).mockResolvedValue({
      id: 'slot-1',
      startsAt: new Date('2026-10-01T09:00:00Z'),
      endsAt: new Date('2026-10-01T12:00:00Z'),
    });
    (prisma.venueOption.findUnique as any).mockResolvedValue({
      id: 'venue-1',
      name: 'Fellowship Hall',
      address: '123 Church Way',
    });

    const res = await finalizeMeetup('m-123', 'slot-1', 'venue-1');
    expect(res.success).toBe(true);
    expect(prisma.meetup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm-123' },
        data: expect.objectContaining({
          finalizedTimeSlotId: 'slot-1',
          finalizedVenueId: 'venue-1',
          location: 'Fellowship Hall, 123 Church Way',
          status: 'COMPLETE',
        }),
      })
    );
  });

  it('generates a public RSVP share link', async () => {
    (prisma.meetupShareLink.create as any).mockResolvedValue({
      id: 'share-1',
      token: 'tok_abc',
    });

    const res = await generateShareLink('m-123', 'Youth Night');
    expect(res.success).toBe(true);
    expect((res as any).url).toMatch(/^\/share\/.+/);
  });
});
