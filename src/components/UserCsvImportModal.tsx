'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  parseAndPreviewUsersCsv,
  importUsersCsv,
  type CsvUserPreviewRow,
  type CsvUserPreviewResult,
} from '@/lib/actions/users';

interface UserCsvImportModalProps {
  onClose: () => void;
}

interface ImportSuccessData {
  importedCount: number;
  results: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    inviteUrl?: string;
    temporaryPassword?: string;
  }>;
}

export function UserCsvImportModal({ onClose }: UserCsvImportModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inputMode, setInputMode] = useState<'upload' | 'paste'>('upload');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CsvUserPreviewResult | null>(null);
  const [sendInvites, setSendInvites] = useState(true);
  const [isImporting, startImportTransition] = useTransition();
  const [successData, setSuccessData] = useState<ImportSuccessData | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  async function handleParse(text: string, name?: string) {
    if (!text.trim()) {
      setPreview(null);
      setError('CSV content is empty.');
      return;
    }
    setError(null);
    setIsParsing(true);
    try {
      if (name) setFileName(name);
      setCsvText(text);
      const res = await parseAndPreviewUsersCsv(text);
      setPreview(res);
      if (res.totalRows === 0) {
        setError('No user records found in the provided CSV.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
      setPreview(null);
    } finally {
      setIsParsing(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      void handleParse(text, file.name);
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      void handleParse(text, file.name);
    };
    reader.readAsText(file);
  }

  function handleDownloadTemplate() {
    const templateContent =
      'Name,Email,Role,Password\n' +
      'Pastor Dan Whitfield,pastor.dan@chespres.org,ADMIN,\n' +
      'Renee Ortiz,renee.ortiz@chespres.org,MANAGER,\n' +
      'Miguel Alvarez,miguel.alvarez@chespres.org,USER,\n' +
      'Casey Nguyen,casey.nguyen@chespres.org,USER,\n' +
      'Sarah Kim,sarah.kim@chespres.org,USER,\n';

    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'cpcana_staff_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleExecuteImport() {
    if (!preview || preview.validCount === 0) return;

    setError(null);
    const validRows = preview.rows
      .filter((r) => r.status === 'valid')
      .map((r) => ({
        name: r.name,
        email: r.email,
        role: r.role,
        password: r.password,
      }));

    startImportTransition(async () => {
      const res = await importUsersCsv({
        rows: validRows,
        sendInvites,
      });

      if (res.success) {
        setSuccessData({
          importedCount: res.importedCount,
          results: res.results,
        });
        router.refresh();
      } else {
        setError(res.error || 'Failed to import users.');
      }
    });
  }

  async function handleCopyAllLinks() {
    if (!successData?.results) return;
    const lines = successData.results
      .map((u) => `${u.name} <${u.email}>: ${u.inviteUrl || '(invite link not generated)'}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(lines);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    } catch {
      // Fallback
    }
  }

  function handleDownloadExportedCredentials() {
    if (!successData?.results) return;
    const rows = [
      ['Name', 'Email', 'Role', 'Temporary Password', 'Invite Setup URL'],
      ...successData.results.map((u) => [
        u.name,
        u.email,
        u.role,
        u.temporaryPassword || '(self-set / existing)',
        u.inviteUrl || '',
      ]),
    ];

    const csvString = rows
      .map((row) =>
        row
          .map((cell) => `"${cell.replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'cpcana_imported_credentials.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>📥</span> Import Staff Users from CSV
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Bulk-create accounts and onboarding links for ministry directors, coordinators, and volunteers.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          {!successData ? (
            <>
              {/* Input Tabs & Template Button */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setInputMode('upload')}
                    className={`rounded-md px-3 py-1.5 transition-colors ${
                      inputMode === 'upload'
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    📁 Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('paste')}
                    className={`rounded-md px-3 py-1.5 transition-colors ${
                      inputMode === 'paste'
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    📋 Paste CSV
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1.5"
                >
                  <span>⬇️</span> Download sample template (.csv)
                </button>
              </div>

              {/* Upload or Paste Area */}
              {inputMode === 'upload' ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-8 text-center transition-colors hover:border-brand-500 hover:bg-brand-50/20 cursor-pointer dark:border-slate-700 dark:hover:border-brand-500 dark:hover:bg-slate-800/40"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <span className="text-3xl mb-2">📄</span>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {fileName ? (
                      <span className="text-brand-600 dark:text-brand-400 font-semibold">{fileName}</span>
                    ) : (
                      'Click to browse or drag and drop your staff roster CSV'
                    )}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Columns: Name, Email, Role (ADMIN, MANAGER, USER), Password (optional)
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    placeholder="Name,Email,Role&#10;Pastor Dan Whitfield,pastor.dan@chespres.org,ADMIN&#10;Renee Ortiz,renee.ortiz@chespres.org,MANAGER"
                    rows={6}
                    className="w-full font-mono text-xs rounded-xl border border-slate-300 p-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleParse(csvText)}
                      disabled={isParsing || !csvText.trim()}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      {isParsing ? 'Parsing…' : 'Preview CSV'}
                    </button>
                  </div>
                </div>
              )}

              {/* Preview Table */}
              {preview && (
                <div className="space-y-3 pt-2">
                  {/* Summary Metric Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/60">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Total in File</div>
                      <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">{preview.totalRows}</div>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                      <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Ready to Import</div>
                      <div className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">
                        {preview.validCount}
                      </div>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 dark:border-amber-900/50 dark:bg-amber-950/30">
                      <div className="text-xs text-amber-700 dark:text-amber-400 font-medium">Already Exists (Skip)</div>
                      <div className="text-lg font-semibold text-amber-800 dark:text-amber-300">
                        {preview.existingCount}
                      </div>
                    </div>
                    <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-2.5 dark:border-rose-900/50 dark:bg-rose-950/30">
                      <div className="text-xs text-rose-700 dark:text-rose-400 font-medium">Invalid / Duplicate</div>
                      <div className="text-lg font-semibold text-rose-800 dark:text-rose-300">
                        {preview.invalidCount + preview.duplicateCount}
                      </div>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                      <thead className="sticky top-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 uppercase tracking-wider font-semibold text-[10px]">
                        <tr>
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">Name</th>
                          <th className="py-2 px-3">Email</th>
                          <th className="py-2 px-3">Role</th>
                          <th className="py-2 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                        {preview.rows.map((row) => (
                          <tr
                            key={row.rowNumber}
                            className={
                              row.status === 'valid'
                                ? 'bg-white hover:bg-slate-50/80 dark:bg-slate-900 dark:hover:bg-slate-800/40'
                                : 'bg-slate-50/50 dark:bg-slate-900/50 opacity-80'
                            }
                          >
                            <td className="py-2 px-3 text-slate-400">{row.rowNumber}</td>
                            <td className="py-2 px-3 font-sans font-medium text-slate-800 dark:text-slate-200">
                              {row.name || <span className="text-rose-500 italic">Empty</span>}
                            </td>
                            <td className="py-2 px-3">{row.email || '—'}</td>
                            <td className="py-2 px-3">
                              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold dark:bg-slate-800">
                                {row.role}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-sans">
                              {row.status === 'valid' && (
                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  ✓ Ready
                                </span>
                              )}
                              {row.status === 'already_exists' && (
                                <span
                                  title={row.error}
                                  className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                >
                                  Skipped (Exists)
                                </span>
                              )}
                              {row.status === 'duplicate_in_file' && (
                                <span
                                  title={row.error}
                                  className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                >
                                  Duplicate in CSV
                                </span>
                              )}
                              {row.status === 'invalid' && (
                                <span
                                  title={row.error}
                                  className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                >
                                  ⚠️ {row.error || 'Error'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Send Invites Checkbox */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      id="sendInvites"
                      type="checkbox"
                      checked={sendInvites}
                      onChange={(e) => setSendInvites(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800"
                    />
                    <label htmlFor="sendInvites" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      Send welcome email invitations with 7-day password setup links
                    </label>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Success Summary View */
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-5 text-center dark:border-emerald-900/60 dark:bg-emerald-950/40">
                <span className="text-3xl">🎉</span>
                <h3 className="mt-2 text-base font-semibold text-emerald-900 dark:text-emerald-200">
                  Successfully imported {successData.importedCount} user
                  {successData.importedCount === 1 ? '' : 's'}!
                </h3>
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400 max-w-md mx-auto">
                  Staff accounts have been registered in CPCana. 7-day password setup links have been minted.
                </p>
              </div>

              {/* Action Buttons: Copy / Download CSV */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleCopyAllLinks}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {copiedAll ? '✓ Copied to clipboard!' : '📋 Copy All Invite Links'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadExportedCredentials}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  📥 Download Credentials CSV
                </button>
              </div>

              {/* Results Roster List */}
              <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="sticky top-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-[10px] uppercase font-semibold">
                    <tr>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Email</th>
                      <th className="py-2 px-3">Role</th>
                      <th className="py-2 px-3 text-right">Invite Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {successData.results.map((u) => (
                      <tr key={u.id} className="bg-white dark:bg-slate-900">
                        <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">{u.name}</td>
                        <td className="py-2 px-3 font-mono text-[11px]">{u.email}</td>
                        <td className="py-2 px-3">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold dark:bg-slate-800">
                            {u.role}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          {u.inviteUrl ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (u.inviteUrl) navigator.clipboard.writeText(u.inviteUrl);
                              }}
                              className="text-[11px] text-brand-600 hover:text-brand-700 dark:text-brand-400 underline font-medium"
                            >
                              Copy Link
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          {!successData ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isImporting || !preview || preview.validCount === 0}
                className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isImporting ? (
                  <>
                    <span className="animate-spin text-sm">⏳</span> Importing…
                  </>
                ) : (
                  `Import ${preview?.validCount ?? 0} Users`
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-brand-600 px-5 py-2 text-xs font-medium text-white hover:bg-brand-700"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
