'use client';

import { useState, useTransition } from 'react';
import { requestPacketPrintTask } from '@/lib/actions/xp';

interface ElderPacketPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  packetId: string;
  packetTitle: string;
}

export function ElderPacketPrintModal({
  isOpen,
  onClose,
  packetId,
  packetTitle,
}: ElderPacketPrintModalProps) {
  const [copies, setCopies] = useState(12);
  const [paperStock, setPaperStock] = useState('28lb Bright White');
  const [bindingType, setBindingType] = useState('Spiral Bound');
  const [deliverTo, setDeliverTo] = useState('Elder Boardroom / Conference Table');
  const [dueDateTime, setDueDateTime] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    d.setHours(16, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await requestPacketPrintTask({
        packetId,
        packetTitle,
        copies: Number(copies),
        paperStock,
        bindingType,
        dueDateTime,
        deliverTo,
        notes: notes.trim() || undefined,
      });

      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 2000);
      } else {
        setError(res.error || 'Failed to dispatch print task');
      }
    });
  };

  const paperOptions = ['20lb Budget', '24lb Standard', '28lb Bright White', 'Heavy Cardstock Cover'];
  const bindingOptions = ['Spiral Bound', 'Stapled Top-Left', '3-Ring Binder', 'Presentation Folder'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Request Print Run: {packetTitle}
            </h3>
            <p className="text-xs text-slate-500">
              Generates a task for the church administrator/secretary with production specs.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </div>
        )}

        {success ? (
          <div className="my-8 text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              ✓
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Print Task Dispatched!</p>
            <p className="text-xs text-slate-500">
              A high-priority task with these exact specs was assigned to the administrative team.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  Number of Copies *
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  required
                  value={copies}
                  onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  Needed By Date & Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={dueDateTime}
                  onChange={(e) => setDueDateTime(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300">Paper Stock</label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {paperOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setPaperStock(opt)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      paperStock === opt
                        ? 'bg-brand-600 text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300">
                Binding & Finishing
              </label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {bindingOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setBindingType(opt)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      bindingType === opt
                        ? 'bg-brand-600 text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300">
                Delivery Location
              </label>
              <input
                type="text"
                value={deliverTo}
                onChange={(e) => setDeliverTo(e.target.value)}
                placeholder="e.g. Session Table, Senior Pastor Desk..."
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300">
                Special Production Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Include color prints for the budget charts, double-sided..."
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-brand-700 disabled:opacity-50"
              >
                {isPending ? 'Sending Task...' : 'Dispatch Print Task to Secretary'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
