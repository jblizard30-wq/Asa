'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PRIORITY_LABELS, PRIORITY_STYLES, STATUS_LABELS, formatDueDate } from '@/lib/format';
import { QuickAddTask } from '@/components/QuickAddTask';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { TagBadge } from '@/components/TagPicker';
import { AssigneePicker } from '@/components/AssigneePicker';
import { bulkDeleteTasks, bulkUpdateTasks } from '@/lib/actions/tasks';
import { createSection, updateSection, deleteSection } from '@/lib/actions/sections';
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

  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [sectionSaving, setSectionSaving] = useState(false);
  const [sectionDeletingId, setSectionDeletingId] = useState<string | null>(null);
  const [sectionDeleteTargetId, setSectionDeleteTargetId] = useState<string>('');

  async function handleAddSection(e: React.FormEvent) {
    e.preventDefault();
    const name = newSectionName.trim();
    if (!name) return;
    setSectionSaving(true);
    const res = await createSection(projectId, name);
    setSectionSaving(false);
    if (!res.success) {
      setError(res.error ?? 'Could not add section');
      return;
    }
    setNewSectionName('');
    setIsAddingSection(false);
    router.refresh();
  }

  async function handleRenameSection(sectionId: string, originalName: string) {
    const trimmed = editingName.trim();
    setEditingSectionId(null);
    if (!trimmed || trimmed === originalName) return;
    const res = await updateSection(sectionId, trimmed);
    if (!res.success) {
      setError(res.error ?? 'Could not rename section');
      return;
    }
    router.refresh();
  }

  async function handleDeleteSectionConfirm() {
    if (!sectionDeletingId) return;
    setSectionSaving(true);
    const res = await deleteSection(sectionDeletingId, sectionDeleteTargetId || undefined);
    setSectionSaving(false);
    if (!res.success) {
      setError(res.error ?? 'Could not delete section');
      return;
    }
    setSectionDeletingId(null);
    setSectionDeleteTargetId('');
    router.refresh();
  }

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
          {editingSectionId === section.id ? (
            <div className="flex items-center gap-1 border-b border-slate-100 px-4 py-2 dark:border-slate-800">
              <input
                type="text"
                autoFocus
                defaultValue={section.name}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => handleRenameSection(section.id, section.name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSection(section.id, section.name);
                  if (e.key === 'Escape') setEditingSectionId(null);
                }}
                className="rounded border border-slate-300 bg-white px-2 py-0.5 text-sm font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
          ) : (
            <div className="group flex items-center justify-between border-b border-slate-100 px-4 py-2 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <h3
                  onClick={() => {
                    setEditingSectionId(section.id);
                    setEditingName(section.name);
                  }}
                  title="Click to rename"
                  className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-brand-600 dark:text-slate-200 dark:hover:text-brand-400"
                >
                  {section.name}
                </h3>
                <span className="text-xs text-slate-400 dark:text-slate-500">{section.tasks.length}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditingSectionId(section.id);
                    setEditingName(section.name);
                  }}
                  className="rounded p-0.5 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  title="Rename section"
                >
                  ✏️
                </button>
                {sections.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSectionDeletingId(section.id);
                      const other = sections.find((s) => s.id !== section.id);
                      setSectionDeleteTargetId(other?.id ?? '');
                    }}
                    className="rounded p-0.5 text-xs text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                    title="Delete section"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          )}

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
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                            ⚠️ Unassigned
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
            <QuickAddTask projectId={projectId} sectionId={section.id} />
          </div>
        </div>
      ))}

      {/* Add section in list view */}
      {isAddingSection ? (
        <form onSubmit={handleAddSection} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <input
            type="text"
            autoFocus
            placeholder="New section name…"
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={sectionSaving || !newSectionName.trim()}
            className="rounded-md bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {sectionSaving ? 'Adding…' : 'Add section'}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAddingSection(false);
              setNewSectionName('');
            }}
            className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsAddingSection(true)}
          className="flex w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-200 py-3 text-sm font-medium text-slate-500 hover:border-brand-500 hover:text-brand-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-brand-400 dark:hover:text-brand-300"
        >
          + Add section
        </button>
      )}

      {sectionDeletingId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Delete &ldquo;{sections.find((s) => s.id === sectionDeletingId)?.name}&rdquo;?
            </h3>
            {(() => {
              const sec = sections.find((s) => s.id === sectionDeletingId);
              const remaining = sections.filter((s) => s.id !== sectionDeletingId);
              const taskCount = sec?.tasks.length ?? 0;
              return (
                <div className="mt-3 space-y-3">
                  {taskCount > 0 ? (
                    <>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        This section contains <strong>{taskCount}</strong> task{taskCount === 1 ? '' : 's'}. Choose where to move them:
                      </p>
                      <select
                        value={sectionDeleteTargetId || remaining[0]?.id}
                        onChange={(e) => setSectionDeleteTargetId(e.target.value)}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        {remaining.map((s) => (
                          <option key={s.id} value={s.id}>
                            Move to: {s.name}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      This empty section will be permanently removed.
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSectionDeletingId(null);
                        setSectionDeleteTargetId('');
                      }}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={sectionSaving}
                      onClick={handleDeleteSectionConfirm}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {sectionSaving ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {openTaskId && <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </div>
  );
}
