'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateUserRole } from '@/lib/actions/users';

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  teams: string[];
}

const ROLES = ['ADMIN', 'MANAGER', 'USER'] as const;

export function UserManagement({ currentUserId, users }: { currentUserId: string; users: ManagedUser[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">User Management</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage staff accounts and their access level. Only administrators can see this page.
        </p>
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
              </tr>
            ))}

            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
