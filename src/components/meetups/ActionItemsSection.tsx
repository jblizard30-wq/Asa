// src/components/meetups/ActionItemsSection.tsx
'use client';

import React, { useState } from 'react';
import { ClipboardListIcon, PlusIcon, CheckIcon, TrashIcon } from '@/components/MeetupIcons';
import { convertActionItemsToTasks } from '@/lib/actions/meetups';

export interface ActionItemsSectionProps {
  meetupId: string;
  canManage: boolean;
}

export function ActionItemsSection({ meetupId, canManage }: ActionItemsSectionProps) {
  const [items, setItems] = useState<Array<{ id: string; title: string }>>([
    { id: '1', title: '' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addItem = () => {
    setItems((prev) => [...prev, { id: Date.now().toString(), title: '' }]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateTitle = (id: string, title: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, title } : item)));
  };

  const handleConvert = async () => {
    const validItems = items.filter((item) => item.title.trim().length > 0);
    if (validItems.length === 0) return;

    setError(null);
    setIsSubmitting(true);
    const result = await convertActionItemsToTasks(
      meetupId,
      validItems.map((i) => ({ title: i.title }))
    );
    setIsSubmitting(false);

    if (result.success) {
      setSuccessCount(result.taskCount);
      setItems([{ id: Date.now().toString(), title: '' }]);
      setTimeout(() => setSuccessCount(null), 4000);
    } else {
      setError(result.error);
    }
  };

  if (!canManage) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
            <ClipboardListIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Meeting Action Items → Tasks
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Turn key decisions and next steps directly into assigned CPCana project tasks
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750 transition-colors"
        >
          <PlusIcon className="h-3 w-3" />
          <span>Add item</span>
        </button>
      </div>

      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      {successCount !== null && (
        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          ✓ Successfully created {successCount} task{successCount === 1 ? '' : 's'} in CPCana!
        </p>
      )}

      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={item.id} className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-400 dark:text-slate-500 w-4 text-right">
              {idx + 1}.
            </span>
            <input
              type="text"
              placeholder="e.g. Schedule follow-up budget review with treasurer"
              value={item.title}
              onChange={(e) => updateTitle(item.id, e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="text-slate-400 hover:text-rose-500 p-1"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleConvert}
          disabled={isSubmitting || items.every((i) => !i.title.trim())}
          className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Creating Tasks…' : 'Generate CPCana Tasks'}
        </button>
      </div>
    </div>
  );
}

