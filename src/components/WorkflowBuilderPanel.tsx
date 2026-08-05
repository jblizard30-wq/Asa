'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  addStage,
  addTaskTemplate,
  deleteStage,
  deleteTaskTemplate,
  deleteWorkflow,
  duplicateWorkflow,
  getWorkflowDetail,
  moveStage,
  moveTaskTemplate,
  renameStage,
  updateTaskTemplate,
  updateWorkflow,
} from '@/lib/actions/workflows';
import { PRIORITY_LABELS } from '@/lib/format';
import type { WorkflowTeamOption } from '@/components/NewWorkflowModal';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

interface SubtaskTemplateInfo {
  id: string;
  title: string;
  description: string | null;
  defaultPriority: (typeof PRIORITIES)[number];
}

interface TaskTemplateInfo extends SubtaskTemplateInfo {
  subtasks: SubtaskTemplateInfo[];
}

interface StageInfo {
  id: string;
  name: string;
  taskTemplates: TaskTemplateInfo[];
}

interface WorkflowDetailInfo {
  id: string;
  name: string;
  description: string | null;
  isTemplate: boolean;
  teamId: string | null;
  team: { id: string; name: string } | null;
  stages: StageInfo[];
}

export function WorkflowBuilderPanel({
  workflowId,
  teams,
  onClose,
  onDeleted,
}: {
  workflowId: string;
  teams: WorkflowTeamOption[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<WorkflowDetailInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newStageName, setNewStageName] = useState('');
  const [newTaskTitleByStage, setNewTaskTitleByStage] = useState<Record<string, string>>({});
  const [newSubtaskTitleByTask, setNewSubtaskTitleByTask] = useState<Record<string, string>>({});

  const refreshDetail = useCallback(async () => {
    const result = await getWorkflowDetail(workflowId);
    setDetail(result as WorkflowDetailInfo | null);
  }, [workflowId]);

  useEffect(() => {
    void refreshDetail();
  }, [refreshDetail]);

  async function withErrorHandling(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    const result = await action();
    if (!result.success) {
      setError(result.error ?? 'Something went wrong.');
      return;
    }
    await refreshDetail();
    router.refresh();
  }

  if (!detail) {
    return (
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-400 dark:border-slate-600 dark:bg-slate-800">
        Loading workflow…
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-600 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-4">
        <input
          defaultValue={detail.name}
          onBlur={(e) => {
            const value = e.target.value.trim();
            if (value && value !== detail.name) void withErrorHandling(() => updateWorkflow(detail.id, { name: value }));
          }}
          className="w-full max-w-sm rounded border border-transparent bg-transparent text-lg font-semibold text-slate-900 hover:border-slate-200 focus:border-slate-300 focus:outline-none dark:text-slate-100 dark:hover:border-slate-600"
        />
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => {
              const name = prompt('Name for the duplicate workflow?', `${detail.name} (copy)`);
              if (name) void withErrorHandling(() => duplicateWorkflow(detail.id, name));
            }}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Duplicate
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete "${detail.name}"? This cannot be undone.`)) {
                void deleteWorkflow(detail.id).then((result) => {
                  if (result.success) {
                    router.refresh();
                    onDeleted();
                  } else {
                    setError(result.error ?? 'Could not delete this workflow.');
                  }
                });
              }
            }}
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
          >
            Delete
          </button>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            ✕
          </button>
        </div>
      </div>

      <textarea
        defaultValue={detail.description ?? ''}
        onBlur={(e) => {
          const value = e.target.value.trim();
          if (value !== (detail.description ?? '')) void withErrorHandling(() => updateWorkflow(detail.id, { description: value }));
        }}
        placeholder="Description (optional)"
        rows={2}
        className="mt-2 w-full rounded border border-transparent bg-transparent text-sm text-slate-500 hover:border-slate-200 focus:border-slate-300 focus:outline-none dark:text-slate-400 dark:hover:border-slate-600"
      />

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          Team
          <select
            defaultValue={detail.teamId ?? ''}
            onChange={(e) => void withErrorHandling(() => updateWorkflow(detail.id, { teamId: e.target.value }))}
            className="rounded-md border border-slate-200 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-700"
          >
            <option value="">No team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={detail.isTemplate}
            onChange={(e) => void withErrorHandling(() => updateWorkflow(detail.id, { isTemplate: e.target.checked }))}
          />
          Reusable template
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-5 space-y-4">
        {detail.stages.map((stage, stageIndex) => (
          <div key={stage.id} className="rounded-md border border-slate-200 p-3 dark:border-slate-600">
            <div className="flex items-center gap-2">
              <div className="flex shrink-0 flex-col">
                <button
                  disabled={stageIndex === 0}
                  onClick={() => void withErrorHandling(() => moveStage(stage.id, 'up'))}
                  className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
                  aria-label="Move stage up"
                >
                  ▲
                </button>
                <button
                  disabled={stageIndex === detail.stages.length - 1}
                  onClick={() => void withErrorHandling(() => moveStage(stage.id, 'down'))}
                  className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
                  aria-label="Move stage down"
                >
                  ▼
                </button>
              </div>
              <input
                defaultValue={stage.name}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value && value !== stage.name) void withErrorHandling(() => renameStage(stage.id, value));
                }}
                className="w-full max-w-xs rounded border border-transparent bg-transparent font-medium text-slate-800 hover:border-slate-200 focus:border-slate-300 focus:outline-none dark:text-slate-200 dark:hover:border-slate-600"
              />
              <span className="text-xs text-slate-400">Stage</span>
              <button
                onClick={() => {
                  if (confirm(`Delete stage "${stage.name}" and everything in it?`)) {
                    void withErrorHandling(() => deleteStage(stage.id));
                  }
                }}
                className="ml-auto shrink-0 text-xs font-medium text-red-500 hover:text-red-600"
              >
                Delete stage
              </button>
            </div>

            <div className="ml-6 mt-3 space-y-2 border-l border-slate-100 pl-4 dark:border-slate-700">
              {stage.taskTemplates.map((task, taskIndex) => (
                <div key={task.id}>
                  <div className="flex items-center gap-2">
                    <div className="flex shrink-0 flex-col">
                      <button
                        disabled={taskIndex === 0}
                        onClick={() => void withErrorHandling(() => moveTaskTemplate(task.id, 'up'))}
                        className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        aria-label="Move task up"
                      >
                        ▲
                      </button>
                      <button
                        disabled={taskIndex === stage.taskTemplates.length - 1}
                        onClick={() => void withErrorHandling(() => moveTaskTemplate(task.id, 'down'))}
                        className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        aria-label="Move task down"
                      >
                        ▼
                      </button>
                    </div>
                    <input
                      defaultValue={task.title}
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        if (value && value !== task.title) void withErrorHandling(() => updateTaskTemplate(task.id, { title: value }));
                      }}
                      className="w-full max-w-xs rounded border border-transparent bg-transparent text-sm text-slate-700 hover:border-slate-200 focus:border-slate-300 focus:outline-none dark:text-slate-300 dark:hover:border-slate-600"
                    />
                    <select
                      defaultValue={task.defaultPriority}
                      onChange={(e) =>
                        void withErrorHandling(() =>
                          updateTaskTemplate(task.id, { defaultPriority: e.target.value as (typeof PRIORITIES)[number] }),
                        )
                      }
                      className="rounded-md border border-slate-200 px-1.5 py-1 text-xs dark:border-slate-600 dark:bg-slate-700"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {PRIORITY_LABELS[p]}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => void withErrorHandling(() => deleteTaskTemplate(task.id))}
                      className="ml-auto shrink-0 text-xs font-medium text-slate-400 hover:text-red-500"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="ml-6 mt-1 space-y-1 border-l border-slate-100 pl-4 dark:border-slate-700">
                    {task.subtasks.map((sub, subIndex) => (
                      <div key={sub.id} className="flex items-center gap-2">
                        <div className="flex shrink-0 flex-col">
                          <button
                            disabled={subIndex === 0}
                            onClick={() => void withErrorHandling(() => moveTaskTemplate(sub.id, 'up'))}
                            className="text-[10px] text-slate-400 hover:text-slate-600 disabled:opacity-30"
                            aria-label="Move subtask up"
                          >
                            ▲
                          </button>
                          <button
                            disabled={subIndex === task.subtasks.length - 1}
                            onClick={() => void withErrorHandling(() => moveTaskTemplate(sub.id, 'down'))}
                            className="text-[10px] text-slate-400 hover:text-slate-600 disabled:opacity-30"
                            aria-label="Move subtask down"
                          >
                            ▼
                          </button>
                        </div>
                        <input
                          defaultValue={sub.title}
                          onBlur={(e) => {
                            const value = e.target.value.trim();
                            if (value && value !== sub.title) void withErrorHandling(() => updateTaskTemplate(sub.id, { title: value }));
                          }}
                          className="w-full max-w-xs rounded border border-transparent bg-transparent text-sm text-slate-600 hover:border-slate-200 focus:border-slate-300 focus:outline-none dark:text-slate-400 dark:hover:border-slate-600"
                        />
                        <select
                          defaultValue={sub.defaultPriority}
                          onChange={(e) =>
                            void withErrorHandling(() =>
                              updateTaskTemplate(sub.id, { defaultPriority: e.target.value as (typeof PRIORITIES)[number] }),
                            )
                          }
                          className="rounded-md border border-slate-200 px-1.5 py-1 text-xs dark:border-slate-600 dark:bg-slate-700"
                        >
                          {PRIORITIES.map((p) => (
                            <option key={p} value={p}>
                              {PRIORITY_LABELS[p]}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => void withErrorHandling(() => deleteTaskTemplate(sub.id))}
                          className="ml-auto shrink-0 text-xs font-medium text-slate-400 hover:text-red-500"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <input
                        value={newSubtaskTitleByTask[task.id] ?? ''}
                        onChange={(e) => setNewSubtaskTitleByTask((prev) => ({ ...prev, [task.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return;
                          const title = (newSubtaskTitleByTask[task.id] ?? '').trim();
                          if (!title) return;
                          void withErrorHandling(() => addTaskTemplate(stage.id, { title, parentId: task.id })).then(() =>
                            setNewSubtaskTitleByTask((prev) => ({ ...prev, [task.id]: '' })),
                          );
                        }}
                        placeholder="+ Add subtask, press Enter"
                        className="w-full max-w-xs rounded-md border border-dashed border-slate-200 px-2 py-1 text-xs text-slate-500 focus:border-solid focus:border-brand-400 focus:outline-none dark:border-slate-600"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <input
                value={newTaskTitleByStage[stage.id] ?? ''}
                onChange={(e) => setNewTaskTitleByStage((prev) => ({ ...prev, [stage.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  const title = (newTaskTitleByStage[stage.id] ?? '').trim();
                  if (!title) return;
                  void withErrorHandling(() => addTaskTemplate(stage.id, { title })).then(() =>
                    setNewTaskTitleByStage((prev) => ({ ...prev, [stage.id]: '' })),
                  );
                }}
                placeholder="+ Add task, press Enter"
                className="w-full max-w-xs rounded-md border border-dashed border-slate-300 px-2 py-1.5 text-sm text-slate-500 focus:border-solid focus:border-brand-400 focus:outline-none dark:border-slate-500"
              />
            </div>
          </div>
        ))}

        <input
          value={newStageName}
          onChange={(e) => setNewStageName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            const name = newStageName.trim();
            if (!name) return;
            void withErrorHandling(() => addStage(detail.id, name)).then(() => setNewStageName(''));
          }}
          placeholder="+ Add stage, press Enter"
          className="w-full max-w-sm rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 focus:border-solid focus:border-brand-400 focus:outline-none dark:border-slate-500"
        />
      </div>
    </div>
  );
}
