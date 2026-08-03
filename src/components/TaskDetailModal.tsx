'use client';

import { useEffect, useRef, useState, useTransition, type ChangeEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { getTaskDetail, updateTask, deleteTask } from '@/lib/actions/tasks';
import { setTaskCustomFieldValue } from '@/lib/actions/customFields';
import { setTaskTags } from '@/lib/actions/tags';
import { addComment } from '@/lib/actions/comments';
import { uploadAttachment, deleteAttachment } from '@/lib/actions/attachments';
import { PRIORITY_LABELS, STATUS_LABELS, RECURRENCE_LABELS } from '@/lib/format';
import { QuickAddTask } from '@/components/QuickAddTask';
import { SendReminderModal } from '@/components/SendReminderModal';
import { MentionInput } from '@/components/MentionInput';
import { TagPicker } from '@/components/TagPicker';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;
type FieldValue = TaskDetail['fieldValues'][number];

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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
                  <label className="block text-xs font-medium text-slate-500">Assignee</label>
                  {(task.viewerRole === 'ADMIN' || task.viewerRole === 'MANAGER') && task.assigneeId && (
                    <button
                      type="button"
                      onClick={() => setShowReminder(true)}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      🔔 Remind
                    </button>
                  )}
                </div>
                <select
                  defaultValue={task.assigneeId ?? ''}
                  onChange={(e) => handleFieldChange('assigneeId', e.target.value || null)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5"
                >
                  <option value="">Unassigned</option>
                  {task.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">Due date</label>
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
              <h3 className="text-sm font-semibold text-slate-700">Sequence</h3>

              {task.locked && task.predecessor && (
                <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  🔒 Locked until &ldquo;{task.predecessor.title}&rdquo; is marked done.
                </p>
              )}

              <div className="mt-2">
                <label className="block text-xs font-medium text-slate-500">Comes after</label>
                <select
                  key={task.predecessor?.id ?? 'none'}
                  defaultValue={task.predecessor?.id ?? ''}
                  onChange={(e) => handleFieldChange('predecessorId', e.target.value || null)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                >
                  <option value="">No predecessor — can start anytime</option>
                  {task.projectTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              {task.successors.length > 0 && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-slate-500">
                    Then ({task.successors.length})
                  </label>
                  <ul className="mt-1 space-y-1">
                    {task.successors.map((s) => (
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
                  predecessorId={task.id}
                  label="+ Add task after this one"
                  onAdded={refresh}
                />
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <label className="block text-xs font-medium text-slate-500">Repeat</label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <select
                  value={task.recurrence}
                  onChange={(e) => handleFieldChange('recurrence', e.target.value)}
                  className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                >
                  {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                {task.recurrence !== 'NONE' && (
                  <>
                    <span className="text-sm text-slate-500">every</span>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={task.recurrenceInterval}
                      onChange={(e) => handleFieldChange('recurrenceInterval', Number(e.target.value) || 1)}
                      className="w-16 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                    />
                    <span className="text-sm text-slate-500">
                      {
                        {
                          DAILY: 'day(s)',
                          WEEKLY: 'week(s)',
                          MONTHLY: 'month(s)',
                          YEARLY: 'year(s)',
                        }[task.recurrence]
                      }
                    </span>
                  </>
                )}
              </div>

              {task.recurrence !== 'NONE' && (
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-500">Ends on</label>
                  <input
                    type="date"
                    value={task.recurrenceEndDate ? task.recurrenceEndDate.slice(0, 10) : ''}
                    onChange={(e) => handleFieldChange('recurrenceEndDate', e.target.value || null)}
                    className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                  />
                  <span className="text-xs text-slate-400">(optional)</span>
                </div>
              )}

              {task.recurrence !== 'NONE' && (
                <p className="mt-2 text-xs text-slate-400">
                  Completing this task will automatically reschedule it to the next occurrence instead of marking it
                  done for good.
                </p>
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
              <button onClick={handleDelete} className="text-xs font-medium text-red-500 hover:text-red-600">
                Delete task
              </button>
            </div>
          </div>
        )}
      </div>

      {showReminder && task && task.assigneeId && (
        <SendReminderModal
          recipientId={task.assigneeId}
          recipientName={task.members.find((m) => m.id === task.assigneeId)?.name ?? 'this user'}
          taskId={task.id}
          onClose={() => setShowReminder(false)}
        />
      )}
    </div>
  );
}
