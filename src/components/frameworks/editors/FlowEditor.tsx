'use client';

import { useState } from 'react';
import type { ToolDefinition, FlowNode } from '@/lib/tools/schema';

type FlowDefinition = Extract<ToolDefinition, { primitive: 'flow' }>;

export function FlowEditor({
  definition,
  data,
  onUpdate,
}: {
  definition: FlowDefinition;
  data: unknown;
  onUpdate: (data: unknown) => void;
}) {
  const currentData = (data as { nodes?: FlowNode[] }) || { nodes: [] };
  const nodes = currentData.nodes || [];

  const [newLabel, setNewLabel] = useState('');
  const [newHeadcount, setNewHeadcount] = useState('');
  const [selectedLane, setSelectedLane] = useState(definition.config.lanes?.[0]?.key || '');

  function addNode(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;

    const newNode: FlowNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: newLabel.trim(),
      order: nodes.length,
      laneKey: selectedLane || undefined,
      values: {
        text: newLabel.trim(),
        headcount: Number(newHeadcount) || 0,
      },
    };

    onUpdate({ ...currentData, nodes: [...nodes, newNode] });
    setNewLabel('');
    setNewHeadcount('');
  }

  function removeNode(nodeId: string) {
    const updated = nodes.filter((n) => n.id !== nodeId).map((n, idx) => ({ ...n, order: idx }));
    onUpdate({ ...currentData, nodes: updated });
  }

  function moveNode(index: number, direction: 'up' | 'down') {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= nodes.length) return;
    const reordered = [...nodes];
    const temp = reordered[index];
    reordered[index] = reordered[targetIdx];
    reordered[targetIdx] = temp;
    const updated = reordered.map((n, idx) => ({ ...n, order: idx }));
    onUpdate({ ...currentData, nodes: updated });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-4">Pipeline Pathway Stages</h3>

        <div className="flex flex-col gap-3">
          {nodes.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400 italic">No stages added yet. Add stages below.</p>
          ) : (
            nodes.map((node, index) => (
              <div
                key={node.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/60"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900">
                    {index + 1}
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">{node.label}</h4>
                    {node.laneKey && (
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                        Lane: {node.laneKey}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {node.values.headcount !== undefined && Number(node.values.headcount) > 0 && (
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                      👥 {node.values.headcount} people
                    </span>
                  )}
                  <div className="flex items-center gap-1 print:hidden">
                    <button
                      type="button"
                      onClick={() => moveNode(index, 'up')}
                      disabled={index === 0}
                      className="rounded p-1 text-slate-400 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-700"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveNode(index, 'down')}
                      disabled={index === nodes.length - 1}
                      className="rounded p-1 text-slate-400 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-700"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => removeNode(node.id)}
                      className="rounded p-1 text-slate-400 hover:text-rose-600 dark:hover:bg-slate-700"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Stage Form */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 print:hidden">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">+ Add Pathway Stage</h4>
        <form onSubmit={addNode} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Stage Name / Description
            </label>
            <input
              type="text"
              placeholder="e.g. Inquirer Class Cohort…"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="w-32">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Participants / Count
            </label>
            <input
              type="number"
              placeholder="Count"
              value={newHeadcount}
              onChange={(e) => setNewHeadcount(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {definition.config.lanes && definition.config.lanes.length > 0 && (
            <div className="w-40">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Lane</label>
              <select
                value={selectedLane}
                onChange={(e) => setSelectedLane(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {definition.config.lanes.map((lane) => (
                  <option key={lane.key} value={lane.key}>
                    {lane.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          >
            + Add Stage
          </button>
        </form>
      </div>
    </div>
  );
}
