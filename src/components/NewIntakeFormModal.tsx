'use client';

import { useState } from 'react';
import { createIntakeForm } from '@/lib/actions/intakeForms';

export function NewIntakeFormModal({
  projectId,
  sections,
  members,
  onClose,
  onCreated,
}: {
  projectId: string;
  sections: { id: string; name: string }[];
  members: { id: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? '');
  const [defaultAssigneeId, setDefaultAssigneeId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim() || !sectionId) return;
    setSaving(true);
    setError(null);
    const result = await createIntakeForm(projectId, {
      name: name.trim(),
      description: description.trim() || undefined,
      sectionId,
      defaultAssigneeId: defaultAssigneeId || undefined,
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Could not create form');
      return;
    }
    onCreated();
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center bg-slate-900/40 p-4 pt-16 sm:pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">New intake form</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Facility Request"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">
              Description <span className="text-slate-400">(shown on the public form)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">New submissions go to</label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Default assignee (optional)</label>
            <select
              value={defaultAssigneeId}
              onChange={(e) => setDefaultAssigneeId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !sectionId}
            className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Creating…' : 'Create form'}
          </button>
        </div>
      </div>
    </div>
  );
}
