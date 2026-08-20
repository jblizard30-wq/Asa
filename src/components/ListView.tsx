'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PRIORITY_LABELS, PRIORITY_STYLES, formatDueDate } from '@/lib/format';
import { QuickAddTask } from '@/components/QuickAddTask';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { TagBadge } from '@/components/TagPicker';
import { AssigneePicker } from '@/components/AssigneePicker';
import { bulkUpdateTasks } from '@/lib/actions/tasks';
import type { KanbanSection, CustomFieldDef } from '@/components/KanbanBoard';
import type { ProjectMemberInfo } from '@/components/ProjectView';

export function ListView({
  projectId,
  sections,
  members,
  filtersActive = false,
}: {
  projectId: string;
  sections: KanbanSection[];
  members: ProjectMemberInfo[];
  customFields: CustomFieldDef[];
  filtersActive?: boolean;
}) {
  const router = useRouter();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssigneeIds, setBulkAssigneeIds] = useState<string[]>([]);
  const [isBulkPending, startBulkTransition] = useTransition();

  function toggleTask(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setBulkAssigneeIds([]);
  }

  function handleBulkAssign() {
    const taskIds = [...selectedIds];
    startBulkTransition(async () => {
      await bulkUpdateTasks(taskIds, { assigneeIds: bulkAssigneeIds });
      clearSelection();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 p-2 dark:border-brand-800 dark:bg-brand-900/30">
          <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
            {selectedIds.size} task{selectedIds.size === 1 ? '' : 's'} selected
          </span>
          <div className="w-56">
            <AssigneePicker members={members} selectedIds={bulkAssigneeIds} onChange={setBulkAssigneeIds} compact />
          </div>
          <button
            type="button"
            onClick={handleBulkAssign}
            disabled={isBulkPending}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {isBulkPending ? 'Assigning…' : 'Assign selected'}
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="text-sm font-medium text-slate-500 hover:underline dark:text-slate-400"
          >
            Cancel
          </button>
        </div>
      )}

      {sections.map((section) => (
        <div key={section.id} className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{section.name}</h3>
            <span className="text-xs text-slate-400 dark:text-slate-500">{section.tasks.length}</span>
          </div>

          {section.tasks.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-400 dark:text-slate-500">
              {filtersActive ? 'No tasks match your filters.' : 'No tasks yet.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {section.tasks.map((task) => {
                const due = formatDueDate(task.dueDate);
                return (
                  <li key={task.id} className="flex items-center gap-3 pl-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(task.id)}
                      onChange={() => toggleTask(task.id)}
                      className="h-4 w-4 shrink-0"
                      aria-label={`Select "${task.title}"`}
                    />
                    <button
                      onClick={() => setOpenTaskId(task.id)}
                      className="flex min-w-0 flex-1 items-center justify-between gap-4 py-3 pr-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
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
                        {task.assigneeNames.length > 0 ? (
                          <span className="text-xs text-slate-400 dark:text-slate-500">{task.assigneeNames.join(', ')}</span>
                        ) : (
                          <span
                            className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400"
                            title="No one is assigned to this task yet"
                          >
                            <span aria-hidden>⚠</span> Unassigned
                          </span>
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

          <div className="border-t border-slate-100 p-2 dark:border-slate-800">
            <QuickAddTask projectId={projectId} sectionId={section.id} members={members} />
          </div>
        </div>
      ))}

      {openTaskId && <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </div>
  );
}
