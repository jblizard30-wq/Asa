'use client';

import { useState } from 'react';
import { sendReminder } from '@/lib/actions/reminders';

export function SendReminderModal({
  recipientId,
  recipientName,
  taskId,
  onClose,
}: {
  recipientId: string;
  recipientName: string;
  taskId?: string;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setLoading(true);
    formData.set('recipientId', recipientId);
    if (taskId) formData.set('taskId', taskId);
    const result = await sendReminder(formData);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? 'Something went wrong.');
      return;
    }
    setSent(true);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Remind {recipientName}</h2>

        {sent ? (
          <>
            <p className="mt-3 text-sm text-green-600">Reminder sent.</p>
            <div className="mt-4 flex justify-end">
              <button onClick={onClose} className="text-sm font-medium text-slate-500 hover:text-slate-700">
                Done
              </button>
            </div>
          </>
        ) : (
          <form action={handleSubmit} className="mt-4 space-y-3">
            <textarea
              name="message"
              required
              rows={3}
              autoFocus
              placeholder="e.g. Just checking in — could you take a look at this today?"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {loading ? 'Sending…' : 'Send reminder'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
