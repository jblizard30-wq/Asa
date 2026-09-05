'use client';

import { useState, useTransition } from 'react';
import { PlusIcon, AlertTriangleIcon } from '@/components/InventoryIcons';
import { quickCreateInventoryItem } from '@/lib/actions/inventory';
import type { CountingItem, InventoryTypeDef } from './InventoryCountClient';

interface InventoryQuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
  prefilledCode?: string;
  inventoryTypes: InventoryTypeDef[];
  onItemCreated: (item: CountingItem) => void;
}

export function InventoryQuickAddModal({
  isOpen,
  onClose,
  roomId,
  roomName,
  prefilledCode = '',
  inventoryTypes,
  onItemCreated,
}: InventoryQuickAddModalProps) {
  const [name, setName] = useState(prefilledCode);
  const [unit, setUnit] = useState('Units');
  const [idealQty, setIdealQty] = useState(10);
  const [onHandQty, setOnHandQty] = useState(1);
  const [shelfLocation, setShelfLocation] = useState(prefilledCode !== name ? prefilledCode : '');
  const [selectedTrack, setSelectedTrack] = useState(inventoryTypes[0]?.id || '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const quickUnits = ['Bags', 'Boxes', 'Bottles', 'Cases', 'Packs', 'Units'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Item name is required');
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await quickCreateInventoryItem({
        name: name.trim(),
        unit,
        idealQty: Math.max(1, Number(idealQty)),
        onHandQty: Math.max(0, Number(onHandQty)),
        roomId,
        shelfLocation: shelfLocation.trim() || undefined,
        inventoryTypeId: selectedTrack || undefined,
      });

      if (res.success) {
        onItemCreated({
          id: res.item.id,
          name: res.item.name,
          unit: res.item.unit,
          idealQty: res.item.idealQty,
          onHandQty: res.item.onHandQty,
          reorderThreshold: res.item.reorderThreshold,
          shelfLocation: res.item.shelfLocation,
          sortOrder: 999,
          notes: null,
          inventoryTypeId: selectedTrack || null,
        });
        onClose();
      } else {
        setError(res.error || 'Failed to add item');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <PlusIcon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Quick-Add Item to {roomName}</h3>
              <p className="text-[11px] text-slate-500">Add a new supply item and record its first count.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">
            <AlertTriangleIcon className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300">Item Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. 10oz Hot Cups, Floor Cleaner..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300">Unit of Measure</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {quickUnits.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    unit === u
                      ? 'bg-brand-600 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300">Par Level (Ideal Qty) *</label>
              <input
                type="number"
                min="1"
                required
                value={idealQty}
                onChange={(e) => setIdealQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300">Initial On-Hand Count *</label>
              <input
                type="number"
                min="0"
                required
                value={onHandQty}
                onChange={(e) => setOnHandQty(Math.max(0, parseInt(e.target.value) || 0))}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300">Shelf / Code</label>
              <input
                type="text"
                placeholder="Shelf B3, Barcode..."
                value={shelfLocation}
                onChange={(e) => setShelfLocation(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300">Category / Track</label>
              <select
                value={selectedTrack}
                onChange={(e) => setSelectedTrack(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {inventoryTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
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
              {isPending ? 'Adding Item...' : 'Save & Add to Count'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
