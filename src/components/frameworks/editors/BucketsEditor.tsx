'use client';

import { useState } from 'react';
import type { ToolDefinition } from '@/lib/tools/schema';

type BucketsDefinition = Extract<ToolDefinition, { primitive: 'buckets' }>;

interface ToolItem {
  id: string;
  categoryKey: string;
  values: {
    text?: string;
    impact?: string;
  };
}

export function BucketsEditor({
  definition,
  data,
  onUpdate,
}: {
  definition: BucketsDefinition;
  data: unknown;
  onUpdate: (data: unknown) => void;
}) {
  const currentData = (data as { items?: ToolItem[] }) || { items: [] };
  const items = currentData.items || [];

  function addItem(categoryKey: string, text: string, impact = 'Medium') {
    if (!text.trim()) return;
    const newItem: ToolItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      categoryKey,
      values: { text: text.trim(), impact },
    };
    onUpdate({ ...currentData, items: [...items, newItem] });
  }

  function removeItem(itemId: string) {
    onUpdate({ ...currentData, items: items.filter((i) => i.id !== itemId) });
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {definition.config.categories.map((cat) => {
        const catItems = items.filter((i) => i.categoryKey === cat.key);
        return (
          <CategoryColumn
            key={cat.key}
            category={cat}
            items={catItems}
            onAdd={(text, impact) => addItem(cat.key, text, impact)}
            onRemove={removeItem}
          />
        );
      })}
    </div>
  );
}

function CategoryColumn({
  category,
  items,
  onAdd,
  onRemove,
}: {
  category: { key: string; label: string; prompt?: string };
  items: ToolItem[];
  onAdd: (text: string, impact: string) => void;
  onRemove: (id: string) => void;
}) {
  const [newText, setNewText] = useState('');
  const [impact, setImpact] = useState('Medium');

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newText.trim()) return;
    onAdd(newText.trim(), impact);
    setNewText('');
  }

  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">{category.label}</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {category.prompt && (
          <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400 leading-relaxed">
            {category.prompt}
          </p>
        )}

        <div className="mt-4 space-y-2.5">
          {items.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400 italic">No entries yet.</p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="group flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 p-2.5 text-xs transition-colors hover:border-slate-200 dark:border-slate-800 dark:bg-slate-800/60"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                  <span
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                      item.values.impact === 'Critical'
                        ? 'bg-rose-500'
                        : item.values.impact === 'High'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                  />
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                    {item.values.text}
                  </span>
                  {item.values.impact && (
                    <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                      {item.values.impact}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="opacity-60 hover:opacity-100 text-slate-400 hover:text-rose-600 px-1 py-0.5 text-xs transition-opacity print:hidden"
                  title="Remove entry"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <form onSubmit={handleAdd} className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800 print:hidden">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={`Add to ${category.label}…`}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <select
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          >
            + Add
          </button>
        </div>
      </form>
    </div>
  );
}
