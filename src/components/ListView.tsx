'use client';

import { useState } from 'react';
import { PRIORITY_LABELS, PRIORITY_STYLES, formatDueDate } from '@/lib/format';
import { QuickAddTask } from '@/components/QuickAddTask';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import type { KanbanSection } from '@/components/KanbanBoard';

export function ListView({ projectId, sections }: { projectId: string; sections: KanbanSection[] }) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.id} className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
            <h3 className="text-sm font-semibold text-slate-700">{section.name}</h3>
            <span className="text-xs text-slate-400">{section.tasks.length}</span>
          </div>

          {section.tasks.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-400">No tasks yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {section.tasks.map((task) => {
                const due = formatDueDate(task.dueDate);
                return (
                  <li key={task.id}>
                    <button
                      onClick={() => setOpenTaskId(task.id)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50"
                    >
                      <span className="truncate text-sm font-medium text-slate-800">{task.title}</span>
                      <div className="flex shrink-0 items-center gap-3">
                        {task.assigneeName && <span className="text-xs text-slate-400">{task.assigneeName}</span>}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[task.priority]}`}>
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                        <span className={`text-xs ${due.overdue ? 'font-medium text-red-500' : 'text-slate-400'}`}>
                          {due.label}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-slate-100 p-2">
            <QuickAddTask projectId={projectId} sectionId={section.id} />
          </div>
        </div>
      ))}

      {openTaskId && <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </div>
  );
}
