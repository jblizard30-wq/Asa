'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  applyWorkflowToProject,
  generateSettingsWriteup,
  saveSettingsWriteup,
} from '@/lib/actions/workflows';
import { PRIORITY_LABELS, PRIORITY_STYLES, STATUS_LABELS } from '@/lib/format';

interface BranchSubtaskInfo {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigneeName: string | null;
}

interface BranchTaskInfo extends BranchSubtaskInfo {
  subtasks: BranchSubtaskInfo[];
}

interface BranchSectionInfo {
  id: string;
  name: string;
  tasks: BranchTaskInfo[];
}

export interface BranchMapData {
  id: string;
  name: string;
  description: string | null;
  settingsWriteup: string | null;
  workflow: { id: string; name: string; teamName: string | null } | null;
  sections: BranchSectionInfo[];
}

export interface WorkflowOption {
  id: string;
  name: string;
  isTemplate: boolean;
  teamName: string | null;
}

function TaskNode({ task }: { task: BranchSubtaskInfo & { subtasks?: BranchSubtaskInfo[] } }) {
  const subtasks = task.subtasks ?? [];
  return (
    <li className="mt-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-slate-800 dark:text-slate-200">{task.title}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {STATUS_LABELS[task.status] ?? task.status}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${PRIORITY_STYLES[task.priority] ?? ''}`}>
          {PRIORITY_LABELS[task.priority] ?? task.priority}
        </span>
        {task.assigneeName && <span className="text-xs text-slate-400">{task.assigneeName}</span>}
      </div>
      {subtasks.length > 0 && (
        <ul className="ml-3 mt-1 border-l border-slate-200 pl-4 dark:border-slate-700">
          {subtasks.map((sub) => (
            <TaskNode key={sub.id} task={sub} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function WorkflowBranchMap({
  projectId,
  data,
  workflowOptions,
}: {
  projectId: string;
  data: BranchMapData;
  workflowOptions: WorkflowOption[];
}) {
  const router = useRouter();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const [writeupText, setWriteupText] = useState(data.settingsWriteup ?? '');
  const [includeWriteup, setIncludeWriteup] = useState(Boolean(data.settingsWriteup));
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedJustNow, setSavedJustNow] = useState(false);
  const [writeupError, setWriteupError] = useState<string | null>(null);

  async function handleApply() {
    if (!selectedWorkflowId) return;
    setApplying(true);
    setApplyError(null);
    const result = await applyWorkflowToProject(projectId, selectedWorkflowId);
    setApplying(false);
    if (!result.success) {
      setApplyError(result.error ?? 'Could not apply that workflow.');
      return;
    }
    router.refresh();
  }

  async function handleGenerateSummary() {
    if (writeupText.trim() && !confirm('Replace your current write-up with a fresh auto-generated summary?')) {
      return;
    }
    setGenerating(true);
    setWriteupError(null);
    const result = await generateSettingsWriteup(projectId);
    setGenerating(false);
    if (!result.success) {
      setWriteupError(result.error ?? 'Could not generate a summary.');
      return;
    }
    if (!result.text) {
      setWriteupError('Could not generate a summary.');
      return;
    }
    setWriteupText(result.text);
  }

  async function handleSaveWriteup() {
    setSaving(true);
    setWriteupError(null);
    const result = await saveSettingsWriteup(projectId, writeupText);
    setSaving(false);
    if (!result.success) {
      setWriteupError(result.error ?? 'Could not save the write-up.');
      return;
    }
    setSavedJustNow(true);
    setTimeout(() => setSavedJustNow(false), 2000);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Workflow</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            A printable branch map of {data.name}&rsquo;s sections, tasks, and subtasks.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Print
        </button>
      </div>

      {!data.workflow && (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-4 print:hidden dark:border-slate-700">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Apply a workflow to this project
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={selectedWorkflowId}
              onChange={(e) => setSelectedWorkflowId(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">Choose a workflow…</option>
              {workflowOptions.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.teamName ? ` (${w.teamName})` : ''}
                  {w.isTemplate ? ' — template' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={handleApply}
              disabled={!selectedWorkflowId || applying}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {applying ? 'Applying…' : 'Apply'}
            </button>
          </div>
          {applyError && <p className="mt-2 text-sm text-red-600">{applyError}</p>}
          <p className="mt-2 text-xs text-slate-400">
            This creates the workflow&rsquo;s sections and tasks in this project. The branch map below always reflects
            this project&rsquo;s live tasks, so it works even without applying a workflow.
          </p>
        </div>
      )}

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{data.name}</h2>
        {data.workflow && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Built from workflow: {data.workflow.name}
            {data.workflow.teamName ? ` (${data.workflow.teamName} team)` : ''}
          </p>
        )}
        {data.description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{data.description}</p>}

        <div className="mt-4 space-y-5">
          {data.sections.map((section) => (
            <div key={section.id}>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">{section.name}</h3>
              <ul className="ml-3 mt-1 border-l border-slate-200 pl-4 dark:border-slate-700">
                {section.tasks.map((task) => (
                  <TaskNode key={task.id} task={task} />
                ))}
                {section.tasks.length === 0 && <li className="mt-2 text-sm text-slate-400">No tasks yet.</li>}
              </ul>
            </div>
          ))}
          {data.sections.length === 0 && <p className="text-sm text-slate-400">No sections yet.</p>}
        </div>
      </div>

      <div className="mt-8 border-t border-slate-200 pt-4 print:hidden dark:border-slate-700">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={includeWriteup} onChange={(e) => setIncludeWriteup(e.target.checked)} />
          Include settings write-up in printout
        </label>
        <textarea
          value={writeupText}
          onChange={(e) => setWriteupText(e.target.value)}
          rows={8}
          placeholder="Write up the details behind this project's settings, or insert an auto-generated summary below."
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={handleGenerateSummary}
            disabled={generating}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {generating ? 'Generating…' : 'Insert auto-summary'}
          </button>
          <button
            onClick={handleSaveWriteup}
            disabled={saving}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save write-up'}
          </button>
          {savedJustNow && <span className="text-sm text-green-600">Saved</span>}
        </div>
        {writeupError && <p className="mt-2 text-sm text-red-600">{writeupError}</p>}
      </div>

      {includeWriteup && writeupText.trim() && (
        <div className="mt-8">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Settings write-up</h3>
          <div className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{writeupText}</div>
        </div>
      )}
    </div>
  );
}
