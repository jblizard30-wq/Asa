'use client';

import { useEffect, useState } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { moveTask } from '@/lib/actions/tasks';
import { PRIORITY_STYLES, formatDueDate } from '@/lib/format';
import { QuickAddTask } from '@/components/QuickAddTask';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { TagBadge, type TagInfo } from '@/components/TagPicker';

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

    void moveTask(draggableId, destination.droppableId, destination.index).then((result) => {
      if (!result.success) {
        setSections(previousSections);
        alert(result.error ?? 'Could not move this task.');
      }
    });
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {sections.map((section) => (
          <div key={section.id} className="w-72 shrink-0 rounded-lg bg-slate-100 p-3 dark:bg-slate-700">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{section.name}</h3>
              <span className="text-xs text-slate-400 dark:text-slate-500">{section.tasks.length}</span>
            </div>

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
                            className={`cursor-pointer rounded-md border border-slate-200 bg-white p-3 shadow-sm hover:border-brand-300 dark:border-slate-600 dark:bg-slate-800 ${
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
                            {task.assigneeNames.length > 0 && (
                              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                                {task.assigneeNames.join(', ')}
                              </p>
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
      </div>

      {openTaskId && <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </DragDropContext>
  );
}
