'use client';

import { useMemo } from 'react';
import {
  computeOverdueTasks,
  computePriorityBreakdown,
  computeRecentlyCompleted,
  computeStatusBreakdown,
  computeTopLineStats,
  computeUpcomingTasks,
  type DashboardTask,
} from '@/lib/dashboard';
import { PRIORITY_BAR_COLORS, PRIORITY_LABELS, STATUS_BAR_COLORS, STATUS_LABELS } from '@/lib/format';
import { BreakdownCard, Section, StatTile, TaskListCard } from '@/components/DashboardView';
import type { KanbanSection } from '@/components/KanbanBoard';

export interface ProjectDashboardTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assigneeIds: string[];
  assigneeNames: string[];
}

// KanbanTask doesn't carry `updatedAt`, so "recently completed" can't be reconstructed here —
// epoch keeps DONE tasks out of that window instead of showing a misleading "just completed" list.
const NO_UPDATED_AT = new Date(0).toISOString();

export function ProjectDashboardView({
  projectId,
  projectName,
  sections,
}: {
  projectId: string;
  projectName: string;
  sections: Pick<KanbanSection, 'tasks'>[];
}) {
  const tasks = useMemo<DashboardTask[]>(
    () =>
      sections.flatMap((section) =>
        section.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          assigneeIds: task.assigneeIds,
          assigneeName: task.assigneeNames.join(', ') || null,
          projectId,
          projectName,
          updatedAt: NO_UPDATED_AT,
        })),
      ),
    [sections, projectId, projectName],
  );

  const now = useMemo(() => new Date(), []);
  const topLine = useMemo(() => computeTopLineStats(tasks, 0, now), [tasks, now]);
  const statusBreakdown = useMemo(() => computeStatusBreakdown(tasks), [tasks]);
  const priorityBreakdown = useMemo(() => computePriorityBreakdown(tasks), [tasks]);
  const overdueTasks = useMemo(() => computeOverdueTasks(tasks, now), [tasks, now]);
  const upcomingTasks = useMemo(() => computeUpcomingTasks(tasks, now), [tasks, now]);
  const recentlyCompleted = useMemo(() => computeRecentlyCompleted(tasks, now), [tasks, now]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Open Tasks" value={topLine.openCount} />
        <StatTile label="Overdue" value={topLine.overdueCount} tone={topLine.overdueCount > 0 ? 'danger' : 'default'} />
        <StatTile label="Due Next 7 Days" value={topLine.dueSoonCount} />
        <StatTile label="Total Tasks" value={topLine.totalCount} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <BreakdownCard title="Tasks by Status" items={statusBreakdown} labels={STATUS_LABELS} colors={STATUS_BAR_COLORS} />
        <BreakdownCard
          title="Open Tasks by Priority"
          items={priorityBreakdown}
          labels={PRIORITY_LABELS}
          colors={PRIORITY_BAR_COLORS}
        />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <TaskListCard title="Overdue" tone="overdue" entries={overdueTasks} emptyMessage="Nothing overdue — nice work!" />
        <TaskListCard title="Due in the Next 7 Days" tone="upcoming" entries={upcomingTasks} emptyMessage="Nothing due soon." />
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
