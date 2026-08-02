'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTeam } from '@/lib/actions/teams';

export interface ManagerOption {
  id: string;
  name: string;
}

export function NewTeamModal({ managers, onClose }: { managers: ManagerOption[]; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setLoading(true);
    const result = await createTeam(formData);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? 'Something went wrong.');
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-slate-900">New team</h2>
        <form action={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="name">
              Team name
            </label>
            <input
              id="name"
              name="name"
              required
              placeholder="e.g. Facilities Crew"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="managerId">
              Manager
            </label>
            <select
              id="managerId"
              name="managerId"
              defaultValue=""
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">No manager assigned yet</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? 'Creating…' : 'Create team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
