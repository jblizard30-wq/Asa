// src/components/NewMeetupModal.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, addDays } from 'date-fns';
import { MeetupCategory } from '@prisma/client';
import {
  MEETUP_CATEGORIES,
  CATEGORY_MAP,
  DEFAULT_WORK_ROLES,
  DEFAULT_POTLUCK_ITEMS,
} from '@/lib/meetupCategories';
import {
  getCategoryIcon,
  VideoIcon,
  MapPinIcon,
  ClockIcon,
  UtensilsIcon,
  ClipboardListIcon,
  PlusIcon,
  TrashIcon,
} from '@/components/MeetupIcons';
import { createMeetup } from '@/lib/actions/meetups';

export function NewMeetupModal({
  onClose,
  availableTeams = [],
  availableUsers = [],
}: {
  onClose: () => void;
  availableTeams?: Array<{ id: string; name: string }>;
  availableUsers?: Array<{ id: string; name: string | null; email: string }>;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Basics & Audience
  const [displayName, setDisplayName] = useState('');
  const [category, setCategory] = useState<MeetupCategory>('STAFF_MEETING');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [virtualUrl, setVirtualUrl] = useState('');
  const [agenda, setAgenda] = useState('');
  const [minQuorum, setMinQuorum] = useState<number | undefined>(undefined);
  const [isAllChurch, setIsAllChurch] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Step 2: Time Slots & Duration
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [timeSlots, setTimeSlots] = useState<
    Array<{ id: string; date: string; time: string; label: string }>
  >([
    {
      id: '1',
      date: format(addDays(new Date(), 2), 'yyyy-MM-dd'),
      time: '10:00',
      label: 'Morning Slot',
    },
    {
      id: '2',
      date: format(addDays(new Date(), 3), 'yyyy-MM-dd'),
      time: '14:00',
      label: 'Afternoon Slot',
    },
  ]);

  // Step 3: Roster (Potluck vs Roles)
  const isPotluckCategory = category === 'POTLUCK_SOCIAL';
  const [isPotluckEnabled, setIsPotluckEnabled] = useState(isPotluckCategory);
  const [hasRolesEnabled, setHasRolesEnabled] = useState(!isPotluckCategory);

  const [rosterItems, setRosterItems] = useState<
    Array<{ id: string; title: string; category: string; capacity: number }>
  >(() => (isPotluckCategory ? DEFAULT_POTLUCK_ITEMS.map((item, i) => ({ ...item, id: `${i}` })) : DEFAULT_WORK_ROLES.map((item, i) => ({ ...item, id: `${i}` }))));

  const handleCategorySelect = (cat: MeetupCategory) => {
    setCategory(cat);
    const meta = CATEGORY_MAP[cat];
    setDurationMinutes(meta.defaultDurationMinutes);

    if (cat === 'POTLUCK_SOCIAL') {
      setIsPotluckEnabled(true);
      setHasRolesEnabled(false);
      setRosterItems(DEFAULT_POTLUCK_ITEMS.map((item, i) => ({ ...item, id: `${i}` })));
    } else {
      setIsPotluckEnabled(false);
      setHasRolesEnabled(true);
      setRosterItems(DEFAULT_WORK_ROLES.map((item, i) => ({ ...item, id: `${i}` })));
    }
  };

  const addTimeSlot = () => {
    const nextDate = addDays(new Date(), timeSlots.length + 2);
    setTimeSlots([
      ...timeSlots,
      {
        id: Date.now().toString(),
        date: format(nextDate, 'yyyy-MM-dd'),
        time: '10:00',
        label: '',
      },
    ]);
  };

  const removeTimeSlot = (id: string) => {
    if (timeSlots.length <= 1) return;
    setTimeSlots(timeSlots.filter((slot) => slot.id !== id));
  };

  const addRosterItem = () => {
    setRosterItems([
      ...rosterItems,
      {
        id: Date.now().toString(),
        title: '',
        category: isPotluckEnabled ? 'Food' : 'Role',
        capacity: 1,
      },
    ]);
  };

  const removeRosterItem = (id: string) => {
    setRosterItems(rosterItems.filter((item) => item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Calculate start/end times
    const formattedSlots = timeSlots.map((slot) => {
      const startsAt = new Date(`${slot.date}T${slot.time}`);
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
      return {
        startsAt,
        endsAt,
        label: slot.label || undefined,
      };
    });

    const payload = {
      displayName,
      category,
      description: description || undefined,
      location: location || undefined,
      virtualUrl: virtualUrl || undefined,
      agenda: agenda || undefined,
      minQuorum: minQuorum || undefined,
      isPotluck: isPotluckEnabled,
      hasRolesRoster: hasRolesEnabled,
      isAllChurch,
      targetTeamIds: isAllChurch ? [] : selectedTeamIds,
      targetUserIds: isAllChurch ? [] : selectedUserIds,
      timeSlots: formattedSlots,
      rosterItems:
        (isPotluckEnabled || hasRolesEnabled)
          ? rosterItems.filter((i) => i.title.trim().length > 0)
          : [],
    };

    const result = await createMeetup(payload);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.refresh();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header & Steps Indicator */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Schedule New Meetup / Meeting
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Step {step} of 3 · {step === 1 ? 'Event Details & Category' : step === 2 ? 'Date/Time Consensus Slots' : 'Logistics & Roster'}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all ${
                  s === step
                    ? 'w-6 bg-brand-600'
                    : s < step
                    ? 'w-2 bg-brand-400'
                    : 'w-2 bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* STEP 1: Details & Categories */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Meeting Title *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Session & Elder Strategy Retreat, Pastoral 1-on-1, or Harvest Potluck"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Work & Ministry Category Picker */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                  Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {MEETUP_CATEGORIES.map((cat) => {
                    const isSelected = category === cat.value;
                    return (
                      <button
                        type="button"
                        key={cat.value}
                        onClick={() => handleCategorySelect(cat.value)}
                        className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
                          isSelected
                            ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20 dark:border-brand-500 dark:bg-brand-950/30'
                            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-850 dark:hover:border-slate-700'
                        }`}
                      >
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                            isSelected
                              ? 'bg-brand-600 text-white'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {getCategoryIcon(cat.iconName, 'h-3.5 w-3.5')}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {cat.label}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {cat.group === 'work' ? 'Work / Staff' : 'Ministry'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hybrid / Location & Virtual URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <MapPinIcon className="h-3.5 w-3.5 text-slate-400" />
                    <span>In-Person Location / Room</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fellowship Hall, Room 204"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <VideoIcon className="h-3.5 w-3.5 text-blue-500" />
                    <span>Virtual Video Call (Zoom / Google Meet)</span>
                  </label>
                  <input
                    type="url"
                    placeholder="e.g. https://meet.google.com/xyz"
                    value={virtualUrl}
                    onChange={(e) => setVirtualUrl(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Agenda & Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Agenda / Preparation Materials
                </label>
                <textarea
                  rows={2}
                  placeholder="Outline key discussion items, links to documents, or preparation tasks..."
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Audience & Visibility */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-850/60 space-y-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    Audience & Visibility
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Choose who can see this meetup on the calendar and attend
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAllChurch(false)}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                      !isAllChurch
                        ? 'border-brand-500 bg-white shadow-sm ring-1 ring-brand-500/20 dark:border-brand-500 dark:bg-slate-800'
                        : 'border-slate-200 bg-white/60 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xl">👥</span>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        Teams & Specific People
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Private & targeted to selected groups or members
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAllChurch(true)}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                      isAllChurch
                        ? 'border-brand-500 bg-white shadow-sm ring-1 ring-brand-500/20 dark:border-brand-500 dark:bg-slate-800'
                        : 'border-slate-200 bg-white/60 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xl">🌐</span>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        Church-Wide Invitation
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Visible to all church members on their calendar
                      </p>
                    </div>
                  </button>
                </div>

                {!isAllChurch && (
                  <div className="space-y-3 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                    {/* Teams selector */}
                    {availableTeams.length > 0 && (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Invite Specific Teams ({selectedTeamIds.length} selected)
                        </label>
                        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                          {availableTeams.map((team) => {
                            const isSelected = selectedTeamIds.includes(team.id);
                            return (
                              <button
                                key={team.id}
                                type="button"
                                onClick={() => {
                                  setSelectedTeamIds((prev) =>
                                    isSelected ? prev.filter((id) => id !== team.id) : [...prev, team.id]
                                  );
                                }}
                                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border transition-all ${
                                  isSelected
                                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-500'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                <span>{isSelected ? '✓' : '+'}</span>
                                <span>{team.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* People selector */}
                    {availableUsers.length > 0 && (
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Invite Specific Members ({selectedUserIds.length} selected)
                        </label>
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                          {availableUsers.map((user) => {
                            const isSelected = selectedUserIds.includes(user.id);
                            return (
                              <button
                                key={user.id}
                                type="button"
                                onClick={() => {
                                  setSelectedUserIds((prev) =>
                                    isSelected ? prev.filter((id) => id !== user.id) : [...prev, user.id]
                                  );
                                }}
                                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border transition-all ${
                                  isSelected
                                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-500'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                <span>{isSelected ? '✓' : '+'}</span>
                                <span>{user.name || user.email}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {selectedTeamIds.length === 0 && selectedUserIds.length === 0 && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        ℹ️ No teams or people selected yet. This meetup will be private to you (as organizer) until shared.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Time Slots & Consensus Engine */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Duration Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                  Expected Duration
                </label>
                <div className="flex flex-wrap gap-2">
                  {[30, 45, 60, 90, 120, 180, 240].map((mins) => (
                    <button
                      type="button"
                      key={mins}
                      onClick={() => setDurationMinutes(mins)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                        durationMinutes === mins
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {mins < 60 ? `${mins} mins` : `${mins / 60} ${mins === 60 ? 'hr' : 'hrs'}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Proposed Time Slots */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Proposed Date / Time Slots for Voting
                  </label>
                  <button
                    type="button"
                    onClick={addTimeSlot}
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    <span>Add Slot</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {timeSlots.map((slot, i) => (
                    <div
                      key={slot.id}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-850"
                    >
                      <span className="font-mono text-xs text-slate-400 w-4 text-center">{i + 1}</span>
                      <input
                        type="date"
                        value={slot.date}
                        onChange={(e) =>
                          setTimeSlots(
                            timeSlots.map((s) => (s.id === slot.id ? { ...s, date: e.target.value } : s))
                          )
                        }
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      />
                      <input
                        type="time"
                        value={slot.time}
                        onChange={(e) =>
                          setTimeSlots(
                            timeSlots.map((s) => (s.id === slot.id ? { ...s, time: e.target.value } : s))
                          )
                        }
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      />
                      <input
                        type="text"
                        placeholder="Label (e.g. Option A / Morning)"
                        value={slot.label}
                        onChange={(e) =>
                          setTimeSlots(
                            timeSlots.map((s) => (s.id === slot.id ? { ...s, label: e.target.value } : s))
                          )
                        }
                        className="flex-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      />
                      {timeSlots.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTimeSlot(slot.id)}
                          className="text-slate-400 hover:text-rose-500 p-1"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Quorum Target */}
              <div className="pt-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Minimum Quorum (Optional)
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder="e.g. 5 (requires 5 attendees to finalize)"
                  value={minQuorum ?? ''}
                  onChange={(e) =>
                    setMinQuorum(e.target.value ? parseInt(e.target.value, 10) : undefined)
                  }
                  className="mt-1 w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Conditional Potluck & Roles Roster */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Conditional Toggle Banners */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-850 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UtensilsIcon className="h-4 w-4 text-rose-500" />
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        Include Potluck Dishes & Supplies
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Ask attendees to sign up for main courses, drinks, sides, and plates
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isPotluckEnabled}
                    onChange={(e) => {
                      setIsPotluckEnabled(e.target.checked);
                      if (e.target.checked) {
                        setRosterItems(DEFAULT_POTLUCK_ITEMS.map((item, i) => ({ ...item, id: `${i}` })));
                      }
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                </div>

                {!isPotluckEnabled && (
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardListIcon className="h-4 w-4 text-blue-500" />
                      <div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          Include Meeting Roles & Logistics
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Assign note takers, facilitators, AV screen-share lead, and hospitality
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={hasRolesEnabled}
                      onChange={(e) => {
                        setHasRolesEnabled(e.target.checked);
                        if (e.target.checked) {
                          setRosterItems(DEFAULT_WORK_ROLES.map((item, i) => ({ ...item, id: `${i}` })));
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                  </div>
                )}
              </div>

              {/* Roster Items Builder */}
              {(isPotluckEnabled || hasRolesEnabled) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      {isPotluckEnabled ? 'Potluck Items Needed' : 'Roles & Assignments Needed'}
                    </label>
                    <button
                      type="button"
                      onClick={addRosterItem}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      <span>Add Item</span>
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {rosterItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-800"
                      >
                        <input
                          type="text"
                          placeholder="e.g. Main Entrée, Note Taker, Coffee"
                          value={item.title}
                          onChange={(e) =>
                            setRosterItems(
                              rosterItems.map((r) => (r.id === item.id ? { ...r, title: e.target.value } : r))
                            )
                          }
                          className="flex-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-850 dark:text-slate-200"
                        />
                        <input
                          type="text"
                          placeholder="Category"
                          value={item.category}
                          onChange={(e) =>
                            setRosterItems(
                              rosterItems.map((r) => (r.id === item.id ? { ...r, category: e.target.value } : r))
                            )
                          }
                          className="w-24 rounded-md border border-slate-300 px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-850 dark:text-slate-200"
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-slate-400">Qty:</span>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={item.capacity}
                            onChange={(e) =>
                              setRosterItems(
                                rosterItems.map((r) =>
                                  r.id === item.id ? { ...r, capacity: parseInt(e.target.value, 10) || 1 } : r
                                )
                              )
                            }
                            className="w-14 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-850 dark:text-slate-200"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRosterItem(item.id)}
                          className="text-slate-400 hover:text-rose-500 p-1"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer Controls */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((step - 1) as 1 | 2)}
                className="rounded-lg px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                ← Back
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && !displayName.trim()) {
                    setError('Meeting title is required.');
                    return;
                  }
                  setError(null);
                  setStep((step + 1) as 2 | 3);
                }}
                className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-brand-500 transition-colors"
              >
                Next Step →
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-500 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Creating Meetup…' : 'Schedule Meetup'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
