'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { permanentlyDeleteTask, permanentlyDeleteTasks, restoreTask, restoreTasks } from '@/lib/actions/trash';

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

const PAGE_SIZE = 15;

export function AdminTrashList({ entries }: { entries: AdminTrashEntry[] }) {
  const [items, setItems] = useState(entries);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isBulkPending, startBulkTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [confirmingRestore, setConfirmingRestore] = useState<AdminTrashEntry | null>(null);
  const [confirmingBulkRestore, setConfirmingBulkRestore] = useState(false);

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = useMemo(
    () => items.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE),
    [items, currentPage],
  );
  const pageIds = useMemo(() => pageItems.map((t) => t.id), [pageItems]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const allItemsSelected = items.length > 0 && selectedIds.size === items.length;

  function togglePageSelection() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllInTrash() {
    setSelectedIds(new Set(items.map((t) => t.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

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

  function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Take out the trash — permanently delete ${ids.length} task${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) {
      return;
    }
    startBulkTransition(async () => {
      const result = await permanentlyDeleteTasks(ids);
      if (result.success) {
        setItems((prev) => prev.filter((t) => !selectedIds.has(t.id)));
        setSelectedIds(new Set());
      }
    });
  }

  function commitBulkRestore() {
    const ids = Array.from(selectedIds);
    setConfirmingBulkRestore(false);
    if (ids.length === 0) return;
    startBulkTransition(async () => {
      const result = await restoreTasks(ids);
      if (result.success) {
        setItems((prev) => prev.filter((t) => !selectedIds.has(t.id)));
        setSelectedIds(new Set());
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-600 dark:text-slate-500">
        Nothing in anyone&apos;s trash right now.
      </div>
    );
  }

  return (
    <div>
      {selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm dark:border-brand-800 dark:bg-brand-950/40">
          <span className="text-slate-700 dark:text-slate-200">
            {selectedIds.size} selected
            {!allItemsSelected && allPageSelected && items.length > pageIds.length && (
              <button
                onClick={selectAllInTrash}
                className="ml-2 font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                Select all {items.length} in trash
              </button>
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={clearSelection}
              disabled={isBulkPending}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Clear
            </button>
            <button
              onClick={() => setConfirmingBulkRestore(true)}
              disabled={isBulkPending}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {isBulkPending ? 'Working…' : `Restore (${selectedIds.size})`}
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isBulkPending}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {isBulkPending ? 'Taking out the trash…' : `Take out the trash (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2 dark:border-slate-800">
          <input
            type="checkbox"
            checked={allPageSelected}
            onChange={togglePageSelection}
            aria-label="Select all on this page"
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
          />
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Select all</span>
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {pageItems.map((task) => (
            <li key={task.id} className="flex items-center gap-4 px-4 py-3">
              <input
                type="checkbox"
                checked={selectedIds.has(task.id)}
                onChange={() => toggleOne(task.id)}
                disabled={isBulkPending}
                aria-label={`Select ${task.title}`}
                className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
              />
              <div className="min-w-0 flex-1">
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
                  disabled={isBulkPending || (isPending && pendingId === task.id)}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Restore
                </button>
                <button
                  onClick={() => handleDeleteForever(task.id, task.title)}
                  disabled={isBulkPending || (isPending && pendingId === task.id)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  Delete forever
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Prev
          </button>
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`h-7 w-7 rounded-md text-xs font-medium ${
                i === currentPage
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={currentPage === pageCount - 1}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Next
          </button>
        </div>
      )}

      {confirmingRestore && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setConfirmingRestore(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900"
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
                className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
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

      {confirmingBulkRestore && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setConfirmingBulkRestore(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Restore {selectedIds.size} task{selectedIds.size === 1 ? '' : 's'}?
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              These were deleted by other people, not you — double check this is the right batch before restoring it.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmingBulkRestore(false)}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={commitBulkRestore}
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
