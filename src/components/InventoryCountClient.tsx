'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import {
  CheckIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  AlertTriangleIcon,
  MinusIcon,
  PlusIcon,
  ArrowLeftIcon,
  ClipboardListIcon,
  SparklesIcon,
  MapPinIcon,
  CheckCheckIcon,
  LayersIcon,
} from '@/components/InventoryIcons';
import { submitBatchStockCounts } from '@/lib/actions/inventory';

export interface CountingItem {
  id: string;
  name: string;
  unit: string;
  idealQty: number;
  onHandQty: number;
  reorderThreshold: number;
  shelfLocation: string | null;
  sortOrder: number;
  notes: string | null;
  inventoryTypeId: string | null;
  inventoryType?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  vendor?: {
    id: string;
    name: string;
  } | null;
}

export interface InventoryTypeDef {
  id: string;
  name: string;
  slug: string;
}

interface InventoryCountClientProps {
  roomId: string;
  roomName: string;
  buildingName?: string;
  items: CountingItem[];
  inventoryTypes: InventoryTypeDef[];
}

export function InventoryCountClient({
  roomId,
  roomName,
  buildingName,
  items,
  inventoryTypes,
}: InventoryCountClientProps) {
  const [selectedTrack, setSelectedTrack] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'walk' | 'list'>('list');
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.onHandQty]))
  );
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Filter items by selected track
  const filteredItems = useMemo(() => {
    if (selectedTrack === 'all') return items;
    return items.filter((i) => i.inventoryTypeId === selectedTrack);
  }, [items, selectedTrack]);

  const currentItem = filteredItems[activeIdx] || filteredItems[0];
  const currentVal = currentItem ? counts[currentItem.id] ?? 0 : 0;
  const isBelowPar = currentItem ? currentVal < currentItem.idealQty : false;
  const isCritical = currentItem ? currentVal <= currentItem.reorderThreshold && currentItem.reorderThreshold > 0 : false;

  const updateCount = (itemId: string, delta: number) => {
    setCounts((prev) => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] ?? 0) + delta),
    }));
  };

  const setCountDirect = (itemId: string, value: number) => {
    setCounts((prev) => ({
      ...prev,
      [itemId]: Math.max(0, value),
    }));
  };

  const setAllToPar = () => {
    const next = { ...counts };
    for (const it of filteredItems) {
      next[it.id] = it.idealQty;
    }
    setCounts(next);
  };

  const handleSave = () => {
    setSaveError(null);
    startTransition(async () => {
      const res = await submitBatchStockCounts({ roomId, counts });
      if (!res.success) {
        setSaveError(res.error);
        return;
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    });
  };

  const itemsBelowPar = items.filter((i) => (counts[i.id] ?? 0) < i.idealQty).length;

  return (
    <div className="mx-auto max-w-3xl pb-24">
      {/* Top back navigation */}
      <div className="mb-4">
        <Link
          href="/inventory"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" /> Back to Inventory Hub
        </Link>
      </div>

      {/* Sticky Counting Header */}
      <div className="sticky top-2 z-20 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {buildingName && (
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {buildingName}
              </div>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {roomName}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <ClipboardListIcon className="h-3.5 w-3.5" /> List
              </button>
              <button
                type="button"
                onClick={() => setViewMode('walk')}
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'walk'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <SparklesIcon className="h-3.5 w-3.5" /> Walk Mode
              </button>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
            >
              {savedSuccess ? (
                <CheckIcon className="h-3.5 w-3.5 text-white" />
              ) : (
                <CheckCheckIcon className="h-3.5 w-3.5" />
              )}
              {savedSuccess ? 'Saved!' : isPending ? 'Saving…' : 'Save Counts'}
            </button>
          </div>
        </div>

        {/* Filter by Inventory Track */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setSelectedTrack('all');
              setActiveIdx(0);
            }}
            className={`rounded-full px-3 py-1 font-medium transition-colors ${
              selectedTrack === 'all'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            All Tracks ({items.length})
          </button>
          {inventoryTypes.map((inv) => {
            const count = items.filter((i) => i.inventoryTypeId === inv.id).length;
            if (count === 0) return null;
            return (
              <button
                key={inv.id}
                type="button"
                onClick={() => {
                  setSelectedTrack(inv.id);
                  setActiveIdx(0);
                }}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  selectedTrack === inv.id
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {inv.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {saveError && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {saveError}
        </div>
      )}

      {/* Quick Summary Banner */}
      <div className="mt-6 flex items-center justify-between rounded-xl bg-slate-100 px-4 py-2.5 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <LayersIcon className="h-4 w-4 text-slate-500" />
          <span>
            {items.length} items total &middot;{' '}
            <strong className={itemsBelowPar > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'}>
              {itemsBelowPar} needed for restock
            </strong>
          </span>
        </div>
        <button
          type="button"
          onClick={setAllToPar}
          className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          Quick Set All to Par
        </button>
      </div>

      {/* VIEW MODE 1: STEP-BY-STEP WALKTHROUGH */}
      {viewMode === 'walk' && currentItem && (
        <div className="mt-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider text-slate-400">
                Item {activeIdx + 1} of {filteredItems.length}
              </span>
              {currentItem.shelfLocation && (
                <span className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <MapPinIcon className="h-3 w-3" /> {currentItem.shelfLocation}
                </span>
              )}
            </div>

            <h3 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {currentItem.name}
            </h3>

            {currentItem.inventoryType && (
              <span className="mt-1 inline-block text-xs text-slate-500">
                {currentItem.inventoryType.name}
              </span>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-950">
              <div>
                <span className="text-slate-400">Par Target:</span>{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {currentItem.idealQty} {currentItem.unit}
                </strong>
              </div>
              <div>
                <span className="text-slate-400">Reorder Below:</span>{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {currentItem.reorderThreshold > 0
                    ? `${currentItem.reorderThreshold} ${currentItem.unit}`
                    : '0'}
                </strong>
              </div>
            </div>

            {/* Stepper Controls */}
            <div className="my-8 flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={() => updateCount(currentItem.id, -1)}
                className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 shadow-sm active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <MinusIcon className="h-7 w-7" />
              </button>

              <div className="flex flex-col items-center">
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={currentVal}
                  onChange={(e) => setCountDirect(currentItem.id, parseInt(e.target.value) || 0)}
                  className="h-20 w-32 rounded-2xl border-2 border-slate-300 text-center text-4xl font-black focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <span className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {currentItem.unit} on hand
                </span>
              </div>

              <button
                type="button"
                onClick={() => updateCount(currentItem.id, 1)}
                className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-800 shadow-sm active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <PlusIcon className="h-7 w-7" />
              </button>
            </div>

            {/* Status Alert */}
            {isBelowPar ? (
              <div
                className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-medium ${
                  isCritical
                    ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                    : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                }`}
              >
                <AlertTriangleIcon className="h-4 w-4 shrink-0" />
                <span>
                  Below par! Needs{' '}
                  <strong>
                    {currentItem.idealQty - currentVal} {currentItem.unit}
                  </strong>{' '}
                  to restock.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckIcon className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>Fully stocked to par level ({currentItem.idealQty} {currentItem.unit}).</span>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                disabled={activeIdx === 0}
                onClick={() => setActiveIdx((prev) => Math.max(0, prev - 1))}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 py-3.5 text-sm font-medium text-slate-700 disabled:opacity-30 dark:border-slate-800 dark:text-slate-300"
              >
                <ChevronLeftIcon className="h-4 w-4" /> Previous
              </button>
              <button
                type="button"
                onClick={() => {
                  if (activeIdx < filteredItems.length - 1) {
                    setActiveIdx((prev) => prev + 1);
                  } else {
                    handleSave();
                  }
                }}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
              >
                {activeIdx < filteredItems.length - 1 ? (
                  <>
                    Next Item <ChevronRightIcon className="h-4 w-4" />
                  </>
                ) : (
                  'Complete & Save'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: MATRIX / LIST VIEW */}
      {viewMode === 'list' && (
        <div className="mt-6 space-y-3">
          {filteredItems.map((item) => {
            const val = counts[item.id] ?? 0;
            const below = val < item.idealQty;

            return (
              <div
                key={item.id}
                className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 transition-colors ${
                  below
                    ? 'border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <div className="min-w-[200px] flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</h4>
                    {item.inventoryType && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {item.inventoryType.name}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>
                      Par: <strong>{item.idealQty} {item.unit}</strong>
                    </span>
                    {item.shelfLocation && (
                      <span className="flex items-center gap-0.5">
                        <MapPinIcon className="h-3 w-3" /> {item.shelfLocation}
                      </span>
                    )}
                    {below && (
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        &middot; Needs {item.idealQty - val} {item.unit}
                      </span>
                    )}
                  </div>
                </div>

                {/* Inline Stepper */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateCount(item.id, -1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>

                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={val}
                    onChange={(e) => setCountDirect(item.id, parseInt(e.target.value) || 0)}
                    className="h-9 w-16 rounded-lg border border-slate-300 text-center font-bold text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />

                  <button
                    type="button"
                    onClick={() => updateCount(item.id, 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>

                  <span className="w-14 text-xs text-slate-500">{item.unit}</span>
                </div>
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-700">
              No items assigned to this track in this room.
            </div>
          )}

          {filteredItems.length > 0 && (
            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
              >
                {savedSuccess ? (
                  <CheckIcon className="h-4 w-4 text-white" />
                ) : (
                  <CheckCheckIcon className="h-4 w-4" />
                )}
                {savedSuccess ? 'All Counts Saved!' : isPending ? 'Saving…' : 'Save All Counts'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
