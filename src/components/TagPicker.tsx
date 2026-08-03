'use client';

import { useEffect, useRef, useState } from 'react';
import { TAG_COLOR_DOT_STYLES, TAG_COLOR_STYLES } from '@/lib/format';

export interface TagInfo {
  id: string;
  name: string;
  color: string;
}

export function TagBadge({ tag, onRemove }: { tag: TagInfo; onRemove?: () => void }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        TAG_COLOR_STYLES[tag.color] ?? TAG_COLOR_STYLES.slate
      }`}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${tag.name} tag`}
          className="ml-0.5 leading-none hover:opacity-60"
        >
          ×
        </button>
      )}
    </span>
  );
}

export function TagPicker({
  allTags,
  selectedIds,
  onChange,
}: {
  allTags: TagInfo[];
  selectedIds: string[];
  onChange: (tagIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function toggle(tagId: string) {
    onChange(selectedIds.includes(tagId) ? selectedIds.filter((id) => id !== tagId) : [...selectedIds, tagId]);
  }

  const selectedTags = allTags.filter((t) => selectedIds.includes(t.id));

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedTags.map((tag) => (
          <TagBadge key={tag.id} tag={tag} onRemove={() => toggle(tag.id)} />
        ))}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-400 hover:border-slate-400 hover:text-slate-600 dark:border-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          + Tag
        </button>
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-48 rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {allTags.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-slate-400 dark:text-slate-500">
              No tags yet. Create some in &ldquo;Manage tags&rdquo;.
            </p>
          ) : (
            allTags.map((tag) => (
              <label
                key={tag.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(tag.id)}
                  onChange={() => toggle(tag.id)}
                  className="h-3.5 w-3.5 shrink-0"
                />
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TAG_COLOR_DOT_STYLES[tag.color] ?? TAG_COLOR_DOT_STYLES.slate}`} />
                <span className="truncate text-slate-700 dark:text-slate-200">{tag.name}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
