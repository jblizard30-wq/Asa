'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  OnboardingRole,
  OnboardingItemCategory,
  OnboardingCostCadence,
  OnboardingProvisioningType,
} from '@prisma/client';
import { saveOnboardingBlueprint } from '@/lib/actions/onboarding';
import { formatMoney } from '@/lib/onboardingBudget';
import {
  ClipboardDocumentIcon,
  ComputerDesktopIcon,
  CloudIcon,
  KeyIcon,
} from './OnboardingIcons';

export interface SerializedBlueprintItem {
  id: string;
  category: OnboardingItemCategory;
  title: string;
  description: string | null;
  docTemplateUrl: string | null;
  estimatedCost: number | null;
  costCadence: OnboardingCostCadence | null;
  provisioningType: OnboardingProvisioningType;
  sortOrder: number;
}

export interface SerializedBlueprint {
  id: string;
  role: OnboardingRole;
  description: string | null;
  items: SerializedBlueprintItem[];
}

const ROLES: Array<{ role: OnboardingRole; label: string; desc: string }> = [
  { role: 'PASTORAL_STAFF', label: 'Pastoral Staff', desc: 'Preaching, pastoral care, executive leadership' },
  { role: 'WORSHIP_MUSIC', label: 'Worship & Music', desc: 'Worship pastors, audio/video directors, musicians' },
  { role: 'ADMIN_OFFICE', label: 'Admin & Office', desc: 'Executive assistants, operations, finance staff' },
  { role: 'CHILDRENS_YOUTH', label: 'Children & Youth', desc: 'Nursery, elementary, and student ministry coordinators' },
  { role: 'FACILITIES', label: 'Facilities & Ops', desc: 'Building maintenance, groundskeeping, security' },
  { role: 'IT_MEDIA', label: 'IT & Media Production', desc: 'Systems administration, streaming audio/video, web' },
  { role: 'VOLUNTEER', label: 'Key Volunteer Leader', desc: 'Deacons, committee chairs, lay coordinators' },
  { role: 'OTHER', label: 'General Staff', desc: 'Custom ministry positions' },
];

const STARTER_DEFAULTS: Record<OnboardingRole, Array<{ category: OnboardingItemCategory; title: string; cost: number | null; cadence: OnboardingCostCadence | null; url?: string }>> = {
  PASTORAL_STAFF: [
    { category: 'PAPERWORK', title: 'Federal W-4 & State Withholding Form', cost: null, cadence: null, url: 'https://docs.google.com/document/d/copy' },
    { category: 'PAPERWORK', title: 'I-9 Employment Eligibility Verification', cost: null, cadence: null, url: 'https://docs.google.com/document/d/copy' },
    { category: 'PAPERWORK', title: 'Direct Deposit Authorization', cost: null, cadence: null },
    { category: 'PAPERWORK', title: 'Ministerial Housing Allowance Agreement', cost: null, cadence: null },
    { category: 'HARDWARE', title: 'MacBook Pro 16-inch', cost: 2499, cadence: 'ONE_TIME' },
    { category: 'HARDWARE', title: 'Office Desk & Ergonomic Chair', cost: 750, cadence: 'ONE_TIME' },
    { category: 'HARDWARE', title: 'External 4K Monitor & USB-C Dock', cost: 450, cadence: 'ONE_TIME' },
    { category: 'SOFTWARE_LICENSE', title: 'Google Workspace Business Standard', cost: 12, cadence: 'MONTHLY' },
    { category: 'SOFTWARE_LICENSE', title: 'Planning Center Staff Seat', cost: 15, cadence: 'MONTHLY' },
    { category: 'SOFTWARE_LICENSE', title: 'Slack Team Pro Seat', cost: 9, cadence: 'MONTHLY' },
    { category: 'FACILITY_ACCESS', title: 'Master Building Physical Key & Alarm Code', cost: 25, cadence: 'ONE_TIME' },
  ],
  WORSHIP_MUSIC: [
    { category: 'PAPERWORK', title: 'W-4 & I-9 Verification Packet', cost: null, cadence: null },
    { category: 'HARDWARE', title: 'MacBook Pro 16-inch (High Performance Audio/Visual)', cost: 2799, cadence: 'ONE_TIME' },
    { category: 'SOFTWARE_LICENSE', title: 'ProPresenter Single Seat', cost: 395, cadence: 'ONE_TIME' },
    { category: 'SOFTWARE_LICENSE', title: 'Ableton Live Suite License', cost: 749, cadence: 'ONE_TIME' },
    { category: 'SOFTWARE_LICENSE', title: 'Google Workspace Business Standard', cost: 12, cadence: 'MONTHLY' },
    { category: 'SOFTWARE_LICENSE', title: 'Planning Center Services Co-Leader', cost: 15, cadence: 'MONTHLY' },
    { category: 'FACILITY_ACCESS', title: 'Sanctuary & AV Booth Keycard', cost: 20, cadence: 'ONE_TIME' },
  ],
  ADMIN_OFFICE: [
    { category: 'PAPERWORK', title: 'W-4, I-9, & Direct Deposit Packet', cost: null, cadence: null },
    { category: 'PAPERWORK', title: 'Employee Handbook & Safety Sign-off', cost: null, cadence: null },
    { category: 'HARDWARE', title: 'MacBook Air 15-inch', cost: 1299, cadence: 'ONE_TIME' },
    { category: 'HARDWARE', title: 'Dual 27-inch Office Monitors & Dock', cost: 550, cadence: 'ONE_TIME' },
    { category: 'SOFTWARE_LICENSE', title: 'Google Workspace Business Standard', cost: 12, cadence: 'MONTHLY' },
    { category: 'SOFTWARE_LICENSE', title: 'QuickBooks Online / Financial Seat', cost: 50, cadence: 'MONTHLY' },
    { category: 'FACILITY_ACCESS', title: 'Main Office Master Key', cost: 15, cadence: 'ONE_TIME' },
  ],
  CHILDRENS_YOUTH: [
    { category: 'PAPERWORK', title: 'MinistrySafe Background Check & Abuse Prevention', cost: 35, cadence: 'ONE_TIME' },
    { category: 'PAPERWORK', title: 'W-4 & Direct Deposit Authorization', cost: null, cadence: null },
    { category: 'HARDWARE', title: 'iPad Pro 11-inch & Rugged Check-In Case', cost: 899, cadence: 'ONE_TIME' },
    { category: 'SOFTWARE_LICENSE', title: 'Planning Center Check-Ins Admin', cost: 15, cadence: 'MONTHLY' },
    { category: 'FACILITY_ACCESS', title: 'Children Wing Secure Door FOB', cost: 25, cadence: 'ONE_TIME' },
  ],
  FACILITIES: [
    { category: 'PAPERWORK', title: 'W-4 & Safety Policy Acknowledgment', cost: null, cadence: null },
    { category: 'HARDWARE', title: 'Heavy-Duty Work Mobile Device / Radio', cost: 400, cadence: 'ONE_TIME' },
    { category: 'FACILITY_ACCESS', title: 'Facilities Master Key Ring & Alarm Override', cost: 50, cadence: 'ONE_TIME' },
  ],
  IT_MEDIA: [
    { category: 'PAPERWORK', title: 'W-4, I-9, & Security NDA', cost: null, cadence: null },
    { category: 'HARDWARE', title: 'Mac Studio M2 Max & Dual 4K Displays', cost: 2800, cadence: 'ONE_TIME' },
    { category: 'SOFTWARE_LICENSE', title: 'Adobe Creative Cloud All Apps', cost: 55, cadence: 'MONTHLY' },
    { category: 'SOFTWARE_LICENSE', title: 'Google Workspace Admin Seat', cost: 18, cadence: 'MONTHLY' },
    { category: 'FACILITY_ACCESS', title: 'Server Room & Broadcast Booth Keycard', cost: 25, cadence: 'ONE_TIME' },
  ],
  VOLUNTEER: [
    { category: 'PAPERWORK', title: 'Volunteer Ministry Covenant & Safety Policy', cost: null, cadence: null },
    { category: 'PAPERWORK', title: 'Ministry Safe Volunteer Background Check', cost: 18, cadence: 'ONE_TIME' },
    { category: 'FACILITY_ACCESS', title: 'Sunday Volunteer Team Lanyard & Door Badge', cost: 10, cadence: 'ONE_TIME' },
  ],
  OTHER: [
    { category: 'PAPERWORK', title: 'Standard Onboarding Packet (W-4 / I-9)', cost: null, cadence: null },
    { category: 'SOFTWARE_LICENSE', title: 'Google Workspace Email Seat', cost: 12, cadence: 'MONTHLY' },
  ],
};

export function OnboardingBlueprintsClient({
  blueprints,
}: {
  blueprints: SerializedBlueprint[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedRole, setSelectedRole] = useState<OnboardingRole>('PASTORAL_STAFF');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Local state for the selected blueprint
  const existingBp = blueprints.find((b) => b.role === selectedRole);
  const [description, setDescription] = useState(existingBp?.description || '');
  const [items, setItems] = useState<
    Array<{
      id?: string;
      category: OnboardingItemCategory;
      title: string;
      description: string;
      docTemplateUrl: string;
      estimatedCost: number | null;
      costCadence: OnboardingCostCadence | null;
      sortOrder: number;
    }>
  >(
    existingBp?.items.map((i, idx) => ({
      id: i.id,
      category: i.category,
      title: i.title,
      description: i.description || '',
      docTemplateUrl: i.docTemplateUrl || '',
      estimatedCost: i.estimatedCost,
      costCadence: i.costCadence,
      sortOrder: i.sortOrder ?? idx,
    })) || []
  );

  // Switch role tab
  function handleSelectRole(role: OnboardingRole) {
    setSelectedRole(role);
    setStatusMessage(null);
    setError(null);
    const bp = blueprints.find((b) => b.role === role);
    setDescription(bp?.description || '');
    setItems(
      bp?.items.map((i, idx) => ({
        id: i.id,
        category: i.category,
        title: i.title,
        description: i.description || '',
        docTemplateUrl: i.docTemplateUrl || '',
        estimatedCost: i.estimatedCost,
        costCadence: i.costCadence,
        sortOrder: i.sortOrder ?? idx,
      })) || []
    );
  }

  // Load starter templates
  function handleLoadDefaults() {
    const defaults = STARTER_DEFAULTS[selectedRole] || [];
    setItems(
      defaults.map((d, idx) => ({
        category: d.category,
        title: d.title,
        description: '',
        docTemplateUrl: d.url || '',
        estimatedCost: d.cost,
        costCadence: d.cadence,
        sortOrder: idx,
      }))
    );
  }

  // Add Item row
  function handleAddItem() {
    setItems((prev) => [
      ...prev,
      {
        category: 'PAPERWORK',
        title: 'New Checklist Deliverable',
        description: '',
        docTemplateUrl: '',
        estimatedCost: null,
        costCadence: 'ONE_TIME',
        sortOrder: prev.length,
      },
    ]);
  }

  // Delete Item row
  function handleDeleteRow(index: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  // Save Blueprint
  function handleSave() {
    setError(null);
    setStatusMessage(null);

    startTransition(async () => {
      const res = await saveOnboardingBlueprint({
        role: selectedRole,
        description: description.trim() || null,
        items: items.map((i, idx) => ({
          category: i.category,
          title: i.title.trim(),
          description: i.description.trim() || null,
          docTemplateUrl: i.docTemplateUrl.trim() || null,
          estimatedCost: i.estimatedCost,
          costCadence: i.costCadence,
          sortOrder: idx,
        })),
      });

      if (!res.success) {
        setError(res.error);
        return;
      }

      setStatusMessage('Blueprint saved successfully.');
      router.refresh();
    });
  }

  // Live Budget Summary for this blueprint
  let capex = 0;
  let opex = 0;
  for (const item of items) {
    const cost = item.estimatedCost || 0;
    if (cost <= 0) continue;
    if (item.costCadence === 'MONTHLY') opex += cost;
    else capex += cost;
  }

  const categoryIcons: Record<OnboardingItemCategory, React.ReactNode> = {
    PAPERWORK: <ClipboardDocumentIcon className="h-4 w-4 text-blue-500" />,
    HARDWARE: <ComputerDesktopIcon className="h-4 w-4 text-emerald-500" />,
    SOFTWARE_LICENSE: <CloudIcon className="h-4 w-4 text-indigo-500" />,
    FACILITY_ACCESS: <KeyIcon className="h-4 w-4 text-amber-500" />,
  };

  return (
    <div className="space-y-8">
      {/* Top Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Link href="/admin/onboarding" className="hover:text-slate-900 dark:hover:text-white">
          Onboarding
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium dark:text-white">Role Blueprints</span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Role Onboarding Blueprints
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Define standard equipment packages, paperwork templates, software seats, and budget estimates per role.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-500 disabled:opacity-50"
          >
            {isPending ? 'Saving Blueprint...' : 'Save Blueprint'}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          {statusMessage}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        {/* Left Col: Role Navigation Tabs */}
        <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Ministry Roles
          </div>
          {ROLES.map(({ role, label }) => {
            const isSelected = selectedRole === role;
            const bp = blueprints.find((b) => b.role === role);
            const count = bp?.items.length || 0;

            return (
              <button
                key={role}
                type="button"
                onClick={() => handleSelectRole(role)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-brand-50 text-brand-700 font-semibold dark:bg-brand-950/50 dark:text-brand-300'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <span>{label}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right 3 Cols: Active Blueprint Editor */}
        <div className="space-y-6 lg:col-span-3">
          {/* Header Card for this Blueprint */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {ROLES.find((r) => r.role === selectedRole)?.label} Blueprint
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {ROLES.find((r) => r.role === selectedRole)?.desc}
                </p>
              </div>

              {items.length === 0 && (
                <button
                  type="button"
                  onClick={handleLoadDefaults}
                  className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950/60 dark:text-brand-300"
                >
                  Load Recommended Defaults
                </button>
              )}
            </div>

            {/* Live Financial Totals Banner */}
            <div className="grid grid-cols-1 gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-3 dark:bg-slate-800/60">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total Blueprint Capex
                </span>
                <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{formatMoney(capex)}</p>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Monthly Software Opex
                </span>
                <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{formatMoney(opex)}/mo</p>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  First-Year Total
                </span>
                <p className="mt-1 text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                  {formatMoney(capex + opex * 12)}
                </p>
              </div>
            </div>
          </div>

          {/* Items Editor */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/50">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Checklist Deliverables ({items.length})
              </h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-500"
              >
                + Add Deliverable
              </button>
            </div>

            {items.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No items defined for this blueprint yet. Click &quot;Load Recommended Defaults&quot; or &quot;+ Add Deliverable&quot; to begin.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 p-4 space-y-4">
                {items.map((item, idx) => (
                  <div key={idx} className="pt-4 first:pt-0 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 items-center">
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Category
                        </label>
                        <select
                          value={item.category}
                          onChange={(e) => {
                            const val = e.target.value as OnboardingItemCategory;
                            setItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, category: val } : it))
                            );
                          }}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                          <option value="PAPERWORK">Paperwork</option>
                          <option value="HARDWARE">Hardware / Desk</option>
                          <option value="SOFTWARE_LICENSE">Software License</option>
                          <option value="FACILITY_ACCESS">Facility Access</option>
                        </select>
                      </div>

                      <div className="sm:col-span-5">
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, title: val } : it))
                            );
                          }}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Estimated Cost
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={item.estimatedCost ?? ''}
                            onChange={(e) => {
                              const val = e.target.value ? parseFloat(e.target.value) : null;
                              setItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, estimatedCost: val } : it))
                              );
                            }}
                            className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                          <select
                            value={item.costCadence || 'ONE_TIME'}
                            onChange={(e) => {
                              const val = e.target.value as OnboardingCostCadence;
                              setItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, costCadence: val } : it))
                              );
                            }}
                            className="rounded-lg border border-slate-300 bg-white px-1.5 py-1.5 text-[11px] text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          >
                            <option value="ONE_TIME">One-Time</option>
                            <option value="MONTHLY">Monthly</option>
                          </select>
                        </div>
                      </div>

                      <div className="sm:col-span-1 flex justify-end pt-5">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(idx)}
                          className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                          title="Delete row"
                        >
                          &times;
                        </button>
                      </div>
                    </div>

                    {/* Template URL link */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                      <div className="sm:col-span-11">
                        <input
                          type="url"
                          placeholder="Optional: Google Doc / Form force-copy URL (e.g. https://docs.google.com/.../copy)"
                          value={item.docTemplateUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, docTemplateUrl: val } : it))
                            );
                          }}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

