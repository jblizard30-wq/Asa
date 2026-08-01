'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTask } from '@/lib/actions/tasks';

export function QuickAddTask({ projectId, sectionId }: { projectId: string; sectionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    formData.set('sectionId', sectionId);
    await createTask(projectId, formData);
    setLoading(false);
    formRef.current?.reset();
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-md px-2 py-1.5 text-left text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        + Add task
      </button>
    );
  }

  return (
    <form ref={formRef} action={handleSubmit} className="rounded-md border border-slate-200 bg-white p-2">
      <input
        name="title"
        autoFocus
        required
        placeholder="Task title"
        className="w-full rounded-md border-none px-1 py-1 text-sm focus:outline-none"
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
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
