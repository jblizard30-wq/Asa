// src/app/share/[token]/page.tsx
import { notFound } from 'next/navigation';
import { createHash } from 'crypto';
import { format } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { CATEGORY_MAP } from '@/lib/meetupCategories';
import {
  ClockIcon,
  MapPinIcon,
  VideoIcon,
  getCategoryIcon,
} from '@/components/MeetupIcons';
import { VisualAvailabilityHeatmap } from '@/components/meetups/VisualAvailabilityHeatmap';
import { MeetingRosterCard } from '@/components/meetups/MeetingRosterCard';
import { CalendarExportBar } from '@/components/meetups/CalendarExportBar';

export default async function PublicShareLinkPage({
  params,
}: {
  params: { token: string };
}) {
  const tokenHash = createHash('sha256').update(params.token).digest('hex');

  const shareLink = await prisma.meetupShareLink.findUnique({
    where: { tokenHash },
    include: {
      meetup: {
        include: {
          createdBy: { select: { name: true } },
          timeSlots: {
            orderBy: { startsAt: 'asc' },
            include: {
              votes: true,
            },
          },
          signupSlots: {
            orderBy: { order: 'asc' },
            include: {
              claims: true,
            },
          },
        },
      },
    },
  });

  if (!shareLink || shareLink.revokedAt || new Date() > shareLink.expiresAt) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
            ⏳
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Invitation Expired or Invalid
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            This share link is either inactive, revoked, or has passed its expiration date.
            Please reach out to the meeting organizer for a fresh link.
          </p>
        </div>
      </div>
    );
  }

  // Increment view counter
  void prisma.meetupShareLink
    .update({
      where: { id: shareLink.id },
      data: { useCount: { increment: 1 } },
    })
    .catch(() => {});

  const meetup = shareLink.meetup;
  if (!meetup || meetup.archivedAt) {
    notFound();
  }

  const categoryMeta = CATEGORY_MAP[meetup.category] || CATEGORY_MAP.GENERAL;
  const isFinalized = Boolean(meetup.startsAt && meetup.finalizedTimeSlotId);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-brand-600 dark:text-brand-400 tracking-tight">
              Community Presbyterian Church
            </span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Meetup RSVP</span>
          </div>

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
        </div>

        {/* Main Details Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${categoryMeta.badgeClass}`}
            >
              {getCategoryIcon(categoryMeta.iconName, 'h-3.5 w-3.5')}
              <span>{categoryMeta.label}</span>
            </span>

            {isFinalized ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                ✓ Confirmed Date
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                ⏳ Polling Availability
              </span>
            )}

            {meetup.isPotluck && (
              <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                Potluck Event
              </span>
            )}
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {meetup.title}
            </h1>
            {meetup.createdBy?.name && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Hosted by {meetup.createdBy.name}
              </p>
            )}
          </div>

          {meetup.description && (
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {meetup.description}
            </p>
          )}

          {/* Time & Location */}
          <div className="flex flex-wrap gap-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
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
                <span>Time polling in progress — please vote below!</span>
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

        {/* Agenda Strip if present */}
        {meetup.agenda && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Meeting Agenda
            </h3>
            <div className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-sans bg-slate-50 dark:bg-slate-850 p-3.5 rounded-lg border border-slate-100 dark:border-slate-800">
              {meetup.agenda}
            </div>
          </div>
        )}

        {/* Time Voting Section */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {isFinalized ? 'Confirmed Time Slot' : 'Cast Your Availability'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isFinalized
                ? 'The meeting date has been confirmed above.'
                : 'Select all proposed times that work for your schedule.'}
            </p>
          </div>

          <VisualAvailabilityHeatmap
            meetupId={meetup.id}
            slots={meetup.timeSlots}
            isFinalized={isFinalized}
            finalizedSlotId={meetup.finalizedTimeSlotId}
            canManage={false}
            guestToken={params.token}
          />
        </div>

        {/* Potluck / Signup Roster */}
        {meetup.signupSlots.length > 0 && (
          <MeetingRosterCard
            meetupId={meetup.id}
            slots={meetup.signupSlots}
            isPotluck={meetup.isPotluck}
          />
        )}
      </div>
    </div>
  );
}
