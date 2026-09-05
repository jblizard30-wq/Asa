'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { bulkDeleteUsers, bulkUpdateUserRole, deleteUser, sendUserInvite, updateUserRole } from '@/lib/actions/users';
import { NewUserModal } from './NewUserModal';
import { EditUserModal } from './EditUserModal';
import { ResetPasswordModal } from './ResetPasswordModal';

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  teams: string[];
}

export const ROLES = ['ADMIN', 'MANAGER', 'USER'] as const;

interface LinkModalState {
  title: string;
  link: string;
  message: string;
}

export function UserManagement({ currentUserId, users }: { currentUserId: string; users: ManagedUser[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNewUser, setShowNewUser] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [resetUser, setResetUser] = useState<ManagedUser | null>(null);
  const [linkModal, setLinkModal] = useState<LinkModalState | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkPending, startBulkTransition] = useTransition();

  const selectableIds = useMemo(() => users.filter((u) => u.id !== currentUserId).map((u) => u.id), [users, currentUserId]);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(selectableIds));
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function withErrorHandling(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    const result = await action();
    if (!result.success) {
      setError(result.error ?? 'Something went wrong.');
      return;
    }
    router.refresh();
  }

  async function handleRoleChange(userId: string, role: string) {
    setError(null);
    setPendingId(userId);
    const result = await updateUserRole(userId, role);
    setPendingId(null);
    if (!result.success) {
      setError(result.error ?? 'Could not update role');
      return;
    }
    router.refresh();
  }

  async function handleSendInvite(user: ManagedUser) {
    setError(null);
    setInvitingId(user.id);
    const result = await sendUserInvite(user.id);
    setInvitingId(null);

    if (!result.success) {
      setError(result.error ?? 'Could not send invitation email.');
      return;
    }

    if (result.inviteUrl) {
      setLinkModal({
        title: 'Invitation Sent',
        link: result.inviteUrl,
        message: `An invitation email with a 7-day setup link was sent to ${user.email}. You can also copy the direct link below:`,
      });
    }
    router.refresh();
  }

  async function handleCopyLink() {
    if (!linkModal?.link) return;
    let copied = false;
    try {
      await navigator.clipboard.writeText(linkModal.link);
      copied = true;
    } catch {
      const input = document.getElementById('linkModalInput') as HTMLInputElement | null;
      if (input) {
        input.select();
        copied = document.execCommand('copy');
      }
    }
    if (copied) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  }

  function handleDelete(user: ManagedUser) {
    if (confirm(`Delete "${user.name}"? Their tasks, comments, and other records will be reassigned to you.`)) {
      void withErrorHandling(() => deleteUser(user.id));
    }
  }

  function handleBulkRoleChange(role: string) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setError(null);
    startBulkTransition(async () => {
      const result = await bulkUpdateUserRole(ids, role);
      if (!result.success) {
        setError(result.error ?? 'Could not update roles');
        return;
      }
      router.refresh();
    });
  }

  function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (
      !confirm(
        `Delete ${ids.length} user${ids.length === 1 ? '' : 's'}? Their tasks, comments, and other records will be reassigned to you.`,
      )
    ) {
      return;
    }
    setError(null);
    startBulkTransition(async () => {
      const result = await bulkDeleteUsers(ids);
      if (!result.success) {
        setError(result.error ?? 'Could not delete users');
        return;
      }
      setSelectedIds(new Set());
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">User Management</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage staff accounts, send login invitations, and reset passwords. Only administrators can access this section.
          </p>
        </div>
        <button
          onClick={() => setShowNewUser(true)}
          className="shrink-0 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + New user
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {selectedIds.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm dark:border-brand-800 dark:bg-brand-950/40">
          <span className="text-slate-700 dark:text-slate-200">{selectedIds.size} selected</span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              Set role
              <select
                defaultValue=""
                disabled={isBulkPending}
                onChange={(e) => {
                  if (e.target.value) handleBulkRoleChange(e.target.value);
                  e.target.value = '';
                }}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="" disabled>
                  Choose…
                </option>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role.charAt(0) + role.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={clearSelection}
              disabled={isBulkPending}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Clear
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isBulkPending}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {isBulkPending ? 'Working…' : `Delete (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 overflow-hidden overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-900/60">
            <tr>
              <th className="w-10 px-4 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={selectableIds.length === 0}
                  aria-label="Select all users"
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
                />
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Name
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Email
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Teams
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Role
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
            {users.map((user) => (
              <tr key={user.id} className={selectedIds.has(user.id) ? 'bg-brand-50/60 dark:bg-brand-950/20' : undefined}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(user.id)}
                    onChange={() => toggleOne(user.id)}
                    disabled={user.id === currentUserId || isBulkPending}
                    aria-label={`Select ${user.name}`}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-40 dark:border-slate-600"
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                  {user.name}
                  {user.id === currentUserId && (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      You
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{user.email}</td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                  {user.teams.length > 0 ? user.teams.join(', ') : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <select
                    value={user.role}
                    disabled={user.id === currentUserId || pendingId === user.id || isBulkPending}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role.charAt(0) + role.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleSendInvite(user)}
                      disabled={invitingId === user.id}
                      title="Send or resend first-time login invitation email"
                      className="text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50 dark:text-emerald-400"
                    >
                      {invitingId === user.id ? 'Sending…' : 'Invite'}
                    </button>
                    <button
                      onClick={() => setResetUser(user)}
                      className="text-xs font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400"
                    >
                      Reset pass
                    </button>
                    <button
                      onClick={() => setEditingUser(user)}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      disabled={user.id === currentUserId}
                      className="text-xs font-medium text-red-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showNewUser && (
        <NewUserModal
          onClose={() => setShowNewUser(false)}
          onShowLinkModal={(title, link, message) => setLinkModal({ title, link, message })}
        />
      )}

      {editingUser && <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} />}

      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          onClose={() => setResetUser(null)}
          onShowLinkModal={(title, link, message) => setLinkModal({ title, link, message })}
        />
      )}

      {/* Direct link sharing modal */}
      {linkModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => {
            setLinkModal(null);
            setCopiedLink(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{linkModal.title}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{linkModal.message}</p>

            <div className="mt-4 flex gap-2">
              <input
                id="linkModalInput"
                type="text"
                readOnly
                value={linkModal.link}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono select-all focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="shrink-0 rounded-md bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700"
              >
                {copiedLink ? '✓ Copied' : 'Copy'}
              </button>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setLinkModal(null);
                  setCopiedLink(false);
                }}
                className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
