'use client';

import { useState } from 'react';
import type { ToolDefinition, TableRow } from '@/lib/tools/schema';

type TableDefinition = Extract<ToolDefinition, { primitive: 'table' }>;

export function TableEditor({
  definition,
  data,
  onUpdate,
}: {
  definition: TableDefinition;
  data: unknown;
  onUpdate: (data: unknown) => void;
}) {
  const currentData = (data as { rows?: TableRow[] }) || { rows: [] };
  const rows = currentData.rows || [];

  const [newRowValues, setNewRowValues] = useState<Record<string, string>>({});

  function addRow(e: React.FormEvent) {
    e.preventDefault();
    const newRow: TableRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...newRowValues,
    };
    onUpdate({ ...currentData, rows: [...rows, newRow] });
    setNewRowValues({});
  }

  function updateRowCell(rowId: string, colKey: string, value: string) {
    const updatedRows = rows.map((r) => {
      if (r.id !== rowId) return r;
      return { ...r, [colKey]: value };
    });
    onUpdate({ ...currentData, rows: updatedRows });
  }

  function removeRow(rowId: string) {
    onUpdate({ ...currentData, rows: rows.filter((r) => r.id !== rowId) });
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
              {definition.config.columns.map((col) => (
                <th key={col.key} className="px-4 py-3">
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-3 text-right print:hidden">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={definition.config.columns.length + 1}
                  className="px-4 py-8 text-center text-slate-400 italic"
                >
                  No entries added yet. Use the form below to add rows.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  {definition.config.columns.map((col) => (
                    <td key={col.key} className="px-4 py-2.5">
                      <input
                        type="text"
                        value={String(row[col.key] ?? '')}
                        onChange={(e) => updateRowCell(row.id, col.key, e.target.value)}
                        className="w-full rounded bg-transparent px-1.5 py-1 text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 dark:text-slate-200 dark:focus:bg-slate-800"
                      />
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right print:hidden">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="text-slate-400 hover:text-rose-600 px-2 py-1 text-xs"
                      title="Delete row"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Row Form */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 print:hidden">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">+ Add New Row</h4>
        <form onSubmit={addRow} className="flex flex-wrap gap-3 items-end">
          {definition.config.columns.map((col) => (
            <div key={col.key} className="flex-1 min-w-[140px]">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                {col.label}
              </label>
              <input
                type="text"
                value={newRowValues[col.key] || ''}
                onChange={(e) => setNewRowValues({ ...newRowValues, [col.key]: e.target.value })}
                placeholder={`Enter ${col.label.toLowerCase()}…`}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          ))}
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          >
            + Add Row
          </button>
        </form>
      </div>
    </div>
  );
}
