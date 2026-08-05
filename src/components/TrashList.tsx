'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { permanentlyDeleteTask, restoreTask } from '@/lib/actions/trash';

export interface TrashEntry {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  sectionName: string;
  deletedAt: string;
  purgesAt: string;
  parentTaskTitle: string | null;
}

export function TrashList({ entries }: { entries: TrashEntry[] }) {
  const [items, setItems] = useState(entries);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function handleRestore(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await restoreTask(id);
      if (result.success) setItems((prev) => prev.filter((t) => t.id !== id));
      setPendingId(null);
    });
  }

  function handleDeleteForever(id: string, title: string) {
    if (!confirm(`Permanently delete "${title}"? This cannot be undone.`)) return;
    setPendingId(id);
    startTransition(async () => {
      const result = await permanentlyDeleteTask(id);
      if (result.success) setItems((prev) => prev.filter((t) => t.id !== id));
      setPendingId(null);
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-500 dark:text-slate-500">
        Your trash is empty.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800">
      <ul className="divide-y divide-slate-100 dark:divide-slate-700">
        {items.map((task) => (
          <li key={task.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                {task.parentTaskTitle && (
                  <span className="font-normal text-slate-400 dark:text-slate-500">{task.parentTaskTitle} / </span>
                )}
                {task.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                <Link href={`/projects/${task.projectId}`} className="hover:underline">
                  {task.projectName}
                </Link>
                {' · '}
                {task.sectionName}
                {' · '}
                Deleted {formatDistanceToNow(new Date(task.deletedAt), { addSuffix: true })}
                {' · '}
                Purges {formatDistanceToNow(new Date(task.purgesAt), { addSuffix: true })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => handleRestore(task.id)}
                disabled={isPending && pendingId === task.id}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Restore
              </button>
              <button
                onClick={() => handleDeleteForever(task.id, task.title)}
                disabled={isPending && pendingId === task.id}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                Delete forever
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
