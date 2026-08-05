import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDashboardData } from '@/lib/actions/dashboard';
import { DashboardView } from '@/components/DashboardView';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/sign-in');
  if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') redirect('/my-tasks');

  const data = await getDashboardData();

  if (!data.hasTeams) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">You don&apos;t manage any teams yet.</p>
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-500 dark:text-slate-500">
          Ask an administrator to assign you as a team&apos;s manager on the{' '}
          <a href="/teams" className="text-brand-600 hover:underline dark:text-brand-400">
            Teams
          </a>{' '}
          page to start overseeing its work here.
        </div>
      </div>
    );
  }

  return (
    <DashboardView
      role={data.role}
      scopeDescription={data.scopeDescription}
      topLine={data.topLine}
      statusBreakdown={data.statusBreakdown}
      priorityBreakdown={data.priorityBreakdown}
      members={data.members}
      projects={data.projects}
      teams={data.teams}
      overdueTasks={data.overdueTasks}
      upcomingTasks={data.upcomingTasks}
      recentlyCompleted={data.recentlyCompleted}
      adminExtras={data.role === 'ADMIN' ? data.adminExtras : undefined}
    />
  );
}
