'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PRIORITY_LABELS, PRIORITY_STYLES, STATUS_LABELS, formatDueDate } from '@/lib/format';
import { QuickAddTask } from '@/components/QuickAddTask';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { TagBadge } from '@/components/TagPicker';
import { AssigneePicker } from '@/components/AssigneePicker';
import { bulkDeleteTasks, bulkUpdateTasks } from '@/lib/actions/tasks';
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
  const [assignToIds, setAssignToIds] = useState<string[]>([]);
  const [isBulkPending, startBulkTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allTaskIds = useMemo(() => sections.flatMap((s) => s.tasks.map((t) => t.id)), [sections]);
  const allSelected = allTaskIds.length > 0 && selectedIds.size === allTaskIds.length;

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(allTaskIds));
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
    setAssignToIds([]);
  }

  function handleBulkStatus(status: string) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setError(null);
    startBulkTransition(async () => {
      const result = await bulkUpdateTasks(ids, { status: status as 'TODO' | 'IN_PROGRESS' | 'DONE' });
      if (!result.success) setError(result.error ?? 'Could not update status');
      else router.refresh();
    });
  }

  function handleBulkPriority(priority: string) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setError(null);
    startBulkTransition(async () => {
      const result = await bulkUpdateTasks(ids, { priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' });
      if (!result.success) setError(result.error ?? 'Could not update priority');
      else router.refresh();
    });
  }

  function handleBulkAssign(ids: string[]) {
    setAssignToIds(ids);
    const taskIds = Array.from(selectedIds);
    if (taskIds.length === 0) return;
    setError(null);
    startBulkTransition(async () => {
      const result = await bulkUpdateTasks(taskIds, { assigneeIds: ids });
      if (!result.success) setError(result.error ?? 'Could not update assignees');
      else router.refresh();
    });
  }

  function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Move ${ids.length} task${ids.length === 1 ? '' : 's'} to the trash?`)) return;
    setError(null);
    startBulkTransition(async () => {
      const result = await bulkDeleteTasks(ids);
      if (!result.success) {
        setError(result.error ?? 'Could not delete tasks');
        return;
      }
      clearSelection();
      router.refresh();
    });
  }

  const assigneeOptions = members.map((m) => ({ id: m.id, name: m.name }));

  return (
    <div className="space-y-6">
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm dark:border-brand-800 dark:bg-brand-950/40">
          <span className="text-slate-700 dark:text-slate-200">
            {selectedIds.size} selected
            {!allSelected && (
              <button onClick={toggleAll} className="ml-2 font-medium text-brand-600 hover:underline dark:text-brand-400">
                Select all {allTaskIds.length}
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
            <div className="w-40">
              <AssigneePicker members={assigneeOptions} selectedIds={assignToIds} onChange={handleBulkAssign} compact />
            </div>
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

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

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
