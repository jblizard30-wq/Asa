'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { getTaskDetail, updateTask, deleteTask } from '@/lib/actions/tasks';
import { addComment } from '@/lib/actions/comments';
import { PRIORITY_LABELS, STATUS_LABELS } from '@/lib/format';

type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;

export function TaskDetailModal({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const router = useRouter();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const commentFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTaskDetail(taskId).then((data) => {
      if (!cancelled) {
        setTask(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  function refresh() {
    getTaskDetail(taskId).then((data) => setTask(data));
    router.refresh();
  }

  function handleFieldChange(field: string, value: string | null) {
    if (!task) return;
    setTask({ ...task, [field]: value } as TaskDetail);
    startTransition(async () => {
      await updateTask(taskId, { [field]: value } as never);
      router.refresh();
    });
  }

  async function handleAddComment(formData: FormData) {
    await addComment(taskId, formData);
    commentFormRef.current?.reset();
    refresh();
  }

  async function handleDelete() {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    await deleteTask(taskId);
    router.refresh();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center bg-slate-900/40 p-4 pt-16 sm:pt-24"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {loading || !task ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <input
                defaultValue={task.title}
                onBlur={(e) => e.target.value !== task.title && handleFieldChange('title', e.target.value)}
                className="w-full text-lg font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-400 rounded"
              />
              <button onClick={onClose} className="shrink-0 text-slate-400 hover:text-slate-600" aria-label="Close">
                ✕
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">{task.projectName}</p>

            <textarea
              defaultValue={task.description ?? ''}
              placeholder="Add a description…"
              onBlur={(e) => e.target.value !== (task.description ?? '') && handleFieldChange('description', e.target.value)}
              rows={3}
              className="mt-4 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            />

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-500">Assignee</label>
                <select
                  defaultValue={task.assigneeId ?? ''}
                  onChange={(e) => handleFieldChange('assigneeId', e.target.value || null)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5"
                >
                  <option value="">Unassigned</option>
                  {task.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">Due date</label>
                <input
                  type="date"
                  defaultValue={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                  onChange={(e) => handleFieldChange('dueDate', e.target.value || null)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">Priority</label>
                <select
                  defaultValue={task.priority}
                  onChange={(e) => handleFieldChange('priority', e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5"
                >
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">Status</label>
                <select
                  defaultValue={task.status}
                  onChange={(e) => handleFieldChange('status', e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5"
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isPending && <p className="mt-2 text-xs text-slate-400">Saving…</p>}

            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-700">Comments</h3>
              <div className="mt-3 space-y-3">
                {task.comments.length === 0 && <p className="text-sm text-slate-400">No comments yet.</p>}
                {task.comments.map((c) => (
                  <div key={c.id} className="rounded-md bg-slate-50 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700">{c.userName}</span>
                      <span className="text-xs text-slate-400">
                        {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-slate-600">{c.body}</p>
                  </div>
                ))}
              </div>

              <form ref={commentFormRef} action={handleAddComment} className="mt-4 flex gap-2">
                <input
                  name="body"
                  placeholder="Write a comment…"
                  required
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Post
                </button>
              </form>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-4">
              <button onClick={handleDelete} className="text-xs font-medium text-red-500 hover:text-red-600">
                Delete task
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
