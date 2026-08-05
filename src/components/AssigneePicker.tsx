'use client';

import { useEffect, useRef, useState } from 'react';

export interface AssigneeOption {
  id: string;
  name: string;
}

/** Compact multi-select for a task's assignees, styled after TagPicker's checkbox-dropdown pattern. */
export function AssigneePicker({
  members,
  selectedIds,
  onChange,
  compact = false,
  autoOpen = false,
}: {
  members: AssigneeOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  compact?: boolean;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((v) => v !== id) : [...selectedIds, id]);
  }

  const selected = members.filter((m) => selectedIds.includes(m.id));
  const label = selected.length === 0 ? 'Unassigned' : selected.map((m) => m.name).join(', ');

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          compact
            ? 'w-full truncate rounded border border-transparent bg-transparent px-1 py-0.5 text-left text-sm hover:border-slate-200 focus:border-slate-300 focus:outline-none dark:hover:border-slate-600 dark:focus:border-slate-500'
            : 'mt-1 w-full truncate rounded-md border border-slate-200 px-2 py-1.5 text-left text-sm dark:border-slate-500 dark:bg-slate-800'
        }
      >
        {selected.length === 0 ? (
          <span className="text-slate-400 dark:text-slate-500">Unassigned</span>
        ) : (
          <span className="text-slate-700 dark:text-slate-200">{label}</span>
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-56 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-700">
          {members.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-slate-400 dark:text-slate-500">No project members yet.</p>
          ) : (
            members.map((m) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-600"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(m.id)}
                  onChange={() => toggle(m.id)}
                  className="h-3.5 w-3.5 shrink-0"
                />
                <span className="truncate text-slate-700 dark:text-slate-200">{m.name}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
