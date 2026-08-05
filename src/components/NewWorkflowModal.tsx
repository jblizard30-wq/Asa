'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createWorkflow, duplicateWorkflow } from '@/lib/actions/workflows';

export interface WorkflowTeamOption {
  id: string;
  name: string;
}

export interface WorkflowTemplateOption {
  id: string;
  name: string;
}

export function NewWorkflowModal({
  teams,
  templates,
  onClose,
}: {
  teams: WorkflowTeamOption[];
  templates: WorkflowTemplateOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'blank' | 'template'>('blank');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState('');
  const [isTemplate, setIsTemplate] = useState(false);
  const [sourceTemplateId, setSourceTemplateId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (mode === 'template' && !sourceTemplateId) {
      setError('Choose a template to start from');
      return;
    }

    setLoading(true);
    setError(null);
    const result =
      mode === 'template'
        ? await duplicateWorkflow(sourceTemplateId, name.trim())
        : await createWorkflow({
            name: name.trim(),
            description: description.trim() || undefined,
            teamId: teamId || undefined,
            isTemplate,
          });
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? 'Something went wrong.');
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">New workflow</h2>

        <div className="mt-4 inline-flex rounded-md border border-slate-200 p-1 dark:border-slate-600">
          <button
            type="button"
            onClick={() => setMode('blank')}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              mode === 'blank' ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Start blank
          </button>
          <button
            type="button"
            onClick={() => setMode('template')}
            disabled={templates.length === 0}
            className={`rounded px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
              mode === 'template' ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            From a template
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. New Member Onboarding"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700"
            />
          </div>

          {mode === 'template' ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Copy structure from
              </label>
              <select
                value={sourceTemplateId}
                onChange={(e) => setSourceTemplateId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
              >
                <option value="">Choose a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Stages, tasks, and subtasks are copied. You can reassign its team afterward.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Team</label>
                <select
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
                >
                  <option value="">No team</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input type="checkbox" checked={isTemplate} onChange={(e) => setIsTemplate(e.target.checked)} />
                Mark as a reusable template
              </label>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? 'Creating…' : 'Create workflow'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
