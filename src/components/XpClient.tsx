'use client';

import { useState, useTransition } from 'react';
import { createFinancialSnapshot, createBudgetLine, createBoardPacket } from '@/lib/actions/xp';
import { allRatios } from '@/lib/xpRatios';
import { ElderPacketPrintModal } from '@/components/ElderPacketPrintModal';
import { StrategicFrameworksCatalog } from '@/components/StrategicFrameworksCatalog';
import type { ToolDefinition } from '@/lib/tools/schema';

interface Snapshot {
  id: string; periodDate: string; unrestrictedCash: number; annualRevenue: number;
  annualExpense: number; programExpense: number; personnelCost: number; varianceNote: string | null;
}
interface BudgetLine {
  id: string; fiscalYear: number; category: string;
  allocatedAmount: number; spentAmount: number; notes: string | null;
}
interface Packet {
  id: string; title: string; meetingDate: string; status: string; summaryNotes: string | null;
}

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const STATUS_STYLE: Record<string, string> = {
  healthy: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  watch: 'border-amber-200 bg-amber-50 text-amber-800',
  concern: 'border-red-200 bg-red-50 text-red-800',
};

export function XpClient({
  canManage, snapshots, budgetLines, packets, tools = [],
}: {
  canManage: boolean;
  snapshots: Snapshot[];
  budgetLines: BudgetLine[];
  packets: Packet[];
  tools?: ToolDefinition[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'financial' | 'budget' | 'packets' | 'tools'>('financial');
  const [form, setForm] = useState({
    periodDate: '', unrestrictedCash: '', annualRevenue: '',
    annualExpense: '', programExpense: '', personnelCost: '', varianceNote: '',
  });
  const [budget, setBudget] = useState({ fiscalYear: '', category: '', allocatedAmount: '', spentAmount: '' });
  const [packet, setPacket] = useState({ title: '', meetingDate: '', summaryNotes: '' });
  const [selectedPrintPacket, setSelectedPrintPacket] = useState<Packet | null>(null);

  const latest = snapshots[0];
  const ratios = latest ? allRatios(latest) : [];

  function run(fn: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.success) setError(res.error ?? 'Something went wrong.');
    });
  }

  const field = 'rounded-md border border-slate-300 px-3 py-2 text-sm';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">XP Hub</h1>
        <p className="mt-1 text-sm text-slate-500">
          Executive pastor financial oversight — health ratios, budget lines and board packets.
        </p>
      </header>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {latest && (
        <div className="grid gap-3 sm:grid-cols-3">
          {ratios.map((r) => (
            <div key={r.label} className={`rounded-lg border p-4 ${STATUS_STYLE[r.status]}`}>
              <p className="text-xs font-medium uppercase tracking-wide opacity-80">{r.label}</p>
              <p className="mt-1 text-2xl font-semibold">{r.display}</p>
              <p className="mt-1 text-xs opacity-80">{r.hint}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {(['financial', 'budget', 'packets', 'tools'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'border-b-2 border-slate-900 font-bold text-slate-900' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t === 'financial'
              ? 'Financial snapshots'
              : t === 'budget'
              ? 'Budget lines'
              : t === 'packets'
              ? 'Board packets'
              : `🛠️ Strategic Frameworks (${tools.length})`}
          </button>
        ))}
      </div>

      {tab === 'financial' && (
        <section className="space-y-4">
          {canManage && (
            <form
              className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  const r = await createFinancialSnapshot({
                    periodDate: form.periodDate,
                    unrestrictedCash: Number(form.unrestrictedCash),
                    annualRevenue: Number(form.annualRevenue),
                    annualExpense: Number(form.annualExpense),
                    programExpense: Number(form.programExpense),
                    personnelCost: Number(form.personnelCost),
                    varianceNote: form.varianceNote,
                  });
                  if (r.success) setForm({ periodDate: '', unrestrictedCash: '', annualRevenue: '', annualExpense: '', programExpense: '', personnelCost: '', varianceNote: '' });
                  return r;
                });
              }}
            >
              <label className="flex flex-col text-sm">
                <span className="mb-1 font-medium text-slate-700">Period date</span>
                <input type="date" required value={form.periodDate}
                  onChange={(e) => setForm({ ...form, periodDate: e.target.value })} className={field} />
              </label>
              {([
                ['unrestrictedCash', 'Unrestricted cash'],
                ['annualRevenue', 'Annual revenue'],
                ['annualExpense', 'Annual expense'],
                ['programExpense', 'Program expense'],
                ['personnelCost', 'Personnel cost'],
              ] as const).map(([k, label]) => (
                <label key={k} className="flex flex-col text-sm">
                  <span className="mb-1 font-medium text-slate-700">{label}</span>
                  <input type="number" step="0.01" required value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })} className={field} />
                </label>
              ))}
              <label className="flex flex-col text-sm sm:col-span-2">
                <span className="mb-1 font-medium text-slate-700">Variance note</span>
                <input value={form.varianceNote}
                  onChange={(e) => setForm({ ...form, varianceNote: e.target.value })} className={field} />
              </label>
              <div className="flex items-end">
                <button disabled={pending}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {pending ? 'Saving…' : 'Save snapshot'}
                </button>
              </div>
            </form>
          )}
          {snapshots.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              No snapshots yet.
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="border-b px-3 py-2">Period</th>
                  <th className="border-b px-3 py-2">Cash</th>
                  <th className="border-b px-3 py-2">Revenue</th>
                  <th className="border-b px-3 py-2">Expense</th>
                  <th className="border-b px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s.id}>
                    <td className="border-b border-slate-100 px-3 py-2">{s.periodDate.slice(0, 10)}</td>
                    <td className="border-b border-slate-100 px-3 py-2">{money(s.unrestrictedCash)}</td>
                    <td className="border-b border-slate-100 px-3 py-2">{money(s.annualRevenue)}</td>
                    <td className="border-b border-slate-100 px-3 py-2">{money(s.annualExpense)}</td>
                    <td className="border-b border-slate-100 px-3 py-2 text-slate-500">{s.varianceNote ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === 'budget' && (
        <section className="space-y-4">
          {canManage && (
            <form
              className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  const r = await createBudgetLine({
                    fiscalYear: Number(budget.fiscalYear),
                    category: budget.category,
                    allocatedAmount: Number(budget.allocatedAmount),
                    spentAmount: Number(budget.spentAmount || 0),
                  });
                  if (r.success) setBudget({ fiscalYear: '', category: '', allocatedAmount: '', spentAmount: '' });
                  return r;
                });
              }}
            >
              <label className="flex flex-col text-sm">
                <span className="mb-1 font-medium text-slate-700">Fiscal year</span>
                <input type="number" required value={budget.fiscalYear}
                  onChange={(e) => setBudget({ ...budget, fiscalYear: e.target.value })} className={`${field} w-28`} />
              </label>
              <label className="flex flex-col text-sm">
                <span className="mb-1 font-medium text-slate-700">Category</span>
                <input required value={budget.category}
                  onChange={(e) => setBudget({ ...budget, category: e.target.value })} className={`${field} w-48`} />
              </label>
              <label className="flex flex-col text-sm">
                <span className="mb-1 font-medium text-slate-700">Allocated</span>
                <input type="number" step="0.01" required value={budget.allocatedAmount}
                  onChange={(e) => setBudget({ ...budget, allocatedAmount: e.target.value })} className={`${field} w-32`} />
              </label>
              <label className="flex flex-col text-sm">
                <span className="mb-1 font-medium text-slate-700">Spent</span>
                <input type="number" step="0.01" value={budget.spentAmount}
                  onChange={(e) => setBudget({ ...budget, spentAmount: e.target.value })} className={`${field} w-32`} />
              </label>
              <button disabled={pending}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                Add line
              </button>
            </form>
          )}
          {budgetLines.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              No budget lines yet.
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="border-b px-3 py-2">FY</th>
                  <th className="border-b px-3 py-2">Category</th>
                  <th className="border-b px-3 py-2">Allocated</th>
                  <th className="border-b px-3 py-2">Spent</th>
                  <th className="border-b px-3 py-2">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {budgetLines.map((b) => (
                  <tr key={b.id}>
                    <td className="border-b border-slate-100 px-3 py-2">{b.fiscalYear}</td>
                    <td className="border-b border-slate-100 px-3 py-2">{b.category}</td>
                    <td className="border-b border-slate-100 px-3 py-2">{money(b.allocatedAmount)}</td>
                    <td className="border-b border-slate-100 px-3 py-2">{money(b.spentAmount)}</td>
                    <td className="border-b border-slate-100 px-3 py-2">{money(b.allocatedAmount - b.spentAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === 'packets' && (
        <section className="space-y-4">
          {canManage && (
            <form
              className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  const r = await createBoardPacket(packet);
                  if (r.success) setPacket({ title: '', meetingDate: '', summaryNotes: '' });
                  return r;
                });
              }}
            >
              <label className="flex flex-col text-sm">
                <span className="mb-1 font-medium text-slate-700">Title</span>
                <input required value={packet.title}
                  onChange={(e) => setPacket({ ...packet, title: e.target.value })} className={`${field} w-64`} />
              </label>
              <label className="flex flex-col text-sm">
                <span className="mb-1 font-medium text-slate-700">Meeting date</span>
                <input type="date" required value={packet.meetingDate}
                  onChange={(e) => setPacket({ ...packet, meetingDate: e.target.value })} className={field} />
              </label>
              <button disabled={pending}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                Add packet
              </button>
            </form>
          )}
          {packets.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              No board packets yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {packets.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-medium text-slate-800">{p.title}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{p.meetingDate.slice(0, 10)} · {p.status}</span>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setSelectedPrintPacket(p)}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        🖨️ Request Print Run
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'tools' && <StrategicFrameworksCatalog tools={tools} />}

      {selectedPrintPacket && (
        <ElderPacketPrintModal
          isOpen={Boolean(selectedPrintPacket)}
          onClose={() => setSelectedPrintPacket(null)}
          packetId={selectedPrintPacket.id}
          packetTitle={selectedPrintPacket.title}
        />
      )}
    </div>
);
}
