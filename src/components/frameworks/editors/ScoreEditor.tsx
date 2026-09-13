'use client';

import { useState } from 'react';
import type { ToolDefinition, ScoreOption } from '@/lib/tools/schema';

type ScoreDefinition = Extract<ToolDefinition, { primitive: 'score' }>;

export function ScoreEditor({
  definition,
  data,
  onUpdate,
}: {
  definition: ScoreDefinition;
  data: unknown;
  onUpdate: (data: unknown) => void;
}) {
  const currentData = (data as { options?: ScoreOption[] }) || { options: [] };
  const options = currentData.options || [];

  const [newOptionName, setNewOptionName] = useState('');

  function addOption(e: React.FormEvent) {
    e.preventDefault();
    if (!newOptionName.trim()) return;

    const initialScores: Record<string, number> = {};
    for (const c of definition.config.criteria) {
      initialScores[c.key] = 5;
    }

    const newOpt: ScoreOption = {
      id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: newOptionName.trim(),
      scores: initialScores,
    };

    onUpdate({ ...currentData, options: [...options, newOpt] });
    setNewOptionName('');
  }

  function updateScore(optId: string, criteriaKey: string, score: number) {
    const updated = options.map((opt) => {
      if (opt.id !== optId) return opt;
      return {
        ...opt,
        scores: { ...opt.scores, [criteriaKey]: score },
      };
    });
    onUpdate({ ...currentData, options: updated });
  }

  function removeOption(optId: string) {
    onUpdate({ ...currentData, options: options.filter((o) => o.id !== optId) });
  }

  function calculateTotal(scores: Record<string, number>) {
    return definition.config.criteria.reduce((sum, c) => {
      const s = scores[c.key] ?? 0;
      return sum + s * (c.weight / 100);
    }, 0);
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
              <th className="px-4 py-3 min-w-[160px]">Alternative / Option</th>
              {definition.config.criteria.map((c) => (
                <th key={c.key} className="px-3 py-3 text-center min-w-[110px]">
                  <div>{c.label}</div>
                  <div className="text-[10px] font-normal text-slate-500">Weight: {c.weight}%</div>
                </th>
              ))}
              <th className="px-4 py-3 text-center min-w-[90px]">Weighted Score</th>
              <th className="px-4 py-3 text-right print:hidden">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {options.length === 0 ? (
              <tr>
                <td
                  colSpan={definition.config.criteria.length + 3}
                  className="px-4 py-8 text-center text-slate-400 italic"
                >
                  No options added yet. Add ministry options below.
                </td>
              </tr>
            ) : (
              options.map((opt) => {
                const total = calculateTotal(opt.scores);
                return (
                  <tr key={opt.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {opt.label}
                    </td>
                    {definition.config.criteria.map((c) => (
                      <td key={c.key} className="px-3 py-3 text-center">
                        <select
                          value={opt.scores[c.key] ?? 5}
                          onChange={(e) => updateScore(opt.id, c.key, Number(e.target.value))}
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-center font-mono text-xs font-semibold focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                            <option key={num} value={num}>
                              {num}
                            </option>
                          ))}
                        </select>
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block rounded-lg bg-brand-50 px-2.5 py-1 font-mono text-xs font-bold text-brand-700 border border-brand-100 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-800">
                        {total.toFixed(1)} / 10
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right print:hidden">
                      <button
                        type="button"
                        onClick={() => removeOption(opt.id)}
                        className="text-slate-400 hover:text-rose-600 px-2 py-1 text-xs"
                        title="Delete option"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Option Form */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 print:hidden">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">+ Add Alternative Option</h4>
        <form onSubmit={addOption} className="flex gap-3">
          <input
            type="text"
            placeholder="e.g. Planning Center Suite, Vendor A…"
            value={newOptionName}
            onChange={(e) => setNewOptionName(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          >
            + Add Option
          </button>
        </form>
      </div>
    </div>
  );
}
