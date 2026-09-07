// src/components/meetups/MeetupSuppliesSection.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/Toast';
import { saveMeetupSupplies } from '@/lib/actions/meetups';

export interface InventorySupplyItem {
  id: string;
  name: string;
  onHandQty: number;
  reorderThreshold: number;
  unit: string;
  roomName: string;
}

export interface SupplyManifestEntry {
  itemId: string;
  name: string;
  neededQty: number;
  unit: string;
}

interface MeetupSuppliesSectionProps {
  meetupId: string;
  canManage: boolean;
  initialSupplies: SupplyManifestEntry[];
  availableInventory: InventorySupplyItem[];
}

export function MeetupSuppliesSection({
  meetupId,
  canManage,
  initialSupplies = [],
  availableInventory = [],
}: MeetupSuppliesSectionProps) {
  const toast = useToast();
  const [supplies, setSupplies] = useState<SupplyManifestEntry[]>(initialSupplies);
  const [selectedItemId, setSelectedItemId] = useState<string>(availableInventory[0]?.id || '');
  const [neededQty, setNeededQty] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddSupply = async () => {
    const item = availableInventory.find((i) => i.id === selectedItemId);
    if (!item) return;

    // Check if already in list
    if (supplies.some((s) => s.itemId === item.id)) {
      toast.info('Item already added', 'Adjust the required quantity if needed.');
      return;
    }

    const nextSupplies = [
      ...supplies,
      {
        itemId: item.id,
        name: item.name,
        neededQty,
        unit: item.unit,
      },
    ];

    setSupplies(nextSupplies);
    setIsSaving(true);
    const res = await saveMeetupSupplies(meetupId, nextSupplies);
    setIsSaving(false);
    if (res.success) {
      toast.success(`Added "${item.name}" to supply checklist`);
    } else {
      toast.error('Failed to save supply checklist', res.error);
    }
  };

  const handleRemoveSupply = async (itemId: string) => {
    const nextSupplies = supplies.filter((s) => s.itemId !== itemId);
    setSupplies(nextSupplies);
    setIsSaving(true);
    const res = await saveMeetupSupplies(meetupId, nextSupplies);
    setIsSaving(false);
    if (res.success) {
      toast.success('Supply item removed');
    } else {
      toast.error('Failed to update supplies', res.error);
    }
  };

  // Inventory map for fast lookup of current on-hand counts
  const invMap = new Map(availableInventory.map((i) => [i.id, i]));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <span>📦</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Event Supply Logistics (Inventory)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Checklist of church inventory and supplies required for this gathering
            </p>
          </div>
        </div>

        <Link
          href="/inventory"
          className="text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
        >
          View Inventory Catalog →
        </Link>
      </div>

      {/* Supplies Checklist */}
      {supplies.length === 0 ? (
        <p className="text-xs text-slate-400 py-2">
          No supplies linked to this event yet. Planners can attach communion cups, paper goods, sound cables, or refreshments below.
        </p>
      ) : (
        <div className="space-y-2">
          {supplies.map((s) => {
            const currentStock = invMap.get(s.itemId);
            const onHand = currentStock?.onHandQty ?? 0;
            const isDeficit = onHand < s.neededQty;
            const isLowStock = currentStock ? onHand <= currentStock.reorderThreshold : false;

            return (
              <div
                key={s.itemId}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                      {s.name}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      (Need: {s.neededQty} {s.unit})
                    </span>
                  </div>
                  {currentStock && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Storage: {currentStock.roomName} · Currently on hand:{' '}
                      <span className={isDeficit || isLowStock ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-medium'}>
                        {onHand} {s.unit}
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isDeficit && (
                    <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                      ⚠️ Stock Deficit
                    </span>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSupply(s.itemId)}
                      disabled={isSaving}
                      className="text-slate-400 hover:text-rose-500 p-1 text-xs"
                      title="Remove from event supplies"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Supply Picker (Managers & Organizers) */}
      {canManage && availableInventory.length > 0 && (
        <div className="pt-2 flex flex-wrap items-center gap-2">
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="flex-1 min-w-[200px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-hidden"
          >
            {availableInventory.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.roomName}) — {i.onHandQty} {i.unit} on hand
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <label className="text-xs text-slate-500 dark:text-slate-400">Qty:</label>
            <input
              type="number"
              min={1}
              value={neededQty}
              onChange={(e) => setNeededQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-hidden"
            />
          </div>

          <button
            type="button"
            onClick={handleAddSupply}
            disabled={isSaving}
            className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving…' : '+ Add Supply'}
          </button>
        </div>
      )}
    </div>
  );
}

