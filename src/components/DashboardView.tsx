'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/Toast';
import { claimSignupSlot } from '@/lib/actions/meetups';
import { quickRestockItemToPar } from '@/lib/actions/inventory';
import { PRIORITY_BAR_COLORS, PRIORITY_LABELS, PRIORITY_STYLES, STATUS_BAR_COLORS, STATUS_LABELS } from '@/lib/format';
import type { CountBreakdown, MemberStats, ProjectStats, TaskListEntry, TeamStats, TopLineStats } from '@/lib/dashboard';
import type { DashboardModuleTelemetry } from '@/lib/actions/dashboard';

export interface DashboardViewProps {
  role: 'ADMIN' | 'MANAGER';
  scopeDescription: string;
  topLine: TopLineStats;
  statusBreakdown: CountBreakdown[];
  priorityBreakdown: CountBreakdown[];
  members: MemberStats[];
  projects: ProjectStats[];
  teams: TeamStats[];
  overdueTasks: TaskListEntry[];
  upcomingTasks: TaskListEntry[];
  recentlyCompleted: TaskListEntry[];
  adminExtras?: { teamCount: number; projectCount: number; unassignedCount: number };
  telemetry?: DashboardModuleTelemetry;
}

export function DashboardView({
  role,
  scopeDescription,
  topLine,
  statusBreakdown,
  priorityBreakdown,
  members,
  projects,
  teams,
  overdueTasks,
  upcomingTasks,
  recentlyCompleted,
  adminExtras,
  telemetry,
}: DashboardViewProps) {
  const toast = useToast();
  const [criticalItems, setCriticalItems] = useState(telemetry?.criticalInventoryItems || []);
  const [openSlots, setOpenSlots] = useState(telemetry?.openVolunteerSlots || []);
  const [claimingSlotId, setClaimingSlotId] = useState<string | null>(null);
  const [restockingItemId, setRestockingItemId] = useState<string | null>(null);

  const handleQuickClaim = async (slotId: string, slotTitle: string, meetupTitle: string) => {
    setClaimingSlotId(slotId);
    try {
      const res = await claimSignupSlot(slotId, 'Self');
      if (res.success) {
        toast.success('Role Claimed!', `You're signed up for "${slotTitle}" at ${meetupTitle}.`);
        setOpenSlots((prev) => prev.filter((s) => s.id !== slotId));
      } else {
        toast.error('Claim Failed', res.error || 'Could not claim this role.');
      }
    } catch (err: any) {
      toast.error('Error', err.message || 'Something went wrong.');
    } finally {
      setClaimingSlotId(null);
    }
  };

  const handleQuickRestock = async (itemId: string, name: string) => {
    setRestockingItemId(itemId);
    try {
      const res = await quickRestockItemToPar(itemId);
      if (res.success) {
        toast.success('Restocked to Par', `"${name}" stock level has been replenished to ideal par.`);
        setCriticalItems((prev) => prev.filter((i) => i.id !== itemId));
      } else {
        toast.error('Restock Failed', res.error || 'Failed to restock item.');
      }
    } catch (err: any) {
      toast.error('Error', err.message || 'Something went wrong.');
    } finally {
      setRestockingItemId(null);
    }
  };
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Church Operations Cockpit</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{scopeDescription}</p>
      </div>

      {/* Financial Runway Ratios (if XP enabled) */}
      {telemetry?.financialRatios && telemetry.financialRatios.length > 0 && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              📊 Financial Runway & Health Ratios (XP Hub)
            </span>
            <Link href="/xp" className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
              View Financials →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {telemetry.financialRatios.map((r) => (
              <div
                key={r.label}
                className={`rounded-lg border p-3 bg-white dark:bg-slate-900 ${
                  r.status === 'healthy'
                    ? 'border-emerald-200 dark:border-emerald-800'
                    : r.status === 'watch'
                    ? 'border-amber-200 dark:border-amber-800'
                    : 'border-rose-200 dark:border-rose-800'
                }`}
              >
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{r.label}</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{r.display}</p>
                <p className="text-[11px] text-slate-400 mt-1">{r.hint}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Operational Rhythms & Urgent Alerts */}
      {telemetry && (telemetry.upcomingMeetups.length > 0 || telemetry.criticalInventoryItems.length > 0 || telemetry.openVolunteerSlots.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Upcoming Gatherings */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>🗓️</span>
                <span>Upcoming Church Gatherings</span>
              </h3>
              <Link href="/meetups" className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">
                View All →
              </Link>
            </div>
            {telemetry.upcomingMeetups.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">No meetups or services scheduled in the next 7 days.</p>
            ) : (
              <div className="space-y-2">
                {telemetry.upcomingMeetups.map((m) => (
                  <Link
                    key={m.id}
                    href={`/meetups/${m.id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-100/60 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="truncate">
                      <p className="font-medium text-xs text-slate-800 dark:text-slate-200 truncate">{m.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {m.startsAt ? new Date(m.startsAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Time voting active'}
                        {m.location ? ` · ${m.location}` : ''}
                      </p>
                    </div>
                    {m.unfilledSlotCount > 0 ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                        ⚠️ {m.unfilledSlotCount} open role{m.unfilledSlotCount === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {m.category}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Critical Supply & Volunteer Alerts */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>⚠️</span>
                <span>Operational Alerts</span>
              </h3>
              <span className="text-xs text-slate-400">Action required</span>
            </div>

            <div className="space-y-2.5">
              {/* Critical Inventory */}
              {criticalItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-rose-100 bg-rose-50/50 dark:border-rose-950/60 dark:bg-rose-950/20"
                >
                  <div>
                    <p className="text-xs font-semibold text-rose-900 dark:text-rose-200">
                      Restock Par Alert: {item.name}
                    </p>
                    <p className="text-[11px] text-rose-700/80 dark:text-rose-400">
                      {item.onHandQty} {item.unit} on hand (Threshold: {item.reorderThreshold}) · Room: {item.roomName}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleQuickRestock(item.id, item.name)}
                      disabled={restockingItemId === item.id}
                      className="text-xs font-semibold px-2 py-1 rounded border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-900/60 shadow-xs transition-colors disabled:opacity-50"
                      title="Instantly replenish to par level"
                    >
                      {restockingItemId === item.id ? 'Restocking...' : 'Restock to Par'}
                    </button>
                    <Link
                      href="/inventory/orders"
                      className="text-xs font-semibold px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white shadow-xs"
                    >
                      Order
                    </Link>
                  </div>
                </div>
              ))}

              {/* Volunteer Gaps */}
              {openSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-amber-100 bg-amber-50/50 dark:border-amber-950/60 dark:bg-amber-950/20"
                >
                  <div>
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                      Unfilled Volunteer Role: {slot.slotTitle}
                    </p>
                    <p className="text-[11px] text-amber-700/80 dark:text-amber-400">
                      {slot.neededCount} opening{slot.neededCount === 1 ? '' : 's'} for &ldquo;{slot.meetupTitle}&rdquo;
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleQuickClaim(slot.id, slot.slotTitle, slot.meetupTitle)}
                      disabled={claimingSlotId === slot.id}
                      className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-colors disabled:opacity-50"
                      title="Claim this volunteer role directly"
                    >
                      {claimingSlotId === slot.id ? 'Claiming...' : 'Claim Role'}
                    </button>
                    <Link
                      href={`/meetups/${slot.meetupId}`}
                      className="text-xs font-medium px-2 py-1 rounded border border-amber-200 bg-white hover:bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 shadow-xs"
                    >
                      Roster →
                    </Link>
                  </div>
                </div>
              ))}

              {criticalItems.length === 0 && openSlots.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-400">
                  ✓ All supplies above par level & volunteer roles covered.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Topline KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label={role === 'ADMIN' ? 'Total Users' : 'Team Members'} value={topLine.peopleCount} />
        <StatTile label="Open Tasks" value={topLine.openCount} />
        <StatTile label="Overdue" value={topLine.overdueCount} tone={topLine.overdueCount > 0 ? 'danger' : 'default'} />
        <StatTile label="Due Next 7 Days" value={topLine.dueSoonCount} />
        <StatTile label="Completed (14d)" value={topLine.completedRecentCount} tone="success" />
      </div>

      {adminExtras && (
        <div className="grid grid-cols-3 gap-3 sm:max-w-xl">
          <StatTile label="Teams" value={adminExtras.teamCount} compact />
          <StatTile label="Projects" value={adminExtras.projectCount} compact />
          <StatTile
            label="Unassigned Tasks"
            value={adminExtras.unassignedCount}
            compact
            tone={adminExtras.unassignedCount > 0 ? 'danger' : 'default'}
          />
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <BreakdownCard title="Tasks by Status" items={statusBreakdown} labels={STATUS_LABELS} colors={STATUS_BAR_COLORS} />
        <BreakdownCard
          title="Open Tasks by Priority"
          items={priorityBreakdown}
          labels={PRIORITY_LABELS}
          colors={PRIORITY_BAR_COLORS}
        />
      </div>

      <Section title="Workload by Team Member">
        <MemberTable members={members} />
      </Section>

      {teams.length > 0 && (
        <Section title="Teams">
          <GroupStatsTable
            emptyMessage="No teams in scope yet."
            rows={teams.map((t) => ({
              id: t.id,
              name: t.name,
              secondaryLabel: `${t.memberCount} member${t.memberCount === 1 ? '' : 's'}${t.managerName ? ` · managed by ${t.managerName}` : ''}`,
              openCount: t.openCount,
              overdueCount: t.overdueCount,
              doneCount: t.doneCount,
              totalCount: t.totalCount,
              completionRate: t.completionRate,
            }))}
          />
        </Section>
      )}

      <Section title="Projects">
        <GroupStatsTable
          emptyMessage="No projects have tasks assigned in this scope yet."
          rows={projects.map((p) => ({
            id: p.projectId,
            name: p.projectName,
            href: `/projects/${p.projectId}`,
            openCount: p.openCount,
            overdueCount: p.overdueCount,
            doneCount: p.doneCount,
            totalCount: p.totalCount,
            completionRate: p.completionRate,
          }))}
        />
      </Section>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <TaskListCard
          title="Overdue"
          tone="overdue"
          entries={overdueTasks}
          emptyMessage="Nothing overdue — nice work!"
        />
        <TaskListCard
          title="Due in the Next 7 Days"
          tone="upcoming"
          entries={upcomingTasks}
          emptyMessage="Nothing due soon."
        />
      </div>

      <Section title="Recently Completed">
        <TaskListCard
          title="Recently Completed"
          tone="completed"
          entries={recentlyCompleted}
          emptyMessage="No tasks completed in the last 14 days."
          hideHeader
        />
      </Section>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  tone = 'default',
  compact = false,
}: {
  label: string;
  value: number;
  tone?: 'default' | 'danger' | 'success';
  compact?: boolean;
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-red-600 dark:text-red-400'
      : tone === 'success'
        ? 'text-green-600 dark:text-green-400'
        : 'text-slate-900 dark:text-slate-100';
  return (
    <div className={`rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 ${compact ? 'p-3' : 'p-4'}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
      <p className={`mt-1 font-semibold ${toneClass} ${compact ? 'text-lg' : 'text-2xl'}`}>{value}</p>
    </div>
  );
}

export function BreakdownCard({
  title,
  items,
  labels,
  colors,
}: {
  title: string;
  items: CountBreakdown[];
  labels: Record<string, string>;
  colors: Record<string, string>;
}) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
      {total === 0 ? (
        <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">No tasks in scope yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => {
            const pct = Math.round((item.count / total) * 100);
            const label = labels[item.key] ?? item.key;
            return (
              <div key={item.key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
                  <span className="text-slate-400 dark:text-slate-500">{item.count}</span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                  title={`${label}: ${item.count} (${pct}%)`}
                >
                  <div className={`h-full rounded-full ${colors[item.key] ?? 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CompletionBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">{pct}%</span>
    </div>
  );
}

const MEMBER_TABLE_HEADERS = ['Name', 'Open', 'Overdue', 'Due Soon', 'Completed (14d)', 'Completion'];

function MemberTable({ members }: { members: MemberStats[] }) {
  if (members.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-600 dark:text-slate-500">
        No team members in scope yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
        <thead className="bg-slate-50 dark:bg-slate-900/60">
          <tr>
            {MEMBER_TABLE_HEADERS.map((header) => (
              <th
                key={header}
                className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
          {members.map((member) => (
            <tr key={member.userId}>
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                {member.name}
              </td>
              <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{member.openCount}</td>
              <td
                className={`px-4 py-3 text-sm ${
                  member.overdueCount > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {member.overdueCount}
              </td>
              <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{member.dueSoonCount}</td>
              <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{member.completedRecentCount}</td>
              <td className="px-4 py-3">
                {member.totalCount > 0 ? (
                  <CompletionBar rate={member.completionRate} />
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500">No tasks</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface GroupStatsRow {
  id: string;
  name: string;
  secondaryLabel?: string;
  href?: string;
  openCount: number;
  overdueCount: number;
  doneCount: number;
  totalCount: number;
  completionRate: number;
}

function GroupStatsTable({ rows, emptyMessage }: { rows: GroupStatsRow[]; emptyMessage: string }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-600 dark:text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
        <thead className="bg-slate-50 dark:bg-slate-900/60">
          <tr>
            {['Name', 'Open', 'Overdue', 'Done', 'Completion'].map((header) => (
              <th
                key={header}
                className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                {row.href ? (
                  <Link href={row.href} className="hover:text-brand-600 hover:underline dark:hover:text-brand-400">
                    {row.name}
                  </Link>
                ) : (
                  row.name
                )}
                {row.secondaryLabel && (
                  <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">{row.secondaryLabel}</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{row.openCount}</td>
              <td
                className={`px-4 py-3 text-sm ${
                  row.overdueCount > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {row.overdueCount}
              </td>
              <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{row.doneCount}</td>
              <td className="px-4 py-3">
                {row.totalCount > 0 ? (
                  <CompletionBar rate={row.completionRate} />
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500">No tasks</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function relativeDueLabel(entry: TaskListEntry, tone: 'overdue' | 'upcoming' | 'completed'): string {
  if (tone === 'completed') {
    return new Date(entry.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  const days = entry.daysFromNow ?? 0;
  if (tone === 'overdue') {
    return days <= 0 ? 'Overdue' : `${days} day${days === 1 ? '' : 's'} overdue`;
  }
  const daysUntil = -days;
  if (daysUntil <= 0) return 'Due today';
  if (daysUntil === 1) return 'Due tomorrow';
  return `Due in ${daysUntil} days`;
}

export function TaskListCard({
  title,
  entries,
  emptyMessage,
  tone,
  hideHeader = false,
}: {
  title: string;
  entries: TaskListEntry[];
  emptyMessage: string;
  tone: 'overdue' | 'upcoming' | 'completed';
  hideHeader?: boolean;
}) {
  const dueToneClass =
    tone === 'overdue'
      ? 'text-red-500 dark:text-red-400'
      : tone === 'completed'
        ? 'text-green-600 dark:text-green-400'
        : 'text-slate-400 dark:text-slate-500';

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {!hideHeader && (
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
        </div>
      )}
      {entries.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">{emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{entry.title}</p>
                <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                  <Link href={`/projects/${entry.projectId}`} className="hover:underline">
                    {entry.projectName}
                  </Link>
                  {entry.assigneeName && <> · {entry.assigneeName}</>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[entry.priority]}`}>
                  {PRIORITY_LABELS[entry.priority]}
                </span>
                <span className={`whitespace-nowrap text-xs font-medium ${dueToneClass}`}>{relativeDueLabel(entry, tone)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
