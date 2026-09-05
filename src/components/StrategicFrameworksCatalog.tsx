'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { ToolDefinition } from '@/lib/tools/schema';

const STAGE_FILTERS = [
  { id: 'all', label: 'All 30 Frameworks', icon: '🛠️' },
  { id: 'discern', label: '1. Sense & Discern', icon: '🔭', desc: 'Where are we as a ministry?' },
  { id: 'decide', label: '2. Decide & Align', icon: '⚖️', desc: 'What direction do we take?' },
  { id: 'execute', label: '3. Execute & Assign', icon: '⚡', desc: 'Who does what and when?' },
  { id: 'review', label: '4. Review & Optimize', icon: '🔍', desc: 'How did it go & what did we learn?' },
] as const;

const PRIMITIVE_COLORS: Record<string, string> = {
  quadrant: 'bg-purple-100 text-purple-800 border-purple-200',
  buckets: 'bg-blue-100 text-blue-800 border-blue-200',
  table: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  tree: 'bg-amber-100 text-amber-800 border-amber-200',
  flow: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  score: 'bg-rose-100 text-rose-800 border-rose-200',
  narrative: 'bg-slate-100 text-slate-800 border-slate-200',
};

export function StrategicFrameworksCatalog({ tools }: { tools: ToolDefinition[] }) {
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTool, setSelectedTool] = useState<ToolDefinition | null>(null);

  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      // Stage filtering
      let stageMatch = true;
      if (selectedStage === 'discern') {
        stageMatch = tool.stages.includes('sense') || tool.stages.includes('discern');
      } else if (selectedStage === 'decide') {
        stageMatch = tool.stages.includes('decide') || tool.stages.includes('align');
      } else if (selectedStage === 'execute') {
        stageMatch = tool.stages.includes('plan') || tool.stages.includes('execute');
      } else if (selectedStage === 'review') {
        stageMatch = tool.stages.includes('review');
      }

      if (!stageMatch) return false;

      // Query filtering
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        tool.name.toLowerCase().includes(q) ||
        tool.blurb.toLowerCase().includes(q) ||
        (tool.churchExample && tool.churchExample.toLowerCase().includes(q)) ||
        tool.primitive.toLowerCase().includes(q) ||
        tool.emits.some((e) => e.toLowerCase().includes(q))
      );
    });
  }, [tools, selectedStage, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                7 Visual Primitives
              </span>
              <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-bold text-brand-800 dark:bg-brand-900 dark:text-brand-200">
                30 Strategic Discernment Tools
              </span>
            </div>
            <h2 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
              Executive Ministry Strategic Discernment Toolkit
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 max-w-2xl">
              Curated decision matrices, operational frameworks, and leadership diagnostic tools for executive pastors, elders, and ministry leads.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-slate-500">
              Showing {filteredTools.length} of {tools.length} frameworks
            </span>
          </div>
        </div>
      </div>

      {/* Stage Filter Buttons & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {STAGE_FILTERS.map((f) => {
            const active = selectedStage === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedStage(f.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  active
                    ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <span>{f.icon}</span>
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[240px]">
          <input
            type="text"
            placeholder="Search frameworks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs placeholder-slate-400 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1.5 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTools.map((tool) => {
          const isRaci = tool.id === 'raci';
          const primitiveBadge = PRIMITIVE_COLORS[tool.primitive] || 'bg-slate-100 text-slate-700 border-slate-200';

          return (
            <div
              key={tool.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${primitiveBadge}`}>
                    {tool.primitive}
                  </span>
                  <span className="text-xs font-medium text-slate-400">
                    ⏱️ {tool.estimatedMinutes} min
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{tool.name}</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {tool.blurb}
                  </p>
                </div>

                {tool.churchExample && (
                  <div className="rounded-lg bg-slate-50 p-2.5 text-xs border border-slate-100 dark:bg-slate-800/60 dark:border-slate-800">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Church Example:</p>
                    <p className="mt-0.5 italic text-slate-600 dark:text-slate-400">{tool.churchExample}</p>
                  </div>
                )}

                {/* Emits Chips */}
                {tool.emits && tool.emits.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Emits:</span>
                    {tool.emits.map((item) => (
                      <span
                        key={item}
                        className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
                      >
                        +{item}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                {isRaci ? (
                  <Link
                    href="/raci"
                    className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-center text-xs font-bold text-white shadow-xs hover:bg-brand-700 transition-colors"
                  >
                    Open RACI Matrix ↗
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedTool(tool)}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    View Framework Guide
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tool Detail Modal */}
      {selectedTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-800 dark:bg-brand-900 dark:text-brand-200">
                    {selectedTool.primitive}
                  </span>
                  <span className="text-xs text-slate-400">⏱️ {selectedTool.estimatedMinutes} min estimated</span>
                </div>
                <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{selectedTool.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTool(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-slate-600 dark:text-slate-300">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">Overview</h4>
                <p className="mt-1 leading-relaxed">{selectedTool.blurb}</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">When to Use</h4>
                <p className="mt-1 leading-relaxed">{selectedTool.whenToUse}</p>
              </div>

              {selectedTool.churchExample && (
                <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3.5 dark:border-brand-900 dark:bg-brand-950/20">
                  <h4 className="font-bold text-brand-900 dark:text-brand-300 uppercase tracking-wider text-[11px]">Real-World Church Application</h4>
                  <p className="mt-1 italic leading-relaxed text-slate-700 dark:text-slate-300">{selectedTool.churchExample}</p>
                </div>
              )}

              {selectedTool.facilitationNotes && (
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">Facilitation Notes for Executive Pastors</h4>
                  <p className="mt-1 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    {selectedTool.facilitationNotes}
                  </p>
                </div>
              )}

              {selectedTool.starterTemplates && selectedTool.starterTemplates.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">Starter Templates</h4>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {selectedTool.starterTemplates.map((tpl) => (
                      <span
                        key={tpl}
                        className="rounded-md bg-slate-100 px-2 py-1 text-slate-700 font-mono text-[11px] dark:bg-slate-800 dark:text-slate-300"
                      >
                        {tpl}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between text-slate-400 border-t border-slate-100 dark:border-slate-800">
                <span>Stages: {selectedTool.stages.join(' → ')}</span>
                <span>Produces: {selectedTool.emits.join(', ')}</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTool(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
              >
                Close Specification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
