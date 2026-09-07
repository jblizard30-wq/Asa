'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ToolDefinition } from '@/lib/tools/schema';
import { updateStrategicFramework, deleteStrategicFramework } from '@/lib/actions/xp';
import { AddToPacketModal } from './AddToPacketModal';
import { QuadrantEditor } from './editors/QuadrantEditor';
import { BucketsEditor } from './editors/BucketsEditor';
import { TableEditor } from './editors/TableEditor';
import { NarrativeEditor } from './editors/NarrativeEditor';
import { FlowEditor } from './editors/FlowEditor';
import { ScoreEditor } from './editors/ScoreEditor';
import { TreeEditor } from './editors/TreeEditor';

interface PacketSummary {
  id: string;
  title: string;
  meetingDate: string;
  status: string;
  itemsCount?: number;
}

export function FrameworkEditor({
  framework,
  definition,
  packets,
}: {
  framework: {
    id: string;
    toolId: string;
    title: string;
    status: string;
    packetId: string | null;
    data: unknown;
    packet?: { id: string; title: string } | null;
  };
  definition: ToolDefinition;
  packets: PacketSummary[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(framework.title);
  const [status, setStatus] = useState(framework.status);
  const [data, setData] = useState<unknown>(framework.data);
  const [isPending, startTransition] = useTransition();
  const [isPacketModalOpen, setIsPacketModalOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  function handleDataUpdate(newData: unknown) {
    setData(newData);
    startTransition(async () => {
      await updateStrategicFramework({ id: framework.id, data: newData });
    });
  }

  function handleTitleBlur() {
    if (!title.trim() || title === framework.title) return;
    startTransition(async () => {
      await updateStrategicFramework({ id: framework.id, title });
    });
  }

  function handleStatusChange(newStatus: string) {
    setStatus(newStatus);
    startTransition(async () => {
      await updateStrategicFramework({ id: framework.id, status: newStatus });
    });
  }

  function handleDelete() {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    startTransition(async () => {
      const res = await deleteStrategicFramework(framework.id);
      if (res.success) {
        router.push('/xp');
      }
    });
  }

  const attachedPacket = packets.find((p) => p.id === framework.packetId);

  return (
    <div className="space-y-6">
      {/* Printable Header */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              Strategic Framework: {definition.name} ({definition.primitive.toUpperCase()})
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p className="font-semibold text-slate-900">Chesterfield Presbyterian Church</p>
            <p>Elder Session / Executive Pastor Briefing</p>
          </div>
        </div>
      </div>

      {/* Navigation & Controls Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4 dark:border-slate-800 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/xp"
            className="text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            ← Back to XP Hub
          </Link>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
            {definition.primitive}
          </span>
          <span className="text-xs text-slate-400">
            {isPending ? 'Saving…' : '✓ Saved'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {attachedPacket ? (
            <Link
              href={`/xp/packets/${attachedPacket.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              <span>📑 In Packet:</span>
              <span className="truncate max-w-[140px]">{attachedPacket.title}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setIsPacketModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <span>📑 Add to Board Packet</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <span>🖨️ Print / Deck View</span>
          </button>

          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/60 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
          >
            <span>📘 Framework Guide</span>
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-slate-900 dark:hover:bg-rose-950/30"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Header Info & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="w-full text-2xl font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-600 focus:outline-none dark:text-white dark:hover:border-slate-700"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {definition.name} · {definition.blurb}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
            <span>Status:</span>
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="draft">Draft</option>
              <option value="in_review">In Review</option>
              <option value="final">Final / Approved</option>
            </select>
          </label>
        </div>
      </div>

      {/* Primitive Editor Dispatcher */}
      <div className="pt-2">
        {definition.primitive === 'quadrant' && (
          <QuadrantEditor definition={definition} data={data} onUpdate={handleDataUpdate} />
        )}
        {definition.primitive === 'buckets' && (
          <BucketsEditor definition={definition} data={data} onUpdate={handleDataUpdate} />
        )}
        {definition.primitive === 'table' && (
          <TableEditor definition={definition} data={data} onUpdate={handleDataUpdate} />
        )}
        {definition.primitive === 'narrative' && (
          <NarrativeEditor definition={definition} data={data} onUpdate={handleDataUpdate} />
        )}
        {definition.primitive === 'flow' && (
          <FlowEditor definition={definition} data={data} onUpdate={handleDataUpdate} />
        )}
        {definition.primitive === 'score' && (
          <ScoreEditor definition={definition} data={data} onUpdate={handleDataUpdate} />
        )}
        {definition.primitive === 'tree' && (
          <TreeEditor definition={definition} data={data} onUpdate={handleDataUpdate} />
        )}
      </div>

      {/* Add To Packet Modal */}
      <AddToPacketModal
        isOpen={isPacketModalOpen}
        onClose={() => {
          setIsPacketModalOpen(false);
          router.refresh();
        }}
        frameworkId={framework.id}
        frameworkTitle={title}
        packets={packets}
        currentPacketId={framework.packetId}
      />

      {/* Guide Specification Modal */}
      {isGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{definition.name} Guide</h3>
                <p className="text-xs text-slate-500">Executive facilitation specifications</p>
              </div>
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-slate-600 dark:text-slate-300">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">When to Use</h4>
                <p className="mt-1 leading-relaxed">{definition.whenToUse}</p>
              </div>

              {definition.churchExample && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 dark:border-indigo-900 dark:bg-indigo-950/20">
                  <h4 className="font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider text-[11px]">Real-World Church Application</h4>
                  <p className="mt-1 italic leading-relaxed text-slate-700 dark:text-slate-300">{definition.churchExample}</p>
                </div>
              )}

              {definition.facilitationNotes && (
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">Facilitation Notes for Executive Pastors</h4>
                  <p className="mt-1 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    {definition.facilitationNotes}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
