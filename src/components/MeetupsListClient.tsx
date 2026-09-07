// src/components/MeetupsListClient.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MeetupCategory } from '@prisma/client';
import { NewMeetupModal } from '@/components/NewMeetupModal';
import { CATEGORY_MAP } from '@/lib/meetupCategories';
import {
  ClockIcon,
  MapPinIcon,
  VideoIcon,
  UsersIcon,
  PlusIcon,
  getCategoryIcon,
} from '@/components/MeetupIcons';
import { ShareLinkButton } from '@/components/meetups/ShareLinkButton';
import { CalendarExportBar } from '@/components/meetups/CalendarExportBar';
import { DeleteMeetupButton } from '@/components/meetups/DeleteMeetupButton';

export interface MeetupRow {
  id: string;
  displayName: string;
  category: MeetupCategory;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  virtualUrl: string | null;
  description: string | null;
  isPotluck: boolean;
  isAllChurch: boolean;
  createdById: string | null;
  createdByName: string | null;
  canManage: boolean;
  finalizedTimeSlotId: string | null;
  venueOptionCount: number;
  signupSlotCount: number;
  timeVoteCount: number;
  sharedTeams?: Array<{ id: string; name: string }>;
  sharedUsers?: Array<{ id: string; name: string | null; email: string }>;
}

function formatWhen(startsAt: string | null): string {
  if (!startsAt) return 'Time not set (Voting active)';
  return new Date(startsAt).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function MeetupsListClient({
  meetups,
  availableTeams = [],
  availableUsers = [],
  currentUserId,
  canManage = true,
}: {
  meetups: MeetupRow[];
  availableTeams?: Array<{ id: string; name: string }>;
  availableUsers?: Array<{ id: string; name: string | null; email: string }>;
  currentUserId?: string;
  canManage?: boolean;
}) {
  const [showNew, setShowNew] = useState(false);
  const [preset, setPreset] = useState<'SUNDAY_WORSHIP' | undefined>(undefined);
  const [selectedGroup, setSelectedGroup] = useState<'ALL' | 'WORK' | 'MINISTRY' | 'VOTING'>('ALL');
  const [meetupList, setMeetupList] = useState<MeetupRow[]>(meetups);

  useEffect(() => {
    setMeetupList(meetups);
  }, [meetups]);

  const filteredMeetups = meetupList.filter((m) => {
    const meta = CATEGORY_MAP[m.category] || CATEGORY_MAP.GENERAL;
    if (selectedGroup === 'WORK') return meta.group === 'work';
    if (selectedGroup === 'MINISTRY') return meta.group === 'ministry' || m.isPotluck;
    if (selectedGroup === 'VOTING') return !m.finalizedTimeSlotId;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Meetup & Meeting Calendar
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Work sessions, 1-on-1 check-ins, committee meetings, ministry gatherings, and potlucks
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setPreset('SUNDAY_WORSHIP');
              setShowNew(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3.5 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-300 dark:hover:bg-purple-900/60 shadow-sm transition-colors"
          >
            <span>⛪</span>
            <span>Sunday Worship</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPreset(undefined);
              setShowNew(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-500 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Schedule Meetup</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 dark:border-slate-800 overflow-x-auto">
        {[
          { id: 'ALL', label: 'All Meetups' },
          { id: 'WORK', label: 'Work & Staff Meetings' },
          { id: 'MINISTRY', label: 'Ministry & Potlucks' },
          { id: 'VOTING', label: 'Awaiting Consensus (Voting)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedGroup(tab.id as any)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              selectedGroup === tab.id
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {filteredMeetups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-800">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 mb-3">
            <ClockIcon className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            No meetups found in this view
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {canManage ? 'Click "Schedule Meetup" to plan a new meeting or gathering.' : 'Nothing scheduled.'}
          </p>
        </div>
      ) : (
        /* Meetup Cards Grid */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredMeetups.map((m) => {
            const meta = CATEGORY_MAP[m.category] || CATEGORY_MAP.GENERAL;
            const isFinalized = Boolean(m.startsAt && m.finalizedTimeSlotId);

            return (
              <div
                key={m.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-slate-700 transition-all space-y-4"
              >
                <div className="space-y-3">
                  {/* Category & Status Bar */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${meta.badgeClass}`}
                      >
                        {getCategoryIcon(meta.iconName, 'h-3 w-3')}
                        <span>{meta.label}</span>
                      </span>

                      {m.isAllChurch ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200/80 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                          🌐 Staff-Wide (Logins)
                        </span>
                      ) : (m.sharedTeams?.length || m.sharedUsers?.length) ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200/80 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                          👥 {m.sharedTeams?.length ? `${m.sharedTeams.length} Team${m.sharedTeams.length > 1 ? 's' : ''}` : ''}
                          {m.sharedTeams?.length && m.sharedUsers?.length ? ', ' : ''}
                          {m.sharedUsers?.length ? `${m.sharedUsers.length} Person${m.sharedUsers.length > 1 ? 's' : ''}` : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                          🔒 Private
                        </span>
                      )}
                    </div>

                    {isFinalized ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                        ✓ Confirmed
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                        ⏳ Voting Active
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <div>
                    <Link href={`/meetups/${m.id}`} className="group block">
                      <h2 className="text-base font-bold text-slate-900 group-hover:text-brand-600 dark:text-slate-100 dark:group-hover:text-brand-400 transition-colors">
                        {m.displayName}
                      </h2>
                    </Link>
                    {m.createdByName && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        Organized by {m.createdByName}
                      </p>
                    )}
                  </div>

                  {m.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {m.description}
                    </p>
                  )}

                  {/* When & Where */}
                  <div className="space-y-1 pt-1 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <ClockIcon className="h-3.5 w-3.5 text-slate-400" />
                      <span className={isFinalized ? 'font-medium' : 'text-amber-600 dark:text-amber-400 font-mono text-[11px]'}>
                        {formatWhen(m.startsAt)}
                      </span>
                    </div>

                    {m.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPinIcon className="h-3.5 w-3.5 text-slate-400" />
                        <span className="truncate">{m.location}</span>
                      </div>
                    )}

                    {m.virtualUrl && (
                      <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                        <VideoIcon className="h-3.5 w-3.5" />
                        <span className="truncate">Virtual Meeting Available</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span>{m.timeVoteCount} votes</span>
                    <span>·</span>
                    <span>{m.signupSlotCount} {m.isPotluck ? 'dishes' : 'roles'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isFinalized && m.startsAt && m.endsAt && (
                      <CalendarExportBar
                        event={{
                          id: m.id,
                          title: m.displayName,
                          description: m.description,
                          startsAt: m.startsAt,
                          endsAt: m.endsAt,
                          location: m.location,
                          virtualUrl: m.virtualUrl,
                        }}
                      />
                    )}

                    <Link
                      href={`/meetups/${m.id}`}
                      className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 transition-colors"
                    >
                      View Details →
                    </Link>

                    {m.canManage && (
                      <DeleteMeetupButton
                        meetupId={m.id}
                        meetupTitle={m.displayName}
                        variant="icon"
                        redirectTo={null}
                        onDeleted={() => setMeetupList((prev) => prev.filter((item) => item.id !== m.id))}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && (
        <NewMeetupModal
          onClose={() => {
            setShowNew(false);
            setPreset(undefined);
          }}
          availableTeams={availableTeams}
          availableUsers={availableUsers}
          initialPreset={preset}
        />
      )}
    </div>
  );
}
