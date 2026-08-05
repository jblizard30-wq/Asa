import Link from 'next/link';
import { PRIORITY_BAR_COLORS, PRIORITY_LABELS, PRIORITY_STYLES, STATUS_BAR_COLORS, STATUS_LABELS } from '@/lib/format';
import type { CountBreakdown, MemberStats, ProjectStats, TaskListEntry, TeamStats, TopLineStats } from '@/lib/dashboard';

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
}: DashboardViewProps) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{scopeDescription}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label={role === 'ADMIN' ? 'Total Users' : 'Team Members'} value={topLine.peopleCount} />
        <StatTile label="Open Tasks" value={topLine.openCount} />
        <StatTile label="Overdue" value={topLine.overdueCount} tone={topLine.overdueCount > 0 ? 'danger' : 'default'} />
        <StatTile label="Due Next 7 Days" value={topLine.dueSoonCount} />
        <StatTile label="Completed (14d)" value={topLine.completedRecentCount} tone="success" />
      </div>

      {adminExtras && (
        <div className="mt-3 grid grid-cols-3 gap-3 sm:max-w-xl">
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
    <div className={`rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800 ${compact ? 'p-3' : 'p-4'}`}>
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
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-800">
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
                  className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"
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
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
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
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-500 dark:text-slate-500">
        No team members in scope yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-600">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-600">
        <thead className="bg-slate-50 dark:bg-slate-800/60">
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
        <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
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
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-500 dark:text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-600">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-600">
        <thead className="bg-slate-50 dark:bg-slate-800/60">
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
        <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
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
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800">
      {!hideHeader && (
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
        </div>
      )}
      {entries.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">{emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700">
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
