// src/components/meetups/MeetingRosterCard.tsx
'use client';

import React, { useState } from 'react';
import { UtensilsIcon, ClipboardListIcon, CheckIcon, PlusIcon, TrashIcon } from '@/components/MeetupIcons';
import { claimSignupSlot, unclaimSignupSlot } from '@/lib/actions/meetups';

export interface RosterClaim {
  id: string;
  userId?: string | null;
  claimerName: string;
  notes?: string | null;
  user?: { id: string; name: string | null } | null;
}

export interface RosterSlot {
  id: string;
  title: string;
  category: string;
  capacity: number;
  claimedCount: number;
  claims: RosterClaim[];
}

export interface MeetingRosterProps {
  meetupId: string;
  slots: RosterSlot[];
  isPotluck: boolean;
  currentUserId?: string | null;
}

export function MeetingRosterCard({ meetupId, slots, isPotluck, currentUserId }: MeetingRosterProps) {
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClaim = async (slotId: string) => {
    setError(null);
    setIsSubmitting(true);
    const result = await claimSignupSlot(slotId, nameInput, notesInput);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setActiveSlotId(null);
    setNameInput('');
    setNotesInput('');
  };

  const handleUnclaim = async (claimId: string) => {
    if (!confirm('Release this claim?')) return;
    await unclaimSignupSlot(claimId);
  };

  if (slots.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {isPotluck ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <UtensilsIcon className="h-4 w-4" />
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <ClipboardListIcon className="h-4 w-4" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {isPotluck ? 'Potluck Dishes & Supplies Roster' : 'Meeting Roles & Logistics'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isPotluck
                ? 'Coordinate main courses, sides, drinks, and tableware'
                : 'Key meeting responsibilities and preparation assignments'}
            </p>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
        {slots.map((slot: RosterSlot) => {
          const isFilled = slot.claimedCount >= slot.capacity;
          const isSelected = activeSlotId === slot.id;

          return (
            <div key={slot.id} className="py-3.5 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {slot.title}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {slot.category}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                    {slot.claimedCount} of {slot.capacity} claimed
                  </p>
                </div>

                {!isFilled && !isSelected && (
                  <button
                    type="button"
                    onClick={() => setActiveSlotId(slot.id)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-brand-400 dark:hover:bg-brand-950/40 transition-colors"
                  >
                    + Claim
                  </button>
                )}

                {isFilled && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    Filled
                  </span>
                )}
              </div>

              {/* Claims List */}
              {slot.claims.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {slot.claims.map((claim: RosterClaim) => {
                    const isMyClaim = currentUserId && claim.userId === currentUserId;
                    return (
                      <span
                        key={claim.id}
                        className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700 border border-slate-200 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-300"
                      >
                        <span className="font-medium">{claim.claimerName}</span>
                        {claim.notes && (
                          <span className="text-[11px] text-slate-400 italic">({claim.notes})</span>
                        )}
                        {isMyClaim && (
                          <button
                            type="button"
                            onClick={() => handleUnclaim(claim.id)}
                            title="Release item"
                            className="text-slate-400 hover:text-rose-500 ml-1"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Inline Claim Form */}
              {isSelected && (
                <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-3 dark:border-brand-900/60 dark:bg-brand-950/20 space-y-2 mt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Your name"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                    <input
                      type="text"
                      placeholder="Dish / notes (optional)"
                      value={notesInput}
                      onChange={(e) => setNotesInput(e.target.value)}
                      className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveSlotId(null)}
                      className="rounded px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleClaim(slot.id)}
                      className="rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-brand-500 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Claiming…' : 'Confirm Claim'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
