// src/components/meetups/AudienceSection.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateMeetupAudience } from '@/lib/actions/meetups';

export interface AudienceSectionProps {
  meetupId: string;
  isAllChurch: boolean;
  canManage: boolean;
  shares: Array<{
    id: string;
    teamId?: string | null;
    userId?: string | null;
    team?: { id: string; name: string } | null;
    user?: { id: string; name: string | null; email: string } | null;
  }>;
  availableTeams: Array<{ id: string; name: string }>;
  availableUsers: Array<{ id: string; name: string | null; email: string }>;
}

export function AudienceSection({
  meetupId,
  isAllChurch,
  canManage,
  shares,
  availableTeams,
  availableUsers,
}: AudienceSectionProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialTeamIds = shares.filter((s) => s.teamId).map((s) => s.teamId!);
  const initialUserIds = shares.filter((s) => s.userId).map((s) => s.userId!);

  const [editIsAllChurch, setEditIsAllChurch] = useState(isAllChurch);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(initialTeamIds);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(initialUserIds);

  const handleSave = async () => {
    setError(null);
    setLoading(true);

    const result = await updateMeetupAudience(meetupId, {
      isAllChurch: editIsAllChurch,
      targetTeamIds: editIsAllChurch ? [] : selectedTeamIds,
      targetUserIds: editIsAllChurch ? [] : selectedUserIds,
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setIsEditing(false);
    router.refresh();
  };

  const sharedTeams = shares.filter((s) => s.team).map((s) => s.team!);
  const sharedUsers = shares.filter((s) => s.user).map((s) => s.user!);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Audience & Sharing</span>
            {isAllChurch ? (
              <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                🌐 Staff-Wide (Logins)
              </span>
            ) : (sharedTeams.length > 0 || sharedUsers.length > 0) ? (
              <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                👥 Targeted ({sharedTeams.length} teams, {sharedUsers.length} people)
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                🔒 Private
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isAllChurch
              ? 'Solely visible to church staff and volunteers with logins. External visitors cannot see this without a public link.'
              : 'Only invited teams, specific individuals, and the organizer can view this meetup.'}
          </p>
        </div>

        {canManage && !isEditing && (
          <button
            type="button"
            onClick={() => {
              setEditIsAllChurch(isAllChurch);
              setSelectedTeamIds(initialTeamIds);
              setSelectedUserIds(initialUserIds);
              setIsEditing(true);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 transition-colors shrink-0 shadow-sm"
          >
            Edit Audience
          </button>
        )}
      </div>

      {!isEditing ? (
        <div className="space-y-3 pt-1">
          {isAllChurch ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 dark:border-blue-900/60 dark:bg-blue-950/30 text-xs text-blue-800 dark:text-blue-300">
              <p className="font-semibold">Open to all church staff & accounts</p>
              <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80 mt-0.5">
                Every member who signs in can see this on the calendar and submit availability votes or volunteer claims.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sharedTeams.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                    Invited Teams ({sharedTeams.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {sharedTeams.map((team) => (
                      <span
                        key={team.id}
                        className="inline-flex items-center gap-1 rounded-md bg-purple-50 border border-purple-200 px-2.5 py-1 text-xs font-medium text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800"
                      >
                        👥 {team.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {sharedUsers.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                    Invited Members ({sharedUsers.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {sharedUsers.map((user) => (
                      <span
                        key={user.id}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                      >
                        👤 {user.name || user.email}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {sharedTeams.length === 0 && sharedUsers.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center dark:border-slate-800 text-xs text-slate-400">
                  🔒 Private meeting. Only you as organizer can view this event. Click &quot;Edit Audience&quot; above to invite teams or people.
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Edit Mode Form */
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-850/70 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEditIsAllChurch(false)}
              className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                !editIsAllChurch
                  ? 'border-brand-500 bg-white shadow-sm ring-1 ring-brand-500/20 dark:border-brand-500 dark:bg-slate-800'
                  : 'border-slate-200 bg-white/60 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
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
              onClick={() => setEditIsAllChurch(true)}
              className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                editIsAllChurch
                  ? 'border-brand-500 bg-white shadow-sm ring-1 ring-brand-500/20 dark:border-brand-500 dark:bg-slate-800'
                  : 'border-slate-200 bg-white/60 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <span className="text-xl">🌐</span>
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Staff-Wide (All Logins)
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Visible to all church members with logins
                </p>
              </div>
            </button>
          </div>

          {!editIsAllChurch && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              {availableTeams.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Select Teams ({selectedTeamIds.length} selected)
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
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

              {availableUsers.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Select Members ({selectedUserIds.length} selected)
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
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
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={loading}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-500 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Save Audience'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
