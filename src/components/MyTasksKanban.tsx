'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { updateTask } from '@/lib/actions/tasks';
import { PRIORITY_STYLES, STATUS_LABELS, formatDueDate } from '@/lib/format';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { TagBadge } from '@/components/TagPicker';
import type { MyTask } from '@/components/MyTasksWorkspace';

/** Fixed status columns — cross-project tasks don't share a "section" the way one project's Kanban board does. */
const STATUS_COLUMNS = Object.entries(STATUS_LABELS).map(([id, label]) => ({ id, label }));

export function MyTasksKanban({ tasks: initialTasks }: { tasks: MyTask[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  function handleDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    const previousTasks = tasks;
    const destinationStatus = destination.droppableId;
    setTasks((prev) => prev.map((t) => (t.id === draggableId ? { ...t, status: destinationStatus } : t)));

    void updateTask(draggableId, { status: destinationStatus as 'TODO' | 'IN_PROGRESS' | 'DONE' }).then((res) => {
      if (!res.success) {
        setTasks(previousTasks);
        alert(res.error ?? 'Could not move this task.');
      }
    });
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUS_COLUMNS.map((column) => {
          const columnTasks = tasks.filter((t) => t.status === column.id);
          return (
            <div key={column.id} className="w-72 shrink-0 rounded-lg bg-slate-100 p-3 dark:bg-slate-700">
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{column.label}</h3>
                <span className="text-xs text-slate-400 dark:text-slate-500">{columnTasks.length}</span>
              </div>

              <Droppable droppableId={column.id}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="min-h-[8px] space-y-2">
                    {columnTasks.map((task, index) => {
                      const due = formatDueDate(task.dueDate);
                      return (
                        <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={task.locked}>
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
                              <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                                <Link
                                  href={`/projects/${task.projectId}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="hover:underline"
                                >
                                  {task.projectName}
                                </Link>
                              </p>
                              {task.tags.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {task.tags.map((tag) => (
                                    <TagBadge key={tag.id} tag={tag} />
                                  ))}
                                </div>
                              )}
                              <div className="mt-2 flex items-center justify-between">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_STYLES[task.priority]}`}>
                                  {task.priority}
                                </span>
                                <span className={`text-xs ${due.overdue ? 'font-medium text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                  {due.label}
                                </span>
                              </div>
                              {task.assigneeNames.length > 0 && (
                                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{task.assigneeNames.join(', ')}</p>
                              )}
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                    {columnTasks.length === 0 && (
                      <p className="px-1 py-2 text-xs text-slate-400 dark:text-slate-500">No tasks here.</p>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>

      {openTaskId && <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </DragDropContext>
  );
}
