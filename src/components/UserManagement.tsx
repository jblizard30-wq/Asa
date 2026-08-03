'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteUser, updateUserRole } from '@/lib/actions/users';
import { NewUserModal } from './NewUserModal';
import { EditUserModal } from './EditUserModal';

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  teams: string[];
}

export const ROLES = ['ADMIN', 'MANAGER', 'USER'] as const;

export function UserManagement({ currentUserId, users }: { currentUserId: string; users: ManagedUser[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNewUser, setShowNewUser] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);

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

  function handleDelete(user: ManagedUser) {
    if (confirm(`Delete "${user.name}"? Their tasks, comments, and other records will be reassigned to you.`)) {
      void withErrorHandling(() => deleteUser(user.id));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">User Management</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage staff accounts and their access level. Only administrators can see this page.
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

      <div className="mt-6 overflow-hidden overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-900/60">
            <tr>
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
              <tr key={user.id}>
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
                    disabled={user.id === currentUserId || pendingId === user.id}
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
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showNewUser && <NewUserModal onClose={() => setShowNewUser(false)} />}
      {editingUser && <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} />}
    </div>
  );
}
