'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createServiceTemplate, applyServiceTemplate, deleteServiceTemplate } from '@/lib/actions/serviceTemplates';
import { getLiturgicalSeason } from '@/lib/liturgicalCalendar';
import type { LiturgicalSeason, Priority } from '@prisma/client';

interface TemplateItem {
  title: string;
  description?: string;
  season?: LiturgicalSeason | null;
  dueOffsetDays?: number;
  defaultPriority?: Priority;
}

interface ServiceTemplateRecord {
  id: string;
  name: string;
  description: string | null;
  items: {
    id: string;
    title: string;
    description: string | null;
    season: LiturgicalSeason | null;
    dueOffsetDays: number | null;
  }[];
  runs: {
    id: string;
    occurrenceDate: Date;
    season: LiturgicalSeason | null;
  }[];
}

const SEASONS: { value: LiturgicalSeason; label: string }[] = [
  { value: 'ADVENT', label: 'Advent' },
  { value: 'CHRISTMAS', label: 'Christmas' },
  { value: 'LENT', label: 'Lent' },
  { value: 'EASTER', label: 'Easter' },
  { value: 'PENTECOST', label: 'Pentecost' },
  { value: 'ORDINARY_TIME', label: 'Ordinary Time' },
];

export function ServiceTemplatesManager({
  projectId,
  templates,
  onClose,
}: {
  projectId: string;
  templates: ServiceTemplateRecord[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [serviceDate, setServiceDate] = useState(() => {
    // Default to next Sunday
    const d = new Date();
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
    return d.toISOString().slice(0, 10);
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New Template Form State
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [items, setItems] = useState<TemplateItem[]>([
    { title: 'Prepare Prelude & Call to Worship', season: null, dueOffsetDays: -2 },
    { title: 'Print Sunday Bulletins & Inserts', season: null, dueOffsetDays: -1 },
    { title: 'Audio / Visual Live Stream Sound Check', season: null, dueOffsetDays: 0 },
    { title: 'Light Advent Wreath Candle', season: 'ADVENT', dueOffsetDays: 0 },
    { title: 'Setup Holy Communion Elements & Cups', season: null, dueOffsetDays: 0 },
    { title: 'Prepare Easter Lilies & Altar Decor', season: 'EASTER', dueOffsetDays: -1 },
  ]);

  function addItem() {
    setItems([...items, { title: '', season: null, dueOffsetDays: 0 }]);
  }

  function updateItem(index: number, patch: Partial<TemplateItem>) {
    setItems(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function handleCreateTemplate() {
    if (!templateName.trim()) return;
    setError(null);

    startTransition(async () => {
      const res = await createServiceTemplate(projectId, {
        name: templateName,
        description: templateDesc,
        items: items.filter((i) => i.title.trim().length > 0),
      });

      if (res.success) {
        setShowCreate(false);
        router.refresh();
      }
    });
  }

  function handleGenerateService(templateId: string) {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const res = await applyServiceTemplate(templateId, serviceDate);
      if (!res.success) {
        setError(res.error ?? 'Failed to generate service.');
        return;
      }

      setMessage(`✨ Generated Sunday Service section for ${serviceDate} (${res.season})!`);
      router.refresh();
    });
  }

  function handleDelete(templateId: string) {
    if (!confirm('Are you sure you want to delete this template?')) return;
    startTransition(async () => {
      await deleteServiceTemplate(templateId);
      router.refresh();
    });
  }

  const detectedSeason = getLiturgicalSeason(serviceDate);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              ⛪ Sunday Service & Liturgy Templates
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Repeatable run-sheets with liturgical season (Advent, Lent, Easter) swap-ins.
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            ✕
          </button>
        </div>

        {error && <div className="mt-4 rounded-md bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
        {message && <div className="mt-4 rounded-md bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{message}</div>}

        {!showCreate ? (
          <div className="mt-6 space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Available Templates ({templates.length})
              </span>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
              >
                + New Service Template
              </button>
            </div>

            {templates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-800">
                <p>No service templates defined yet.</p>
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="mt-2 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                >
                  Create your first template
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="rounded-lg border border-slate-200 p-4 transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{tpl.name}</h3>
                        {tpl.description && (
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{tpl.description}</p>
                        )}
                        <p className="mt-1 text-xs text-slate-400">
                          {tpl.items.length} checklist items · {tpl.runs.length} service batches generated
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedTemplateId(tpl.id === selectedTemplateId ? null : tpl.id)}
                          className="rounded-md bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:bg-brand-900/40 dark:text-brand-300"
                        >
                          ⚡ 1-Click Generate
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(tpl.id)}
                          className="rounded p-1 text-xs text-slate-400 hover:text-red-500"
                          title="Delete template"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Generator Panel */}
                    {selectedTemplateId === tpl.id && (
                      <div className="mt-4 rounded-md border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-800 dark:bg-brand-950/20">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-800 dark:text-brand-300">
                          Generate Sunday Service Run-Sheet
                        </h4>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                              Service Date
                            </label>
                            <input
                              type="date"
                              value={serviceDate}
                              onChange={(e) => setServiceDate(e.target.value)}
                              className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                              Detected Liturgical Season
                            </label>
                            <span className="mt-1 inline-block rounded bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                              ✨ {detectedSeason.replace('_', ' ')}
                            </span>
                          </div>

                          <div className="mt-auto">
                            <button
                              type="button"
                              onClick={() => handleGenerateService(tpl.id)}
                              disabled={isPending}
                              className="rounded-md bg-brand-600 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-brand-700 disabled:opacity-60"
                            >
                              {isPending ? 'Generating…' : 'Generate Run-Sheet Now'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Create Template Form */
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Template Name</label>
              <input
                type="text"
                placeholder="e.g. Standard Sunday Morning Worship"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Description</label>
              <input
                type="text"
                placeholder="e.g. Sunday run-sheet across AV, preaching, music, and setup"
                value={templateDesc}
                onChange={(e) => setTemplateDesc(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Run-Sheet Checklist Items
                </label>
                <button
                  type="button"
                  onClick={addItem}
                  className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                >
                  + Add Line Item
                </button>
              </div>

              <div className="mt-2 space-y-2">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-800 dark:bg-slate-800/50"
                  >
                    <input
                      type="text"
                      placeholder="Task Title…"
                      value={item.title}
                      onChange={(e) => updateItem(idx, { title: e.target.value })}
                      className="min-w-[180px] flex-1 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                    />

                    <select
                      value={item.season ?? ''}
                      onChange={(e) => updateItem(idx, { season: (e.target.value as LiturgicalSeason) || null })}
                      className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="">All Seasons</option>
                      {SEASONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-500">Offset:</span>
                      <input
                        type="number"
                        value={item.dueOffsetDays ?? 0}
                        onChange={(e) => updateItem(idx, { dueOffsetDays: Number(e.target.value) })}
                        className="w-12 rounded border border-slate-300 px-1 py-1 text-center dark:border-slate-700 dark:bg-slate-900"
                      />
                      <span className="text-[11px] text-slate-500">days</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-slate-400 hover:text-red-500"
                      title="Remove item"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-md border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateTemplate}
                disabled={isPending || !templateName.trim()}
                className="rounded-md bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                Save Template
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

