'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  addTeamMember,
  deleteTeam,
  moveTeamMember,
  removeTeamMember,
  setTeamManager,
} from '@/lib/actions/teams';
import { NewTeamModal, type ManagerOption } from '@/components/NewTeamModal';

export interface TeamMemberInfo {
  id: string;
  name: string;
}

export interface TeamInfo {
  id: string;
  name: string;
  managerId: string | null;
  managerName: string | null;
  members: TeamMemberInfo[];
}

export interface UserOption {
  id: string;
  name: string;
  email: string;
}

export interface TeamOption {
  id: string;
  name: string;
}

export function TeamsManager({
  teams,
  allTeamOptions,
  allUsers,
  managers,
  isAdmin,
}: {
  teams: TeamInfo[];
  allTeamOptions: TeamOption[];
  allUsers: UserOption[];
  managers: ManagerOption[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withErrorHandling(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    const result = await action();
    if (!result.success) {
      setError(result.error ?? 'Something went wrong.');
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Teams</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAdmin
              ? 'Every team in the system. Assign a manager to each one.'
              : 'Teams you manage. Move members between teams, or invite new ones.'}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowNewTeam(true)}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + New team
          </button>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {teams.map((team) => (
          <div key={team.id} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold text-slate-900">{team.name}</h2>
              {isAdmin && (
                <button
                  onClick={() => {
                    if (confirm(`Delete "${team.name}"? Members will be removed from it.`)) {
                      void withErrorHandling(() => deleteTeam(team.id));
                    }
                  }}
                  className="shrink-0 text-xs font-medium text-red-500 hover:text-red-600"
                >
                  Delete
                </button>
              )}
            </div>

            <div className="mt-2">
              <label className="block text-xs font-medium text-slate-500">Manager</label>
              {isAdmin ? (
                <select
                  defaultValue={team.managerId ?? ''}
                  onChange={(e) => void withErrorHandling(() => setTeamManager(team.id, e.target.value || null))}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                >
                  <option value="">No manager assigned</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-1 text-sm text-slate-600">{team.managerName ?? 'Unassigned'}</p>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-500">
                Members ({team.members.length})
              </label>
              <ul className="mt-1 space-y-1">
                {team.members.length === 0 && <li className="text-sm text-slate-400">No members yet.</li>}
                {team.members.map((member) => (
                  <li key={member.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-slate-700">{member.name}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const toTeamId = e.target.value;
                          if (!toTeamId) return;
                          void withErrorHandling(() => moveTeamMember(member.id, team.id, toTeamId));
                          e.target.value = '';
                        }}
                        className="rounded-md border border-slate-200 px-1.5 py-1 text-xs text-slate-600"
                      >
                        <option value="">Move to…</option>
                        {allTeamOptions
                          .filter((t) => t.id !== team.id)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={() => void withErrorHandling(() => removeTeamMember(team.id, member.id))}
                        className="text-xs font-medium text-slate-400 hover:text-red-500"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-3">
              <select
                defaultValue=""
                onChange={(e) => {
                  const userId = e.target.value;
                  if (!userId) return;
                  void withErrorHandling(() => addTeamMember(team.id, userId));
                  e.target.value = '';
                }}
                className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-500"
              >
                <option value="">+ Add member…</option>
                {allUsers
                  .filter((u) => !team.members.some((m) => m.id === u.id))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
              </select>
            </div>
          </div>
        ))}

        {teams.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
            {isAdmin ? 'No teams yet. Create one to get started.' : "You don't manage any teams yet."}
          </div>
        )}
      </div>

      {showNewTeam && <NewTeamModal managers={managers} onClose={() => setShowNewTeam(false)} />}
    </div>
  );
}
