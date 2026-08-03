'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTag, deleteTag, updateTag } from '@/lib/actions/tags';
import { TAG_COLORS, TAG_COLOR_DOT_STYLES, type TagColor } from '@/lib/format';
import type { TagInfo } from '@/components/TagPicker';

export function TagsManager({
  projectId,
  tags,
  onClose,
}: {
  projectId: string;
  tags: TagInfo[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [color, setColor] = useState<TagColor>('slate');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renameById, setRenameById] = useState<Record<string, string>>({});

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const result = await createTag(projectId, { name: name.trim(), color });
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Could not create that tag.');
      return;
    }
    setName('');
    setColor('slate');
    router.refresh();
  }

  async function handleRename(tagId: string, currentName: string) {
    const nextName = (renameById[tagId] ?? currentName).trim();
    if (!nextName || nextName === currentName) return;
    const result = await updateTag(tagId, { name: nextName });
    if (!result.success) {
      setError(result.error ?? 'Could not rename that tag.');
      return;
    }
    router.refresh();
  }

  async function handleColorChange(tagId: string, nextColor: TagColor) {
    await updateTag(tagId, { color: nextColor });
    router.refresh();
  }

  async function handleDelete(tagId: string) {
    if (!confirm('Delete this tag? It will be removed from every task.')) return;
    await deleteTag(tagId);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center bg-slate-900/40 p-4 pt-16 sm:pt-24" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Tags</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="p-6">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tags are color-coded labels you can assign to any task in this project — from the task detail panel or
            Grid view.
          </p>

          <div className="mt-4 space-y-2">
            {tags.length === 0 && <p className="text-sm text-slate-400">No tags yet.</p>}
            {tags.map((tag) => (
              <div key={tag.id} className="flex items-center gap-2 rounded-md border border-slate-200 p-2 dark:border-slate-700">
                <div className="flex shrink-0 gap-1">
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleColorChange(tag.id, c)}
                      aria-label={`Set color to ${c}`}
                      className={`h-4 w-4 rounded-full ${TAG_COLOR_DOT_STYLES[c]} ${
                        tag.color === c ? 'ring-2 ring-offset-1 ring-slate-400 dark:ring-offset-slate-900' : ''
                      }`}
                    />
                  ))}
                </div>
                <input
                  defaultValue={tag.name}
                  onChange={(e) => setRenameById((prev) => ({ ...prev, [tag.id]: e.target.value }))}
                  onBlur={() => handleRename(tag.id, tag.name)}
                  className="w-full min-w-0 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-slate-800 hover:border-slate-200 focus:border-slate-300 focus:outline-none dark:text-slate-200 dark:hover:border-slate-700"
                />
                <button
                  onClick={() => handleDelete(tag.id)}
                  className="shrink-0 text-xs font-medium text-red-500 hover:text-red-600"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Add a tag</h3>
            <div className="mt-2 flex flex-col gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tag name"
                className="rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
              <div className="flex flex-wrap gap-1.5">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Choose ${c}`}
                    className={`h-6 w-6 rounded-full ${TAG_COLOR_DOT_STYLES[c]} ${
                      color === c ? 'ring-2 ring-offset-1 ring-slate-400 dark:ring-offset-slate-900' : ''
                    }`}
                  />
                ))}
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                onClick={handleCreate}
                disabled={saving || !name.trim()}
                className="self-start rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? 'Adding…' : 'Add tag'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
