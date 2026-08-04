'use client';

import { useState } from 'react';
import { sendReminder } from '@/lib/actions/reminders';
import { scheduleReminder } from '@/lib/actions/scheduledReminders';

type ReminderMode = 'now' | 'later';

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

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
  const [mode, setMode] = useState<ReminderMode>('now');
  const [minDeliverAt] = useState(() => toDatetimeLocalValue(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setLoading(true);
    formData.set('recipientId', recipientId);
    if (taskId) formData.set('taskId', taskId);

    if (mode === 'later') {
      const result = await scheduleReminder(formData);
      setLoading(false);
      if (!result.success) {
        setError(result.error ?? 'Something went wrong.');
        return;
      }
      const deliverAtValue = formData.get('deliverAt');
      setScheduledFor(typeof deliverAtValue === 'string' && deliverAtValue ? new Date(deliverAtValue).toLocaleString() : null);
      setSent(true);
      return;
    }

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
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {sent
            ? mode === 'later'
              ? `Reminder scheduled for ${recipientName}`
              : `Reminder sent to ${recipientName}`
            : `Remind ${recipientName}`}
        </h2>

        {sent ? (
          <>
            <p className="mt-3 text-sm text-green-600">
              {mode === 'later'
                ? `Reminder scheduled for ${scheduledFor ?? 'the selected time'}.`
                : 'Reminder sent.'}
            </p>
            <div className="mt-4 flex justify-end">
              <button onClick={onClose} className="text-sm font-medium text-slate-500 hover:text-slate-700">
                Done
              </button>
            </div>
          </>
        ) : (
          <form action={handleSubmit} className="mt-4 space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('now')}
                aria-pressed={mode === 'now'}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  mode === 'now'
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                Send now
              </button>
              <button
                type="button"
                onClick={() => setMode('later')}
                aria-pressed={mode === 'later'}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  mode === 'later'
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                Schedule for later
              </button>
            </div>

            {mode === 'later' && (
              <div>
                <label
                  htmlFor="deliverAt"
                  className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Deliver at
                </label>
                <input
                  id="deliverAt"
                  type="datetime-local"
                  name="deliverAt"
                  required
                  min={minDeliverAt}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            )}

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
                {loading
                  ? mode === 'later'
                    ? 'Scheduling…'
                    : 'Sending…'
                  : mode === 'later'
                    ? 'Schedule reminder'
                    : 'Send reminder'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
