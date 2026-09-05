// src/components/meetups/VisualAvailabilityHeatmap.tsx
'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { VoteChoice } from '@prisma/client';
import { SparklesIcon, CheckIcon, ClockIcon } from '@/components/MeetupIcons';
import { submitMeetupVotes, finalizeMeetup } from '@/lib/actions/meetups';

export interface HeatmapSlot {
  id: string;
  startsAt: Date | string;
  endsAt: Date | string;
  label?: string | null;
  votes: Array<{
    id: string;
    choice: VoteChoice;
    voterName?: string | null;
    voterUserId?: string | null;
  }>;
}

export interface HeatmapProps {
  meetupId: string;
  slots: HeatmapSlot[];
  isFinalized: boolean;
  finalizedSlotId?: string | null;
  canManage: boolean;
  currentUserId?: string | null;
  guestName?: string;
  guestToken?: string;
  minQuorum?: number | null;
}

export function VisualAvailabilityHeatmap({
  meetupId,
  slots,
  isFinalized,
  finalizedSlotId,
  canManage,
  currentUserId,
  guestName,
  guestToken,
  minQuorum,
}: HeatmapProps) {
  const [userVotes, setUserVotes] = useState<Record<string, VoteChoice>>(() => {
    const initial: Record<string, VoteChoice> = {};
    for (const slot of slots) {
      const myVote = slot.votes.find(
        (v) => (currentUserId && v.voterUserId === currentUserId) || (guestName && v.voterName === guestName)
      );
      if (myVote) initial[slot.id] = myVote.choice;
    }
    return initial;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);

  // Compute stats per slot
  const slotStats = slots.map((slot) => {
    const yesCount = slot.votes.filter((v) => v.choice === 'YES').length;
    const maybeCount = slot.votes.filter((v) => v.choice === 'IF_NEEDED').length;
    const noCount = slot.votes.filter((v) => v.choice === 'NO').length;
    const totalVotes = slot.votes.length;
    const score = yesCount * 2 + maybeCount * 1;
    return {
      slot,
      yesCount,
      maybeCount,
      noCount,
      totalVotes,
      score,
      percentage: totalVotes > 0 ? Math.round((yesCount / totalVotes) * 100) : 0,
    };
  });

  // Find optimal slot (highest score)
  const sortedStats = [...slotStats].sort((a, b) => b.score - a.score);
  const optimalSlot = sortedStats[0]?.totalVotes > 0 ? sortedStats[0] : null;

  const handleSelectChoice = (slotId: string, choice: VoteChoice) => {
    if (isFinalized) return;
    setUserVotes((prev) => ({ ...prev, [slotId]: choice }));
  };

  const handleSaveVotes = async () => {
    setIsSubmitting(true);
    const votePayload = Object.entries(userVotes).map(([timeSlotId, choice]) => ({
      timeSlotId,
      choice,
    }));

    const result = await submitMeetupVotes(
      meetupId,
      votePayload,
      guestName || guestToken ? { name: guestName || 'Guest Participant', guestToken } : undefined
    );
    setIsSubmitting(false);

    if (result.success) {
      setSuccessNotice(true);
      setTimeout(() => setSuccessNotice(false), 3000);
    }
  };

  const handleFinalize = async (slotId: string) => {
    if (!confirm('Lock this meeting time and notify participants?')) return;
    await finalizeMeetup(meetupId, slotId);
  };

  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
        <p className="text-xs text-slate-500 dark:text-slate-400">No proposed time slots yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Optimal Match Spotlight Banner */}
      {!isFinalized && optimalSlot && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
              <SparklesIcon className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Best Consensus Match
                </span>
                <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-300">
                  {optimalSlot.yesCount} Available · {optimalSlot.percentage}% Match
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {format(new Date(optimalSlot.slot.startsAt), 'EEEE, MMMM d · h:mm a')}
              </p>
            </div>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={() => handleFinalize(optimalSlot.slot.id)}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-emerald-500 transition-colors"
            >
              Lock & Finalize
            </button>
          )}
        </div>
      )}

      {/* Quorum Progress if applicable */}
      {minQuorum && (
        <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
          <span>
            Quorum Requirement: <strong className="text-slate-900 dark:text-slate-200">{minQuorum} attendees</strong>
          </span>
          <span className="font-mono">
            {Math.max(...slotStats.map((s) => s.yesCount))} / {minQuorum} confirmed
          </span>
        </div>
      )}

      {/* Time Slots Grid */}
      <div className="space-y-2.5">
        {slotStats.map(({ slot, yesCount, maybeCount, noCount, totalVotes, percentage }) => {
          const isSlotFinalized = isFinalized && finalizedSlotId === slot.id;
          const myChoice = userVotes[slot.id];

          return (
            <div
              key={slot.id}
              className={`rounded-xl border p-4 transition-all ${
                isSlotFinalized
                  ? 'border-brand-500 bg-brand-50/40 ring-2 ring-brand-500/20 dark:border-brand-600 dark:bg-brand-950/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Slot Info */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ClockIcon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {format(new Date(slot.startsAt), 'EEE, MMM d, yyyy · h:mm a')}
                    </span>
                    {slot.label && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {slot.label}
                      </span>
                    )}
                    {isSlotFinalized && (
                      <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                        Confirmed Time
                      </span>
                    )}
                  </div>

                  {/* Availability Bar & Percentages */}
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-36 rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800 flex">
                      <div
                        className="bg-emerald-500 transition-all duration-300"
                        style={{ width: `${Math.min(100, percentage)}%` }}
                      />
                      {maybeCount > 0 && totalVotes > 0 && (
                        <div
                          className="bg-amber-400 transition-all duration-300"
                          style={{ width: `${Math.min(100, (maybeCount / totalVotes) * 100)}%` }}
                        />
                      )}
                    </div>
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      <strong className="text-emerald-600 dark:text-emerald-400">{yesCount} Yes</strong>
                      {maybeCount > 0 && <span className="text-amber-600 dark:text-amber-400"> · {maybeCount} Maybe</span>}
                      {noCount > 0 && <span className="text-slate-400"> · {noCount} No</span>}
                    </span>
                  </div>
                </div>

                {/* Voting Actions */}
                {!isFinalized ? (
                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleSelectChoice(slot.id, 'YES')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                        myChoice === 'YES'
                          ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-emerald-950/40'
                      }`}
                    >
                      ✓ Free
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectChoice(slot.id, 'IF_NEEDED')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                        myChoice === 'IF_NEEDED'
                          ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-500/30'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-amber-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-amber-950/40'
                      }`}
                    >
                      ? If Need Be
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectChoice(slot.id, 'NO')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                        myChoice === 'NO'
                          ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-600/30'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-950/40'
                      }`}
                    >
                      ✕ Busy
                    </button>

                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleFinalize(slot.id)}
                        className="ml-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750"
                      >
                        Lock
                      </button>
                    )}
                  </div>
                ) : (
                  isSlotFinalized && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckIcon className="h-4 w-4" />
                      <span>Selected winning slot</span>
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Save Votes Floating Bar */}
      {!isFinalized && (
        <div className="flex items-center justify-between pt-2">
          {successNotice ? (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              ✓ Availability recorded!
            </span>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Select your availability above and click submit.
            </span>
          )}

          <button
            type="button"
            onClick={handleSaveVotes}
            disabled={isSubmitting}
            className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-brand-500 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Saving…' : 'Submit My Availability'}
          </button>
        </div>
      )}
    </div>
  );
}

