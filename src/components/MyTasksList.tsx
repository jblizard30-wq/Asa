'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PRIORITY_LABELS, PRIORITY_STYLES, STATUS_LABELS, formatDueDate } from '@/lib/format';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { TagBadge, type TagInfo } from '@/components/TagPicker';
import { TaskFilterBar } from '@/components/TaskFilterBar';
import { EMPTY_TASK_FILTERS, matchesTaskFilters, type TaskFilters } from '@/lib/taskFilters';

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
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_MY_TASKS_FILTERS);

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
                <li key={task.id}>
                  <button
                    onClick={() => setOpenTaskId(task.id)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
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
