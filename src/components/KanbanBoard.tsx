'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { moveTask } from '@/lib/actions/tasks';
import { createSection, updateSection, deleteSection } from '@/lib/actions/sections';
import { PRIORITY_STYLES, formatDueDate } from '@/lib/format';
import { QuickAddTask } from '@/components/QuickAddTask';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { TagBadge, type TagInfo } from '@/components/TagPicker';
import { useToast } from '@/components/Toast';

export interface TaskFieldValue {
  customFieldId: string;
  textValue: string | null;
  numberValue: number | null;
  dateValue: string | null;
  boolValue: boolean | null;
  optionId: string | null;
}

export interface CustomFieldOption {
  id: string;
  label: string;
}

export interface CustomFieldDef {
  id: string;
  name: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'CHECKBOX';
  order: number;
  options: CustomFieldOption[];
}

export interface KanbanSubtask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assigneeIds: string[];
  assigneeNames: string[];
}

export interface TaskRecurrenceInfo {
  id: string;
  mode: 'PERIODIC' | 'AFTER_COMPLETION';
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  endsAt: string | null;
}

export interface KanbanTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  startDate?: string | null;
  dueDate: string | null;
  assigneeIds: string[];
  assigneeNames: string[];
  taskRecurrence: TaskRecurrenceInfo | null;
  locked: boolean;

  blockedByTitles: string[];
  subtasks: KanbanSubtask[];
  fieldValues: TaskFieldValue[];
  tags: TagInfo[];
}

export interface KanbanSection {
  id: string;
  name: string;
  order: number;
  tasks: KanbanTask[];
}

export function KanbanBoard({
  projectId,
  sections: initialSections,
  filtersActive = false,
}: {
  projectId: string;
  sections: KanbanSection[];
  filtersActive?: boolean;
}) {
  const [sections, setSections] = useState(initialSections);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();

  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [columnSaving, setColumnSaving] = useState(false);
  const [columnDeletingId, setColumnDeletingId] = useState<string | null>(null);
  const [columnDeleteTargetId, setColumnDeleteTargetId] = useState<string>('');

  async function handleAddColumn(e: React.FormEvent) {
    e.preventDefault();
    const name = newColumnName.trim();
    if (!name) return;
    setColumnSaving(true);
    const res = await createSection(projectId, name);
    setColumnSaving(false);
    if (!res.success) {
      toast.error('Could not add column', res.error ?? 'Unknown error');
      return;
    }
    setNewColumnName('');
    setIsAddingColumn(false);
    router.refresh();
  }

  async function handleRenameColumn(sectionId: string, originalName: string) {
    const trimmed = editingName.trim();
    setEditingSectionId(null);
    if (!trimmed || trimmed === originalName) return;
    const res = await updateSection(sectionId, trimmed);
    if (!res.success) {
      toast.error('Could not rename column', res.error ?? 'Unknown error');
      return;
    }
    router.refresh();
  }

  async function handleDeleteColumnConfirm() {
    if (!columnDeletingId) return;
    setColumnSaving(true);
    const res = await deleteSection(columnDeletingId, columnDeleteTargetId || undefined);
    setColumnSaving(false);
    if (!res.success) {
      toast.error('Could not delete column', res.error ?? 'Unknown error');
      return;
    }
    setColumnDeletingId(null);
    setColumnDeleteTargetId('');
    router.refresh();
  }

  useEffect(() => {
    setSections(initialSections);
  }, [initialSections]);

  function handleDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const previousSections = sections;

    setSections((prev) => {
      const next = prev.map((s) => ({ ...s, tasks: [...s.tasks] }));
      const sourceSection = next.find((s) => s.id === source.droppableId);
      const destSection = next.find((s) => s.id === destination.droppableId);
      if (!sourceSection || !destSection) return prev;

      const [moved] = sourceSection.tasks.splice(source.index, 1);
      destSection.tasks.splice(destination.index, 0, moved);
      return next;
    });

    void moveTask(draggableId, destination.droppableId, destination.index).then((res) => {
      if (!res.success) {
        setSections(previousSections);
        toast.error('Move failed', res.error ?? 'Could not move this task.');
      }
    });
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {sections.map((section) => (
          <div key={section.id} className="w-72 shrink-0 rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
            {editingSectionId === section.id ? (
              <div className="mb-2 flex items-center gap-1">
                <input
                  type="text"
                  autoFocus
                  defaultValue={section.name}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => handleRenameColumn(section.id, section.name)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameColumn(section.id, section.name);
                    if (e.key === 'Escape') setEditingSectionId(null);
                  }}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-0.5 text-sm font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>
            ) : (
              <div className="group mb-2 flex items-center justify-between px-1">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <h3
                    onClick={() => {
                      setEditingSectionId(section.id);
                      setEditingName(section.name);
                    }}
                    title="Click to rename"
                    className="cursor-pointer truncate text-sm font-semibold text-slate-700 hover:text-brand-600 dark:text-slate-200 dark:hover:text-brand-400"
                  >
                    {section.name}
                  </h3>
                  <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{section.tasks.length}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSectionId(section.id);
                      setEditingName(section.name);
                    }}
                    className="rounded p-0.5 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    title="Rename column"
                  >
                    ✏️
                  </button>
                  {sections.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setColumnDeletingId(section.id);
                        const other = sections.find((s) => s.id !== section.id);
                        setColumnDeleteTargetId(other?.id ?? '');
                      }}
                      className="rounded p-0.5 text-xs text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                      title="Delete column"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            )}

            <Droppable droppableId={section.id}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="min-h-[8px] space-y-2">
                  {filtersActive && section.tasks.length === 0 && (
                    <p className="px-1 py-2 text-xs text-slate-400 dark:text-slate-500">No tasks match your filters.</p>
                  )}
                  {section.tasks.map((task, index) => {
                    const due = formatDueDate(task.dueDate);
                    return (
                      <Draggable
                        key={task.id}
                        draggableId={task.id}
                        index={index}
                        isDragDisabled={task.locked || filtersActive}
                      >
                        {(dragProvided, snapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            onClick={() => setOpenTaskId(task.id)}
                            title={task.locked ? `Locked until ${task.blockedByTitles.map((t) => `"${t}"`).join(', ')} done` : undefined}
                            className={`cursor-pointer rounded-md border border-slate-200 bg-white p-3 shadow-sm hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900 ${
                              snapshot.isDragging ? 'shadow-md' : ''
                            } ${task.locked ? 'opacity-60' : ''}`}
                          >
                            <div className="flex items-center gap-1.5">
                              {task.locked && (
                                <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500" aria-label="Locked">
                                  🔒
                                </span>
                              )}
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{task.title}</p>
                            </div>
                            {task.locked && (
                              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                Waiting on {task.blockedByTitles.map((t) => `"${t}"`).join(', ')}
                              </p>
                            )}
                            {task.tags.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {task.tags.map((tag) => (
                                  <TagBadge key={tag.id} tag={tag} />
                                ))}
                              </div>
                            )}
                            <div className="mt-2 flex items-center justify-between">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_STYLES[task.priority]}`}
                              >
                                {task.priority}
                              </span>
                              <span className={`text-xs ${due.overdue ? 'font-medium text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                {due.label}
                              </span>
                            </div>
                            {task.assigneeNames.length > 0 ? (
                              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                                {task.assigneeNames.join(', ')}
                              </p>
                            ) : (
                              <span className="mt-2 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                ⚠️ Unassigned
                              </span>
                            )}
                          </div>
                        )}
                      </Draggable>
                    );
                  })}

                  {provided.placeholder}
                </div>
              )}
            </Droppable>

            <div className="mt-2">
              <QuickAddTask projectId={projectId} sectionId={section.id} />
            </div>
          </div>
        ))}
        {/* Add column card at end of board */}
        {isAddingColumn ? (
          <form onSubmit={handleAddColumn} className="w-72 shrink-0 rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
            <input
              type="text"
              autoFocus
              placeholder="Column label…"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={columnSaving || !newColumnName.trim()}
                className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {columnSaving ? 'Adding…' : 'Add column'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingColumn(false);
                  setNewColumnName('');
                }}
                className="rounded-md px-2 py-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddingColumn(true)}
            className="flex h-14 w-72 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-sm font-medium text-slate-500 hover:border-brand-500 hover:text-brand-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-brand-400 dark:hover:text-brand-300"
          >
            + Add column
          </button>
        )}
      </div>

      {columnDeletingId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Delete &ldquo;{sections.find((s) => s.id === columnDeletingId)?.name}&rdquo;?
            </h3>
            {(() => {
              const sec = sections.find((s) => s.id === columnDeletingId);
              const remaining = sections.filter((s) => s.id !== columnDeletingId);
              const taskCount = sec?.tasks.length ?? 0;
              return (
                <div className="mt-3 space-y-3">
                  {taskCount > 0 ? (
                    <>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        This column contains <strong>{taskCount}</strong> task{taskCount === 1 ? '' : 's'}. Choose where to move them:
                      </p>
                      <select
                        value={columnDeleteTargetId || remaining[0]?.id}
                        onChange={(e) => setColumnDeleteTargetId(e.target.value)}
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
                      This empty column will be removed from your board.
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setColumnDeletingId(null);
                        setColumnDeleteTargetId('');
                      }}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={columnSaving}
                      onClick={handleDeleteColumnConfirm}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {columnSaving ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {openTaskId && <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </DragDropContext>
  );
}
