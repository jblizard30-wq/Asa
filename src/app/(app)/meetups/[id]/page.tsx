// src/app/(app)/meetups/[id]/page.tsx
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/modules';
import { CATEGORY_MAP } from '@/lib/meetupCategories';
import {
  ClockIcon,
  MapPinIcon,
  VideoIcon,
  getCategoryIcon,
} from '@/components/MeetupIcons';
import { VisualAvailabilityHeatmap } from '@/components/meetups/VisualAvailabilityHeatmap';
import { MeetingRosterCard } from '@/components/meetups/MeetingRosterCard';
import { ActionItemsSection } from '@/components/meetups/ActionItemsSection';
import { CalendarExportBar } from '@/components/meetups/CalendarExportBar';
import { ShareLinkButton } from '@/components/meetups/ShareLinkButton';
import { AudienceSection } from '@/components/meetups/AudienceSection';

export default async function MeetupDetailPage({ params }: { params: { id: string } }) {
  if (!isModuleEnabled('meetups')) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/sign-in');
  }

  const [meetup, userTeams, availableTeams, availableUsers] = await Promise.all([
    prisma.meetup.findUnique({
      where: { id: params.id },
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
    }),
    prisma.teamMember.findMany({
      where: { userId: session.user.id },
      select: { teamId: true },
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

  if (!meetup || meetup.archivedAt) {
    notFound();
  }

  const isAdmin = session.user.role === 'ADMIN';
  const isManager = session.user.role === 'MANAGER';
  const isCreator = meetup.createdById === session.user.id;
  const isDirectlyShared = meetup.shares.some((s) => s.userId === session.user.id);
  const userTeamIdSet = new Set(userTeams.map((t) => t.teamId));
  const isTeamShared = meetup.shares.some((s) => s.teamId && userTeamIdSet.has(s.teamId));

  const isVisible = isAdmin || meetup.isAllChurch || isCreator || isDirectlyShared || isTeamShared;
  if (!isVisible) {
    notFound();
  }

  const canManage = isAdmin || isManager || isCreator;
  const categoryMeta = CATEGORY_MAP[meetup.category] || CATEGORY_MAP.GENERAL;
  const isFinalized = Boolean(meetup.startsAt && meetup.finalizedTimeSlotId);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Back to Meetups */}
      <div className="flex items-center justify-between">
        <Link
          href="/meetups"
          className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          ← Back to Meetups
        </Link>

        <div className="flex items-center gap-2">
          {isFinalized && meetup.startsAt && meetup.endsAt && (
            <CalendarExportBar
              event={{
                id: meetup.id,
                title: meetup.title,
                description: meetup.description,
                startsAt: meetup.startsAt,
                endsAt: meetup.endsAt,
                location: meetup.location,
                virtualUrl: meetup.virtualUrl,
                agenda: meetup.agenda,
                hostName: meetup.createdBy?.name,
              }}
            />
          )}

          <ShareLinkButton meetupId={meetup.id} />
        </div>
      </div>

      {/* Main Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${categoryMeta.badgeClass}`}
          >
            {getCategoryIcon(categoryMeta.iconName, 'h-3.5 w-3.5')}
            <span>{categoryMeta.label}</span>
          </span>

          {isFinalized ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              ✓ Confirmed
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              ⏳ Availability Polling Active
            </span>
          )}

          {meetup.isPotluck && (
            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
              Potluck Event
            </span>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {meetup.title}
          </h1>
          {meetup.createdBy?.name && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Organized by {meetup.createdBy.name}
            </p>
          )}
        </div>

        {meetup.description && (
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {meetup.description}
          </p>
        )}

        {/* Location & Video Call Strip */}
        <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          {meetup.startsAt ? (
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <ClockIcon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              <span className="font-semibold">
                {format(new Date(meetup.startsAt), 'EEEE, MMMM d, yyyy · h:mm a')}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <ClockIcon className="h-4 w-4" />
              <span>Time will be finalized once consensus is reached</span>
            </div>
          )}

          {meetup.location && (
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <MapPinIcon className="h-4 w-4 text-slate-400" />
              <span>{meetup.location}</span>
            </div>
          )}

          {meetup.virtualUrl && (
            <a
              href={meetup.virtualUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 transition-colors"
            >
              <VideoIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>Join Video Call</span>
              <span className="text-[10px]">↗</span>
            </a>
          )}
        </div>
      </div>

      {/* Audience & Sharing Section */}
      <AudienceSection
        meetupId={meetup.id}
        isAllChurch={meetup.isAllChurch}
        canManage={canManage}
        shares={meetup.shares}
        availableTeams={availableTeams}
        availableUsers={availableUsers}
      />

      {/* Agenda Section */}
      {meetup.agenda && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Meeting Agenda & Preparation Notes
          </h3>
          <div className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-sans bg-slate-50 dark:bg-slate-850 p-3.5 rounded-lg border border-slate-100 dark:border-slate-800">
            {meetup.agenda}
          </div>
        </div>
      )}

      {/* Availability Heatmap & Polling */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {isFinalized ? 'Confirmed Meeting Time' : 'Time Availability Consensus'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isFinalized
                ? 'The meeting organizer locked this date and time.'
                : 'Vote for all slots that work for you to help find the optimal consensus.'}
            </p>
          </div>
        </div>

        <VisualAvailabilityHeatmap
          meetupId={meetup.id}
          slots={meetup.timeSlots}
          isFinalized={isFinalized}
          finalizedSlotId={meetup.finalizedTimeSlotId}
          canManage={canManage}
          currentUserId={session.user.id}
          minQuorum={meetup.minQuorum}
        />
      </div>

      {/* Roster: Potluck Dishes or Meeting Roles */}
      <MeetingRosterCard
        meetupId={meetup.id}
        slots={meetup.signupSlots}
        isPotluck={meetup.isPotluck}
        currentUserId={session.user.id}
      />

      {/* Action Items to Tasks (Organizers) */}
      <ActionItemsSection meetupId={meetup.id} canManage={canManage} />
    </div>
  );
}
