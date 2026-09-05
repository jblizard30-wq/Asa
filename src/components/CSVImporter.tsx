'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  SparklesIcon,
  CheckCheckIcon,
  AlertTriangleIcon,
  DownloadIcon,
} from '@/components/InventoryIcons';
import { parseAndPreviewCSV, executeBatchImport, type ImportPreviewRow } from '@/lib/actions/inventoryImport';

interface InventoryTypeOption {
  id: string;
  name: string;
}

export function CSVImporter({ inventoryTypes }: { inventoryTypes: InventoryTypeOption[] }) {
  const [selectedInventory, setSelectedInventory] = useState<string>(inventoryTypes[0]?.id || '');
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, startTransition] = useTransition();
  const [importResult, setImportResult] = useState<{ count: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setErrorMessage(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = (event.target?.result as string) || '';
        const parsed = await parseAndPreviewCSV(text);
        setPreviewRows(parsed);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to parse CSV file.';
        setErrorMessage(msg);
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = () => {
    if (!selectedInventory) {
      alert('Please select a target Inventory Track first.');
      return;
    }
    if (previewRows.length === 0) return;

    setErrorMessage(null);
    startTransition(async () => {
      const res = await executeBatchImport({
        inventoryTypeId: selectedInventory,
        rows: previewRows,
      });

      if (res.success) {
        setImportResult({ count: res.count });
        setPreviewRows([]);
      } else {
        setErrorMessage(res.error || 'Import failed.');
      }
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/inventory"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Import Consumables & Supplies CSV
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Bulk populate rooms, par levels, and vendors from spreadsheets or Google Forms.
            </p>
          </div>
        </div>
      </div>

      {/* Target Domain Selector */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          Target Inventory Track
        </label>
        <p className="mt-0.5 text-xs text-slate-500">
          Choose which department or cadence this batch belongs to.
        </p>
        <select
          value={selectedInventory}
          onChange={(e) => setSelectedInventory(e.target.value)}
          className="mt-3 block w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          {inventoryTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Upload Zone */}
      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/40">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400">
          <DownloadIcon className="h-6 w-6 rotate-180" />
        </div>
        <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
          Upload Spreadsheet (.csv)
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Supports columns: Location/Building, Room, Item Name, On Hand, Unit, Vendor
        </p>

        <label className="mt-4 inline-block cursor-pointer rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-brand-700">
          Select CSV File
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={isParsing || isImporting}
            className="hidden"
          />
        </label>

        {isParsing && <p className="mt-3 text-xs text-brand-500">Sanitizing and parsing CSV...</p>}
      </div>

      {/* Status Messages */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          <AlertTriangleIcon className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {importResult && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
          <CheckCheckIcon className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>Successfully imported {importResult.count} items into the inventory ledger!</span>
        </div>
      )}

      {/* Preview Table */}
      {previewRows.length > 0 && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-4 w-4 text-brand-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Sanitized Preview ({previewRows.length} Items Found)
              </h2>
            </div>
            <button
              onClick={handleExecuteImport}
              disabled={isImporting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
            >
              {isImporting ? 'Importing Batch...' : `Confirm & Import ${previewRows.length} Items`}
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-100 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="p-2.5">Building</th>
                  <th className="p-2.5">Room</th>
                  <th className="p-2.5">Clean Item Name</th>
                  <th className="p-2.5">Unit</th>
                  <th className="p-2.5 text-right">Par Level</th>
                  <th className="p-2.5 text-right">On Hand</th>
                  <th className="p-2.5">Vendor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {previewRows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-2.5 text-slate-600 dark:text-slate-400">{r.building}</td>
                    <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">{r.room}</td>
                    <td className="p-2.5 font-medium text-slate-900 dark:text-white">{r.item}</td>
                    <td className="p-2.5 text-slate-500">{r.unit}</td>
                    <td className="p-2.5 text-right font-mono text-slate-700 dark:text-slate-300">{r.idealQty}</td>
                    <td className="p-2.5 text-right font-mono text-slate-700 dark:text-slate-300">{r.onHandQty}</td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-400">
                      {r.vendor || <span className="text-slate-400 italic">None</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
