'use client';

import { useState, useTransition } from 'react';
import { NotificationType, DigestFrequency } from '@prisma/client';
import { setPreference, setDigestFrequency, setPreferredDigestHour } from '@/lib/actions/notificationPreferences';

const TYPE_LABELS: Record<NotificationType, string> = {
  TASK_ASSIGNED: 'Task assigned to you',
  COMMENT_ADDED: 'New comment on your task',
  PROJECT_INVITE: 'Added to a project',
  REMINDER: 'Reminder',
  MENTIONED: 'Mentioned in a comment',
  FORM_SUBMITTED: 'Intake form submitted',
};

const DIGEST_OPTIONS: { value: DigestFrequency; label: string }[] = [
  { value: 'OFF', label: 'Off' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
];

const HOUR_OPTIONS: { value: number; label: string }[] = Array.from({ length: 24 }, (_, hour) => {
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return { value: hour, label: `${displayHour}:00 ${period}` };
});

export function NotificationPreferencesForm({
  types,
  initialEmailByType,
  initialDigestFrequency,
  initialPreferredDigestHour,
}: {
  types: NotificationType[];
  initialEmailByType: Record<string, boolean>;
  initialDigestFrequency: DigestFrequency;
  initialPreferredDigestHour: number;
}) {
  const [emailByType, setEmailByType] = useState(initialEmailByType);
  const [digestFrequency, setDigestFrequencyState] = useState(initialDigestFrequency);
  const [preferredDigestHour, setPreferredDigestHourState] = useState(initialPreferredDigestHour);
  const [isPending, startTransition] = useTransition();

  function handleToggle(type: NotificationType, checked: boolean) {
    setEmailByType((prev) => ({ ...prev, [type]: checked }));
    startTransition(async () => {
      const result = await setPreference(type, checked);
      if (!result.success) setEmailByType((prev) => ({ ...prev, [type]: !checked }));
    });
  }

  function handleDigestChange(value: DigestFrequency) {
    const previous = digestFrequency;
    setDigestFrequencyState(value);
    startTransition(async () => {
      const result = await setDigestFrequency(value);
      if (!result.success) setDigestFrequencyState(previous);
    });
  }

  function handlePreferredHourChange(hour: number) {
    const previous = preferredDigestHour;
    setPreferredDigestHourState(hour);
    startTransition(async () => {
      const result = await setPreferredDigestHour(hour);
      if (!result.success) setPreferredDigestHourState(previous);
    });
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Email notifications</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Choose which activity sends you an email. In-app notifications are always created.
        </p>
        <div className="mt-4 space-y-2">
          {types.map((type) => (
            <label
              key={type}
              className="flex items-center justify-between gap-4 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
            >
              <span className="text-slate-700 dark:text-slate-300">{TYPE_LABELS[type] ?? type}</span>
              <input
                type="checkbox"
                checked={emailByType[type] ?? true}
                onChange={(e) => handleToggle(type, e.target.checked)}
              />
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Email digest</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Get a periodic summary of unread notifications instead of (or in addition to) individual emails.
        </p>
        <div className="mt-4 flex gap-4">
          {DIGEST_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="radio"
                name="digestFrequency"
                checked={digestFrequency === option.value}
                onChange={() => handleDigestChange(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>

        <label className="mt-4 flex items-center justify-between gap-4 text-sm text-slate-700 dark:text-slate-300">
          <span>Send around</span>
          <select
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            value={preferredDigestHour}
            disabled={digestFrequency === 'OFF'}
            onChange={(e) => handlePreferredHourChange(Number(e.target.value))}
          >
            {HOUR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {isPending && <p className="text-xs text-slate-400 dark:text-slate-500">Saving…</p>}
    </div>
  );
}
