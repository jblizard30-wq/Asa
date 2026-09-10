'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { OnboardingRole, OnboardingItemCategory, OnboardingCostCadence, Role } from '@prisma/client';
import { createOnboardingCase } from '@/lib/actions/onboarding';
import { formatMoney } from '@/lib/onboardingBudget';
import {
  BanknotesIcon,
  ClipboardDocumentIcon,
  ComputerDesktopIcon,
  KeyIcon,
  CloudIcon,
  UserPlusIcon,
} from './OnboardingIcons';

interface BlueprintItemPreview {
  id: string;
  category: OnboardingItemCategory;
  title: string;
  description: string | null;
  docTemplateUrl: string | null;
  estimatedCost: number | null;
  costCadence: OnboardingCostCadence | null;
}

interface BlueprintPreview {
  id: string;
  role: OnboardingRole;
  description: string | null;
  items: BlueprintItemPreview[];
}

export interface StaffUserOption {
  id: string;
  name: string;
  email: string;
  role: Role;
}

const ROLES: Array<{ role: OnboardingRole; label: string; desc: string }> = [
  { role: 'PASTORAL_STAFF', label: 'Pastoral Staff', desc: 'Preaching, pastoral care, leadership' },
  { role: 'CHILDRENS_YOUTH', label: 'Children & Youth', desc: 'Nursery, elementary, student ministry' },
  { role: 'WORSHIP_MUSIC', label: 'Worship & Music', desc: 'Worship leaders, AV directors, musicians' },
  { role: 'ADMIN_OFFICE', label: 'Admin & Office', desc: 'Executive assistants, operations, finance' },
  { role: 'FACILITIES', label: 'Facilities & Ops', desc: 'Maintenance, grounds, building managers' },
  { role: 'IT_MEDIA', label: 'IT & Media Production', desc: 'Systems, live streaming, web/tech' },
  { role: 'VOLUNTEER', label: 'Key Volunteer Leader', desc: 'Deacons, committee chairs, team leads' },
  { role: 'OTHER', label: 'General / Other Staff', desc: 'Custom ministry positions' },
];

const CATEGORY_META: Record<
  OnboardingItemCategory,
  { label: string; placeholder: string; defaultRoleHint: string }
> = {
  PAPERWORK: {
    label: 'Paperwork & Compliance',
    placeholder: 'Assign to Support Ministry / HR...',
    defaultRoleHint: 'HR / Operations',
  },
  HARDWARE: {
    label: 'Hardware & Equipment',
    placeholder: 'Assign to IT / Gear Lead...',
    defaultRoleHint: 'IT Director',
  },
  SOFTWARE_LICENSE: {
    label: 'Software & Cloud Licenses',
    placeholder: 'Assign to IT / Cloud Admin...',
    defaultRoleHint: 'IT Director',
  },
  FACILITY_ACCESS: {
    label: 'Facility & Physical Access',
    placeholder: 'Assign to Facilities / Security...',
    defaultRoleHint: 'Facilities Manager',
  },
};

export function NewOnboardingWizardClient({
  blueprints,
  staffUsers = [],
}: {
  blueprints: BlueprintPreview[];
  staffUsers?: StaffUserOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [personName, setPersonName] = useState('');
  const [personEmail, setPersonEmail] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<OnboardingRole[]>(['PASTORAL_STAFF']);
  const [startDate, setStartDate] = useState('');
  const [categoryAssignees, setCategoryAssignees] = useState<
    Partial<Record<OnboardingItemCategory, string>>
  >({});

  // Toggle multi-select role
  function toggleRole(role: OnboardingRole) {
    setSelectedRoles((prev) => {
      if (prev.includes(role)) {
        if (prev.length <= 1) return prev; // Keep at least one
        return prev.filter((r) => r !== role);
      } else {
        return [...prev, role];
      }
    });
  }

  // Aggregate and deduplicate items across selected blueprints
  const mergedItems = useMemo(() => {
    const seenKeys = new Set<string>();
    const result: Array<BlueprintItemPreview & { sourceRole: OnboardingRole }> = [];

    for (const role of selectedRoles) {
      const bp = blueprints.find((b) => b.role === role);
      if (!bp) continue;
      for (const item of bp.items) {
        const key = `${item.category}:${item.title.trim().toLowerCase()}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        result.push({ ...item, sourceRole: role });
      }
    }
    return result;
  }, [blueprints, selectedRoles]);

  // Live budget math over merged items
  const { capexTotal, monthlyOpexTotal, annualOpexTotal, firstYearTotal } = useMemo(() => {
    let capex = 0;
    let monthly = 0;
    for (const item of mergedItems) {
      const cost = item.estimatedCost || 0;
      if (cost <= 0) continue;
      if (item.costCadence === 'MONTHLY') {
        monthly += cost;
      } else {
        capex += cost;
      }
    }
    const annual = monthly * 12;
    return {
      capexTotal: capex,
      monthlyOpexTotal: monthly,
      annualOpexTotal: annual,
      firstYearTotal: capex + annual,
    };
  }, [mergedItems]);

  function handleAssigneeChange(category: OnboardingItemCategory, userId: string) {
    setCategoryAssignees((prev) => ({
      ...prev,
      [category]: userId || undefined,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!personName.trim()) {
      setError('Candidate or staff name is required.');
      return;
    }
    if (selectedRoles.length === 0) {
      setError('At least one role blueprint must be selected.');
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await createOnboardingCase({
        personName: personName.trim(),
        personEmail: personEmail.trim() || undefined,
        roles: selectedRoles,
        startDate: startDate || undefined,
        categoryAssignees,
      });

      if (!res.success) {
        setError(res.error);
        return;
      }

      router.push(`/admin/onboarding/${res.data.caseId}`);
    });
  }

  const categoryIcons: Record<OnboardingItemCategory, React.ReactNode> = {
    PAPERWORK: <ClipboardDocumentIcon className="h-4 w-4 text-blue-500" />,
    HARDWARE: <ComputerDesktopIcon className="h-4 w-4 text-emerald-500" />,
    SOFTWARE_LICENSE: <CloudIcon className="h-4 w-4 text-indigo-500" />,
    FACILITY_ACCESS: <KeyIcon className="h-4 w-4 text-amber-500" />,
  };

  return (
    <div className="space-y-8">
      {/* Breadcrumb / Nav */}
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Link href="/admin/onboarding" className="hover:text-slate-900 dark:hover:text-white">
          Onboarding
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium dark:text-white">New Onboarding Case</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Launch New Onboarding Case
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Combine multiple role blueprints (e.g. Pastoral Staff + Children &amp; Youth) to snapshot unified deliverables, assign workflow owners, and forecast Year-1 costs.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left 2 Cols: Form & Preview */}
        <div className="space-y-6 lg:col-span-2">
          {/* Section 1: Candidate Info */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">1. Candidate Information</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pastor David Miller"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. david@church.org"
                  value={personEmail}
                  onChange={(e) => setPersonEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full sm:w-1/2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Choose Roles (Multi-Select) */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  2. Select Role Blueprint(s)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select all that apply. Blueprints merge together and deduplicate shared checklist items.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
                {selectedRoles.length} Selected
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ROLES.map(({ role, label, desc }) => {
                const isSelected = selectedRoles.includes(role);
                const hasBlueprint = blueprints.some((b) => b.role === role);

                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`flex flex-col text-left rounded-xl p-4 border transition-all ${
                      isSelected
                        ? 'border-brand-600 bg-brand-50/70 shadow-sm dark:border-brand-500 dark:bg-brand-950/50 ring-2 ring-brand-500/20'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-4 w-4 rounded flex items-center justify-center border text-[10px] font-bold ${
                            isSelected
                              ? 'bg-brand-600 border-brand-600 text-white'
                              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                          }`}
                        >
                          {isSelected ? '✓' : ''}
                        </div>
                        <span className="font-semibold text-sm text-slate-900 dark:text-white">{label}</span>
                      </div>
                      {hasBlueprint ? (
                        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Ready</span>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400">Empty</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 pl-6">{desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Workflow Delegation Defaults (Assign by Category) */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlusIcon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                3. Workflow Delegation Defaults
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Automatically route tasks in each category to the right ministry lead or director upon launch.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(['PAPERWORK', 'HARDWARE', 'SOFTWARE_LICENSE', 'FACILITY_ACCESS'] as OnboardingItemCategory[]).map(
                (category) => {
                  const meta = CATEGORY_META[category];
                  const currentAssignee = categoryAssignees[category] || '';

                  return (
                    <div key={category} className="space-y-1.5 rounded-lg border border-slate-200 p-3.5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                      <div className="flex items-center gap-2">
                        {categoryIcons[category]}
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {meta.label}
                        </label>
                      </div>
                      <select
                        value={currentAssignee}
                        onChange={(e) => handleAssigneeChange(category, e.target.value)}
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="">— Unassigned (Assign Later) —</option>
                        {staffUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} ({user.role})
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        Typical owner: {meta.defaultRoleHint}
                      </p>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* Section 4: Merged Items Snapshot Preview */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  4. Merged Deliverables Snapshot ({mergedItems.length} items)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Aggregated from {selectedRoles.length} selected blueprint{selectedRoles.length > 1 ? 's' : ''} (duplicates removed).
                </p>
              </div>
              <Link
                href="/admin/onboarding/templates"
                className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400 shrink-0"
              >
                Customize Templates &rarr;
              </Link>
            </div>

            {mergedItems.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4 italic">
                No default items are defined for the selected roles yet. You can add custom items directly to the case after launching.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[420px] overflow-y-auto pr-2">
                {mergedItems.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="py-3 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{categoryIcons[item.category]}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{item.title}</p>
                          <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            {item.sourceRole.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs font-medium text-slate-700 dark:text-slate-300 shrink-0">
                      {item.estimatedCost ? (
                        <span>
                          {formatMoney(item.estimatedCost)}
                          {item.costCadence === 'MONTHLY' ? '/mo' : ''}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Live Sticky Budget Estimator Card */}
        <div className="space-y-6">
          <div className="sticky top-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
              <BanknotesIcon className="h-5 w-5 text-emerald-500" />
              <h2 className="text-base font-bold">Budget Estimator</h2>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live combined cost projection based on {mergedItems.length} deliverables across {selectedRoles.length} role blueprint{selectedRoles.length > 1 ? 's' : ''}.
            </p>

            <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              <div className="pt-2 flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400">One-Time Capex</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatMoney(capexTotal)}</span>
              </div>

              <div className="pt-3 flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400">Monthly Software Opex</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatMoney(monthlyOpexTotal)}/mo</span>
              </div>

              <div className="pt-3 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                <span>Annualized Software</span>
                <span>{formatMoney(annualOpexTotal)}/yr</span>
              </div>

              <div className="pt-4 border-t-2 border-slate-900 dark:border-slate-100 flex justify-between items-center">
                <div>
                  <span className="block font-bold text-slate-900 dark:text-white">Year-1 Total</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Capex + 12 Mo Opex</span>
                </div>
                <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {formatMoney(firstYearTotal)}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-500 disabled:opacity-50 transition-colors dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              {isPending ? 'Snapshotting & Launching...' : 'Launch Onboarding Case'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

