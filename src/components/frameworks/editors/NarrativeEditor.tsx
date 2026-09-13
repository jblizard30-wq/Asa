'use client';

import { useState } from 'react';
import type { ToolDefinition } from '@/lib/tools/schema';

type NarrativeDefinition = Extract<ToolDefinition, { primitive: 'narrative' }>;

export function NarrativeEditor({
  definition,
  data,
  onUpdate,
}: {
  definition: NarrativeDefinition;
  data: unknown;
  onUpdate: (data: unknown) => void;
}) {
  const initialSections = (data as { sections?: Record<string, string> })?.sections || {};
  const [sections, setSections] = useState<Record<string, string>>(initialSections);

  function handleBlur(key: string, val: string) {
    const updated = { ...sections, [key]: val };
    setSections(updated);
    onUpdate({ sections: updated });
  }

  return (
    <div className="space-y-6">
      {definition.config.sections.map((sec) => (
        <div
          key={sec.key}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">{sec.label}</h3>
          </div>

          {sec.prompt && (
            <p className="text-xs italic text-slate-500 dark:text-slate-400">{sec.prompt}</p>
          )}

          <div className="hidden print:block text-xs leading-relaxed text-slate-900 dark:text-slate-100 whitespace-pre-wrap pt-1">
            {sections[sec.key] || '—'}
          </div>

          <textarea
            rows={4}
            placeholder={`Draft ${sec.label.toLowerCase()} notes here…`}
            value={sections[sec.key] || ''}
            onChange={(e) => setSections({ ...sections, [sec.key]: e.target.value })}
            onBlur={(e) => handleBlur(sec.key, e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-3 text-xs leading-relaxed text-slate-800 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white print:hidden"
          />
        </div>
      ))}
    </div>
  );
}
