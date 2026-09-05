'use client';

import { useState } from 'react';
import { NewWorkflowModal, type WorkflowTeamOption } from '@/components/NewWorkflowModal';
import { WorkflowBuilderPanel } from '@/components/WorkflowBuilderPanel';
import { WorkflowAutomationsConfig } from '@/components/WorkflowAutomationsConfig';

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string | null;
  isTemplate: boolean;
  team: { id: string; name: string } | null;
  createdByName: string;
  stageCount: number;
  taskCount: number;
}

export function WorkflowsManager({
  workflows,
  teams,
  users = [],
  projects = [],
}: {
  workflows: WorkflowSummary[];
  teams: WorkflowTeamOption[];
  users?: Array<{ id: string; name: string | null; email: string; role: string }>;
  projects?: Array<{ id: string; name: string }>;
}) {
  const [activeTab, setActiveTab] = useState<'workflows' | 'automations'>('workflows');
  const [showNewWorkflow, setShowNewWorkflow] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const templates = workflows.filter((w) => w.isTemplate);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Workflows & Automations</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Design multi-stage ministry processes and configure cross-module automation rules across Inventory, Tasks, and XP Hub.
          </p>
        </div>

        {activeTab === 'workflows' && (
          <button
            onClick={() => setShowNewWorkflow(true)}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 shadow-sm"
          >
            + New workflow
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-1">
        <button
          onClick={() => setActiveTab('workflows')}
          className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
            activeTab === 'workflows'
              ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          Process Workflows ({workflows.length})
        </button>
        <button
          onClick={() => setActiveTab('automations')}
          className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
            activeTab === 'automations'
              ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          ⚡ Cross-Module Automations
        </button>
      </div>

      {activeTab === 'automations' ? (
        <WorkflowAutomationsConfig users={users} projects={projects} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workflows.map((workflow) => (
              <button
                key={workflow.id}
                onClick={() => setSelectedId(selectedId === workflow.id ? null : workflow.id)}
                className={`rounded-lg border p-4 text-left transition ${
                  selectedId === workflow.id
                    ? 'border-brand-400 ring-1 ring-brand-400'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                } bg-white dark:bg-slate-900`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-slate-900 dark:text-slate-100">{workflow.name}</h2>
                  {workflow.isTemplate && (
                    <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                      Template
                    </span>
                  )}
                </div>
                {workflow.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{workflow.description}</p>
                )}
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>{workflow.team ? workflow.team.name : 'All teams'}</span>
                  <span>
                    {workflow.stageCount} stages · {workflow.taskCount} tasks
                  </span>
                </div>
              </button>
            ))}
          </div>

          {selectedId && (
            <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <WorkflowBuilderPanel
                key={selectedId}
                workflowId={selectedId}
                teams={teams}
                onClose={() => setSelectedId(null)}
                onDeleted={() => setSelectedId(null)}
              />
            </div>
          )}

          {showNewWorkflow && (
            <NewWorkflowModal
              teams={teams}
              templates={templates}
              onClose={() => setShowNewWorkflow(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
