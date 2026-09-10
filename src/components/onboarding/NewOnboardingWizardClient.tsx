'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { OnboardingRole, OnboardingItemCategory, OnboardingCostCadence } from '@prisma/client';
import { createOnboardingCase } from '@/lib/actions/onboarding';
import { formatMoney } from '@/lib/onboardingBudget';
import {
  BanknotesIcon,
  ClipboardDocumentIcon,
  ComputerDesktopIcon,
  KeyIcon,
  CloudIcon,
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

const ROLES: Array<{ role: OnboardingRole; label: string; desc: string }> = [
  { role: 'PASTORAL_STAFF', label: 'Pastoral Staff', desc: 'Preaching, pastoral care, leadership' },
  { role: 'WORSHIP_MUSIC', label: 'Worship & Music', desc: 'Worship pastors, audio/visual directors, musicians' },
  { role: 'ADMIN_OFFICE', label: 'Admin & Office', desc: 'Executive assistants, operations, bookkeepers' },
  { role: 'CHILDRENS_YOUTH', label: 'Children & Youth', desc: 'Nursery, elementary, student ministry directors' },
  { role: 'FACILITIES', label: 'Facilities & Ops', desc: 'Maintenance, grounds, building managers' },
  { role: 'IT_MEDIA', label: 'IT & Media Production', desc: 'Systems, live streaming, web/tech' },
  { role: 'VOLUNTEER', label: 'Key Volunteer Leader', desc: 'Deacons, committee chairs, team leads' },
  { role: 'OTHER', label: 'General / Other Staff', desc: 'Custom ministry positions' },
];

export function NewOnboardingWizardClient({
  blueprints,
}: {
  blueprints: BlueprintPreview[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [personName, setPersonName] = useState('');
  const [personEmail, setPersonEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<OnboardingRole>('PASTORAL_STAFF');
  const [startDate, setStartDate] = useState('');

  // Find active blueprint
  const activeBlueprint = blueprints.find((b) => b.role === selectedRole);

  // Live budget math
  let capexTotal = 0;
  let monthlyOpexTotal = 0;

  if (activeBlueprint?.items) {
    for (const item of activeBlueprint.items) {
      const cost = item.estimatedCost || 0;
      if (cost <= 0) continue;
      if (item.costCadence === 'MONTHLY') {
        monthlyOpexTotal += cost;
      } else {
        capexTotal += cost;
      }
    }
  }

  const annualOpexTotal = monthlyOpexTotal * 12;
  const firstYearTotal = capexTotal + annualOpexTotal;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!personName.trim()) {
      setError('Candidate or staff name is required.');
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await createOnboardingCase({
        personName: personName.trim(),
        personEmail: personEmail.trim() || undefined,
        role: selectedRole,
        startDate: startDate || undefined,
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
          Select a role blueprint to automatically snapshot checklists and calculate the Year-1 budget footprint.
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

          {/* Section 2: Choose Role */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">2. Select Role Blueprint</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ROLES.map(({ role, label, desc }) => {
                const isSelected = selectedRole === role;
                const hasBlueprint = blueprints.some((b) => b.role === role);

                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRole(role)}
                    className={`flex flex-col text-left rounded-xl p-4 border transition-all ${
                      isSelected
                        ? 'border-brand-600 bg-brand-50/50 shadow-sm dark:border-brand-500 dark:bg-brand-950/40'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-slate-900 dark:text-white">{label}</span>
                      {hasBlueprint ? (
                        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Blueprint Ready</span>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400">Empty Blueprint</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">{desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Blueprint Items Snapshot Preview */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                3. Items Included in this Blueprint ({activeBlueprint?.items.length ?? 0})
              </h2>
              <Link
                href="/admin/onboarding/templates"
                className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                Customize Template &rarr;
              </Link>
            </div>

            {!activeBlueprint || activeBlueprint.items.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4 italic">
                No default items are defined for this role yet. You will be able to add custom items directly to the case after launching.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeBlueprint.items.map((item) => (
                  <div key={item.id} className="py-3 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{categoryIcons[item.category]}</div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{item.title}</p>
                        {item.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
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
              Live cost projection for this hire based on the selected blueprint items.
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

