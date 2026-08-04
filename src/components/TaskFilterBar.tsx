'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DUE_DATE_PRESET_LABELS,
  EMPTY_TASK_FILTERS,
  countActiveFilters,
  type DueDatePreset,
  type TaskFilters,
} from '@/lib/taskFilters';
import { deleteSavedFilter, listSavedFilters, saveFilter, type SavedFilterDTO } from '@/lib/actions/savedFilters';

export interface FilterOption {
  id: string;
  label: string;
}

function MultiSelectFilter({
  label,
  options,
  selectedIds,
  onChange,
  isOpen,
  onToggle,
  emptyMessage,
}: {
  label: string;
  options: FilterOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  isOpen: boolean;
  onToggle: () => void;
  emptyMessage?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const active = selectedIds.length > 0;

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle();
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function toggleOption(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((v) => v !== id) : [...selectedIds, id]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium ${
          active
            ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
            : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'
        }`}
      >
        {label}
        {active && (
          <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-white">{selectedIds.length}</span>
        )}
        <span className="text-[10px] text-slate-400">▾</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {options.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-slate-400 dark:text-slate-500">{emptyMessage ?? 'No options'}</p>
          ) : (
            <>
              {active && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="mb-1 block w-full rounded px-2 py-1 text-left text-xs font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/30"
                >
                  Clear {label.toLowerCase()}
                </button>
              )}
              {options.map((opt) => (
                <label
                  key={opt.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(opt.id)}
                    onChange={() => toggleOption(opt.id)}
                    className="h-3.5 w-3.5 shrink-0"
                  />
                  <span className="truncate text-slate-700 dark:text-slate-200">{opt.label}</span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SavedFiltersControl({
  scope,
  projectId,
  filters,
  onChange,
  isOpen,
  onToggle,
}: {
  scope: string;
  projectId?: string;
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState<SavedFilterDTO[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSavedFilters(scope, projectId).then((rows) => {
      if (!cancelled) {
        setSaved(rows);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [scope, projectId]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setNewName(null);
        onToggle();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSaved((prev) => prev.filter((f) => f.id !== id));
    await deleteSavedFilter(id);
  }

  async function handleSave() {
    const name = newName?.trim();
    setNewName(null);
    if (!name) return;
    const result = await saveFilter(name, scope, filters, projectId);
    if (result.success) setSaved((prev) => [...prev, result.filter]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Saved
        <span className="text-[10px] text-slate-400">▾</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-20 mt-1 w-60 rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {!loaded ? (
            <p className="px-2 py-1.5 text-xs text-slate-400 dark:text-slate-500">Loading…</p>
          ) : saved.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-slate-400 dark:text-slate-500">No saved filters yet.</p>
          ) : (
            saved.map((row) => (
              <div key={row.id} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onChange(row.filters);
                    onToggle();
                  }}
                  className="flex-1 truncate rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {row.name}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(row.id, e)}
                  className="rounded p-1 text-xs text-slate-400 opacity-0 hover:bg-slate-200 group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-slate-600"
                  aria-label={`Delete ${row.name}`}
                >
                  &#10005;
                </button>
              </div>
            ))
          )}

          <div className="mt-1 border-t border-slate-100 pt-1 dark:border-slate-700">
            {newName !== null ? (
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') setNewName(null);
                }}
                onBlur={handleSave}
                placeholder="Filter name"
                className="w-full rounded border border-brand-300 px-2 py-1 text-sm dark:border-brand-700 dark:bg-slate-900 dark:text-slate-100"
              />
            ) : (
              <button
                type="button"
                onClick={() => setNewName('')}
                className="block w-full rounded px-2 py-1.5 text-left text-xs font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/30"
              >
                + Save current filter…
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function TaskFilterBar({
  filters,
  onChange,
  statusOptions,
  priorityOptions,
  assigneeOptions,
  teamOptions,
  tagOptions,
  projectOptions,
  showDueDate = true,
  showSearch = true,
  searchPlaceholder = 'Search tasks…',
  scope,
  projectId,
}: {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  statusOptions: FilterOption[];
  priorityOptions: FilterOption[];
  assigneeOptions?: FilterOption[];
  teamOptions?: FilterOption[];
  tagOptions?: FilterOption[];
  projectOptions?: FilterOption[];
  showDueDate?: boolean;
  showSearch?: boolean;
  searchPlaceholder?: string;
  /** Which view is asking (e.g. 'my-tasks' | 'project' | 'calendar') — scopes saved filters. Omit to hide the Saved control. */
  scope?: string;
  projectId?: string;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  function toggleOpen(key: string) {
    setOpenKey((prev) => (prev === key ? null : key));
  }

  function patch(partial: Partial<TaskFilters>) {
    onChange({ ...filters, ...partial });
  }

  const activeCount = countActiveFilters(filters);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
      <MultiSelectFilter
        label="Status"
        options={statusOptions}
        selectedIds={filters.statuses}
        onChange={(ids) => patch({ statuses: ids })}
        isOpen={openKey === 'status'}
        onToggle={() => toggleOpen('status')}
      />
      <MultiSelectFilter
        label="Priority"
        options={priorityOptions}
        selectedIds={filters.priorities}
        onChange={(ids) => patch({ priorities: ids })}
        isOpen={openKey === 'priority'}
        onToggle={() => toggleOpen('priority')}
      />
      {assigneeOptions && (
        <MultiSelectFilter
          label="Assignee"
          options={assigneeOptions}
          selectedIds={filters.assigneeIds}
          onChange={(ids) => patch({ assigneeIds: ids })}
          isOpen={openKey === 'assignee'}
          onToggle={() => toggleOpen('assignee')}
        />
      )}
      {teamOptions && (teamOptions.length > 0 || filters.teamIds.length > 0) && (
        <MultiSelectFilter
          label="Team"
          options={teamOptions}
          selectedIds={filters.teamIds}
          onChange={(ids) => patch({ teamIds: ids })}
          isOpen={openKey === 'team'}
          onToggle={() => toggleOpen('team')}
          emptyMessage="No teams for the tasks shown"
        />
      )}
      {projectOptions && (
        <MultiSelectFilter
          label="Project"
          options={projectOptions}
          selectedIds={filters.projectIds}
          onChange={(ids) => patch({ projectIds: ids })}
          isOpen={openKey === 'project'}
          onToggle={() => toggleOpen('project')}
        />
      )}
      {tagOptions && (
        <MultiSelectFilter
          label="Tags"
          options={tagOptions}
          selectedIds={filters.tagIds}
          onChange={(ids) => patch({ tagIds: ids })}
          isOpen={openKey === 'tag'}
          onToggle={() => toggleOpen('tag')}
          emptyMessage="No tags yet"
        />
      )}

      {showDueDate && (
        <div className="flex items-center gap-1.5">
          <select
            value={filters.dueDatePreset}
            onChange={(e) => patch({ dueDatePreset: e.target.value as DueDatePreset })}
            className={`rounded-md border px-2.5 py-1.5 text-sm font-medium focus:outline-none ${
              filters.dueDatePreset !== 'any'
                ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                : 'border-slate-300 text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            {Object.entries(DUE_DATE_PRESET_LABELS).map(([value, dueLabel]) => (
              <option key={value} value={value}>
                {dueLabel}
              </option>
            ))}
          </select>
          {filters.dueDatePreset === 'custom' && (
            <>
              <input
                type="date"
                value={filters.dueDateFrom ?? ''}
                onChange={(e) => patch({ dueDateFrom: e.target.value || null })}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              />
              <span className="text-xs text-slate-400 dark:text-slate-500">to</span>
              <input
                type="date"
                value={filters.dueDateTo ?? ''}
                onChange={(e) => patch({ dueDateTo: e.target.value || null })}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              />
            </>
          )}
        </div>
      )}

      {showSearch && (
        <input
          type="text"
          value={filters.search}
          onChange={(e) => patch({ search: e.target.value })}
          placeholder={searchPlaceholder}
          className="min-w-[10rem] flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
        />
      )}

      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => onChange({ ...EMPTY_TASK_FILTERS })}
          className="rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          Clear filters ({activeCount})
        </button>
      )}

      {scope && (
        <SavedFiltersControl
          scope={scope}
          projectId={projectId}
          filters={filters}
          onChange={onChange}
          isOpen={openKey === 'saved'}
          onToggle={() => toggleOpen('saved')}
        />
      )}
    </div>
  );
}
