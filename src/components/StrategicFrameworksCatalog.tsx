'use client';

import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ToolDefinition } from '@/lib/tools/schema';
import { createStrategicFramework, deleteStrategicFramework } from '@/lib/actions/xp';
import { AddToPacketModal } from '@/components/frameworks/AddToPacketModal';

export interface BuiltFrameworkSummary {
  id: string;
  toolId: string;
  title: string;
  status: string;
  updatedAt: string;
  packetId?: string | null;
  packet?: { id: string; title: string } | null;
}

interface PacketSummary {
  id: string;
  title: string;
  meetingDate: string;
  status: string;
}

const STAGE_FILTERS = [
  { id: 'all', label: 'All 30 Frameworks', icon: '🛠️' },
  { id: 'discern', label: '1. Sense & Discern', icon: '🔭', desc: 'Where are we as a ministry?' },
  { id: 'decide', label: '2. Decide & Align', icon: '⚖️', desc: 'What direction do we take?' },
  { id: 'execute', label: '3. Execute & Assign', icon: '⚡', desc: 'Who does what and when?' },
  { id: 'review', label: '4. Review & Optimize', icon: '🔍', desc: 'How did it go & what did we learn?' },
] as const;

const PRIMITIVE_COLORS: Record<string, string> = {
  quadrant: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  buckets: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  table: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  tree: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  flow: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800',
  score: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  narrative: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

export function StrategicFrameworksCatalog({
  tools,
  builtFrameworks = [],
  packets = [],
}: {
  tools: ToolDefinition[];
  builtFrameworks?: BuiltFrameworkSummary[];
  packets?: PacketSummary[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTool, setSelectedTool] = useState<ToolDefinition | null>(null);

  // Quick build modal state
  const [toolToBuild, setToolToBuild] = useState<ToolDefinition | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [useTemplate, setUseTemplate] = useState(true);
  const [targetPacketId, setTargetPacketId] = useState('');
  const [buildError, setBuildError] = useState<string | null>(null);

  // Add to packet modal state
  const [packetModalFramework, setPacketModalFramework] = useState<BuiltFrameworkSummary | null>(null);

  const toolMap = useMemo(() => {
    const map = new Map<string, ToolDefinition>();
    for (const t of tools) map.set(t.id, t);
    return map;
  }, [tools]);

  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
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

  function handleOpenBuildModal(tool: ToolDefinition) {
    setToolToBuild(tool);
    setNewTitle(`Session ${tool.name} — ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`);
    setUseTemplate(true);
    setTargetPacketId(packets.length > 0 ? packets[0].id : '');
    setBuildError(null);
  }

  function handleConfirmBuild(e: React.FormEvent) {
    e.preventDefault();
    if (!toolToBuild) return;
    setBuildError(null);

    startTransition(async () => {
      const res = await createStrategicFramework({
        toolId: toolToBuild.id,
        title: newTitle.trim() || undefined,
        useTemplate,
        packetId: targetPacketId || undefined,
      });

      if (res.success) {
        setToolToBuild(null);
        router.push(`/xp/frameworks/${res.frameworkId}`);
      } else {
        setBuildError(res.error || 'Failed to initialize framework');
      }
    });
  }

  function handleDeleteFramework(id: string, title: string) {
    if (!confirm(`Delete framework "${title}"?`)) return;
    startTransition(async () => {
      const res = await deleteStrategicFramework(id);
      if (res.success) {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Header Info */}
      <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4 dark:border-brand-900/40 dark:bg-brand-950/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-brand-800 dark:bg-brand-900 dark:text-brand-200">
                7 Visual Primitives
              </span>
              <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-bold text-brand-800 dark:bg-brand-900 dark:text-brand-200">
                30 Strategic Discernment Tools
              </span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                {builtFrameworks.length} Built Active
              </span>
            </div>
            <h2 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
              Executive Ministry Strategic Discernment &amp; Framework Builder
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 max-w-2xl">
              Build interactive matrices, diagnostic tools, and operational frameworks. Edit them with your ministry team and bundle them directly into Elder Board Packets.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-slate-500">
              Showing {filteredTools.length} of {tools.length} frameworks
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 1: BUILT FRAMEWORKS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Built Strategic Frameworks ({builtFrameworks.length})
            </h3>
            <p className="text-xs text-slate-500">
              Active frameworks created by ministry staff, available for editing and deck distribution.
            </p>
          </div>
        </div>

        {builtFrameworks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500 dark:border-slate-800">
            <p className="font-semibold text-slate-700 dark:text-slate-300">No strategic frameworks built yet.</p>
            <p className="mt-1">
              Select any of the 30 frameworks in the catalog below and click <span className="font-bold text-slate-900 dark:text-white">&ldquo;+ Build Framework&rdquo;</span> to create your first matrix.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {builtFrameworks.map((bf) => {
              const def = toolMap.get(bf.toolId);
              const primitiveBadge = def ? PRIMITIVE_COLORS[def.primitive] : 'bg-slate-100 text-slate-700';

              return (
                <div
                  key={bf.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-3 hover:bg-slate-50/70 transition-colors dark:hover:bg-slate-800/50"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md border px-2 py-0.2 text-[10px] font-bold uppercase tracking-wider ${primitiveBadge}`}>
                        {def?.primitive || 'framework'}
                      </span>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                        {bf.title}
                      </h4>
                      <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 uppercase">
                        {bf.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>Tool: {def?.name || bf.toolId}</span>
                      <span>•</span>
                      <span>Modified: {new Date(bf.updatedAt).toLocaleDateString()}</span>
                      {bf.packet ? (
                        <>
                          <span>•</span>
                          <Link
                            href={`/xp/packets/${bf.packet.id}`}
                            className="text-brand-600 font-semibold hover:underline dark:text-brand-400"
                          >
                            📑 In Packet: {bf.packet.title}
                          </Link>
                        </>
                      ) : (
                        <>
                          <span>•</span>
                          <span className="text-slate-400 italic">Not in a packet</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/xp/frameworks/${bf.id}`}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 transition-colors"
                    >
                      Open / Edit ↗
                    </Link>

                    <button
                      type="button"
                      onClick={() => setPacketModalFramework(bf)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      title="Add to board packet"
                    >
                      📑 Add to Packet
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteFramework(bf.id, bf.title)}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-950/30"
                      title="Delete framework"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 2: FRAMEWORK CATALOG & BUILDER */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Strategic Frameworks Catalog (30)
            </h3>
            <p className="text-xs text-slate-500">
              Select any framework below to launch a new instance or inspect facilitation notes.
            </p>
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
                      <p className="mt-0.5 italic text-slate-600 dark:text-slate-400 line-clamp-2">{tool.churchExample}</p>
                    </div>
                  )}

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
                      onClick={() => handleOpenBuildModal(tool)}
                      className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-bold text-white shadow-xs hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 transition-colors"
                    >
                      + Build Framework
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedTool(tool)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    title="View Framework Guide"
                  >
                    📘 Guide
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* QUICK BUILD MODAL */}
      {toolToBuild && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <span className="rounded bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                  {toolToBuild.primitive}
                </span>
                <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                  Build {toolToBuild.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setToolToBuild(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {buildError && (
              <div className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                {buildError}
              </div>
            )}

            <form onSubmit={handleConfirmBuild} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Framework Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                <label className="flex items-start gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useTemplate}
                    onChange={(e) => setUseTemplate(e.target.checked)}
                    className="mt-0.5 rounded text-brand-600 focus:ring-brand-500"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Pre-populate with Church Starter Template
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Fills realistic church ministry examples into the matrix so you don&apos;t start with an empty canvas.
                    </p>
                  </div>
                </label>
              </div>

              {packets.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Attach to Board Packet (Optional)
                  </label>
                  <select
                    value={targetPacketId}
                    onChange={(e) => setTargetPacketId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">None (Independent Framework)</option>
                    {packets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.meetingDate.slice(0, 10)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setToolToBuild(null)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                >
                  {isPending ? 'Launching…' : 'Launch Framework →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD TO PACKET MODAL FOR BUILT FRAMEWORK */}
      {packetModalFramework && (
        <AddToPacketModal
          isOpen={Boolean(packetModalFramework)}
          onClose={() => {
            setPacketModalFramework(null);
            router.refresh();
          }}
          frameworkId={packetModalFramework.id}
          frameworkTitle={packetModalFramework.title}
          packets={packets}
          currentPacketId={packetModalFramework.packetId}
        />
      )}

      {/* TOOL DETAIL SPECIFICATION MODAL */}
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

            <div className="mt-6 flex justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const t = selectedTool;
                  setSelectedTool(null);
                  handleOpenBuildModal(t);
                }}
                className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 shadow-xs"
              >
                + Build this Framework
              </button>

              <button
                type="button"
                onClick={() => setSelectedTool(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
