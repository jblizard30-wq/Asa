'use client';

import { useState } from 'react';
import { NewWorkflowModal, type WorkflowTeamOption } from '@/components/NewWorkflowModal';
import { WorkflowBuilderPanel } from '@/components/WorkflowBuilderPanel';

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

export function WorkflowsManager({ workflows, teams }: { workflows: WorkflowSummary[]; teams: WorkflowTeamOption[] }) {
  const [showNewWorkflow, setShowNewWorkflow] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const templates = workflows.filter((w) => w.isTemplate);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Workflows</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Build out stages, tasks, and subtasks a team follows. Mark any workflow as a template to reuse its
            structure elsewhere.
          </p>
        </div>
        <button
          onClick={() => setShowNewWorkflow(true)}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + New workflow
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {workflows.map((workflow) => (
          <button
            key={workflow.id}
            onClick={() => setSelectedId(selectedId === workflow.id ? null : workflow.id)}
            className={`rounded-lg border p-4 text-left transition ${
              selectedId === workflow.id
                ? 'border-brand-400 ring-1 ring-brand-400'
                : 'border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500'
            } bg-white dark:bg-slate-800`}
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
              <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{workflow.description}</p>
            )}
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              {workflow.team ? workflow.team.name : 'No team'} · {workflow.stageCount} stage
              {workflow.stageCount === 1 ? '' : 's'} · {workflow.taskCount} task{workflow.taskCount === 1 ? '' : 's'}
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Created by {workflow.createdByName}</p>
          </button>
        ))}

        {workflows.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-600">
            No workflows yet. Create one to get started.
          </div>
        )}
      </div>

      {selectedId && (
        <WorkflowBuilderPanel
          key={selectedId}
          workflowId={selectedId}
          teams={teams}
          onClose={() => setSelectedId(null)}
          onDeleted={() => setSelectedId(null)}
        />
      )}

      {showNewWorkflow && (
        <NewWorkflowModal teams={teams} templates={templates} onClose={() => setShowNewWorkflow(false)} />
      )}
    </div>
  );
}
