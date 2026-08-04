'use client';

import { useState, type FormEvent } from 'react';
import { PRIORITY_LABELS, PRIORITY_STYLES, STATUS_LABELS, STATUS_STYLES } from '@/lib/format';
import { addGuestComment } from '@/lib/actions/guestAccess';

export interface GuestComment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  isGuest: boolean;
}

export interface GuestTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
}

export function GuestTaskView({
  token,
  task,
  comments: initialComments,
  canComment,
}: {
  token: string;
  task: GuestTask;
  comments: GuestComment[];
  canComment: boolean;
}) {
  const [comments, setComments] = useState(initialComments);
  const [guestName, setGuestName] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await addGuestComment(token, guestName, body);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? 'Something went wrong. Please try again.');
      return;
    }
    setComments((prev) => [...prev, result.comment]);
    setBody('');
  }

  return (
    <main className="flex min-h-screen justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold text-slate-900">{task.title}</h1>
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[task.status] ?? ''}`}>
            {STATUS_LABELS[task.status] ?? task.status}
          </span>
        </div>

        {task.description && <p className="mt-2 text-sm text-slate-500">{task.description}</p>}

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className={`rounded-md px-2 py-0.5 font-medium ${PRIORITY_STYLES[task.priority] ?? ''}`}>
            {PRIORITY_LABELS[task.priority] ?? task.priority}
          </span>
          {task.dueDate && (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
              Due {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>

        <div className="mt-6 border-t border-slate-200 pt-4">
          <h2 className="text-sm font-semibold text-slate-900">Comments</h2>
          <div className="mt-3 space-y-3">
            {comments.length === 0 && <p className="text-sm text-slate-400">No comments yet.</p>}
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-700">
                    {comment.author}
                    {comment.isGuest && <span className="ml-1 text-slate-400">(guest)</span>}
                  </p>
                  <p className="text-xs text-slate-400">{new Date(comment.createdAt).toLocaleString()}</p>
                </div>
                <p className="mt-1 text-sm text-slate-600">{comment.body}</p>
              </div>
            ))}
          </div>

          {canComment ? (
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500">Your name *</label>
                <input
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">Comment *</label>
                <textarea
                  required
                  rows={3}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {submitting ? 'Posting…' : 'Post comment'}
              </button>
            </form>
          ) : (
            <p className="mt-4 text-xs text-slate-400">Commenting is disabled for this link.</p>
          )}
        </div>
      </div>
    </main>
  );
}
