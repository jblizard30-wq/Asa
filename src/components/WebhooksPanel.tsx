'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { WebhookEvent } from '@prisma/client';
import { createWebhook, toggleWebhook, deleteWebhook } from '@/lib/actions/webhooks';

export interface WebhookSummary {
  id: string;
  url: string;
  events: WebhookEvent[];
  isActive: boolean;
  createdAt: string;
}

const ALL_EVENTS: WebhookEvent[] = ['TASK_CREATED', 'TASK_UPDATED', 'TASK_COMPLETED', 'TASK_DELETED', 'COMMENT_ADDED'];

const EVENT_LABELS: Record<WebhookEvent, string> = {
  TASK_CREATED: 'Task created',
  TASK_UPDATED: 'Task updated',
  TASK_COMPLETED: 'Task completed',
  TASK_DELETED: 'Task deleted',
  COMMENT_ADDED: 'Comment added',
};

export function WebhooksPanel({ initialWebhooks }: { initialWebhooks: WebhookSummary[] }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>([]);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleEvent(event: WebhookEvent) {
    setSelectedEvents((prev) => (prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]));
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createWebhook(url.trim(), selectedEvents);
      if (!result.success) {
        setError(result.error ?? 'Could not create webhook');
        return;
      }
      setRevealedSecret(result.secret);
      setUrl('');
      setSelectedEvents([]);
      router.refresh();
    });
  }

  function handleToggle(id: string) {
    startTransition(async () => {
      await toggleWebhook(id);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteWebhook(id);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="space-y-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.org/webhook"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        <div className="flex flex-wrap gap-3">
          {ALL_EVENTS.map((event) => (
            <label key={event} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={selectedEvents.includes(event)} onChange={() => toggleEvent(event)} />
              {EVENT_LABELS[event]}
            </label>
          ))}
        </div>
        <button
          onClick={handleCreate}
          disabled={isPending || !url.trim() || selectedEvents.length === 0}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          Create webhook
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {revealedSecret && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
            Signing secret &mdash; copy it now, it won&apos;t be shown again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md bg-white px-2 py-1.5 text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200">
              {revealedSecret}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(revealedSecret)}
              className="shrink-0 rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-white dark:border-slate-600 dark:text-slate-300"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {initialWebhooks.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500">No webhooks yet.</p>
        )}
        {initialWebhooks.map((webhook) => (
          <div
            key={webhook.id}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="truncate font-medium text-slate-700 dark:text-slate-300">{webhook.url}</p>
              <div className="flex shrink-0 items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <input type="checkbox" checked={webhook.isActive} onChange={() => handleToggle(webhook.id)} />
                  Active
                </label>
                <button
                  onClick={() => handleDelete(webhook.id)}
                  className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {webhook.events.map((e) => EVENT_LABELS[e]).join(', ')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
