'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PRIORITY_LABELS, PRIORITY_STYLES, formatDueDate } from '@/lib/format';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { TagBadge, type TagInfo } from '@/components/TagPicker';

export interface MyTask {
  id: string;
  title: string;
  priority: string;
  status: string;
  dueDate: string | null;
  projectId: string;
  projectName: string;
  sectionName: string;
  tags: TagInfo[];
}

export function MyTasksList({ tasks }: { tasks: MyTask[] }) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-600 dark:text-slate-500">
        You&apos;re all caught up — no open tasks assigned to you.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {tasks.map((task) => {
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

      {openTaskId && <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </div>
  );
}
