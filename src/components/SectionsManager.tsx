'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSection, deleteSection, reorderSections, updateSection } from '@/lib/actions/sections';
import type { KanbanSection } from '@/components/KanbanBoard';

export function SectionsManager({
  projectId,
  sections,
  onClose,
}: {
  projectId: string;
  sections: KanbanSection[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [newSectionName, setNewSectionName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renames, setRenames] = useState<Record<string, string>>({});
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null);
  const [targetDestinationId, setTargetDestinationId] = useState<string>('');

  async function handleCreate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const name = newSectionName.trim();
    if (!name) return;

    setSaving(true);
    setError(null);
    const result = await createSection(projectId, name);
    setSaving(false);

    if (!result.success) {
      setError(result.error ?? 'Could not create column.');
      return;
    }

    setNewSectionName('');
    router.refresh();
  }

  async function handleRename(sectionId: string, originalName: string) {
    const nextName = (renames[sectionId] ?? originalName).trim();
    if (!nextName || nextName === originalName) return;

    setError(null);
    const result = await updateSection(sectionId, nextName);
    if (!result.success) {
      setError(result.error ?? 'Could not rename column.');
      return;
    }
    router.refresh();
  }

  async function handleMoveOrder(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    setError(null);
    const reordered = [...sections];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const result = await reorderSections(
      projectId,
      reordered.map((s) => s.id),
    );
    if (!result.success) {
      setError(result.error ?? 'Could not reorder columns.');
      return;
    }
    router.refresh();
  }

  async function confirmDelete() {
    if (!deletingSectionId) return;
    setSaving(true);
    setError(null);

    const result = await deleteSection(deletingSectionId, targetDestinationId || undefined);
    setSaving(false);

    if (!result.success) {
      setError(result.error ?? 'Could not delete column.');
      return;
    }

    setDeletingSectionId(null);
    setTargetDestinationId('');
    router.refresh();
  }

  const sectionToDelete = sections.find((s) => s.id === deletingSectionId);
  const remainingSections = sections.filter((s) => s.id !== deletingSectionId);

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center bg-slate-900/40 p-4 pt-16 sm:pt-24"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Project Columns</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Customize workflow columns for Kanban and List views. Rename, remove default labels, or add your own.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-2.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Delete confirmation modal overlay / inline prompt */}
          {deletingSectionId && sectionToDelete && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50/60 p-4 dark:border-red-900/60 dark:bg-red-950/30">
              <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">
                Delete &ldquo;{sectionToDelete.name}&rdquo;?
              </h3>
              {sectionToDelete.tasks.length > 0 ? (
                <div className="mt-2 space-y-3 text-xs text-red-800 dark:text-red-300">
                  <p>
                    This column contains <strong>{sectionToDelete.tasks.length}</strong> task
                    {sectionToDelete.tasks.length === 1 ? '' : 's'}. Choose where to move them:
                  </p>
                  <select
                    value={targetDestinationId || remainingSections[0]?.id}
                    onChange={(e) => setTargetDestinationId(e.target.value)}
                    className="w-full rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-xs dark:border-red-800 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {remainingSections.map((s) => (
                      <option key={s.id} value={s.id}>
                        Move to: {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                  This column is empty and will be permanently removed.
                </p>
              )}
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeletingSectionId(null);
                    setTargetDestinationId('');
                  }}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={confirmDelete}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? 'Deleting…' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          )}

          {/* List of existing sections */}
          <div className="space-y-2">
            {sections.map((section, index) => {
              const taskCount = section.tasks.length;
              return (
                <div
                  key={section.id}
                  className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800/60"
                >
                  {/* Reordering buttons */}
                  <div className="flex flex-col">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMoveOrder(index, 'up')}
                      className="text-slate-400 hover:text-slate-700 disabled:opacity-25 dark:hover:text-slate-200"
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={index === sections.length - 1}
                      onClick={() => handleMoveOrder(index, 'down')}
                      className="text-slate-400 hover:text-slate-700 disabled:opacity-25 dark:hover:text-slate-200"
                      title="Move down"
                    >
                      ▼
                    </button>
                  </div>

                  {/* Section name input */}
                  <div className="flex-1">
                    <input
                      type="text"
                      defaultValue={section.name}
                      onChange={(e) => setRenames((prev) => ({ ...prev, [section.id]: e.target.value }))}
                      onBlur={() => handleRename(section.id, section.name)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-slate-900"
                    />
                  </div>

                  {/* Task count pill */}
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                    {taskCount} task{taskCount === 1 ? '' : 's'}
                  </span>

                  {/* Delete button */}
                  <button
                    type="button"
                    disabled={sections.length <= 1}
                    onClick={() => {
                      setDeletingSectionId(section.id);
                      setTargetDestinationId(sections.find((s) => s.id !== section.id)?.id ?? '');
                    }}
                    title={
                      sections.length <= 1
                        ? 'Project must have at least one column'
                        : `Delete column "${section.name}"`
                    }
                    className="shrink-0 rounded-md p-1.5 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  >
                    🗑️
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add column form */}
          <form onSubmit={handleCreate} className="mt-6 flex items-center gap-2">
            <input
              type="text"
              placeholder="New column name (e.g. Backlog, Liturgical Prep)…"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-hidden focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={saving || !newSectionName.trim()}
              className="shrink-0 rounded-md bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Adding…' : '+ Add column'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

