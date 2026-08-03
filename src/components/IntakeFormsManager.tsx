'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  addIntakeFormField,
  deleteIntakeFormField,
  deleteIntakeForm,
  toggleIntakeForm,
} from '@/lib/actions/intakeForms';
import { NewIntakeFormModal } from '@/components/NewIntakeFormModal';
import { TaskDetailModal } from '@/components/TaskDetailModal';

const FIELD_TYPE_LABELS: Record<string, string> = {
  TEXT: 'Text',
  TEXTAREA: 'Paragraph',
  EMAIL: 'Email',
  DATE: 'Date',
  SELECT: 'Dropdown',
};

export interface IntakeFormSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sectionId: string;
  sectionName: string;
  defaultAssigneeId: string | null;
  defaultAssigneeName: string | null;
  submissionCount: number;
  fields: {
    id: string;
    label: string;
    type: string;
    required: boolean;
    options: { id: string; label: string }[];
  }[];
  recentSubmissions: {
    id: string;
    submitterName: string;
    submitterEmail: string | null;
    createdAt: string;
    taskId: string | null;
    taskTitle: string | null;
  }[];
}

export function IntakeFormsManager({
  projectId,
  projectName,
  sections,
  members,
  forms,
}: {
  projectId: string;
  projectName: string;
  sections: { id: string; name: string }[];
  members: { id: string; name: string }[];
  forms: IntakeFormSummary[];
}) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [newFieldByForm, setNewFieldByForm] = useState<
    Record<string, { label: string; type: string; optionsText: string; required: boolean }>
  >({});

  function fieldDraft(formId: string) {
    return newFieldByForm[formId] ?? { label: '', type: 'TEXT', optionsText: '', required: false };
  }

  function setFieldDraft(formId: string, patch: Partial<ReturnType<typeof fieldDraft>>) {
    setNewFieldByForm((prev) => ({ ...prev, [formId]: { ...fieldDraft(formId), ...patch } }));
  }

  async function handleCopyLink(form: IntakeFormSummary) {
    const url = `${window.location.origin}/forms/${form.slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(form.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function handleToggle(formId: string, isActive: boolean) {
    await toggleIntakeForm(formId, isActive);
    router.refresh();
  }

  async function handleDeleteForm(formId: string) {
    if (!confirm('Delete this form? Past submissions and the tasks they created are kept.')) return;
    await deleteIntakeForm(formId);
    router.refresh();
  }

  async function handleAddField(formId: string) {
    const draft = fieldDraft(formId);
    if (!draft.label.trim()) return;
    const options =
      draft.type === 'SELECT'
        ? draft.optionsText
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined;
    await addIntakeFormField(formId, {
      label: draft.label.trim(),
      type: draft.type as 'TEXT' | 'TEXTAREA' | 'EMAIL' | 'DATE' | 'SELECT',
      required: draft.required,
      options,
    });
    setNewFieldByForm((prev) => ({ ...prev, [formId]: { label: '', type: 'TEXT', optionsText: '', required: false } }));
    router.refresh();
  }

  async function handleDeleteField(fieldId: string) {
    await deleteIntakeFormField(fieldId);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href={`/projects/${projectId}`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
            ← {projectName}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">Intake forms</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Public forms anyone can submit without an account — each submission creates a task here.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="shrink-0 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + New form
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {forms.length === 0 && (
          <p className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No intake forms yet for this project.
          </p>
        )}

        {forms.map((form) => {
          const draft = fieldDraft(form.id);
          return (
            <div
              key={form.id}
              className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{form.name}</p>
                  {form.description && (
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{form.description}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Submissions create a task in <span className="font-medium">{form.sectionName}</span>
                    {form.defaultAssigneeName && <> and assign it to {form.defaultAssigneeName}</>} ·{' '}
                    {form.submissionCount} submission{form.submissionCount === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => handleToggle(form.id, e.target.checked)}
                    />
                    Accepting submissions
                  </label>
                  <button
                    onClick={() => handleDeleteForm(form.id)}
                    className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <code className="min-w-0 flex-1 truncate text-xs text-slate-600 dark:text-slate-300">
                  /forms/{form.slug}
                </code>
                <button
                  onClick={() => handleCopyLink(form)}
                  className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {copiedId === form.id ? 'Copied!' : 'Copy link'}
                </button>
              </div>

              <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Fields
                </h3>
                <div className="mt-2 space-y-2">
                  {form.fields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700"
                    >
                      <span className="text-slate-700 dark:text-slate-200">
                        {field.label}{' '}
                        <span className="text-xs text-slate-400">
                          ({FIELD_TYPE_LABELS[field.type]}
                          {field.required ? ', required' : ''})
                        </span>
                      </span>
                      <button
                        onClick={() => handleDeleteField(field.id)}
                        className="text-xs font-medium text-red-500 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {form.fields.length === 0 && (
                    <p className="text-xs text-slate-400">
                      Only name and email are collected. Add fields for anything else you need to ask.
                    </p>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={draft.label}
                    onChange={(e) => setFieldDraft(form.id, { label: e.target.value })}
                    placeholder="Question label"
                    className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <select
                    value={draft.type}
                    onChange={(e) => setFieldDraft(form.id, { type: e.target.value })}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {draft.type === 'SELECT' && (
                    <input
                      value={draft.optionsText}
                      onChange={(e) => setFieldDraft(form.id, { optionsText: e.target.value })}
                      placeholder="Options, comma separated"
                      className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  )}
                  <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={draft.required}
                      onChange={(e) => setFieldDraft(form.id, { required: e.target.checked })}
                    />
                    Required
                  </label>
                  <button
                    onClick={() => handleAddField(form.id)}
                    disabled={!draft.label.trim()}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Add field
                  </button>
                </div>
              </div>

              {form.recentSubmissions.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Recent submissions
                  </h3>
                  <ul className="mt-2 space-y-1">
                    {form.recentSubmissions.map((s) => (
                      <li key={s.id} className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          {s.submitterName}
                          {s.submitterEmail && ` (${s.submitterEmail})`} · {new Date(s.createdAt).toLocaleDateString()}
                        </span>
                        {s.taskId && (
                          <button
                            onClick={() => setOpenTaskId(s.taskId)}
                            className="font-medium text-brand-600 hover:text-brand-700"
                          >
                            View task
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showNew && (
        <NewIntakeFormModal
          projectId={projectId}
          sections={sections}
          members={members}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            router.refresh();
          }}
        />
      )}

      {openTaskId && <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </div>
  );
}
