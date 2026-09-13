'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  OnboardingRole,
  OnboardingItemCategory,
  OnboardingCostCadence,
  OnboardingProvisioningType,
  OnboardingProcurementStatus,
  OnboardingStatus,
  Role,
} from '@prisma/client';
import {
  toggleOnboardingItemComplete,
  updateOnboardingItem,
  addOnboardingItem,
  deleteOnboardingItem,
  updateOnboardingCaseStatus,
  completeOnboardingAndCreateUser,
  deleteOnboardingCase,
  assignOnboardingItem,
  batchAssignOnboardingCategory,
} from '@/lib/actions/onboarding';
import { formatMoney } from '@/lib/onboardingBudget';
import {
  ArrowTopRightOnSquareIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  CloudIcon,
  ComputerDesktopIcon,
  KeyIcon,
  FunnelIcon,
  UserGroupIcon,
  UserPlusIcon,
} from './OnboardingIcons';

export interface DetailedCaseItem {
  id: string;
  caseId: string;
  category: OnboardingItemCategory;
  title: string;
  description: string | null;
  docTemplateUrl: string | null;
  cost: number | null;
  costCadence: OnboardingCostCadence | null;
  provisioningType: OnboardingProvisioningType;
  sortOrder: number;
  inventoryItemId: string | null;
  inventoryItem: { id: string; name: string; onHandQty: number; unit: string } | null;
  procurementVendor: string | null;
  procurementPoNumber: string | null;
  procurementUrl: string | null;
  procurementStatus: OnboardingProcurementStatus;
  assignedToUserId: string | null;
  assignedTo: { id: string; name: string; email: string } | null;
  completedAt: string | null;
  completedBy: { id: string; name: string } | null;
  completedLocationNote: string | null;
}

export interface DetailedOnboardingCase {
  id: string;
  personName: string;
  personEmail: string | null;
  role: OnboardingRole;
  roles?: OnboardingRole[];
  startDate: string | null;
  status: OnboardingStatus;
  templateSnapshotAt: string | null;
  createdUser: { id: string; name: string; email: string; role: Role } | null;
  createdAt: string;
  updatedAt: string;
  budget: {
    capexTotal: number;
    monthlyOpexTotal: number;
    annualOpexTotal: number;
    firstYearTotal: number;
    formattedCapex: string;
    formattedMonthlyOpex: string;
    formattedAnnualOpex: string;
    formattedFirstYearTotal: string;
  };
  items: DetailedCaseItem[];
}

const CATEGORY_CONFIG: Record<
  OnboardingItemCategory,
  { label: string; icon: (props: any) => JSX.Element; desc: string }
> = {
  PAPERWORK: {
    label: 'Paperwork & Compliance',
    icon: ClipboardDocumentIcon,
    desc: 'W-4, I-9, direct deposit, safety policies, background checks',
  },
  HARDWARE: {
    label: 'Hardware & Office Equipment',
    icon: ComputerDesktopIcon,
    desc: 'Laptops, monitors, standing desks, peripherals',
  },
  SOFTWARE_LICENSE: {
    label: 'Software & Cloud Licenses',
    icon: CloudIcon,
    desc: 'Google Workspace, Microsoft 365, Slack, Planning Center',
  },
  FACILITY_ACCESS: {
    label: 'Facility & Physical Access',
    icon: KeyIcon,
    desc: 'Building keys, alarm codes, stage/nursery badges, parking passes',
  },
};

export function OnboardingDetailClient({
  onboardingCase,
  inventoryItems = [],
  staffUsers = [],
}: {
  onboardingCase: DetailedOnboardingCase;
  inventoryItems?: Array<{ id: string; name: string; onHandQty: number; unit: string }>;
  staffUsers?: Array<{ id: string; name: string; email: string; role: Role }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Filters & State
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');

  // Modals & form state
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemCategory, setNewItemCategory] = useState<OnboardingItemCategory>('HARDWARE');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemCost, setNewItemCost] = useState('');
  const [newItemCadence, setNewItemCadence] = useState<OnboardingCostCadence>('ONE_TIME');
  const [newItemUrl, setNewItemUrl] = useState('');
  const [newItemAssignee, setNewItemAssignee] = useState<string>('');

  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [accountEmail, setAccountEmail] = useState(onboardingCase.personEmail || '');
  const [accountName, setAccountName] = useState(onboardingCase.personName || '');
  const [accountRole, setAccountRole] = useState<Role>('USER');
  const [createdAccountPassword, setCreatedAccountPassword] = useState<string | null>(null);

  const [editingItemNote, setEditingItemNote] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');

  // Item toggle handler
  function handleToggleItem(itemId: string, currentCompleted: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await toggleOnboardingItemComplete(itemId, !currentCompleted);
      if (!res.success) setError(res.error);
      else router.refresh();
    });
  }

  // Save item note
  function handleSaveNote(itemId: string) {
    startTransition(async () => {
      await updateOnboardingItem(itemId, { completedLocationNote: noteValue });
      setEditingItemNote(null);
      router.refresh();
    });
  }

  // Update procurement
  function handleProcurementChange(itemId: string, status: OnboardingProcurementStatus) {
    startTransition(async () => {
      await updateOnboardingItem(itemId, { procurementStatus: status });
      router.refresh();
    });
  }

  // Assign individual item
  function handleAssignItem(itemId: string, userId: string | null) {
    startTransition(async () => {
      const res = await assignOnboardingItem(itemId, userId);
      if (!res.success) setError(res.error);
      else router.refresh();
    });
  }

  // Batch assign whole category
  function handleBatchAssignCategory(category: OnboardingItemCategory, userId: string | null) {
    startTransition(async () => {
      const res = await batchAssignOnboardingCategory(onboardingCase.id, category, userId);
      if (!res.success) setError(res.error);
      else router.refresh();
    });
  }

  // Add Item
  function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItemTitle.trim()) return;

    startTransition(async () => {
      const res = await addOnboardingItem(onboardingCase.id, {
        category: newItemCategory,
        title: newItemTitle.trim(),
        cost: newItemCost ? parseFloat(newItemCost) : null,
        costCadence: newItemCadence,
        docTemplateUrl: newItemUrl.trim() || undefined,
        assignedToUserId: newItemAssignee || undefined,
      });

      if (!res.success) {
        setError(res.error);
        return;
      }

      setNewItemTitle('');
      setNewItemCost('');
      setNewItemUrl('');
      setNewItemAssignee('');
      setShowAddItem(false);
      router.refresh();
    });
  }

  // Delete Item
  function handleDeleteItem(itemId: string) {
    if (!confirm('Are you sure you want to remove this item from the checklist?')) return;
    startTransition(async () => {
      await deleteOnboardingItem(itemId);
      router.refresh();
    });
  }

  // Update Case Status
  function handleStatusChange(status: OnboardingStatus) {
    startTransition(async () => {
      await updateOnboardingCaseStatus(onboardingCase.id, status);
      router.refresh();
    });
  }

  // Complete & Create User Account
  function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await completeOnboardingAndCreateUser(onboardingCase.id, {
        name: accountName,
        email: accountEmail,
        role: accountRole,
      });

      if (!res.success) {
        setError(res.error);
        return;
      }

      setCreatedAccountPassword(res.data.temporaryPassword);
      router.refresh();
    });
  }

  // Dismiss the one-time temporary-password reveal after the admin has copied it
  function handleDismissCreatedAccount() {
    setCreatedAccountPassword(null);
    setShowCreateAccount(false);
  }

  // Delete Case
  function handleDeleteCase() {
    if (!confirm(`Are you sure you want to delete the onboarding record for ${onboardingCase.personName}?`)) return;
    startTransition(async () => {
      const res = await deleteOnboardingCase(onboardingCase.id);
      if (!res.success) setError(res.error);
      else router.push('/admin/onboarding');
    });
  }

  const completedCount = onboardingCase.items.filter((i) => i.completedAt !== null).length;
  const totalCount = onboardingCase.items.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Breadcrumb / Top Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/admin/onboarding" className="hover:text-slate-900 dark:hover:text-white">
            Onboarding
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-medium dark:text-white">{onboardingCase.personName}</span>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={onboardingCase.status}
            onChange={(e) => handleStatusChange(e.target.value as OnboardingStatus)}
            disabled={isPending}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="DRAFT">Status: Draft</option>
            <option value="IN_PROGRESS">Status: In Progress</option>
            <option value="READY_FOR_DAY_ONE">Status: Ready For Day 1</option>
            <option value="COMPLETED">Status: Completed</option>
            <option value="CANCELLED">Status: Cancelled</option>
          </select>

          <button
            type="button"
            onClick={handleDeleteCase}
            disabled={isPending}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm hover:bg-red-50 dark:border-red-900/50 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Delete Case
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Hero Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {onboardingCase.personName}
              </h1>
              <div className="flex flex-wrap items-center gap-1.5">
                {(onboardingCase.roles && onboardingCase.roles.length > 0
                  ? onboardingCase.roles
                  : [onboardingCase.role]
                ).map((r) => (
                  <span
                    key={r}
                    className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950/80 dark:text-brand-300"
                  >
                    {r.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {onboardingCase.personEmail || 'No email provided'} &bull; Start Date:{' '}
              {onboardingCase.startDate ? new Date(onboardingCase.startDate).toLocaleDateString() : 'Unscheduled'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {onboardingCase.createdUser ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
                ✓ Staff Account Active ({onboardingCase.createdUser.role})
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreateAccount(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
              >
                <CheckCircleIcon className="h-4 w-4" />
                Finalize & Create Staff Account
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1.5">
            <span className="font-semibold">Overall Onboarding Checklist Completion</span>
            <span>
              {completedCount} of {totalCount} items completed ({progressPct}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full transition-all duration-300 ${
                progressPct === 100 ? 'bg-emerald-500' : 'bg-brand-600'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Budget Estimator Banner */}
        <div className="grid grid-cols-1 gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-3 dark:bg-slate-800/60">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              One-Time Capex (Hardware/Desk)
            </span>
            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              {onboardingCase.budget.formattedCapex}
            </p>
          </div>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Monthly License Opex
            </span>
            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              {onboardingCase.budget.formattedMonthlyOpex}
            </p>
          </div>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Year-1 Financial Footprint
            </span>
            <p className="mt-1 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {onboardingCase.budget.formattedFirstYearTotal}
            </p>
          </div>
        </div>
      </div>

      {/* Action Bar for Items */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Onboarding Checklist & Deliverables</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Check off completed tasks, assign workflow deliverables, and track equipment procurement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Assignee Filter */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs shadow-xs dark:border-slate-700 dark:bg-slate-800">
            <FunnelIcon className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Assignees</option>
              <option value="UNASSIGNED">Unassigned Only</option>
              {staffUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  Assigned: {u.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowAddItem(true)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            + Add Custom Item
          </button>
        </div>
      </div>

      {/* Add Item Form (Inline Toggle) */}
      {showAddItem && (
        <form
          onSubmit={handleAddItem}
          className="rounded-xl border border-brand-200 bg-brand-50/40 p-5 dark:border-brand-900/60 dark:bg-brand-950/20 space-y-4"
        >
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add Custom Deliverable to Case</h3>
            <button
              type="button"
              onClick={() => setShowAddItem(false)}
              className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
              <select
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value as OnboardingItemCategory)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="HARDWARE">Hardware & Equipment</option>
                <option value="SOFTWARE_LICENSE">Software License</option>
                <option value="PAPERWORK">Paperwork & Compliance</option>
                <option value="FACILITY_ACCESS">Facility Access</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Ergonomic Keyboard & Mouse"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Estimated Cost</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newItemCost}
                  onChange={(e) => setNewItemCost(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <select
                  value={newItemCadence}
                  onChange={(e) => setNewItemCadence(e.target.value as OnboardingCostCadence)}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="ONE_TIME">One-Time</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Assignee</label>
              <select
                value={newItemAssignee}
                onChange={(e) => setNewItemAssignee(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">— Unassigned —</option>
                {staffUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Optional Link / Google Doc Copy URL
              </label>
              <input
                type="url"
                placeholder="https://docs.google.com/.../copy"
                value={newItemUrl}
                onChange={(e) => setNewItemUrl(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-500"
            >
              Add Item
            </button>
          </div>
        </form>
      )}

      {/* Categorized Checklist Sections */}
      {(['PAPERWORK', 'HARDWARE', 'SOFTWARE_LICENSE', 'FACILITY_ACCESS'] as OnboardingItemCategory[]).map(
        (category) => {
          const allCategoryItems = onboardingCase.items.filter((i) => i.category === category);
          const items = allCategoryItems.filter((i) => {
            if (assigneeFilter === 'ALL') return true;
            if (assigneeFilter === 'UNASSIGNED') return !i.assignedToUserId;
            return i.assignedToUserId === assigneeFilter;
          });
          const config = CATEGORY_CONFIG[category];
          const Icon = config.icon;

          return (
            <div
              key={category}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              {/* Category Header */}
              <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-white p-2 shadow-xs border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                    <Icon className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{config.label}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{config.desc}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {staffUsers.length > 0 && (
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        handleBatchAssignCategory(category, val === '__CLEAR__' ? null : val);
                        e.target.value = '';
                      }}
                      disabled={isPending}
                      defaultValue=""
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none"
                    >
                      <option value="" disabled>
                        Batch Assign Category...
                      </option>
                      <option value="__CLEAR__">— Clear / Unassign Category —</option>
                      {staffUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          Assign All to {u.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                    {allCategoryItems.filter((i) => i.completedAt !== null).length} / {allCategoryItems.length} Done
                  </span>
                </div>
              </div>

              {/* Items List */}
              {items.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 italic">
                  {allCategoryItems.length === 0
                    ? 'No items in this category.'
                    : 'No items in this category match the current assignee filter.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((item) => {
                    const isDone = item.completedAt !== null;

                    return (
                      <div
                        key={item.id}
                        className={`p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between transition-colors ${
                          isDone ? 'bg-slate-50/40 dark:bg-slate-900/40' : ''
                        }`}
                      >
                        {/* Checkbox and Details */}
                        <div className="flex items-start gap-3.5 flex-1">
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() => handleToggleItem(item.id, isDone)}
                            disabled={isPending}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800"
                          />

                          <div className="space-y-1 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-sm font-medium ${
                                  isDone
                                    ? 'line-through text-slate-400 dark:text-slate-500'
                                    : 'text-slate-900 dark:text-white'
                                }`}
                              >
                                {item.title}
                              </span>

                              {item.cost && item.cost > 0 ? (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                  {formatMoney(item.cost)}
                                  {item.costCadence === 'MONTHLY' ? '/mo' : ''}
                                </span>
                              ) : null}

                              {item.docTemplateUrl && (
                                <a
                                  href={item.docTemplateUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:underline dark:bg-blue-950/60 dark:text-blue-300"
                                >
                                  Open Force-Copy Template
                                  <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                                </a>
                              )}

                              {item.category === 'HARDWARE' && (
                                <select
                                  value={item.procurementStatus}
                                  onChange={(e) => handleProcurementChange(item.id, e.target.value as OnboardingProcurementStatus)}
                                  className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                  <option value="NOT_REQUIRED">Fulfillment: Not Required</option>
                                  <option value="NEEDED">Fulfillment: Needed</option>
                                  <option value="ORDERED">Fulfillment: Ordered (PO Issued)</option>
                                  <option value="RECEIVED">Fulfillment: Received & Tagged</option>
                                </select>
                              )}

                              {/* Inline Assignee Selector */}
                              {staffUsers.length > 0 && (
                                <select
                                  value={item.assignedToUserId || ''}
                                  onChange={(e) => handleAssignItem(item.id, e.target.value || null)}
                                  disabled={isPending}
                                  className={`rounded border px-2 py-0.5 text-[11px] font-medium focus:outline-none transition-colors ${
                                    item.assignedToUserId
                                      ? 'border-brand-200 bg-brand-50/70 text-brand-700 dark:border-brand-900/60 dark:bg-brand-950/40 dark:text-brand-300'
                                      : 'border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                  }`}
                                >
                                  <option value="">— Unassigned —</option>
                                  {staffUsers.map((u) => (
                                    <option key={u.id} value={u.id}>
                                      Owner: {u.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>

                            {item.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                            )}

                            {/* Completed Meta & Note */}
                            {isDone && (
                              <div className="pt-1 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-3">
                                <span>
                                  Completed {new Date(item.completedAt!).toLocaleDateString()}
                                  {item.completedBy ? ` by ${item.completedBy.name}` : ''}
                                </span>

                                {item.completedLocationNote && editingItemNote !== item.id && (
                                  <span className="italic text-slate-600 dark:text-slate-300">
                                    Note: {item.completedLocationNote}
                                  </span>
                                )}

                                {editingItemNote !== item.id ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingItemNote(item.id);
                                      setNoteValue(item.completedLocationNote || '');
                                    }}
                                    className="text-brand-600 hover:underline dark:text-brand-400"
                                  >
                                    {item.completedLocationNote ? 'Edit Note' : '+ Add Note/Filing Location'}
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-2 mt-1">
                                    <input
                                      type="text"
                                      placeholder="e.g. Filed in HR drive / Serial #C02..."
                                      value={noteValue}
                                      onChange={(e) => setNoteValue(e.target.value)}
                                      className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveNote(item.id)}
                                      className="rounded bg-brand-600 px-2 py-0.5 text-xs font-medium text-white"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingItemNote(null)}
                                      className="text-xs text-slate-400"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                            title="Delete item"
                          >
                            &times; Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }
      )}

      {/* Modal: Finalize & Create Staff User Account */}
      {showCreateAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            {createdAccountPassword ? (
              <>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Account Created</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Share this temporary password with {accountName || 'the new user'} now — it will not be shown again.
                </p>
                <div className="select-all break-all rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  {createdAccountPassword}
                </div>
                <div className="pt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleDismissCreatedAccount}
                    className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Finalize Onboarding & Create Staff Account
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This will create a live user account in CPCana for this candidate and mark the onboarding case as Completed.
                </p>

                <form onSubmit={handleCreateAccount} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Name</label>
                    <input
                      type="text"
                      required
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={accountEmail}
                      onChange={(e) => setAccountEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">System Role</label>
                    <select
                      value={accountRole}
                      onChange={(e) => setAccountRole(e.target.value as Role)}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="USER">User (Standard staff / volunteer)</option>
                      <option value="MANAGER">Manager (Department / Ministry Director)</option>
                      <option value="ADMIN">Administrator (Full church system access)</option>
                    </select>
                  </div>

                  <div className="pt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateAccount(false)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500"
                    >
                      {isPending ? 'Creating Account...' : 'Create Account & Complete'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

