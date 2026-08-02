'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CustomFieldDef } from '@/components/KanbanBoard';
import { createCustomField, deleteCustomField, addCustomFieldOption } from '@/lib/actions/customFields';

const FIELD_TYPE_LABELS: Record<CustomFieldDef['type'], string> = {
  TEXT: 'Text',
  NUMBER: 'Number',
  DATE: 'Date',
  SELECT: 'Dropdown',
  CHECKBOX: 'Checkbox',
};

export function CustomFieldsManager({
  projectId,
  fields,
  onClose,
}: {
  projectId: string;
  fields: CustomFieldDef[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldDef['type']>('TEXT');
  const [optionsText, setOptionsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [newOptionByField, setNewOptionByField] = useState<Record<string, string>>({});

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    const options =
      type === 'SELECT'
        ? optionsText
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined;
    await createCustomField(projectId, { name: name.trim(), type, options });
    setName('');
    setOptionsText('');
    setSaving(false);
    router.refresh();
  }

  async function handleDelete(fieldId: string) {
    if (!confirm('Delete this field? Values stored on tasks will be lost.')) return;
    await deleteCustomField(fieldId);
    router.refresh();
  }

  async function handleAddOption(fieldId: string) {
    const label = (newOptionByField[fieldId] ?? '').trim();
    if (!label) return;
    await addCustomFieldOption(fieldId, label);
    setNewOptionByField((prev) => ({ ...prev, [fieldId]: '' }));
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center bg-slate-900/40 p-4 pt-16 sm:pt-24" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Custom fields</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="p-6">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Custom fields appear as extra columns in List view and can be sorted, filtered, and edited inline.
          </p>

          <div className="mt-4 space-y-3">
            {fields.length === 0 && <p className="text-sm text-slate-400">No custom fields yet.</p>}
            {fields.map((field) => (
              <div key={field.id} className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{field.name}</p>
                    <p className="text-xs text-slate-400">{FIELD_TYPE_LABELS[field.type]}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(field.id)}
                    className="text-xs font-medium text-red-500 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>

                {field.type === 'SELECT' && (
                  <div className="mt-2">
                    <div className="flex flex-wrap gap-1.5">
                      {field.options.map((o) => (
                        <span
                          key={o.id}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        >
                          {o.label}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={newOptionByField[field.id] ?? ''}
                        onChange={(e) => setNewOptionByField((prev) => ({ ...prev, [field.id]: e.target.value }))}
                        placeholder="Add option…"
                        className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                      <button
                        onClick={() => handleAddOption(field.id)}
                        className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Add a field</h3>
            <div className="mt-2 flex flex-col gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Field name"
                className="rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CustomFieldDef['type'])}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {type === 'SELECT' && (
                <input
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  placeholder="Options, comma separated"
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              )}
              <button
                onClick={handleCreate}
                disabled={saving || !name.trim()}
                className="self-start rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? 'Adding…' : 'Add field'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
