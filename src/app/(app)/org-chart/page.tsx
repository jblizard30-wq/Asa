import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildOrgTree } from '@/lib/orgChart';
import { OrgChart } from '@/components/OrgChart';

export default async function OrgChartPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/sign-in');

  const [users, raciCharts, activeTasks] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, role: true, managerId: true },
    }),
    prisma.raciChart.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        processName: true,
        trigger: true,
        owner: true,
        workflow: { select: { id: true, name: true } },
        people: {
          select: {
            id: true,
            name: true,
            userId: true,
            assignments: {
              select: {
                designations: true,
                step: { select: { stepName: true } },
              },
            },
          },
        },
      },
      orderBy: { processName: 'asc' },
    }),
    prisma.task.findMany({
      where: {
        deletedAt: null,
        status: { not: 'DONE' },
      },
      select: {
        id: true,
        title: true,
        priority: true,
        status: true,
        project: {
          select: {
            id: true,
            name: true,
            workflow: { select: { id: true, name: true } },
          },
        },
        assignees: { select: { id: true } },
      },
      take: 200,
    }),
  ]);

  const tree = buildOrgTree(users);
  const chartRoots = tree.filter((node) => node.children.length > 0);
  const unassigned = tree.filter((node) => node.children.length === 0);

  // Map RACI processes and roles by user
  const userRaciMap: Record<string, Record<string, string[]>> = {};
  const userDetailedRaci: Record<
    string,
    Array<{ chartId: string; processName: string; designations: string[]; stepName?: string }>
  > = {};

  for (const chart of raciCharts) {
    for (const person of chart.people) {
      if (!person.userId) continue;
      if (!userRaciMap[person.userId]) {
        userRaciMap[person.userId] = {};
        userDetailedRaci[person.userId] = [];
      }
      if (!userRaciMap[person.userId][chart.id]) {
        userRaciMap[person.userId][chart.id] = [];
      }

      for (const assignment of person.assignments) {
        for (const desig of assignment.designations) {
          if (!userRaciMap[person.userId][chart.id].includes(desig)) {
            userRaciMap[person.userId][chart.id].push(desig);
          }
        }
        userDetailedRaci[person.userId].push({
          chartId: chart.id,
          processName: chart.processName,
          designations: assignment.designations,
          stepName: assignment.step?.stepName,
        });
      }
    }
  }

  // Map active tasks by user
  const userTaskMap: Record<
    string,
    Array<{
      id: string;
      title: string;
      priority: string;
      status: string;
      projectId?: string;
      projectName?: string;
      workflowName?: string;
    }>
  > = {};

  for (const task of activeTasks) {
    for (const assignee of task.assignees) {
      if (!userTaskMap[assignee.id]) userTaskMap[assignee.id] = [];
      userTaskMap[assignee.id].push({
        id: task.id,
        title: task.title,
        priority: task.priority,
        status: task.status,
        projectId: task.project?.id,
        projectName: task.project?.name,
        workflowName: task.project?.workflow?.name,
      });
    }
  }

  const processes = raciCharts.map((c) => ({
    id: c.id,
    processName: c.processName,
    trigger: c.trigger,
    owner: c.owner,
    workflowName: c.workflow?.name,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Org Chart & Process Governance</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Reporting hierarchy, authority lines, and cross-functional RACI process responsibilities.
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <OrgChart
          roots={chartRoots}
          unassigned={unassigned}
          isAdmin={session.user.role === 'ADMIN'}
          allPeople={users.map((u) => ({ id: u.id, name: u.name }))}
          rawPeople={users}
          currentUserId={session.user.id}
          processes={processes}
          userRaciMap={userRaciMap}
          userDetailedRaci={userDetailedRaci}
          userTaskMap={userTaskMap}
        />
      </div>
    </div>
  );
}
