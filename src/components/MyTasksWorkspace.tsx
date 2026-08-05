'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PRIORITY_LABELS, PRIORITY_STYLES, STATUS_LABELS, formatDueDate } from '@/lib/format';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { TagBadge, type TagInfo } from '@/components/TagPicker';
import { TaskFilterBar } from '@/components/TaskFilterBar';
import { EMPTY_TASK_FILTERS, matchesTaskFilters, type TaskFilters } from '@/lib/taskFilters';
import { MyTasksKanban } from '@/components/MyTasksKanban';
import { MyTasksCalendar } from '@/components/MyTasksCalendar';
import { GridView } from '@/components/GridView';
import type { KanbanSection, KanbanSubtask, KanbanTask, TaskRecurrenceInfo } from '@/components/KanbanBoard';

export type TaskSource = 'assigned' | 'personal';

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
  /** Which bucket(s) this task came from — a personal task the user also assigned to themself carries both. */
  sources: TaskSource[];
  taskRecurrence: TaskRecurrenceInfo | null;
  locked: boolean;
  blockedByTitles: string[];
  subtasks: KanbanSubtask[];
}

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([id, label]) => ({ id, label }));
const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS).map(([id, label]) => ({ id, label }));

// Completed tasks are hidden by default so this view stays focused on open work;
// the filter bar lets the user opt back in by selecting "Done" under Status.
const DEFAULT_MY_TASKS_FILTERS: TaskFilters = { ...EMPTY_TASK_FILTERS, statuses: ['TODO', 'IN_PROGRESS'] };

const SOURCE_TABS: { id: 'all' | TaskSource; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'assigned', label: 'My Tasks' },
  { id: 'personal', label: 'Personal' },
];

function toKanbanTask(task: MyTask): KanbanTask {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate,
    assigneeIds: task.assigneeIds,
    assigneeNames: task.assigneeNames,
    taskRecurrence: task.taskRecurrence,
    locked: task.locked,
    blockedByTitles: task.blockedByTitles,
    subtasks: task.subtasks,
    fieldValues: [],
    tags: task.tags,
  };
}

export function MyTasksWorkspace({
  tasks,
  membersByProjectId,
  tagsByProjectId,
  hasPersonalProject,
}: {
  tasks: MyTask[];
  membersByProjectId: Record<string, { id: string; name: string }[]>;
  tagsByProjectId: Record<string, TagInfo[]>;
  hasPersonalProject: boolean;
}) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_MY_TASKS_FILTERS);
  const [sourceFilter, setSourceFilter] = useState<'all' | TaskSource>('all');
  const [view, setView] = useState<'list' | 'kanban' | 'calendar' | 'grid'>('list');

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

  const sourceFilteredTasks = useMemo(
    () => (sourceFilter === 'all' ? tasks : tasks.filter((t) => t.sources.includes(sourceFilter))),
    [tasks, sourceFilter],
  );

  const filteredTasks = useMemo(
    () => sourceFilteredTasks.filter((task) => matchesTaskFilters(task, filters)),
    [sourceFilteredTasks, filters],
  );

  const gridSections = useMemo(() => {
    const byProject = new Map<string, KanbanSection>();
    for (const task of filteredTasks) {
      if (!byProject.has(task.projectId)) {
        byProject.set(task.projectId, { id: task.projectId, name: task.projectName, order: 0, tasks: [] });
      }
      byProject.get(task.projectId)!.tasks.push(toKanbanTask(task));
    }
    return [...byProject.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredTasks]);

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-500 dark:text-slate-500">
        You&apos;re all caught up — no tasks assigned to you, and no personal tasks yet.{' '}
        <Link href="/personal-tasks" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
          Add a personal task
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-slate-200 bg-white p-1 dark:border-slate-600 dark:bg-slate-800">
          {SOURCE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSourceFilter(tab.id)}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                sourceFilter === tab.id
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="inline-flex rounded-md border border-slate-200 bg-white p-1 dark:border-slate-600 dark:bg-slate-800">
          {(['list', 'kanban', 'calendar', 'grid'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded px-3 py-1.5 text-sm font-medium capitalize ${
                view === v ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

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

      {sourceFilter === 'personal' && !hasPersonalProject ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-500 dark:text-slate-500">
          You don&apos;t have any personal tasks yet.{' '}
          <Link href="/personal-tasks" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Add one
          </Link>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-500 dark:text-slate-500">
          No tasks match your filters.{' '}
          <button
            onClick={() => setFilters(EMPTY_TASK_FILTERS)}
            className="font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Clear filters
          </button>
        </div>
      ) : view === 'kanban' ? (
        <MyTasksKanban tasks={filteredTasks} />
      ) : view === 'calendar' ? (
        <MyTasksCalendar tasks={filteredTasks} />
      ) : view === 'grid' ? (
        <GridView mode="cross-project" sections={gridSections} membersByProjectId={membersByProjectId} tagsByProjectId={tagsByProjectId} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800">
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredTasks.map((task) => {
              const due = formatDueDate(task.dueDate);
              return (
                <li key={task.id}>
                  <button
                    onClick={() => setOpenTaskId(task.id)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{task.title}</p>
                        {sourceFilter === 'all' && task.sources.includes('personal') && (
                          <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                            Personal
                          </span>
                        )}
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
