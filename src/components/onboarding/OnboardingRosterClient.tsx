'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { OnboardingRole, OnboardingStatus } from '@prisma/client';
import { formatMoney } from '@/lib/onboardingBudget';
import {
  BanknotesIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  UserPlusIcon,
} from './OnboardingIcons';

export interface SerializedOnboardingCase {
  id: string;
  personName: string;
  personEmail: string | null;
  role: OnboardingRole;
  roles?: OnboardingRole[];
  startDate: string | null;
  status: OnboardingStatus;
  templateSnapshotAt: string | null;
  totalItems: number;
  completedItems: number;
  isComplete: boolean;
  createdUser: { id: string; name: string; email: string } | null;
  createdAt: string;
  capexTotal: number;
  monthlyOpexTotal: number;
  formattedCapex: string;
  formattedMonthlyOpex: string;
  formattedFirstYearTotal: string;
}

const ROLE_LABELS: Record<OnboardingRole, string> = {
  PASTORAL_STAFF: 'Pastoral Staff',
  ADMIN_OFFICE: 'Admin & Office',
  FACILITIES: 'Facilities',
  IT_MEDIA: 'IT & Media',
  WORSHIP_MUSIC: 'Worship & Music',
  CHILDRENS_YOUTH: 'Children & Youth',
  VOLUNTEER: 'Key Volunteer',
  OTHER: 'Other',
};

const STATUS_CONFIG: Record<OnboardingStatus, { label: string; badgeClass: string }> = {
  DRAFT: {
    label: 'Draft',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800',
  },
  READY_FOR_DAY_ONE: {
    label: 'Ready For Day 1',
    badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800',
  },
  COMPLETED: {
    label: 'Completed',
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
  },
  CANCELLED: {
    label: 'Cancelled',
    badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800',
  },
};

export function OnboardingRosterClient({
  cases,
}: {
  cases: SerializedOnboardingCase[];
}) {
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (roleFilter !== 'ALL') {
        const hasRole =
          c.roles && c.roles.length > 0
            ? c.roles.includes(roleFilter as OnboardingRole)
            : c.role === roleFilter;
        if (!hasRole) return false;
      }
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = c.personName.toLowerCase().includes(query);
        const matchEmail = c.personEmail?.toLowerCase().includes(query);
        if (!matchName && !matchEmail) return false;
      }
      return true;
    });
  }, [cases, roleFilter, statusFilter, searchQuery]);

  const metrics = useMemo(() => {
    let totalCapex = 0;
    let totalMonthlyOpex = 0;
    let activeCount = 0;
    let readyCount = 0;

    for (const c of cases) {
      if (c.status !== 'CANCELLED') {
        totalCapex += c.capexTotal;
        totalMonthlyOpex += c.monthlyOpexTotal;
      }
      if (c.status === 'IN_PROGRESS' || c.status === 'DRAFT') {
        activeCount++;
      }
      if (c.status === 'READY_FOR_DAY_ONE') {
        readyCount++;
      }
    }

    return {
      activeCount,
      readyCount,
      totalCapex,
      totalMonthlyOpex,
    };
  }, [cases]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Staff & Volunteer Onboarding
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Role-based provisioning, paperwork compliance, IT equipment, and live Capex / Opex budget tracking.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/onboarding/templates"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ClipboardDocumentIcon className="h-4 w-4" />
            Role Blueprints
          </Link>
          <Link
            href="/admin/onboarding/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-500 transition-colors dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            <UserPlusIcon className="h-4 w-4" />
            New Onboarding Case
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
            <ClipboardDocumentIcon className="h-5 w-5 text-blue-500" />
            <span className="text-xs font-semibold uppercase tracking-wider">Active In-Flight</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{metrics.activeCount}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">In Draft or In Progress</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
            <CheckCircleIcon className="h-5 w-5 text-amber-500" />
            <span className="text-xs font-semibold uppercase tracking-wider">Day 1 Ready</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{metrics.readyCount}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Awaiting candidate start date</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
            <BanknotesIcon className="h-5 w-5 text-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-wider">Hardware / Setup Capex</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{formatMoney(metrics.totalCapex)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">One-time gear & furniture costs</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
            <BanknotesIcon className="h-5 w-5 text-brand-500" />
            <span className="text-xs font-semibold uppercase tracking-wider">Monthly License Opex</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{formatMoney(metrics.totalMonthlyOpex)}/mo</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{formatMoney(metrics.totalMonthlyOpex * 12)}/yr annualized run-rate</p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 items-center gap-3">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
          />

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Roles</option>
            {Object.entries(ROLE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400">
          Showing {filteredCases.length} of {cases.length} records
        </div>
      </div>

      {/* Roster Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {filteredCases.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <ClipboardDocumentIcon className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">No onboarding cases found</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Get started by launching an onboarding case from a blueprint template.
            </p>
            <Link
              href="/admin/onboarding/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-500"
            >
              <UserPlusIcon className="h-4 w-4" />
              Launch First Case
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Candidate / Staff</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Checklist Progress</th>
                  <th className="px-4 py-3">Capex (One-Time)</th>
                  <th className="px-4 py-3">Opex (Monthly)</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredCases.map((c) => {
                  const statusInfo = STATUS_CONFIG[c.status];
                  const progressPct =
                    c.totalItems > 0 ? Math.round((c.completedItems / c.totalItems) * 100) : 0;

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/80 transition-colors dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          <Link href={`/admin/onboarding/${c.id}`} className="hover:underline">
                            {c.personName}
                          </Link>
                        </div>
                        {c.personEmail && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">{c.personEmail}</div>
                        )}
                        {c.createdUser && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                            ✓ Staff Account Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {(c.roles && c.roles.length > 0 ? c.roles : [c.role]).map((r) => (
                            <span
                              key={r}
                              className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            >
                              {ROLE_LABELS[r] || r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusInfo.badgeClass}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="w-36">
                          <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                            <span>{c.completedItems} of {c.totalItems} done</span>
                            <span className="font-medium">{progressPct}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                              className={`h-full transition-all duration-300 ${
                                progressPct === 100
                                  ? 'bg-emerald-500'
                                  : progressPct > 50
                                  ? 'bg-blue-500'
                                  : 'bg-brand-500'
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-900 dark:text-white">
                        {c.formattedCapex}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                        {c.formattedMonthlyOpex}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                        {c.startDate ? new Date(c.startDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/admin/onboarding/${c.id}`}
                          className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          Open &rarr;
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

