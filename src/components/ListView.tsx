'use client';

import { useState } from 'react';
import { PRIORITY_LABELS, PRIORITY_STYLES, formatDueDate } from '@/lib/format';
import { QuickAddTask } from '@/components/QuickAddTask';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { TagBadge } from '@/components/TagPicker';
import type { KanbanSection, CustomFieldDef } from '@/components/KanbanBoard';
import type { ProjectMemberInfo } from '@/components/ProjectView';

export function ListView({
  projectId,
  sections,
  filtersActive = false,
}: {
  projectId: string;
  sections: KanbanSection[];
  members: ProjectMemberInfo[];
  customFields: CustomFieldDef[];
  filtersActive?: boolean;
}) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.id} className="rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{section.name}</h3>
            <span className="text-xs text-slate-400 dark:text-slate-500">{section.tasks.length}</span>
          </div>

          {section.tasks.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-400 dark:text-slate-500">
              {filtersActive ? 'No tasks match your filters.' : 'No tasks yet.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {section.tasks.map((task) => {
                const due = formatDueDate(task.dueDate);
                return (
                  <li key={task.id}>
                    <button
                      onClick={() => setOpenTaskId(task.id)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                        {task.locked && (
                          <span
                            className="shrink-0 text-xs"
                            title={`Locked until ${task.blockedByTitles.map((t) => `"${t}"`).join(', ')} done`}
                          >
                            🔒
                          </span>
                        )}
                        <span className="truncate">{task.title}</span>
                        {task.tags.length > 0 && (
                          <span className="flex shrink-0 gap-1">
                            {task.tags.map((tag) => (
                              <TagBadge key={tag.id} tag={tag} />
                            ))}
                          </span>
                        )}
                      </span>
                      <div className="flex shrink-0 items-center gap-3">
                        {task.assigneeNames.length > 0 && (
                          <span className="text-xs text-slate-400 dark:text-slate-500">{task.assigneeNames.join(', ')}</span>
                        )}
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
          )}

          <div className="border-t border-slate-100 p-2 dark:border-slate-700">
            <QuickAddTask projectId={projectId} sectionId={section.id} />
          </div>
        </div>
      ))}

      {openTaskId && <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </div>
  );
}
