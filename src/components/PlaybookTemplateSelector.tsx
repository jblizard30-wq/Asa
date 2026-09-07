'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, addDays } from 'date-fns';
import {
  MINISTRY_PLAYBOOKS,
  type MinistryPlaybook,
  type PlaybookSectionTemplate,
  type PlaybookTaskTemplate,
} from '@/lib/ministryPlaybooks';
import { instantiatePlaybookAction } from '@/lib/actions/playbooks';
import { PRIORITY_STYLES } from '@/lib/format';

export interface PlaybookTemplateSelectorProps {
  onClose: () => void;
  onSuccess?: (projectId: string) => void;
}

export function PlaybookTemplateSelector({ onClose, onSuccess }: PlaybookTemplateSelectorProps) {
  const router = useRouter();
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string>(MINISTRY_PLAYBOOKS[0].id);
  const [startDate, setStartDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [customName, setCustomName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSectionIndex, setActiveSectionIndex] = useState<number>(0);

  const selectedPlaybook = MINISTRY_PLAYBOOKS.find((p) => p.id === selectedPlaybookId) ?? MINISTRY_PLAYBOOKS[0];

  const totalTasks = selectedPlaybook.sections.reduce((acc, sec) => acc + sec.tasks.length, 0);

  async function handleInstantiate() {
    if (!startDate) {
      setError('Please choose a start date.');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await instantiatePlaybookAction(
      selectedPlaybook.id,
      startDate,
      customName.trim() || undefined
    );

    setLoading(false);

    if (!result.success || !result.projectId) {
      setError(result.error ?? 'Failed to instantiate playbook.');
      return;
    }

    if (onSuccess) {
      onSuccess(result.projectId);
    }
    router.refresh();
    router.push(`/projects/${result.projectId}`);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex h-[90vh] max-h-[820px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📚</span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Ministry Playbook Library
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Battle-tested operational frameworks with structured sections, RACI roles, and relative timeline offsets.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Content Body: Two-Pane Split View */}
        <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
          {/* Left Pane: Playbook Catalog Cards */}
          <div className="w-full border-r border-slate-200 p-4 md:w-80 md:overflow-y-auto dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Select a Playbook Template
            </h3>
            <div className="space-y-2.5">
              {MINISTRY_PLAYBOOKS.map((pb) => {
                const isSelected = pb.id === selectedPlaybook.id;
                const pbTaskCount = pb.sections.reduce((a, s) => a + s.tasks.length, 0);

                return (
                  <button
                    key={pb.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlaybookId(pb.id);
                      setActiveSectionIndex(0);
                      setCustomName('');
                    }}
                    className={`w-full rounded-xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-white shadow-md ring-2 ring-brand-500/20 dark:bg-slate-900 dark:border-brand-500'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl">{pb.icon}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {pb.estimatedWeeks} wks
                      </span>
                    </div>
                    <div className="mt-2 font-semibold text-sm text-slate-900 dark:text-slate-100">
                      {pb.name}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                      {pb.description}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{pb.category}</span>
                      <span>{pbTaskCount} tasks · {pb.sections.length} sections</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Pane: Selected Playbook Details, RACI Matrix & Section Explorer */}
          <div className="flex flex-1 flex-col overflow-hidden bg-white p-6 dark:bg-slate-900">
            {/* Header & Meta */}
            <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{selectedPlaybook.icon}</span>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {selectedPlaybook.name}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                    {selectedPlaybook.category}
                  </span>
                  <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                    ⏱ {selectedPlaybook.estimatedWeeks} Weeks Timeline
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {selectedPlaybook.description}
              </p>
            </div>

            {/* Sections & Sample Tasks Preview with RACI */}
            <div className="flex-1 overflow-y-auto py-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Sections & Sample Tasks ({selectedPlaybook.sections.length} Sections, {totalTasks} Tasks)
                </span>
                <span className="text-xs text-brand-600 dark:text-brand-400 font-medium">
                  RACI Roles & Relative Offsets Pre-Configured
                </span>
              </div>

              {/* Section Tabs */}
              <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
                {selectedPlaybook.sections.map((sec, idx) => (
                  <button
                    key={sec.name}
                    type="button"
                    onClick={() => setActiveSectionIndex(idx)}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeSectionIndex === idx
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {sec.name} ({sec.tasks.length})
                  </button>
                ))}
              </div>

              {/* Active Section Tasks List */}
              <div className="mt-3 space-y-2">
                {selectedPlaybook.sections[activeSectionIndex]?.tasks.map((task, tIdx) => {
                  const projectedDueDate = startDate
                    ? format(addDays(new Date(startDate), task.dueOffsetDays), 'MMM d, yyyy')
                    : `+${task.dueOffsetDays}d`;

                  return (
                    <div
                      key={tIdx}
                      className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-950/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {task.title}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                PRIORITY_STYLES[task.priority]
                              }`}
                            >
                              {task.priority}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {task.description}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Day +{task.dueOffsetDays}
                          </span>
                          <div className="text-[10px] text-slate-400">{projectedDueDate}</div>
                        </div>
                      </div>

                      {/* RACI Matrix Badges */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-slate-200/60 pt-2 text-[11px] dark:border-slate-800/80">
                        <span className="font-semibold text-slate-400 text-[10px]">RACI:</span>
                        <span className="rounded bg-rose-50 px-2 py-0.5 text-rose-700 font-medium dark:bg-rose-950/50 dark:text-rose-300">
                          <strong className="font-bold">R:</strong> {task.raci.responsible}
                        </span>
                        <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-700 font-medium dark:bg-amber-950/50 dark:text-amber-300">
                          <strong className="font-bold">A:</strong> {task.raci.accountable}
                        </span>
                        {task.raci.consulted && (
                          <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700 font-medium dark:bg-blue-950/50 dark:text-blue-300">
                            <strong className="font-bold">C:</strong> {task.raci.consulted}
                          </span>
                        )}
                        {task.raci.informed && (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600 font-medium dark:bg-slate-800 dark:text-slate-400">
                            <strong className="font-bold">I:</strong> {task.raci.informed}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Form: Kickoff Date & Instantiate Action */}
            <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
              {error && (
                <div className="mb-3 rounded-md bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-950/60 dark:text-red-300">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="startDateInput"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                  >
                    Playbook Kickoff / Start Date
                  </label>
                  <input
                    id="startDateInput"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <span className="text-[10px] text-slate-400">
                    All task due dates will calculate relative to this kickoff date.
                  </span>
                </div>

                <div>
                  <label
                    htmlFor="customNameInput"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                  >
                    Project Name (Optional)
                  </label>
                  <input
                    id="customNameInput"
                    type="text"
                    placeholder={`${selectedPlaybook.name} (${startDate ? new Date(startDate).getFullYear() : '2026'})`}
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Creates <strong>{selectedPlaybook.sections.length}</strong> sections &{' '}
                  <strong>{totalTasks}</strong> tasks with full RACI metadata.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleInstantiate}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
                  >
                    {loading ? (
                      <>
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Instantiating…</span>
                      </>
                    ) : (
                      <>
                        <span>🚀</span>
                        <span>Instantiate Playbook</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

