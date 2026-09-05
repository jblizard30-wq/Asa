'use client';

import React from 'react';
import Link from 'next/link';

export interface DossierPerson {
  id: string;
  name: string;
  email: string;
  role: string;
  managerId?: string | null;
}

export interface DossierRaciItem {
  chartId: string;
  processName: string;
  designations: string[];
  stepName?: string;
}

export interface DossierTaskItem {
  id: string;
  title: string;
  priority: string;
  status: string;
  projectId?: string;
  projectName?: string;
  workflowName?: string;
}

export interface OrgChartDossierProps {
  isOpen: boolean;
  onClose: () => void;
  person: DossierPerson | null;
  manager?: { id: string; name: string; email: string } | null;
  directReports: { id: string; name: string; email: string }[];
  raciAssignments: DossierRaciItem[];
  activeTasks: DossierTaskItem[];
  onSelectPerson?: (personId: string) => void;
}

const RACI_BADGE_STYLES: Record<string, { bg: string; text: string; label: string; desc: string }> = {
  ACCOUNTABLE: {
    bg: 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700',
    text: 'text-amber-800 dark:text-amber-200',
    label: 'A',
    desc: 'Accountable (Final Owner)',
  },
  RESPONSIBLE: {
    bg: 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700',
    text: 'text-blue-800 dark:text-blue-200',
    label: 'R',
    desc: 'Responsible (Executes)',
  },
  CONSULTED: {
    bg: 'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700',
    text: 'text-purple-800 dark:text-purple-200',
    label: 'C',
    desc: 'Consulted (Advises)',
  },
  INFORMED: {
    bg: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700',
    text: 'text-slate-700 dark:text-slate-300',
    label: 'I',
    desc: 'Informed (Kept Updated)',
  },
};

export function OrgChartDossier({
  isOpen,
  onClose,
  person,
  manager,
  directReports,
  raciAssignments,
  activeTasks,
  onSelectPerson,
}: OrgChartDossierProps) {
  if (!isOpen || !person) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="relative flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dossier-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white shadow-sm">
                {person.name.charAt(0).toUpperCase()}
              </span>
              <div className="truncate">
                <h2 id="dossier-title" className="truncate text-base font-bold text-slate-900 dark:text-slate-100">
                  {person.name}
                </h2>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{person.email}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {person.role}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
            aria-label="Close dossier"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Authority & Reporting Chain */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Authority & Reporting Line
            </h3>

            {/* Immediate Manager */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Direct Supervisor
              </span>
              {manager ? (
                <div
                  onClick={() => onSelectPerson?.(manager.id)}
                  className="mt-1 flex items-center justify-between cursor-pointer group"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-800 group-hover:text-brand-600 dark:text-slate-200 dark:group-hover:text-brand-400">
                      {manager.name}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{manager.email}</p>
                  </div>
                  <span className="text-xs text-slate-400 group-hover:text-brand-600 dark:text-slate-500">
                    ➔
                  </span>
                </div>
              ) : (
                <p className="mt-1 text-xs italic text-slate-500 dark:text-slate-400">
                  Senior Executive / Root of Organization
                </p>
              )}
            </div>

            {/* Direct Reports */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Direct Reports
                </span>
                <span className="rounded-full bg-slate-200/80 px-1.5 py-0.2 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {directReports.length}
                </span>
              </div>
              {directReports.length > 0 ? (
                <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800/80">
                  {directReports.map((report) => (
                    <div
                      key={report.id}
                      onClick={() => onSelectPerson?.(report.id)}
                      className="py-1.5 flex items-center justify-between cursor-pointer group"
                    >
                      <div>
                        <p className="text-xs font-medium text-slate-700 group-hover:text-brand-600 dark:text-slate-300 dark:group-hover:text-brand-400">
                          {report.name}
                        </p>
                        <p className="text-[10px] text-slate-400">{report.email}</p>
                      </div>
                      <span className="text-xs text-slate-400 group-hover:text-brand-600">➔</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs italic text-slate-400 dark:text-slate-500">No direct reports</p>
              )}
            </div>
          </div>

          {/* RACI Matrix Responsibilities */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Governance & RACI Responsibilities
              </h3>
              <Link
                href="/raci"
                className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
              >
                Open RACI Hub ↗
              </Link>
            </div>

            {raciAssignments.length > 0 ? (
              <div className="space-y-2">
                {raciAssignments.map((raci, idx) => (
                  <div
                    key={`${raci.chartId}-${idx}`}
                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {raci.processName}
                        </p>
                        {raci.stepName && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Step: {raci.stepName}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 shrink-0">
                        {raci.designations.map((roleKey) => {
                          const style = RACI_BADGE_STYLES[roleKey] ?? RACI_BADGE_STYLES.INFORMED;
                          return (
                            <span
                              key={roleKey}
                              title={style.desc}
                              className={`flex h-5 w-5 items-center justify-center rounded-md border text-[10px] font-bold ${style.bg} ${style.text}`}
                            >
                              {style.label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center dark:border-slate-800">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  No RACI process roles currently mapped to this person.
                </p>
                <Link
                  href="/raci"
                  className="mt-2 inline-block rounded-md bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                >
                  Assign Roles in RACI Charts
                </Link>
              </div>
            )}
          </div>

          {/* Active Workflows & Tasks */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Active Workflow Tasks ({activeTasks.length})
            </h3>

            {activeTasks.length > 0 ? (
              <div className="space-y-2">
                {activeTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                          {task.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                          {task.projectName && (
                            <span className="font-semibold text-slate-600 dark:text-slate-300">
                              {task.projectName}
                            </span>
                          )}
                          {task.workflowName && (
                            <span className="rounded bg-indigo-50 px-1.5 py-0.2 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-mono">
                              ⚡ {task.workflowName}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {task.priority}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-slate-400 dark:text-slate-500">
                No active incomplete tasks assigned.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 p-4 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60 flex items-center justify-between">
          <Link
            href={`/my-tasks`}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          >
            View Assigned Tasks
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
