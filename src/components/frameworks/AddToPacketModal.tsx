'use client';

import { useState, useTransition } from 'react';
import {
  addFrameworkToBoardPacket,
  createBoardPacketWithFramework,
} from '@/lib/actions/xp';

interface PacketSummary {
  id: string;
  title: string;
  meetingDate: string;
  status: string;
  itemsCount?: number;
}

export function AddToPacketModal({
  isOpen,
  onClose,
  frameworkId,
  frameworkTitle,
  packets,
  currentPacketId,
}: {
  isOpen: boolean;
  onClose: () => void;
  frameworkId: string;
  frameworkTitle: string;
  packets: PacketSummary[];
  currentPacketId?: string | null;
}) {
  const [selectedPacketId, setSelectedPacketId] = useState<string>(
    currentPacketId || (packets.length > 0 ? packets[0].id : 'new')
  );
  const [newPacketTitle, setNewPacketTitle] = useState('');
  const [newMeetingDate, setNewMeetingDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      let res;
      if (selectedPacketId === 'new') {
        const title = newPacketTitle.trim() || `Session Meeting Packet — ${frameworkTitle}`;
        res = await createBoardPacketWithFramework({
          packetTitle: title,
          meetingDate: newMeetingDate,
          frameworkId,
          notes: notes.trim() || undefined,
        });
      } else {
        res = await addFrameworkToBoardPacket({
          frameworkId,
          packetId: selectedPacketId,
          notes: notes.trim() || undefined,
        });
      }

      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 1200);
      } else {
        setError(res.error || 'Failed to add framework to packet');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">📑</span>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Add to Board Packet</h3>
              <p className="text-[11px] text-slate-500 truncate max-w-xs">{frameworkTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
            {error}
          </div>
        )}

        {success ? (
          <div className="my-8 text-center space-y-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              ✓
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Added to Board Packet!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Target Packet
              </label>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {packets.map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      selectedPacketId === p.id
                        ? 'border-brand-600 bg-brand-50/60 dark:border-brand-500 dark:bg-brand-950/40'
                        : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="packetSelect"
                        checked={selectedPacketId === p.id}
                        onChange={() => setSelectedPacketId(p.id)}
                        className="text-brand-600"
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{p.title}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{p.meetingDate.slice(0, 10)}</span>
                  </label>
                ))}

                <label
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    selectedPacketId === 'new'
                      ? 'border-brand-600 bg-brand-50/60 dark:border-brand-500 dark:bg-brand-950/40'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="packetSelect"
                    checked={selectedPacketId === 'new'}
                    onChange={() => setSelectedPacketId('new')}
                    className="text-brand-600"
                  />
                  <span className="font-bold text-brand-700 dark:text-brand-300">+ Create New Board Packet</span>
                </label>
              </div>
            </div>

            {selectedPacketId === 'new' && (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    New Packet Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Session Stated Meeting - September 2026"
                    value={newPacketTitle}
                    onChange={(e) => setNewPacketTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Meeting Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newMeetingDate}
                    onChange={(e) => setNewMeetingDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Presenter / Slide Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Notes or context for the elder deck slide…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
              >
                {isPending ? 'Adding…' : 'Add to Packet'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
