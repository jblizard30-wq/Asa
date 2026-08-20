'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toggleAutomationRule, deleteAutomationRule } from '@/lib/actions/automations';
import { STATUS_LABELS, AUTOMATION_ACTION_LABELS } from '@/lib/format';
import { NewAutomationRuleModal } from '@/components/NewAutomationRuleModal';

export interface AutomationProjectOption {
  id: string;
  name: string;
  members: { id: string; name: string }[];
  sections: { id: string; name: string; tasks: { id: string; title: string; recurring: boolean }[] }[];
}

export interface AutomationRuleSummary {
  id: string;
  name: string;
  enabled: boolean;
  createdByName: string;
  triggerType: string;
  triggerStatus: string | null;
  triggerDaysBefore: number | null;
  actionType: string;
  actionStatus: string | null;
  assigneeMode: string | null;
  actionAssignee: { id: string; name: string } | null;
  newTaskTitle: string | null;
  newTaskAssignee: { id: string; name: string } | null;
  sourceTask: { id: string; title: string; projectName: string; recurring: boolean } | null;
  targetTask: { id: string; title: string; projectName: string; recurring: boolean } | null;
  targetSection: { id: string; name: string; projectName: string } | null;
  runs: { id: string; status: string; detail: string | null; createdAt: string }[];
}

function triggerSummary(rule: AutomationRuleSummary): string {
  if (rule.triggerType === 'STATUS_CHANGED') {
    return `status becomes ${STATUS_LABELS[rule.triggerStatus ?? ''] ?? rule.triggerStatus}`;
  }
  if (rule.triggerType === 'ASSIGNEE_CHANGED') return 'the assignee changes';
  return `its due date is ${rule.triggerDaysBefore ?? 0} day(s) away`;
}

function actionSummary(rule: AutomationRuleSummary): string {
  switch (rule.actionType) {
    case 'SET_STATUS':
      return `set "${rule.targetTask?.title}" to ${STATUS_LABELS[rule.actionStatus ?? ''] ?? rule.actionStatus}`;
    case 'SET_ASSIGNEE':
      return rule.assigneeMode === 'SAME_AS_SOURCE'
        ? `assign "${rule.targetTask?.title}" to the same person`
        : `assign "${rule.targetTask?.title}" to ${rule.actionAssignee?.name ?? 'someone'}`;
    case 'MOVE_SECTION':
      return `move "${rule.targetTask?.title}" to ${rule.targetSection?.name}`;
    case 'CREATE_TASK':
      return `create "${rule.newTaskTitle}" in ${rule.targetSection?.name}`;
    default:
      return '';
  }
}

export function AutomationRulesView({
  projectId,
  projectName,
  rules,
  options,
}: {
  projectId: string;
  projectName: string;
  rules: AutomationRuleSummary[];
  options: AutomationProjectOption[];
}) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle(ruleId: string, enabled: boolean) {
    startTransition(async () => {
      await toggleAutomationRule(ruleId, enabled);
      router.refresh();
    });
  }

  function handleDelete(ruleId: string) {
    if (!confirm('Delete this automation rule?')) return;
    startTransition(async () => {
      await deleteAutomationRule(ruleId);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/projects/${projectId}`}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            ← {projectName}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">Automations</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Rules that automatically act on a task when something happens to another task.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="shrink-0 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + New rule
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {rules.length === 0 && (
          <p className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No automation rules yet for this project.
          </p>
        )}
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{rule.name}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  When <span className="font-medium">&ldquo;{rule.sourceTask?.title}&rdquo;</span>
                  {rule.sourceTask?.recurring && <span className="text-xs text-slate-400"> (recurring series)</span>}{' '}
                  {triggerSummary(rule)} → {AUTOMATION_ACTION_LABELS[rule.actionType]?.toLowerCase()}:{' '}
                  {actionSummary(rule)}
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Created by {rule.createdByName}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    disabled={isPending}
                    onChange={(e) => handleToggle(rule.id, e.target.checked)}
                  />
                  Enabled
                </label>
                <button
                  onClick={() => setExpandedId(expandedId === rule.id ? null : rule.id)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  History
                </button>
                <button
                  onClick={() => handleDelete(rule.id)}
                  disabled={isPending}
                  className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>

            {expandedId === rule.id && (
              <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                {rule.runs.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500">No runs yet.</p>
                ) : (
                  <ul className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    {rule.runs.map((run) => (
                      <li key={run.id}>
                        <span
                          className={
                            run.status === 'SUCCESS'
                              ? 'text-green-600 dark:text-green-400'
                              : run.status === 'FAILED'
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-slate-400'
                          }
                        >
                          {run.status}
                        </span>{' '}
                        {new Date(run.createdAt).toLocaleString()}
                        {run.detail ? ` — ${run.detail}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {showNew && (
        <NewAutomationRuleModal
          defaultProjectId={projectId}
          options={options}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
