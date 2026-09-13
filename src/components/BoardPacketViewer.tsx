'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ElderPacketPrintModal } from '@/components/ElderPacketPrintModal';
import { removeFrameworkFromBoardPacket } from '@/lib/actions/xp';
import type { ToolDefinition } from '@/lib/tools/schema';
import { QuadrantPrimitive } from '@/components/primitives/quadrant';
import { BucketsPrimitive } from '@/components/primitives/buckets';
import { TablePrimitive } from '@/components/primitives/table';
import { NarrativePrimitive } from '@/components/primitives/narrative';
import { FlowPrimitive } from '@/components/primitives/flow';
import { ScorePrimitive } from '@/components/primitives/score';
import { TreePrimitive } from '@/components/primitives/tree';

export interface ResolvedPacketItem {
  id: string;
  type: string;
  frameworkId?: string;
  toolId?: string;
  title: string;
  notes?: string | null;
  order: number;
  framework?: {
    id: string;
    toolId: string;
    title: string;
    status: string;
    data: unknown;
  } | null;
  definition?: ToolDefinition | null;
}

export function BoardPacketViewer({
  packet,
  items,
  canManage,
}: {
  packet: {
    id: string;
    title: string;
    meetingDate: string;
    status: string;
    summaryNotes: string | null;
  };
  items: ResolvedPacketItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Total slides = 1 (Cover / Agenda) + items.length
  const totalSlides = 1 + items.length;

  function handleRemove(frameworkId: string) {
    if (!confirm('Remove this strategic framework from this board packet?')) return;
    startTransition(async () => {
      const res = await removeFrameworkFromBoardPacket({
        packetId: packet.id,
        frameworkId,
      });
      if (res.success) {
        if (currentSlideIndex >= totalSlides - 1) {
          setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1));
        }
        router.refresh();
      }
    });
  }

  const currentItem = currentSlideIndex > 0 ? items[currentSlideIndex - 1] : null;

  return (
    <div className="space-y-6">
      {/* Printable Header */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{packet.title}</h1>
            <p className="text-xs text-slate-600 font-medium">
              Meeting Date: {packet.meetingDate.slice(0, 10)} · Status: {packet.status.toUpperCase()}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p className="font-bold text-slate-900">Chesterfield Presbyterian Church</p>
            <p>Elder Session Board Deck</p>
          </div>
        </div>
      </div>

      {/* Navigation and Top Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4 dark:border-slate-800 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/xp"
            className="text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            ← Back to XP Hub
          </Link>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {packet.title}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {packet.meetingDate.slice(0, 10)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <span>🖨️ Request Print Run</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          >
            <span>Print Deck / PDF</span>
          </button>
        </div>
      </div>

      {/* Slide Carousel & Navigation Bar */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 print:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentSlideIndex === 0}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            ← Previous
          </button>
          <span className="text-xs font-medium text-slate-500">
            Slide <span className="font-bold text-slate-900 dark:text-white">{currentSlideIndex + 1}</span> of {totalSlides}
          </span>
          <button
            type="button"
            onClick={() => setCurrentSlideIndex((prev) => Math.min(totalSlides - 1, prev + 1))}
            disabled={currentSlideIndex === totalSlides - 1}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            Next →
          </button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto max-w-md">
          <button
            type="button"
            onClick={() => setCurrentSlideIndex(0)}
            className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
              currentSlideIndex === 0
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            Cover / Agenda
          </button>
          {items.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCurrentSlideIndex(idx + 1)}
              className={`px-2 py-1 rounded text-[11px] font-semibold truncate max-w-[120px] transition-colors ${
                currentSlideIndex === idx + 1
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {idx + 1}. {item.title}
            </button>
          ))}
        </div>
      </div>

      {/* Slide 0: Executive Cover & Packet Agenda */}
      {currentSlideIndex === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 pb-6 dark:border-slate-800">
            <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-800 uppercase tracking-wider dark:bg-brand-950/60 dark:text-brand-300">
              Elder Board Packet
            </span>
            <h2 className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-white">{packet.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span>📅 Meeting Date: <strong>{packet.meetingDate.slice(0, 10)}</strong></span>
              <span>•</span>
              <span>Status: <strong className="uppercase">{packet.status}</strong></span>
              <span>•</span>
              <span>Components: <strong>{items.length} strategic items attached</strong></span>
            </div>
          </div>

          {packet.summaryNotes && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-700 dark:bg-slate-800">
              <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1">
                Executive Meeting Summary
              </h4>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {packet.summaryNotes}
              </p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
              Packet Deck Contents &amp; Strategic Agenda
            </h3>

            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500 dark:border-slate-700">
                <p>No strategic frameworks have been attached to this packet yet.</p>
                <p className="mt-1">
                  Go to <Link href="/xp" className="text-brand-600 font-semibold hover:underline">XP Hub &gt; Strategic Frameworks</Link> to build a framework and click &ldquo;Add to Board Packet&rdquo;.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 text-xs hover:bg-slate-50/70 transition-colors dark:hover:bg-slate-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700 text-xs dark:bg-slate-800 dark:text-slate-300">
                        {idx + 1}
                      </span>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">{item.title}</h4>
                        <div className="flex items-center gap-2 mt-0.5 text-slate-500">
                          {item.definition && (
                            <span className="rounded bg-brand-50 px-1.5 py-0.2 text-[10px] font-semibold text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                              {item.definition.name} ({item.definition.primitive})
                            </span>
                          )}
                          {item.notes && <span className="truncate max-w-sm italic">Note: {item.notes}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 print:hidden">
                      <button
                        type="button"
                        onClick={() => setCurrentSlideIndex(idx + 1)}
                        className="rounded-lg bg-slate-100 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                      >
                        View Slide →
                      </button>
                      {item.frameworkId && (
                        <Link
                          href={`/xp/frameworks/${item.frameworkId}`}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                        >
                          Edit Framework
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slide 1..N: Individual Strategic Framework Slide */}
      {currentItem && currentItem.definition && currentItem.framework && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-slate-800 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                  Slide {currentSlideIndex} · {currentItem.definition.primitive}
                </span>
                <span className="text-xs text-slate-400">
                  Status: {currentItem.framework.status.toUpperCase()}
                </span>
              </div>
              <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                {currentItem.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {currentItem.definition.name} · {currentItem.definition.blurb}
              </p>
            </div>

            <div className="flex items-center gap-2 print:hidden">
              <Link
                href={`/xp/frameworks/${currentItem.framework.id}`}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                ✏️ Edit Items
              </Link>
              <button
                type="button"
                onClick={() => handleRemove(currentItem.framework!.id)}
                disabled={isPending}
                className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-slate-900 dark:hover:bg-rose-950/30"
              >
                Detach
              </button>
            </div>
          </div>

          {/* Presenter / Slide Notes if present */}
          {currentItem.notes && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
              <p className="font-bold text-[11px] uppercase tracking-wider">Presenter Notes for Elders:</p>
              <p className="mt-0.5">{currentItem.notes}</p>
            </div>
          )}

          {/* Embedded Primitive Visual Presentation */}
          <div className="pt-2">
            {currentItem.definition.primitive === 'quadrant' && (
              <QuadrantPrimitive definition={currentItem.definition as any} data={currentItem.framework.data} />
            )}
            {currentItem.definition.primitive === 'buckets' && (
              <BucketsPrimitive definition={currentItem.definition as any} data={currentItem.framework.data} />
            )}
            {currentItem.definition.primitive === 'table' && (
              <TablePrimitive definition={currentItem.definition as any} data={currentItem.framework.data} />
            )}
            {currentItem.definition.primitive === 'narrative' && (
              <NarrativePrimitive definition={currentItem.definition as any} data={currentItem.framework.data} />
            )}
            {currentItem.definition.primitive === 'flow' && (
              <FlowPrimitive definition={currentItem.definition as any} data={currentItem.framework.data} />
            )}
            {currentItem.definition.primitive === 'score' && (
              <ScorePrimitive definition={currentItem.definition as any} data={currentItem.framework.data} />
            )}
            {currentItem.definition.primitive === 'tree' && (
              <TreePrimitive definition={currentItem.definition as any} data={currentItem.framework.data} />
            )}
          </div>
        </div>
      )}

      {/* Print Run Request Modal */}
      {isPrintModalOpen && (
        <ElderPacketPrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          packetId={packet.id}
          packetTitle={packet.title}
        />
      )}
    </div>
  );
}
