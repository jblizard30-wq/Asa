'use client';

import { useEffect, useRef, useState, useTransition, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { getTaskDetail, updateTask, deleteTask, addDependency, removeDependency } from '@/lib/actions/tasks';
import { setTaskRecurrence, type SetTaskRecurrenceInput } from '@/lib/actions/taskRecurrences';
import { setTaskCustomFieldValue } from '@/lib/actions/customFields';
import { setTaskTags } from '@/lib/actions/tags';
import { addComment } from '@/lib/actions/comments';
import { uploadAttachment, deleteAttachment } from '@/lib/actions/attachments';
import { logTime, deleteTimeEntry } from '@/lib/actions/timeEntries';
import { createGuestLink, listGuestLinks, revokeGuestLink } from '@/lib/actions/guestAccess';
import { PRIORITY_LABELS, STATUS_LABELS, ACTIVITY_ACTION_ICONS } from '@/lib/format';
import { QuickAddTask } from '@/components/QuickAddTask';
import { SendReminderModal } from '@/components/SendReminderModal';
import { RemindMeModal } from '@/components/RemindMeModal';
import { MentionInput } from '@/components/MentionInput';
import { TagPicker } from '@/components/TagPicker';
import { AssigneePicker } from '@/components/AssigneePicker';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;
type FieldValue = TaskDetail['fieldValues'][number];
type GuestLink = Awaited<ReturnType<typeof listGuestLinks>>[number];
type TaskRecurrenceDetail = NonNullable<TaskDetail['taskRecurrence']>;

/**
 * Frequency/interval/mode/end-date form for an active recurrence. The mode radio buttons are
 * worded in plain language on purpose (per the two real examples below) rather than a bare
 * "periodic vs after_completion" toggle — mixing these up is the most common recurring-task
 * complaint in tools that get this wrong.
 */
function RecurrenceEditor({
  recurrence,
  onChange,
}: {
  recurrence: TaskRecurrenceDetail;
  onChange: (input: SetTaskRecurrenceInput) => void;
}) {
  function update(patch: Partial<SetTaskRecurrenceInput>) {
    onChange({
      frequency: recurrence.frequency,
      interval: recurrence.interval,
      mode: recurrence.mode,
      endsAt: recurrence.endsAt,
      ...patch,
    });
  }

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500">Every</span>
        <input
          type="number"
          min={1}
          max={365}
          value={recurrence.interval}
          onChange={(e) => update({ interval: Number(e.target.value) || 1 })}
          className="w-16 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
        />
        <select
          value={recurrence.frequency}
          onChange={(e) => update({ frequency: e.target.value as SetTaskRecurrenceInput['frequency'] })}
          className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
        >
          <option value="DAILY">day(s)</option>
          <option value="WEEKLY">week(s)</option>
          <option value="MONTHLY">month(s)</option>
          <option value="YEARLY">year(s)</option>
        </select>
      </div>

      <div className="mt-3 space-y-2">
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="recurrence-mode"
            checked={recurrence.mode === 'PERIODIC'}
            onChange={() => update({ mode: 'PERIODIC' })}
            className="mt-0.5 h-4 w-4"
          />
          <span className="text-sm text-slate-700">
            Repeat on schedule, whether or not the last one got done
            <span className="block text-xs text-slate-400">
              e.g. &ldquo;Set up chairs&rdquo; — happens on schedule regardless of last time
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="recurrence-mode"
            checked={recurrence.mode === 'AFTER_COMPLETION'}
            onChange={() => update({ mode: 'AFTER_COMPLETION' })}
            className="mt-0.5 h-4 w-4"
          />
          <span className="text-sm text-slate-700">
            Only create the next one after this one is done
            <span className="block text-xs text-slate-400">
              e.g. &ldquo;Replace HVAC filter&rdquo; — the next one is dated from whenever you finish this one
            </span>
          </span>
        </label>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <label className="text-xs font-medium text-slate-500">Ends on</label>
        <input
          type="date"
          value={recurrence.endsAt ? recurrence.endsAt.slice(0, 10) : ''}
          onChange={(e) => update({ endsAt: e.target.value || null })}
          className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
        />
        <span className="text-xs text-slate-400">(optional)</span>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        {recurrence.mode === 'PERIODIC'
          ? 'A new occurrence is created on schedule automatically, whether or not this one is marked done.'
          : 'Marking this task done creates the next occurrence, dated from today.'}
      </p>
    </>
  );
}

/** Checkbox dropdown for picking which other project tasks this task is blocked by. */
function DependencyPicker({
  options,
  selectedIds,
  onToggle,
}: {
  options: { id: string; title: string }[];
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const selected = options.filter((o) => selectedIds.includes(o.id));

  return (
    <div className="relative mt-1" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full truncate rounded-md border border-slate-200 px-2 py-1.5 text-left text-sm dark:border-slate-600 dark:bg-slate-900"
      >
        {selected.length === 0 ? (
          <span className="text-slate-400 dark:text-slate-500">No blockers — can start anytime</span>
        ) : (
          <span className="text-slate-700 dark:text-slate-200">{selected.map((s) => s.title).join(', ')}</span>
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {options.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-slate-400 dark:text-slate-500">No other tasks in this project yet.</p>
          ) : (
            options.map((o) => (
              <label
                key={o.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(o.id)}
                  onChange={(e) => onToggle(o.id, e.target.checked)}
                  className="h-3.5 w-3.5 shrink-0"
                />
                <span className="truncate text-slate-700 dark:text-slate-200">{o.title}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Bolds any "@FullName" substring that matches a project member, so mentions stand out in the thread. */
function renderCommentBody(body: string, members: { id: string; name: string }[]) {
  if (members.length === 0) return body;
  const names = [...new Set(members.map((m) => m.name))].sort((a, b) => b.length - a.length);
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`@(${escaped.join('|')})\\b`, 'g');

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body))) {
    if (match.index > lastIndex) parts.push(body.slice(lastIndex, match.index));
    parts.push(
      <strong key={match.index} className="font-semibold text-brand-700">
        @{match[1]}
      </strong>,
    );
    lastIndex = match.index + match[0].length;
  }
  parts.push(body.slice(lastIndex));
  return parts;
}

export function TaskDetailModal({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const router = useRouter();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [statusError, setStatusError] = useState<string | null>(null);
  const [showReminder, setShowReminder] = useState(false);
  const [showRemindMe, setShowRemindMe] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [timeMinutes, setTimeMinutes] = useState('');
  const [timeNote, setTimeNote] = useState('');
  const [timeSubmitting, setTimeSubmitting] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [guestLinks, setGuestLinks] = useState<GuestLink[] | null>(null);
  const [creatingGuestLink, setCreatingGuestLink] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTaskDetail(taskId).then((data) => {
      if (!cancelled) {
        setTask(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  function refresh() {
    getTaskDetail(taskId).then((data) => setTask(data));
    router.refresh();
  }

  function handleFieldChange(field: string, value: string | number | null) {
    handleFieldsChange({ [field]: value });
  }

  function handleRecurrenceChange(input: SetTaskRecurrenceInput | null) {
    if (!task) return;
    const previous = task;
    // Optimistic update, same pattern as handleFieldsChange — without it, this checkbox/radio
    // group flickers back to its old value on every click until the round trip resolves, since
    // their `checked` props are controlled by server state.
    setTask({
      ...task,
      taskRecurrence: input
        ? {
            id: task.taskRecurrence?.id ?? 'pending',
            mode: input.mode,
            frequency: input.frequency,
            interval: input.interval,
            endsAt: input.endsAt ?? null,
          }
        : null,
    });
    setStatusError(null);
    startTransition(async () => {
      const result = await setTaskRecurrence(taskId, input);
      if (!result.success) {
        setTask(previous);
        setStatusError(result.error ?? 'Could not save recurrence settings.');
        return;
      }
      refresh();
    });
  }

  function handleFieldsChange(fields: Record<string, string | number | null>) {
    if (!task) return;
    const previous = task;
    setTask({ ...task, ...fields } as TaskDetail);
    setStatusError(null);
    startTransition(async () => {
      const result = await updateTask(taskId, fields as never);
      if (!result.success) {
        setTask(previous);
        setStatusError(result.error ?? 'Could not save that change.');
        return;
      }
      router.refresh();
    });
  }

  async function handleAddComment(body: string, mentionedUserIds: string[]) {
    await addComment(taskId, { body, mentionedUserIds });
    refresh();
  }

  async function handleToggleSubtask(subtaskId: string, done: boolean) {
    if (!task) return;
    setTask({
      ...task,
      subtasks: task.subtasks.map((s) => (s.id === subtaskId ? { ...s, status: done ? 'DONE' : 'TODO' } : s)),
    });
    await updateTask(subtaskId, { status: done ? 'DONE' : 'TODO' });
    router.refresh();
  }

  function handleCustomFieldChange(fieldId: string, patch: Partial<Omit<FieldValue, 'customFieldId'>>) {
    if (!task) return;
    const next: FieldValue = {
      customFieldId: fieldId,
      textValue: null,
      numberValue: null,
      dateValue: null,
      boolValue: null,
      optionId: null,
      ...task.fieldValues.find((v) => v.customFieldId === fieldId),
      ...patch,
    };
    setTask({
      ...task,
      fieldValues: [...task.fieldValues.filter((v) => v.customFieldId !== fieldId), next],
    });
    startTransition(async () => {
      await setTaskCustomFieldValue(taskId, fieldId, patch);
      router.refresh();
    });
  }

  async function handleDelete() {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    await deleteTask(taskId);
    router.refresh();
    onClose();
  }

  async function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    const formData = new FormData();
    formData.set('file', file);
    const result = await uploadAttachment(taskId, formData);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!result.success) {
      setUploadError(result.error ?? 'Could not upload that file.');
      return;
    }
    refresh();
  }

  async function handleDeleteAttachment(attachmentId: string) {
    if (!confirm('Remove this attachment?')) return;
    await deleteAttachment(attachmentId);
    refresh();
  }

  function handleTagsChange(tagIds: string[]) {
    if (!task) return;
    setTask({ ...task, tags: task.allTags.filter((t) => tagIds.includes(t.id)) });
    startTransition(async () => {
      await setTaskTags(taskId, tagIds);
      router.refresh();
    });
  }

  function handleAssigneesChange(assigneeIds: string[]) {
    if (!task) return;
    const previous = task;
    setTask({ ...task, assignees: task.members.filter((m) => assigneeIds.includes(m.id)) });
    setStatusError(null);
    startTransition(async () => {
      const result = await updateTask(taskId, { assigneeIds } as never);
      if (!result.success) {
        setTask(previous);
        setStatusError(result.error ?? 'Could not save that change.');
        return;
      }
      router.refresh();
    });
  }

  async function handleToggleBlocker(blockerId: string, checked: boolean) {
    if (!task) return;
    if (checked) {
      const result = await addDependency(task.id, blockerId);
      if (!result.success) {
        setStatusError(result.error ?? 'Could not add that dependency.');
        return;
      }
    } else {
      await removeDependency(task.id, blockerId);
    }
    setStatusError(null);
    refresh();
  }

  async function handleLogTime(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const minutes = Number(timeMinutes);
    if (!minutes || minutes <= 0) return;
    setTimeSubmitting(true);
    await logTime(taskId, minutes, timeNote.trim() || undefined);
    setTimeMinutes('');
    setTimeNote('');
    setTimeSubmitting(false);
    refresh();
  }

  async function handleDeleteTimeEntry(entryId: string) {
    await deleteTimeEntry(entryId);
    refresh();
  }

  function handleToggleShare() {
    const next = !showShare;
    setShowShare(next);
    if (next && guestLinks === null) {
      listGuestLinks(taskId).then(setGuestLinks);
    }
  }

  async function handleCreateGuestLink() {
    setCreatingGuestLink(true);
    const result = await createGuestLink(taskId);
    setCreatingGuestLink(false);
    if (result.success) {
      listGuestLinks(taskId).then(setGuestLinks);
    } else {
      setStatusError(result.error ?? 'Could not create a guest link.');
    }
  }

  async function handleRevokeGuestLink(id: string) {
    await revokeGuestLink(id);
    listGuestLinks(taskId).then(setGuestLinks);
  }

  async function handleCopyGuestLink(path: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    } catch {
      // clipboard access denied — the link is still visible in the panel to copy manually
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center bg-slate-900/40 p-4 pt-16 sm:pt-24"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {loading || !task ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : (
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <input
                defaultValue={task.title}
                onBlur={(e) => e.target.value !== task.title && handleFieldChange('title', e.target.value)}
                className="w-full text-lg font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-400 rounded"
              />
              <button onClick={onClose} className="shrink-0 text-slate-400 hover:text-slate-600" aria-label="Close">
                ✕
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">{task.projectName}</p>

            <textarea
              defaultValue={task.description ?? ''}
              placeholder="Add a description…"
              onBlur={(e) => e.target.value !== (task.description ?? '') && handleFieldChange('description', e.target.value)}
              rows={3}
              className="mt-4 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            />

            <div className="mt-2">
              <label className="block text-xs font-medium text-slate-500">Link</label>
              <input
                type="url"
                defaultValue={task.url ?? ''}
                placeholder="https://…"
                onBlur={(e) => e.target.value !== (task.url ?? '') && handleFieldChange('url', e.target.value || null)}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
              />
              {task.url && (
                <a
                  href={task.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block truncate text-xs text-brand-600 hover:underline"
                >
                  {task.url}
                </a>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-500">Tags</label>
              <div className="mt-1">
                <TagPicker
                  allTags={task.allTags}
                  selectedIds={task.tags.map((t) => t.id)}
                  onChange={handleTagsChange}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-500">Assignees</label>
                  {(task.viewerRole === 'ADMIN' || task.viewerRole === 'MANAGER') && task.assignees.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowReminder(true)}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      🔔 Remind
                    </button>
                  )}
                </div>
                <AssigneePicker
                  members={task.members}
                  selectedIds={task.assignees.map((a) => a.id)}
                  onChange={handleAssigneesChange}
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-500">Due date</label>
                  {task.assignees.some((a) => a.id === task.viewerId) && (
                    <button
                      type="button"
                      onClick={() => setShowRemindMe(true)}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      ⏰ Remind me
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  defaultValue={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                  onChange={(e) => handleFieldChange('dueDate', e.target.value || null)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">Priority</label>
                <select
                  defaultValue={task.priority}
                  onChange={(e) => handleFieldChange('priority', e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5"
                >
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">Status</label>
                <select
                  key={task.status}
                  defaultValue={task.status}
                  onChange={(e) => handleFieldChange('status', e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5"
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {statusError && <p className="mt-2 text-xs text-red-600">{statusError}</p>}

            <div className="mt-4 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-700">Dependencies</h3>

              {task.locked && (
                <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  🔒 Locked until{' '}
                  {task.blockedBy
                    .filter((b) => b.status !== 'DONE')
                    .map((b) => `"${b.title}"`)
                    .join(', ')}{' '}
                  {task.blockedBy.filter((b) => b.status !== 'DONE').length > 1 ? 'are' : 'is'} marked done.
                </p>
              )}

              <div className="mt-2">
                <label className="block text-xs font-medium text-slate-500">Blocked by</label>
                <DependencyPicker
                  options={task.projectTasks}
                  selectedIds={task.blockedBy.map((b) => b.id)}
                  onToggle={handleToggleBlocker}
                />
              </div>

              {task.blocking.length > 0 && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-slate-500">Blocks ({task.blocking.length})</label>
                  <ul className="mt-1 space-y-1">
                    {task.blocking.map((s) => (
                      <li key={s.id} className="flex items-center justify-between text-sm text-slate-700">
                        <span className="truncate">{s.title}</span>
                        <span className="ml-2 shrink-0 text-xs text-slate-400">{STATUS_LABELS[s.status]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-2">
                <QuickAddTask
                  projectId={task.projectId}
                  sectionId={task.sectionId}
                  blockerId={task.id}
                  label="+ Add task after this one"
                  onAdded={refresh}
                />
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <label className="block text-xs font-medium text-slate-500">Repeat</label>

              <label className="mt-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={task.taskRecurrence !== null}
                  onChange={(e) =>
                    handleRecurrenceChange(
                      e.target.checked ? { frequency: 'WEEKLY', interval: 1, mode: 'PERIODIC', endsAt: null } : null,
                    )
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm text-slate-700">This task repeats</span>
              </label>

              {task.taskRecurrence && (
                <RecurrenceEditor recurrence={task.taskRecurrence} onChange={handleRecurrenceChange} />
              )}
            </div>

            {task.customFields.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold text-slate-700">Custom fields</h3>
                <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                  {task.customFields.map((field) => {
                    const value = task.fieldValues.find((v) => v.customFieldId === field.id);
                    return (
                      <div key={field.id}>
                        <label className="block text-xs font-medium text-slate-500">{field.name}</label>
                        {field.type === 'TEXT' && (
                          <input
                            defaultValue={value?.textValue ?? ''}
                            onBlur={(e) =>
                              e.target.value !== (value?.textValue ?? '') &&
                              handleCustomFieldChange(field.id, { textValue: e.target.value || null })
                            }
                            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5"
                          />
                        )}
                        {field.type === 'NUMBER' && (
                          <input
                            type="number"
                            defaultValue={value?.numberValue ?? ''}
                            onBlur={(e) =>
                              handleCustomFieldChange(field.id, {
                                numberValue: e.target.value === '' ? null : Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5"
                          />
                        )}
                        {field.type === 'DATE' && (
                          <input
                            type="date"
                            defaultValue={value?.dateValue ? value.dateValue.slice(0, 10) : ''}
                            onChange={(e) => handleCustomFieldChange(field.id, { dateValue: e.target.value || null })}
                            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5"
                          />
                        )}
                        {field.type === 'CHECKBOX' && (
                          <input
                            type="checkbox"
                            defaultChecked={value?.boolValue ?? false}
                            onChange={(e) => handleCustomFieldChange(field.id, { boolValue: e.target.checked })}
                            className="mt-2 h-4 w-4"
                          />
                        )}
                        {field.type === 'SELECT' && (
                          <select
                            defaultValue={value?.optionId ?? ''}
                            onChange={(e) => handleCustomFieldChange(field.id, { optionId: e.target.value || null })}
                            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5"
                          >
                            <option value="">—</option>
                            {field.options.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-4 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-700">
                Subtasks {task.subtasks.length > 0 && `(${task.subtasks.filter((s) => s.status === 'DONE').length}/${task.subtasks.length})`}
              </h3>
              <ul className="mt-2 space-y-1">
                {task.subtasks.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={s.status === 'DONE'}
                      onChange={(e) => handleToggleSubtask(s.id, e.target.checked)}
                      className="h-4 w-4 shrink-0"
                    />
                    <span className={`truncate text-sm ${s.status === 'DONE' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                      {s.title}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2">
                <QuickAddTask
                  projectId={task.projectId}
                  sectionId={task.sectionId}
                  parentTaskId={task.id}
                  label="+ Add subtask"
                  onAdded={refresh}
                />
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-700">
                Attachments {task.attachments.length > 0 && `(${task.attachments.length})`}
              </h3>
              <ul className="mt-2 space-y-1">
                {task.attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-md px-1 py-1.5 hover:bg-slate-50"
                  >
                    <a
                      href={a.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate text-sm text-brand-600 hover:underline"
                      title={a.fileName}
                    >
                      📎 {a.fileName}
                    </a>
                    <span className="shrink-0 text-xs text-slate-400">{formatBytes(a.fileSize)}</span>
                    <span className="shrink-0 text-xs text-slate-400">{a.uploadedByName}</span>
                    {(a.uploadedById === task.viewerId || task.viewerRole === 'ADMIN' || task.viewerRole === 'MANAGER') && (
                      <button
                        onClick={() => handleDeleteAttachment(a.id)}
                        className="shrink-0 text-xs font-medium text-red-500 hover:text-red-600"
                        aria-label={`Remove ${a.fileName}`}
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
                {task.attachments.length === 0 && <p className="text-sm text-slate-400">No files yet.</p>}
              </ul>
              <div className="mt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelected}
                  disabled={uploading}
                  className="w-full text-xs text-slate-500 file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-600 hover:file:bg-slate-100"
                />
                {uploading && <p className="mt-1 text-xs text-slate-400">Uploading…</p>}
                {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
                <p className="mt-1 text-xs text-slate-400">Up to 10MB per file.</p>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-700">
                Time logged
                {task.timeEntries.length > 0 &&
                  ` (${formatMinutes(task.timeEntries.reduce((sum, e) => sum + e.minutes, 0))})`}
              </h3>
              <ul className="mt-2 space-y-1">
                {task.timeEntries.length === 0 && <p className="text-sm text-slate-400">No time logged yet.</p>}
                {task.timeEntries.slice(0, 5).map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2 text-sm text-slate-600">
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-slate-700">{entry.userName}</span> logged{' '}
                      {formatMinutes(entry.minutes)}
                      {entry.note && <span className="text-slate-400"> — {entry.note}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
                      {formatDistanceToNow(new Date(entry.loggedAt), { addSuffix: true })}
                      {(entry.userId === task.viewerId ||
                        task.viewerRole === 'ADMIN' ||
                        task.viewerRole === 'MANAGER') && (
                        <button
                          onClick={() => handleDeleteTimeEntry(entry.id)}
                          className="font-medium text-red-500 hover:text-red-600"
                          aria-label="Remove time entry"
                        >
                          Remove
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <form onSubmit={handleLogTime} className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={1}
                  placeholder="Minutes"
                  value={timeMinutes}
                  onChange={(e) => setTimeMinutes(e.target.value)}
                  className="w-24 rounded-md border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                />
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={timeNote}
                  onChange={(e) => setTimeNote(e.target.value)}
                  className="min-w-[8rem] flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                />
                <button
                  type="submit"
                  disabled={timeSubmitting || !timeMinutes}
                  className="shrink-0 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {timeSubmitting ? 'Logging…' : 'Log time'}
                </button>
              </form>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-700">Activity</h3>
              <ul className="mt-2 space-y-2">
                {task.activities.length === 0 && <p className="text-sm text-slate-400">No activity yet.</p>}
                {task.activities.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 text-xs text-slate-500">
                    <span className="shrink-0">{ACTIVITY_ACTION_ICONS[a.action] ?? '•'}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {a.detail}
                      {a.actorName && <span className="text-slate-400"> — {a.actorName}</span>}
                    </span>
                    <span className="shrink-0 text-slate-400">
                      {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {isPending && <p className="mt-2 text-xs text-slate-400">Saving…</p>}

            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-700">Comments</h3>
              <div className="mt-3 space-y-3">
                {task.comments.length === 0 && <p className="text-sm text-slate-400">No comments yet.</p>}
                {task.comments.map((c) => (
                  <div key={c.id} className="rounded-md bg-slate-50 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700">{c.userName}</span>
                      <span className="text-xs text-slate-400">
                        {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-slate-600">{renderCommentBody(c.body, task.members)}</p>
                  </div>
                ))}
              </div>

              <MentionInput members={task.members} onSubmit={handleAddComment} />
            </div>

            <div className="mt-6 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleToggleShare}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                🔗 Share with guest
              </button>

              {showShare && (
                <div className="mt-2 space-y-2">
                  {guestLinks === null ? (
                    <p className="text-xs text-slate-400">Loading…</p>
                  ) : (
                    <>
                      {guestLinks
                        .filter((link) => !link.revokedAt)
                        .map((link) => (
                          <div
                            key={link.id}
                            className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-600"
                          >
                            <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">{link.path}</span>
                            <span className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleCopyGuestLink(link.path)}
                                className="font-medium text-brand-600 hover:text-brand-700"
                              >
                                Copy
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRevokeGuestLink(link.id)}
                                className="font-medium text-red-500 hover:text-red-600"
                              >
                                Revoke
                              </button>
                            </span>
                          </div>
                        ))}
                      {guestLinks.filter((link) => !link.revokedAt).length === 0 && (
                        <p className="text-xs text-slate-400">No active guest links.</p>
                      )}
                      <button
                        type="button"
                        onClick={handleCreateGuestLink}
                        disabled={creatingGuestLink}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {creatingGuestLink ? 'Creating…' : '+ New guest link'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 border-t border-slate-100 pt-4">
              <button onClick={handleDelete} className="text-xs font-medium text-red-500 hover:text-red-600">
                Delete task
              </button>
            </div>
          </div>
        )}
      </div>

      {showReminder && task && task.assignees.length > 0 && (
        <SendReminderModal
          recipientId={task.assignees[0].id}
          recipientName={task.assignees[0].name}
          taskId={task.id}
          onClose={() => setShowReminder(false)}
        />
      )}

      {showRemindMe && task && (
        <RemindMeModal
          taskId={task.id}
          taskTitle={task.title}
          dueDate={task.dueDate}
          onClose={() => setShowRemindMe(false)}
        />
      )}
    </div>
  );
}
