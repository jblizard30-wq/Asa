'use client';

import { useState } from 'react';
import { scheduleSelfReminder } from '@/lib/actions/scheduledReminders';

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

export function RemindMeModal({
  taskId,
  taskTitle,
  dueDate,
  onClose,
}: {
  taskId: string;
  taskTitle: string;
  dueDate: string | null;
  onClose: () => void;
}) {
  const [minDeliverAt] = useState(() => toDatetimeLocalValue(new Date()));
  const [defaultDeliverAt] = useState(() => {
    if (!dueDate) return '';
    const morningOf = new Date(dueDate);
    morningOf.setHours(8, 0, 0, 0);
    return toDatetimeLocalValue(morningOf);
  });
  const [error, setError] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setLoading(true);
    formData.set('taskId', taskId);
    const result = await scheduleSelfReminder(formData);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? 'Something went wrong.');
      return;
    }
    setScheduled(true);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {scheduled ? 'Reminder set' : `Remind me about "${taskTitle}"`}
        </h2>

        {scheduled ? (
          <>
            <p className="mt-3 text-sm text-green-600 dark:text-green-400">
              You&apos;ll get an email at the time you chose — independent of your daily digest.
            </p>
            <div className="mt-4 flex justify-end">
              <button onClick={onClose} className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400">
                Done
              </button>
            </div>
          </>
        ) : (
          <form action={handleSubmit} className="mt-4 space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              For time-critical tasks where tomorrow&apos;s digest isn&apos;t soon enough.
            </p>
            <div>
              <label
                htmlFor="deliverAt"
                className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                Remind me at
              </label>
              <input
                id="deliverAt"
                type="datetime-local"
                name="deliverAt"
                required
                min={minDeliverAt}
                defaultValue={defaultDeliverAt}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {loading ? 'Setting…' : 'Set reminder'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
