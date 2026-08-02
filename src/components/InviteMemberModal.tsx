'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { inviteMemberToProject } from '@/lib/actions/projects';

export function InviteMemberModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);
    setLoading(true);
    const result = await inviteMemberToProject(projectId, formData);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? 'Something went wrong.');
      return;
    }
    setSuccess('Member added to the project.');
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900 dark:shadow-slate-950/50" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Invite a member</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Enter the email of a staff member who already has an account.
        </p>
        <form action={handleSubmit} className="mt-4 flex gap-2">
          <input
            name="email"
            type="email"
            required
            placeholder="name@example.org"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          />
          <button
            type="submit"
            disabled={loading}
            className="shrink-0 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? 'Inviting…' : 'Invite'}
          </button>
        </form>

        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {success && <p className="mt-2 text-sm text-green-600 dark:text-green-400">{success}</p>}

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
