'use client';

import { useState } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { moveTask } from '@/lib/actions/tasks';
import { PRIORITY_STYLES, formatDueDate } from '@/lib/format';
import { QuickAddTask } from '@/components/QuickAddTask';
import { TaskDetailModal } from '@/components/TaskDetailModal';

export interface KanbanTask {
  id: string;
  title: string;
  priority: string;
  dueDate: string | null;
  assigneeName: string | null;
}

export interface KanbanSection {
  id: string;
  name: string;
  order: number;
  tasks: KanbanTask[];
}

export function KanbanBoard({ projectId, sections: initialSections }: { projectId: string; sections: KanbanSection[] }) {
  const [sections, setSections] = useState(initialSections);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  function handleDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    setSections((prev) => {
      const next = prev.map((s) => ({ ...s, tasks: [...s.tasks] }));
      const sourceSection = next.find((s) => s.id === source.droppableId);
      const destSection = next.find((s) => s.id === destination.droppableId);
      if (!sourceSection || !destSection) return prev;

      const [moved] = sourceSection.tasks.splice(source.index, 1);
      destSection.tasks.splice(destination.index, 0, moved);
      return next;
    });

    void moveTask(draggableId, destination.droppableId, destination.index);
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {sections.map((section) => (
          <div key={section.id} className="w-72 shrink-0 rounded-lg bg-slate-100 p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-slate-700">{section.name}</h3>
              <span className="text-xs text-slate-400">{section.tasks.length}</span>
            </div>

            <Droppable droppableId={section.id}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="min-h-[8px] space-y-2">
                  {section.tasks.map((task, index) => {
                    const due = formatDueDate(task.dueDate);
                    return (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(dragProvided, snapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            onClick={() => setOpenTaskId(task.id)}
                            className={`cursor-pointer rounded-md border border-slate-200 bg-white p-3 shadow-sm hover:border-brand-300 ${
                              snapshot.isDragging ? 'shadow-md' : ''
                            }`}
                          >
                            <p className="text-sm font-medium text-slate-800">{task.title}</p>
                            <div className="mt-2 flex items-center justify-between">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_STYLES[task.priority]}`}
                              >
                                {task.priority}
                              </span>
                              <span className={`text-xs ${due.overdue ? 'font-medium text-red-500' : 'text-slate-400'}`}>
                                {due.label}
                              </span>
                            </div>
                            {task.assigneeName && (
                              <p className="mt-2 text-xs text-slate-400">{task.assigneeName}</p>
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
