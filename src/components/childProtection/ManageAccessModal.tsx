'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import {
  listChildProtectionShares,
  createChildProtectionShare,
  deleteChildProtectionShare,
} from '@/lib/actions/childProtection';
import { getTeamsForWorkflowPicker } from '@/lib/actions/workflows';

interface AssignableUser {
  id: string;
  name: string;
  email: string;
}

interface TeamItem {
  id: string;
  name: string;
}

interface ChildProtectionShareItem {
  id: string;
  access: 'VIEW' | 'EDIT';
  createdAt: Date | string;
  userId: string | null;
  teamId: string | null;
  user: { id: string; name: string; email: string } | null;
  team: { id: string; name: string } | null;
}

interface ManageAccessModalProps {
  assignableUsers: AssignableUser[];
  onClose: () => void;
  onFeedback: (msg: { type: 'success' | 'error'; text: string }) => void;
}

export function ManageAccessModal({
  assignableUsers,
  onClose,
  onFeedback,
}: ManageAccessModalProps) {
  const [shares, setShares] = useState<ChildProtectionShareItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [isLoadingShares, setIsLoadingShares] = useState(true);
  const [shareType, setShareType] = useState<'PERSON' | 'TEAM'>('PERSON');
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [access, setAccess] = useState<'VIEW' | 'EDIT'>('VIEW');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      setIsLoadingShares(true);
      setError(null);
      try {
        const [sharesRes, loadedTeams] = await Promise.all([
          listChildProtectionShares(),
          getTeamsForWorkflowPicker(),
        ]);

        if (!isMounted) return;

        if (sharesRes.success && sharesRes.data) {
          setShares(sharesRes.data as ChildProtectionShareItem[]);
        } else if (sharesRes.error) {
          setError(sharesRes.error);
        }

        if (Array.isArray(loadedTeams)) {
          setTeams(loadedTeams);
        }
      } catch {
        if (isMounted) {
          setError('Failed to load access shares or teams.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingShares(false);
        }
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    setError(null);

    const res = await deleteChildProtectionShare(id);
    setRevokingId(null);

    if (res.success) {
      setShares((prev) => prev.filter((s) => s.id !== id));
      onFeedback({ type: 'success', text: 'Access revoked successfully.' });
    } else {
      const errMsg = res.error || 'Failed to revoke access.';
      setError(errMsg);
      onFeedback({ type: 'error', text: errMsg });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTargetId) return;

    setIsSubmitting(true);
    setError(null);

    const payload =
      shareType === 'PERSON'
        ? { userId: selectedTargetId, access }
        : { teamId: selectedTargetId, access };

    const res = await createChildProtectionShare(payload);
    setIsSubmitting(false);

    if (res.success && res.data) {
      const created = res.data;
      const rawUser =
        'user' in created && created.user ? (created.user as AssignableUser) : null;
      const rawTeam =
        'team' in created && created.team ? (created.team as TeamItem) : null;

      const resolvedShare: ChildProtectionShareItem = {
        id: created.id,
        access: created.access,
        createdAt: created.createdAt,
        userId: created.userId,
        teamId: created.teamId,
        user:
          rawUser ??
          (created.userId
            ? assignableUsers.find((u) => u.id === created.userId) ?? null
            : null),
        team:
          rawTeam ??
          (created.teamId
            ? teams.find((t) => t.id === created.teamId) ?? null
            : null),
      };

      setShares((prev) => {
        const idx = prev.findIndex((s) => s.id === resolvedShare.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = resolvedShare;
          return updated;
        }
        return [...prev, resolvedShare];
      });

      setSelectedTargetId('');
      onFeedback({ type: 'success', text: 'Access granted successfully.' });
    } else {
      const errMsg = res.error || 'Failed to grant access.';
      setError(errMsg);
      onFeedback({ type: 'error', text: errMsg });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 my-8">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Manage Access
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure user and team access to child protection records
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-2 text-sm">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Who has access
          </h3>

          {isLoadingShares ? (
            <p className="py-2 text-sm text-slate-500 dark:text-slate-400">
              Loading…
            </p>
          ) : shares.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
              Only admins can see child protection records until access is granted.
            </div>
          ) : (
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {shares.map((share) => {
                const user =
                  share.user ??
                  (share.userId
                    ? assignableUsers.find((u) => u.id === share.userId) ?? null
                    : null);
                const team =
                  share.team ??
                  (share.teamId
                    ? teams.find((t) => t.id === share.teamId) ?? null
                    : null);
                const isRevoking = revokingId === share.id;

                return (
                  <div
                    key={share.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/30"
                  >
                    <div className="min-w-0 flex-1">
                      {user ? (
                        <div>
                          <div className="truncate text-sm font-medium text-slate-900 dark:text-white">
                            {user.name}
                          </div>
                          <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {user.email}
                          </div>
                        </div>
                      ) : team ? (
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-slate-900 dark:text-white">
                            {team.name}
                          </span>
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                            Team
                          </span>
                        </div>
                      ) : (
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {share.userId ?? share.teamId ?? 'Unknown'}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {share.access === 'EDIT' ? (
                        <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                          EDIT
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          VIEW
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRevoke(share.id)}
                        disabled={isRevoking}
                        className="text-xs font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50 dark:text-rose-400 dark:hover:text-rose-300"
                      >
                        {isRevoking ? 'Revoking…' : 'Revoke'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Grant access
          </h3>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Type
            </label>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShareType('PERSON');
                  setSelectedTargetId('');
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  shareType === 'PERSON'
                    ? 'bg-indigo-600 text-white shadow-sm dark:bg-indigo-600 dark:text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Person
              </button>
              <button
                type="button"
                onClick={() => {
                  setShareType('TEAM');
                  setSelectedTargetId('');
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  shareType === 'TEAM'
                    ? 'bg-indigo-600 text-white shadow-sm dark:bg-indigo-600 dark:text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Team
              </button>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              {shareType === 'PERSON' ? 'Person' : 'Team'}
            </label>
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">
                {shareType === 'PERSON' ? 'Select a person…' : 'Select a team…'}
              </option>
              {shareType === 'PERSON'
                ? assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))
                : teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Access level
            </label>
            <select
              value={access}
              onChange={(e) => setAccess(e.target.value as 'VIEW' | 'EDIT')}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="VIEW">VIEW</option>
              <option value="EDIT">EDIT</option>
            </select>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedTargetId}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Granting…' : 'Grant access'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
