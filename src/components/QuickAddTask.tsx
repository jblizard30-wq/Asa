'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTask, addDependency } from '@/lib/actions/tasks';

export function QuickAddTask({
  projectId,
  sectionId,
  parentTaskId,
  blockerId,
  label = '+ Add task',
  onAdded,
}: {
  projectId: string;
  sectionId: string;
  parentTaskId?: string;
  /** When set, the newly created task is made dependent on (blocked by) this task. */
  blockerId?: string;
  label?: string;
  onAdded?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    formData.set('sectionId', sectionId);
    if (parentTaskId) formData.set('parentTaskId', parentTaskId);
    const result = await createTask(projectId, formData);
    if (result.success && result.taskId && blockerId) {
      await addDependency(result.taskId, blockerId);
    }
    setLoading(false);
    formRef.current?.reset();
    setOpen(false);
    router.refresh();
    onAdded?.();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-md px-2 py-1.5 text-left text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
      >
        {label}
      </button>
    );
  }

  return (
    <form ref={formRef} action={handleSubmit} className="rounded-md border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <input
        name="title"
        autoFocus
        required
        placeholder="Task title…"
        className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            name="dueDate"
            title="Due Date"
            className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          />
          <select
            name="priority"
            defaultValue="MEDIUM"
            title="Priority"
            className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? 'Adding…' : 'Add Task'}
          </button>
        </div>
      </div>
    </form>
  );
}

