'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PRIORITY_LABELS, PRIORITY_STYLES, STATUS_LABELS, formatDueDate } from '@/lib/format';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { TagBadge, type TagInfo } from '@/components/TagPicker';
import { TaskFilterBar } from '@/components/TaskFilterBar';
import { EMPTY_TASK_FILTERS, matchesTaskFilters, type TaskFilters } from '@/lib/taskFilters';
import { bulkDeleteTasks, bulkUpdateTasks } from '@/lib/actions/tasks';

export interface MyTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  projectId: string;
  projectName: string;
  sectionName: string;
  assigneeIds: string[];
  assigneeNames: string[];
  tags: TagInfo[];
}

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([id, label]) => ({ id, label }));
const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS).map(([id, label]) => ({ id, label }));

// Completed tasks are hidden by default so this view stays focused on open work;
// the filter bar lets the user opt back in by selecting "Done" under Status.
const DEFAULT_MY_TASKS_FILTERS: TaskFilters = { ...EMPTY_TASK_FILTERS, statuses: ['TODO', 'IN_PROGRESS'] };

export function MyTasksList({ tasks }: { tasks: MyTask[] }) {
  const router = useRouter();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_MY_TASKS_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkPending, startBulkTransition] = useTransition();
  const [bulkError, setBulkError] = useState<string | null>(null);

  const projectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const task of tasks) seen.set(task.projectId, task.projectName);
    return [...seen.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [tasks]);

  const tagOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const task of tasks) for (const tag of task.tags) seen.set(tag.id, tag.name);
    return [...seen.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [tasks]);

  const filteredTasks = useMemo(() => tasks.filter((task) => matchesTaskFilters(task, filters)), [tasks, filters]);
  const filteredTaskIds = useMemo(() => filteredTasks.map((t) => t.id), [filteredTasks]);
  const allSelected = filteredTaskIds.length > 0 && filteredTaskIds.every((id) => selectedIds.has(id));

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(filteredTaskIds));
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function handleBulkStatus(status: string) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkError(null);
    startBulkTransition(async () => {
      const result = await bulkUpdateTasks(ids, { status: status as 'TODO' | 'IN_PROGRESS' | 'DONE' });
      if (!result.success) setBulkError(result.error ?? 'Could not update status');
      else router.refresh();
    });
  }

  function handleBulkPriority(priority: string) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkError(null);
    startBulkTransition(async () => {
      const result = await bulkUpdateTasks(ids, { priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' });
      if (!result.success) setBulkError(result.error ?? 'Could not update priority');
      else router.refresh();
    });
  }

  function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Move ${ids.length} task${ids.length === 1 ? '' : 's'} to the trash?`)) return;
    setBulkError(null);
    startBulkTransition(async () => {
      const result = await bulkDeleteTasks(ids);
      if (!result.success) {
        setBulkError(result.error ?? 'Could not delete tasks');
        return;
      }
      clearSelection();
      router.refresh();
    });
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-600 dark:text-slate-500">
        You&apos;re all caught up — no open tasks assigned to you.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TaskFilterBar
        filters={filters}
        onChange={setFilters}
        statusOptions={STATUS_OPTIONS}
        priorityOptions={PRIORITY_OPTIONS}
        projectOptions={projectOptions}
        tagOptions={tagOptions}
        searchPlaceholder="Search your tasks…"
        scope="my-tasks"
      />

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm dark:border-brand-800 dark:bg-brand-950/40">
          <span className="text-slate-700 dark:text-slate-200">
            {selectedIds.size} selected
            {!allSelected && (
              <button onClick={toggleAll} className="ml-2 font-medium text-brand-600 hover:underline dark:text-brand-400">
                Select all {filteredTaskIds.length}
              </button>
            )}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <select
              defaultValue=""
              disabled={isBulkPending}
              onChange={(e) => {
                if (e.target.value) handleBulkStatus(e.target.value);
                e.target.value = '';
              }}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="" disabled>
                Set status…
              </option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              defaultValue=""
              disabled={isBulkPending}
              onChange={(e) => {
                if (e.target.value) handleBulkPriority(e.target.value);
                e.target.value = '';
              }}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="" disabled>
                Set priority…
              </option>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              onClick={clearSelection}
              disabled={isBulkPending}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Clear
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isBulkPending}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {isBulkPending ? 'Working…' : `Delete (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}

      {bulkError && <p className="text-sm text-red-600 dark:text-red-400">{bulkError}</p>}

      {filteredTasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-600 dark:text-slate-500">
          No tasks match your filters.{' '}
          <button
            onClick={() => setFilters(EMPTY_TASK_FILTERS)}
            className="font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredTasks.map((task) => {
              const due = formatDueDate(task.dueDate);
              return (
                <li key={task.id} className="flex items-center gap-3 px-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(task.id)}
                    onChange={() => toggleOne(task.id)}
                    disabled={isBulkPending}
                    aria-label={`Select ${task.title}`}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
                  />
                  <button
                    onClick={() => setOpenTaskId(task.id)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{task.title}</p>
                        {task.tags.length > 0 && (
                          <span className="flex shrink-0 gap-1">
                            {task.tags.map((tag) => (
                              <TagBadge key={tag.id} tag={tag} />
                            ))}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                        <Link
                          href={`/projects/${task.projectId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline"
                        >
                          {task.projectName}
                        </Link>
                        {' · '}
                        {task.sectionName}
                        {task.assigneeNames.length > 1 && ` · Shared with ${task.assigneeNames.join(', ')}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[task.priority]}`}>
                        {PRIORITY_LABELS[task.priority]}
                      </span>
                      <span className={`text-xs ${due.overdue ? 'font-medium text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                        {due.label}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {openTaskId && <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </div>
  );
}
