'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTask, addDependency } from '@/lib/actions/tasks';
import { AssigneePicker, type AssigneeOption } from '@/components/AssigneePicker';

export function QuickAddTask({
  projectId,
  sectionId,
  parentTaskId,
  blockerId,
  members = [],
  label = '+ Add task',
  onAdded,
}: {
  projectId: string;
  sectionId: string;
  parentTaskId?: string;
  /** When set, the newly created task is made dependent on (blocked by) this task. */
  blockerId?: string;
  /** Project members offered in the inline assignee picker. Omit to hide the picker. */
  members?: AssigneeOption[];
  label?: string;
  onAdded?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    formData.set('sectionId', sectionId);
    if (parentTaskId) formData.set('parentTaskId', parentTaskId);
    assigneeIds.forEach((id) => formData.append('assigneeIds', id));
    const result = await createTask(projectId, formData);
    if (result.success && result.taskId && blockerId) {
      await addDependency(result.taskId, blockerId);
    }
    setLoading(false);
    formRef.current?.reset();
    setAssigneeIds([]);
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
    <form ref={formRef} action={handleSubmit} className="rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
      <input
        name="title"
        autoFocus
        required
        placeholder="Task title"
        className="w-full rounded-md border-none px-1 py-1 text-sm focus:outline-none dark:bg-slate-900 dark:text-slate-200"
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {members.length > 0 && (
        <div className="mt-1.5">
          <AssigneePicker members={members} selectedIds={assigneeIds} onChange={setAssigneeIds} compact />
        </div>
      )}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setAssigneeIds([]);
          }}
          className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Adding…' : 'Add'}
        </button>
      </div>
    </form>
  );
}
