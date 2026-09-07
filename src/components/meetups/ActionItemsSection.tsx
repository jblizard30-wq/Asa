// src/components/meetups/ActionItemsSection.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ClipboardListIcon, PlusIcon, TrashIcon } from '@/components/MeetupIcons';
import { convertActionItemsToTasks } from '@/lib/actions/meetups';
import { useToast } from '@/components/Toast';

export interface ActionItemsSectionProps {
  meetupId: string;
  canManage: boolean;
  availableProjects?: Array<{
    id: string;
    name: string;
    sections?: Array<{ id: string; name: string }>;
  }>;
  availableUsers?: Array<{ id: string; name: string | null; email: string }>;
  linkedTasks?: Array<{
    id: string;
    title: string;
    status: string;
    projectId: string;
    projectName: string;
  }>;
}

export function ActionItemsSection({
  meetupId,
  canManage,
  availableProjects = [],
  availableUsers = [],
  linkedTasks = [],
}: ActionItemsSectionProps) {
  const toast = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(availableProjects[0]?.id || '');
  const [items, setItems] = useState<Array<{ id: string; title: string; assigneeId: string; dueDate: string }>>([
    { id: '1', title: '', assigneeId: '', dueDate: '' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addItem = () => {
    setItems((prev) => [...prev, { id: Date.now().toString(), title: '', assigneeId: '', dueDate: '' }]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: 'title' | 'assigneeId' | 'dueDate', val: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: val } : item)));
  };

  const handleConvert = async () => {
    const validItems = items.filter((item) => item.title.trim().length > 0);
    if (validItems.length === 0) return;

    setError(null);
    setIsSubmitting(true);
    const result = await convertActionItemsToTasks(
      meetupId,
      validItems.map((i) => ({
        title: i.title,
        assigneeId: i.assigneeId || undefined,
        dueDate: i.dueDate || undefined,
      })),
      { projectId: selectedProjectId || undefined }
    );
    setIsSubmitting(false);

    if (result.success) {
      toast.success(`Created ${result.taskCount} task${result.taskCount === 1 ? '' : 's'} in project!`);
      setItems([{ id: Date.now().toString(), title: '', assigneeId: '', dueDate: '' }]);
    } else {
      setError(result.error);
      toast.error('Task creation failed', result.error);
    }
  };

  const completedCount = linkedTasks.filter((t) => t.status === 'DONE').length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
            <ClipboardListIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Action Items → Assigned Tasks
              </h3>
              {linkedTasks.length > 0 && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {completedCount}/{linkedTasks.length} Completed
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Turn key decisions and next steps directly into assigned tasks in any project
            </p>
          </div>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750 transition-colors shrink-0"
          >
            <PlusIcon className="h-3 w-3" />
            <span>Add item</span>
          </button>
        )}
      </div>

      {/* Linked Tasks from Previous Conversions */}
      {linkedTasks.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Active Project Tasks Linked to this Meetup
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {linkedTasks.map((t) => (
              <Link
                key={t.id}
                href={`/projects/${t.projectId}`}
                className="flex items-center justify-between p-2 rounded-lg border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="truncate">
                  <span className={`text-xs ${t.status === 'DONE' ? 'line-through text-slate-400 dark:text-slate-500' : 'font-medium text-slate-800 dark:text-slate-200'}`}>
                    {t.title}
                  </span>
                  <p className="text-[10px] text-slate-400">{t.projectName}</p>
                </div>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${t.status === 'DONE' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'}`}>
                  {t.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Creator Form (Managers & Creators only) */}
      {canManage && (
        <div className="space-y-3 pt-2">
          {availableProjects.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Target Project:
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-hidden"
              >
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

          <div className="space-y-2.5">
            {items.map((item, idx) => (
              <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-slate-50/60 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="font-mono text-xs text-slate-400 dark:text-slate-500 w-4 text-center sm:text-right shrink-0">
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  placeholder="Action item title (e.g. Confirm speaker lodging)"
                  value={item.title}
                  onChange={(e) => updateItem(item.id, 'title', e.target.value)}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />

                {availableUsers.length > 0 && (
                  <select
                    value={item.assigneeId}
                    onChange={(e) => updateItem(item.id, 'assigneeId', e.target.value)}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 focus:outline-hidden"
                  >
                    <option value="">Unassigned</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                )}

                <input
                  type="date"
                  value={item.dueDate}
                  onChange={(e) => updateItem(item.id, 'dueDate', e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 focus:outline-hidden"
                />

                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-slate-400 hover:text-rose-500 p-1"
                    title="Remove item"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleConvert}
              disabled={isSubmitting || items.every((i) => !i.title.trim())}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Creating Tasks…' : 'Generate Project Tasks'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
