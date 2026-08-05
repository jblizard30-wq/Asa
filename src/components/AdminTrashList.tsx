'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { permanentlyDeleteTask, restoreTask } from '@/lib/actions/trash';

export interface AdminTrashEntry {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  sectionName: string;
  deletedByName: string;
  deletedAt: string;
  purgesAt: string;
  parentTaskTitle: string | null;
}

export function AdminTrashList({ entries }: { entries: AdminTrashEntry[] }) {
  const [items, setItems] = useState(entries);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmingRestore, setConfirmingRestore] = useState<AdminTrashEntry | null>(null);

  function commitRestore(id: string) {
    setConfirmingRestore(null);
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
        Nothing in anyone&apos;s trash right now.
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
                Deleted by {task.deletedByName}{' '}
                {formatDistanceToNow(new Date(task.deletedAt), { addSuffix: true })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setConfirmingRestore(task)}
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

      {confirmingRestore && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setConfirmingRestore(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Restore this task?</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              &ldquo;{confirmingRestore.title}&rdquo; will go back into{' '}
              <span className="font-medium">{confirmingRestore.projectName}</span> /{' '}
              {confirmingRestore.sectionName}. It was deleted by{' '}
              <span className="font-medium">{confirmingRestore.deletedByName}</span>{' '}
              {formatDistanceToNow(new Date(confirmingRestore.deletedAt), { addSuffix: true })} — not you, so double
              check this is the right task before restoring it.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmingRestore(null)}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => commitRestore(confirmingRestore.id)}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
              >
                Confirm restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
