'use client';

import { useMemo, useState, useTransition } from 'react';
import { createAutomationRule } from '@/lib/actions/automations';
import { STATUS_LABELS, PRIORITY_LABELS } from '@/lib/format';
import type { AutomationProjectOption } from '@/components/AutomationRulesView';

const selectClass =
  'mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200';
const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400';

export function NewAutomationRuleModal({
  defaultProjectId,
  options,
  onClose,
  onCreated,
}: {
  defaultProjectId: string;
  options: AutomationProjectOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [sourceProjectId, setSourceProjectId] = useState(defaultProjectId);
  const [sourceTaskId, setSourceTaskId] = useState('');

  const [triggerType, setTriggerType] = useState<'STATUS_CHANGED' | 'ASSIGNEE_CHANGED' | 'DUE_DATE_APPROACHING'>(
    'STATUS_CHANGED',
  );
  const [triggerStatus, setTriggerStatus] = useState('DONE');
  const [triggerDaysBefore, setTriggerDaysBefore] = useState('1');

  const [actionType, setActionType] = useState<'SET_STATUS' | 'SET_ASSIGNEE' | 'MOVE_SECTION' | 'CREATE_TASK'>(
    'SET_STATUS',
  );
  const [targetProjectId, setTargetProjectId] = useState(defaultProjectId);
  const [targetTaskId, setTargetTaskId] = useState('');
  const [actionStatus, setActionStatus] = useState('TODO');
  const [assigneeMode, setAssigneeMode] = useState<'SPECIFIC_USER' | 'SAME_AS_SOURCE'>('SAME_AS_SOURCE');
  const [actionAssigneeId, setActionAssigneeId] = useState('');
  const [targetSectionId, setTargetSectionId] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('MEDIUM');
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const tasksFor = useMemo(
    () => (projectId: string) => {
      const project = options.find((p) => p.id === projectId);
      if (!project) return [];
      return project.sections.flatMap((s) => s.tasks.map((t) => ({ id: t.id, label: `${s.name} / ${t.title}` })));
    },
    [options],
  );
  const sectionsFor = (projectId: string) => options.find((p) => p.id === projectId)?.sections ?? [];
  const membersFor = (projectId: string) => options.find((p) => p.id === projectId)?.members ?? [];

  const needsTargetTask = actionType === 'SET_STATUS' || actionType === 'SET_ASSIGNEE' || actionType === 'MOVE_SECTION';
  const needsTargetSection = actionType === 'MOVE_SECTION' || actionType === 'CREATE_TASK';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError('Name is required');
    if (!sourceTaskId) return setError('Select a source task');
    if (needsTargetTask && !targetTaskId) return setError('Select a target task');
    if (needsTargetSection && !targetSectionId) return setError('Select a destination section');
    if (actionType === 'CREATE_TASK' && !newTaskTitle.trim()) return setError('Enter a title for the new task');

    startTransition(async () => {
      const result = await createAutomationRule({
        name,
        sourceTaskId,
        triggerType,
        triggerStatus: triggerType === 'STATUS_CHANGED' ? (triggerStatus as 'TODO' | 'IN_PROGRESS' | 'DONE') : undefined,
        triggerDaysBefore: triggerType === 'DUE_DATE_APPROACHING' ? Number(triggerDaysBefore) : undefined,
        actionType,
        targetTaskId: needsTargetTask ? targetTaskId : undefined,
        actionStatus: actionType === 'SET_STATUS' ? (actionStatus as 'TODO' | 'IN_PROGRESS' | 'DONE') : undefined,
        assigneeMode: actionType === 'SET_ASSIGNEE' ? assigneeMode : undefined,
        actionAssigneeId:
          actionType === 'SET_ASSIGNEE' && assigneeMode === 'SPECIFIC_USER' ? actionAssigneeId : undefined,
        targetSectionId: needsTargetSection ? targetSectionId : undefined,
        newTaskTitle: actionType === 'CREATE_TASK' ? newTaskTitle : undefined,
        newTaskDescription: actionType === 'CREATE_TASK' ? newTaskDescription || undefined : undefined,
        newTaskPriority: actionType === 'CREATE_TASK' ? (newTaskPriority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT') : undefined,
        newTaskAssigneeId: actionType === 'CREATE_TASK' ? newTaskAssigneeId || undefined : undefined,
      });
      if (!result.success) {
        setError(result.error ?? 'Something went wrong.');
        return;
      }
      onCreated();
    });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900 dark:shadow-slate-950/50"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">New automation rule</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          <div>
            <label className={labelClass}>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Unlock printing once bulletin is done"
              className={selectClass}
            />
          </div>

          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">When…</h3>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Project</label>
                <select
                  value={sourceProjectId}
                  onChange={(e) => {
                    setSourceProjectId(e.target.value);
                    setSourceTaskId('');
                  }}
                  className={selectClass}
                >
                  {options.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Task</label>
                <select value={sourceTaskId} onChange={(e) => setSourceTaskId(e.target.value)} className={selectClass}>
                  <option value="">Select a task…</option>
                  {tasksFor(sourceProjectId).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Trigger</label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as typeof triggerType)}
                  className={selectClass}
                >
                  <option value="STATUS_CHANGED">Status changes to…</option>
                  <option value="ASSIGNEE_CHANGED">Assignee changes</option>
                  <option value="DUE_DATE_APPROACHING">Due date is approaching</option>
                </select>
              </div>
              {triggerType === 'STATUS_CHANGED' && (
                <div>
                  <label className={labelClass}>Status</label>
                  <select value={triggerStatus} onChange={(e) => setTriggerStatus(e.target.value)} className={selectClass}>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {triggerType === 'DUE_DATE_APPROACHING' && (
                <div>
                  <label className={labelClass}>Days before due date</label>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={triggerDaysBefore}
                    onChange={(e) => setTriggerDaysBefore(e.target.value)}
                    className={selectClass}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Then…</h3>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Action</label>
                <select
                  value={actionType}
                  onChange={(e) => {
                    setActionType(e.target.value as typeof actionType);
                    setTargetTaskId('');
                    setTargetSectionId('');
                  }}
                  className={selectClass}
                >
                  <option value="SET_STATUS">Set status</option>
                  <option value="SET_ASSIGNEE">Set assignee</option>
                  <option value="MOVE_SECTION">Move to section</option>
                  <option value="CREATE_TASK">Create a new task</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Project</label>
                <select
                  value={targetProjectId}
                  onChange={(e) => {
                    setTargetProjectId(e.target.value);
                    setTargetTaskId('');
                    setTargetSectionId('');
                    setActionAssigneeId('');
                    setNewTaskAssigneeId('');
                  }}
                  className={selectClass}
                >
                  {options.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {needsTargetTask && (
                <div className="col-span-2">
                  <label className={labelClass}>Target task</label>
                  <select value={targetTaskId} onChange={(e) => setTargetTaskId(e.target.value)} className={selectClass}>
                    <option value="">Select a task…</option>
                    {tasksFor(targetProjectId).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {actionType === 'SET_STATUS' && (
                <div>
                  <label className={labelClass}>New status</label>
                  <select value={actionStatus} onChange={(e) => setActionStatus(e.target.value)} className={selectClass}>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {actionType === 'SET_ASSIGNEE' && (
                <>
                  <div>
                    <label className={labelClass}>Who</label>
                    <select
                      value={assigneeMode}
                      onChange={(e) => setAssigneeMode(e.target.value as typeof assigneeMode)}
                      className={selectClass}
                    >
                      <option value="SAME_AS_SOURCE">Same person as the source task</option>
                      <option value="SPECIFIC_USER">A specific person</option>
                    </select>
                  </div>
                  {assigneeMode === 'SPECIFIC_USER' && (
                    <div>
                      <label className={labelClass}>Person</label>
                      <select
                        value={actionAssigneeId}
                        onChange={(e) => setActionAssigneeId(e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Select…</option>
                        {membersFor(targetProjectId).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {needsTargetSection && (
                <div className="col-span-2">
                  <label className={labelClass}>{actionType === 'CREATE_TASK' ? 'Destination section' : 'Destination section'}</label>
                  <select
                    value={targetSectionId}
                    onChange={(e) => setTargetSectionId(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Select a section…</option>
                    {sectionsFor(targetProjectId).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {actionType === 'CREATE_TASK' && (
                <>
                  <div className="col-span-2">
                    <label className={labelClass}>New task title</label>
                    <input
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className={selectClass}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Description (optional)</label>
                    <textarea
                      value={newTaskDescription}
                      onChange={(e) => setNewTaskDescription(e.target.value)}
                      rows={2}
                      className={selectClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Priority</label>
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value)}
                      className={selectClass}
                    >
                      {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Assignee (optional)</label>
                    <select
                      value={newTaskAssigneeId}
                      onChange={(e) => setNewTaskAssigneeId(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Unassigned</option>
                      {membersFor(targetProjectId).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {isPending ? 'Creating…' : 'Create rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
