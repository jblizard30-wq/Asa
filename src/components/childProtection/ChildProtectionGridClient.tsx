'use client';

import React, { useState, useMemo, useTransition, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowTopRightOnSquareIcon,
  PlusIcon,
  ArrowUpTrayIcon,
  PencilSquareIcon,
  ClipboardDocumentCheckIcon,
  ArchiveBoxIcon,
  UsersIcon,
} from './ChildProtectionIcons';
import { ManageAccessModal } from './ManageAccessModal';
import type {
  SerializedChildProtectionRecord,
  ChildProtectionStatus,
} from '@/lib/childProtection';
import type { ChildProtectionMetrics } from '@/lib/actions/childProtection';
import {
  createChildProtectionRecord,
  updateChildProtectionRecord,
  archiveChildProtectionRecord,
  createRenewalReviewTask,
  importChildProtectionRecords,
} from '@/lib/actions/childProtection';
import { CsvTemplateButton } from '@/components/CsvTemplateButton';

interface Props {
  initialRecords: SerializedChildProtectionRecord[];
  initialMetrics: ChildProtectionMetrics;
  userAccess: 'VIEW' | 'EDIT' | null;
  availableProjects: { id: string; name: string; defaultSectionId: string }[];
  assignableUsers: { id: string; name: string; email: string }[];
  /// Distinct from userAccess === 'EDIT': a non-admin can hold EDIT through a team share,
  /// but granting access to others stays with global admins.
  isAdmin: boolean;
}

const COMMON_MINISTRIES = [
  'Nursery',
  'Kids Ministry',
  'Youth / Students',
  'VBS',
  'Sunday School',
  'Worship / Tech',
  'Pastoral Care',
  'Security / Welcome',
];

export function ChildProtectionGridClient({
  initialRecords,
  initialMetrics,
  userAccess,
  availableProjects,
  assignableUsers,
  isAdmin,
}: Props) {
  const [records, setRecords] = useState<SerializedChildProtectionRecord[]>(initialRecords);
  const [metrics, setMetrics] = useState<ChildProtectionMetrics>(initialMetrics);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [ministryFilter, setMinistryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isPending, startTransition] = useTransition();
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SerializedChildProtectionRecord | null>(null);
  const [reviewTaskRecord, setReviewTaskRecord] = useState<SerializedChildProtectionRecord | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isManageAccessModalOpen, setIsManageAccessModalOpen] = useState(false);

  // Extract all distinct ministries from records for the filter dropdown
  const allDistinctMinistries = useMemo(() => {
    const set = new Set<string>(COMMON_MINISTRIES);
    records.forEach((r) => r.ministries.forEach((m) => set.add(m)));
    return Array.from(set).sort();
  }, [records]);

  // Filtered rows
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Status filter
      if (statusFilter === 'NEEDS_ATTENTION') {
        if (r.status === 'COMPLIANT') return false;
      } else if (statusFilter !== 'ALL' && r.status !== statusFilter) {
        return false;
      }

      // Ministry filter
      if (ministryFilter !== 'ALL') {
        if (!r.ministries.includes(ministryFilter)) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.name.toLowerCase().includes(q);
        const matchEmail = r.email?.toLowerCase().includes(q) ?? false;
        const matchMinistry = r.ministries.some((m) => m.toLowerCase().includes(q));
        if (!matchName && !matchEmail && !matchMinistry) return false;
      }

      return true;
    });
  }, [records, statusFilter, ministryFilter, searchQuery]);

  // Recalculate metrics locally when records change
  const refreshMetrics = (updatedRecords: SerializedChildProtectionRecord[]) => {
    let compliant = 0;
    let expiringSoon = 0;
    let expired = 0;
    let incomplete = 0;
    for (const r of updatedRecords) {
      if (r.status === 'COMPLIANT') compliant++;
      else if (r.status === 'EXPIRING_SOON') expiringSoon++;
      else if (r.status === 'EXPIRED') expired++;
      else if (r.status === 'INCOMPLETE') incomplete++;
    }
    setMetrics({
      total: updatedRecords.length,
      compliant,
      expiringSoon,
      expired,
      incomplete,
    });
  };

  const handleArchive = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to archive ${name}? They will be removed from the active compliance list.`)) {
      return;
    }

    startTransition(async () => {
      const res = await archiveChildProtectionRecord(id);
      if (res.success) {
        const next = records.filter((r) => r.id !== id);
        setRecords(next);
        refreshMetrics(next);
        setFeedbackMessage({ type: 'success', text: `Archived ${name}.` });
      } else {
        setFeedbackMessage({ type: 'error', text: res.error || 'Failed to archive record.' });
      }
    });
  };

  const formatDate = (isoString: string | null) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedbackMessage && (
        <div
          className={`flex items-center justify-between rounded-lg p-4 text-sm font-medium transition-all ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
          }`}
        >
          <span>{feedbackMessage.text}</span>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-xs font-semibold uppercase hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <ShieldCheckIcon className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Child Protection
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Compliance tracking for staff and volunteers: DocuSign covenants, MinistrySafe (3-yr renewal), and Background Checks (5-yr renewal).
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => setIsManageAccessModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <UsersIcon className="h-4 w-4" />
              Manage Access
            </button>
          )}

          {userAccess === 'EDIT' && (
            <>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <ArrowUpTrayIcon className="h-4 w-4" />
                Import CSV / Sheets
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors dark:bg-indigo-600 dark:hover:bg-indigo-500"
              >
                <PlusIcon className="h-4 w-4" />
                Add Volunteer
              </button>
            </>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          aria-pressed={statusFilter === 'ALL'}
          className={`cursor-pointer rounded-xl border p-4 text-left shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 hover:border-slate-400 dark:hover:border-slate-600 ${
            statusFilter === 'ALL'
              ? 'border-indigo-500 bg-indigo-50/40 dark:border-indigo-500 dark:bg-indigo-950/20'
              : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
          }`}
        >
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <ShieldCheckIcon className="h-4 w-4 text-indigo-500" />
            <span className="text-xs font-semibold uppercase tracking-wider">Total Roster</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{metrics.total}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Active tracked individuals</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('COMPLIANT')}
          aria-pressed={statusFilter === 'COMPLIANT'}
          className={`cursor-pointer rounded-xl border p-4 text-left shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 hover:border-emerald-400 dark:hover:border-emerald-600 ${
            statusFilter === 'COMPLIANT'
              ? 'border-emerald-500 bg-emerald-50/40 dark:border-emerald-500 dark:bg-emerald-950/20'
              : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
          }`}
        >
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-wider">Compliant</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{metrics.compliant}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">All 3 current (&gt;45 days)</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('EXPIRING_SOON')}
          aria-pressed={statusFilter === 'EXPIRING_SOON'}
          className={`cursor-pointer rounded-xl border p-4 text-left shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 hover:border-amber-400 dark:hover:border-amber-600 ${
            statusFilter === 'EXPIRING_SOON'
              ? 'border-amber-500 bg-amber-50/40 dark:border-amber-500 dark:bg-amber-950/20'
              : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
          }`}
        >
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-semibold uppercase tracking-wider">Expiring Soon</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{metrics.expiringSoon}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Within 45-day renewal window</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('EXPIRED')}
          aria-pressed={statusFilter === 'EXPIRED'}
          className={`cursor-pointer rounded-xl border p-4 text-left shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 hover:border-rose-400 dark:hover:border-rose-600 ${
            statusFilter === 'EXPIRED'
              ? 'border-rose-500 bg-rose-50/40 dark:border-rose-500 dark:bg-rose-950/20'
              : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
          }`}
        >
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <XCircleIcon className="h-4 w-4 text-rose-500" />
            <span className="text-xs font-semibold uppercase tracking-wider">Expired</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{metrics.expired}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Past 3-yr or 5-yr renewal</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('INCOMPLETE')}
          aria-pressed={statusFilter === 'INCOMPLETE'}
          className={`cursor-pointer rounded-xl border p-4 text-left shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 hover:border-slate-400 dark:hover:border-slate-600 ${
            statusFilter === 'INCOMPLETE'
              ? 'border-indigo-500 bg-indigo-50/40 dark:border-indigo-500 dark:bg-indigo-950/20'
              : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
          }`}
        >
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <ClipboardDocumentCheckIcon className="h-4 w-4 text-indigo-500" />
            <span className="text-xs font-semibold uppercase tracking-wider">Incomplete</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{metrics.incomplete}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Missing signature or initial check</p>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search volunteer by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />

          <select
            value={ministryFilter}
            onChange={(e) => setMinistryFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="ALL">All Ministries</option>
            {allDistinctMinistries.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEEDS_ATTENTION">⚠️ Needs Attention (Expiring / Expired / Incomplete)</option>
            <option value="EXPIRING_SOON">🟡 Expiring in 45 Days</option>
            <option value="EXPIRED">🔴 Expired</option>
            <option value="INCOMPLETE">⚪ Incomplete / Missing Requirements</option>
            <option value="COMPLIANT">🟢 Compliant</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400">
          Showing <span className="font-semibold text-slate-900 dark:text-white">{filteredRecords.length}</span> of{' '}
          <span className="font-semibold text-slate-900 dark:text-white">{records.length}</span> records
        </div>
      </div>

      {/* Spreadsheet-Grade Grid Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="py-3.5 pl-4 pr-3">Volunteer / Person</th>
                <th className="px-3 py-3.5">Ministries</th>
                <th className="px-3 py-3.5">Status</th>
                <th className="px-3 py-3.5">DocuSign Agreement</th>
                <th className="px-3 py-3.5">MinistrySafe (3 Yr)</th>
                <th className="px-3 py-3.5">Background Check (5 Yr)</th>
                <th className="py-3.5 pl-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No child protection records match your current filters.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/60 transition-colors dark:hover:bg-slate-800/40"
                    >
                      {/* Person Details */}
                      <td className="py-4 pl-4 pr-3">
                        <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{r.name}</span>
                          {r.user && (
                            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                              Staff
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {r.email || 'No email'} {r.phone ? `• ${r.phone}` : ''}
                        </div>
                        {r.notes && (
                          <div className="mt-1 text-[11px] text-slate-400 line-clamp-1 italic">
                            {r.notes}
                          </div>
                        )}
                      </td>

                      {/* Ministries */}
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {r.ministries.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">None</span>
                          ) : (
                            r.ministries.map((m) => (
                              <span
                                key={m}
                                className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                              >
                                {m}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      {/* Overall Compliance Status */}
                      <td className="px-3 py-4 whitespace-nowrap">
                        {r.status === 'COMPLIANT' && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                            <CheckCircleIcon className="h-3.5 w-3.5" />
                            Compliant
                          </span>
                        )}
                        {r.status === 'EXPIRING_SOON' && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                            <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                            Renews in {r.daysUntilNextRenewal}d
                          </span>
                        )}
                        {r.status === 'EXPIRED' && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
                            <XCircleIcon className="h-3.5 w-3.5" />
                            Expired
                          </span>
                        )}
                        {r.status === 'INCOMPLETE' && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                            Action Needed
                          </span>
                        )}
                      </td>

                      {/* DocuSign Agreement */}
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {r.docusignSigned ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              <CheckCircleIcon className="h-4 w-4" />
                              Signed {r.docusignSignedAt ? `(${formatDate(r.docusignSignedAt)})` : ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-rose-500 font-medium">
                              <XCircleIcon className="h-4 w-4" />
                              Not Signed
                            </span>
                          )}

                          {r.docusignUrl && (
                            <a
                              href={r.docusignUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open DocuSign in Google Drive"
                              className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                            >
                              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* MinistrySafe */}
                      <td className="px-3 py-4 whitespace-nowrap">
                        {r.ministrySafeCompletedAt ? (
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900 dark:text-white text-xs">
                                Completed {formatDate(r.ministrySafeCompletedAt)}
                              </span>
                              {r.ministrySafeUrl && (
                                <a
                                  href={r.ministrySafeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Open MinistrySafe Certificate in Google Drive"
                                  className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                                >
                                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Expires: {formatDate(r.ministrySafeExpiresAt)}
                              {r.daysUntilMinistrySafeExpires !== null && (
                                <span
                                  className={`ml-1.5 font-medium ${
                                    r.daysUntilMinistrySafeExpires < 0
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : r.daysUntilMinistrySafeExpires <= 45
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  ({r.daysUntilMinistrySafeExpires < 0 ? 'Expired' : `${r.daysUntilMinistrySafeExpires}d left`})
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Not completed</span>
                        )}
                      </td>

                      {/* Background Check */}
                      <td className="px-3 py-4 whitespace-nowrap">
                        {r.backgroundCheckCompletedAt ? (
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900 dark:text-white text-xs">
                                Completed {formatDate(r.backgroundCheckCompletedAt)}
                              </span>
                              {r.backgroundCheckUrl && (
                                <a
                                  href={r.backgroundCheckUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Open Background Check Report in Google Drive"
                                  className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                                >
                                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Expires: {formatDate(r.backgroundCheckExpiresAt)}
                              {r.daysUntilBackgroundCheckExpires !== null && (
                                <span
                                  className={`ml-1.5 font-medium ${
                                    r.daysUntilBackgroundCheckExpires < 0
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : r.daysUntilBackgroundCheckExpires <= 45
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  ({r.daysUntilBackgroundCheckExpires < 0 ? 'Expired' : `${r.daysUntilBackgroundCheckExpires}d left`})
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Not completed</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 pl-3 pr-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setReviewTaskRecord(r)}
                            title="Assign Renewal Review Task"
                            className="inline-flex items-center gap-1 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
                          >
                            <ClipboardDocumentCheckIcon className="h-4 w-4" />
                          </button>

                          {userAccess === 'EDIT' && (
                            <>
                              <button
                                onClick={() => setReviewTaskRecord(r)}
                                title="Assign Renewal Review Task"
                                aria-label={`Assign Renewal Review Task for ${r.name}`}
                                className="inline-flex items-center gap-1 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
                              >
                                <ClipboardDocumentCheckIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingRecord(r)}
                                title="Edit Volunteer"
                                aria-label={`Edit ${r.name}`}
                                className="inline-flex items-center gap-1 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                              >
                                <PencilSquareIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleArchive(r.id, r.name)}
                                title="Archive Volunteer"
                                aria-label={`Archive ${r.name}`}
                                className="inline-flex items-center gap-1 rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                              >
                                <ArchiveBoxIcon className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Volunteer Modal */}
      {(isAddModalOpen || editingRecord) && (
        <RecordFormModal
          record={editingRecord}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingRecord(null);
          }}
          onSaved={(savedRecord) => {
            if (editingRecord) {
              const next = records.map((r) => (r.id === savedRecord.id ? savedRecord : r));
              setRecords(next);
              refreshMetrics(next);
              setFeedbackMessage({ type: 'success', text: `Updated ${savedRecord.name}.` });
            } else {
              const next = [savedRecord, ...records];
              setRecords(next);
              refreshMetrics(next);
              setFeedbackMessage({ type: 'success', text: `Added ${savedRecord.name} to Child Protection.` });
            }
            setIsAddModalOpen(false);
            setEditingRecord(null);
          }}
        />
      )}

      {/* Assign Review Task Modal */}
      {reviewTaskRecord && (
        <ReviewTaskModal
          record={reviewTaskRecord}
          availableProjects={availableProjects}
          assignableUsers={assignableUsers}
          onClose={() => setReviewTaskRecord(null)}
          onCreated={(taskTitle) => {
            setFeedbackMessage({ type: 'success', text: `Assigned task: "${taskTitle}"` });
            setReviewTaskRecord(null);
          }}
        />
      )}

      {/* Manage Access Modal */}
      {isManageAccessModalOpen && (
        <ManageAccessModal
          assignableUsers={assignableUsers}
          onClose={() => setIsManageAccessModalOpen(false)}
          onFeedback={(msg) => setFeedbackMessage(msg)}
        />
      )}

      {/* CSV / Sheets Import Modal */}
      {isImportModalOpen && (
        <ImportCsvModal
          onClose={() => setIsImportModalOpen(false)}
          onImported={(count, created, updated) => {
            const summary =
              updated > 0
                ? `Imported ${count} rows: ${created} added, ${updated} updated on existing records.`
                : `Successfully imported ${count} volunteers!`;
            setFeedbackMessage({ type: 'success', text: summary });
            setIsImportModalOpen(false);
            window.location.reload(); // Re-fetch all data from server
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add / Edit Volunteer Form Modal
// ---------------------------------------------------------------------------

function RecordFormModal({
  record,
  onClose,
  onSaved,
}: {
  record: SerializedChildProtectionRecord | null;
  onClose: () => void;
  onSaved: (record: SerializedChildProtectionRecord) => void;
}) {
  const [name, setName] = useState(record?.name ?? '');
  const [email, setEmail] = useState(record?.email ?? '');
  const [phone, setPhone] = useState(record?.phone ?? '');
  const [ministriesText, setMinistriesText] = useState(record?.ministries.join(', ') ?? '');
  const [notes, setNotes] = useState(record?.notes ?? '');

  // DocuSign
  const [docusignSigned, setDocusignSigned] = useState(record?.docusignSigned ?? false);
  const [docusignSignedAt, setDocusignSignedAt] = useState(
    record?.docusignSignedAt ? record.docusignSignedAt.split('T')[0] : ''
  );
  const [docusignUrl, setDocusignUrl] = useState(record?.docusignUrl ?? '');

  // MinistrySafe
  const [ministrySafeCompletedAt, setMinistrySafeCompletedAt] = useState(
    record?.ministrySafeCompletedAt ? record.ministrySafeCompletedAt.split('T')[0] : ''
  );
  const [ministrySafeUrl, setMinistrySafeUrl] = useState(record?.ministrySafeUrl ?? '');

  // Background Check
  const [backgroundCheckCompletedAt, setBackgroundCheckCompletedAt] = useState(
    record?.backgroundCheckCompletedAt ? record.backgroundCheckCompletedAt.split('T')[0] : ''
  );
  const [backgroundCheckUrl, setBackgroundCheckUrl] = useState(record?.backgroundCheckUrl ?? '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Volunteer name is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const ministries = ministriesText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const payload = {
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      ministries,
      notes: notes.trim() || null,
      docusignSigned,
      docusignSignedAt: docusignSignedAt ? new Date(docusignSignedAt).toISOString() : null,
      docusignUrl: docusignUrl.trim() || null,
      ministrySafeCompletedAt: ministrySafeCompletedAt ? new Date(ministrySafeCompletedAt).toISOString() : null,
      ministrySafeUrl: ministrySafeUrl.trim() || null,
      backgroundCheckCompletedAt: backgroundCheckCompletedAt ? new Date(backgroundCheckCompletedAt).toISOString() : null,
      backgroundCheckUrl: backgroundCheckUrl.trim() || null,
    };

    try {
      if (record) {
        const res = await updateChildProtectionRecord(record.id, payload);
        if (res.success && res.data) {
          // Compute updated status
          window.location.reload();
        } else {
          setError(res.error || 'Failed to update record.');
        }
      } else {
        const res = await createChildProtectionRecord(payload);
        if (res.success && res.data) {
          window.location.reload();
        } else {
          setError(res.error || 'Failed to create record.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 my-8">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {record ? `Edit ${record.name}` : 'Add Volunteer to Child Protection'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
          {/* Personal Info */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">Name *</label>
              <input
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 000-0000"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Ministries (comma-separated)
              </label>
              <input
                type="text"
                value={ministriesText}
                onChange={(e) => setMinistriesText(e.target.value)}
                placeholder="Nursery, Kids, Youth"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* DocuSign Section */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <h3 className="font-semibold text-slate-900 dark:text-white">DocuSign Agreement (One-Time)</h3>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={docusignSigned}
                  onChange={(e) => setDocusignSigned(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 dark:text-slate-300 font-medium">Agreement Signed</span>
              </label>

              <div>
                <input
                  type="date"
                  value={docusignSignedAt}
                  onChange={(e) => setDocusignSignedAt(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Google Drive Document Link
              </label>
              <input
                type="url"
                value={docusignUrl}
                onChange={(e) => setDocusignUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* MinistrySafe Section */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                MinistrySafe Training (3-Year Renewal)
              </h3>
              <span className="text-xs text-slate-400">Auto-expires in 3 years</span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Completed Date
                </label>
                <input
                  type="date"
                  value={ministrySafeCompletedAt}
                  onChange={(e) => setMinistrySafeCompletedAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Certificate Google Drive Link
                </label>
                <input
                  type="url"
                  value={ministrySafeUrl}
                  onChange={(e) => setMinistrySafeUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Background Check Section */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Background Check (5-Year Renewal)
              </h3>
              <span className="text-xs text-slate-400">Auto-expires in 5 years</span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Completed Date
                </label>
                <input
                  type="date"
                  value={backgroundCheckCompletedAt}
                  onChange={(e) => setBackgroundCheckCompletedAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Report Google Drive Link
                </label>
                <input
                  type="url"
                  value={backgroundCheckUrl}
                  onChange={(e) => setBackgroundCheckUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">Notes / Audit Log</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes or screening background..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : record ? 'Save Changes' : 'Add Volunteer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Review Task Modal
// ---------------------------------------------------------------------------

function ReviewTaskModal({
  record,
  availableProjects,
  assignableUsers,
  onClose,
  onCreated,
}: {
  record: SerializedChildProtectionRecord;
  availableProjects: { id: string; name: string; defaultSectionId: string }[];
  assignableUsers: { id: string; name: string; email: string }[];
  onClose: () => void;
  onCreated: (taskTitle: string) => void;
}) {
  const [projectId, setProjectId] = useState(availableProjects[0]?.id ?? '');
  const [assigneeId, setAssigneeId] = useState(assignableUsers[0]?.id ?? '');
  const [dueDate, setDueDate] = useState(() => {
    // Default to 1 week from now
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [customNote, setCustomNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProject = availableProjects.find((p) => p.id === projectId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) {
      setError('Please select an active project to place the review task.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const res = await createRenewalReviewTask({
      recordId: record.id,
      projectId: selectedProject.id,
      sectionId: selectedProject.defaultSectionId,
      assigneeId: assigneeId || null,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      customNote: customNote.trim() || null,
    });

    setIsSubmitting(false);

    if (res.success && res.data) {
      onCreated(res.data.title);
    } else {
      setError(res.error || 'Failed to create review task.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 my-8">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Assign Compliance Review Task
            </h2>
            <p className="text-xs text-slate-500">For {record.name}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">Project</label>
            <select
              autoFocus
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {availableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Assign Review To Staff Member
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Unassigned</option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Additional Instructions / Context
            </label>
            <textarea
              rows={3}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="e.g. Please send the renewal link to this volunteer and follow up next Sunday..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating Task...' : 'Create Review Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import from CSV / Google Sheets Modal
// ---------------------------------------------------------------------------

function ImportCsvModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (count: number, created: number, updated: number) => void;
}) {
  const [csvText, setCsvText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) {
      setError('Please paste spreadsheet or CSV data.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setWarnings([]);

    try {
      // Parsing (delimiter detection, quoted-field handling, date normalization, and
      // dedup-by-match against the existing roster) all happen server-side in
      // importChildProtectionRecords — see src/lib/childProtection.ts.
      const res = await importChildProtectionRecords(csvText);
      if (res.warnings?.length) setWarnings(res.warnings);
      if (res.success) {
        onImported(res.count, res.created, res.updated);
      } else {
        setError(res.error || 'Failed to import records.');
      }
    } catch (err: any) {
      setError(err.message || 'Error processing spreadsheet data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 my-8">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Import from Google Sheets / CSV
            </h2>
            <p className="text-xs text-slate-500">
              Paste rows directly from your Google Sheet or CSV export.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleImport} className="mt-4 space-y-4 text-sm">
          <div className="flex flex-col gap-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 border border-slate-200 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">Expected Column Order:</p>
              <code>Name &nbsp;|&nbsp; Email &nbsp;|&nbsp; Ministries (separated by ;) &nbsp;|&nbsp; DocuSign (Yes/No) &nbsp;|&nbsp; MinistrySafe Date &nbsp;|&nbsp; Background Check Date</code>
            </div>
            <CsvTemplateButton template="child_protection" label="Download Template (.csv)" />
          </div>

          <div>
            <textarea
              rows={8}
              required
              autoFocus
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`John Doe\tjohndoe@example.com\tKids Ministry; Nursery\tYes\t2024-05-15\t2023-11-20\nJane Smith\tjanesmith@example.com\tYouth\tNo\t2025-01-10\t`}
              className="w-full font-mono text-xs rounded-lg border border-slate-300 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {warnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <p className="font-semibold mb-1">Imported with warnings:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Importing...' : 'Start Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
