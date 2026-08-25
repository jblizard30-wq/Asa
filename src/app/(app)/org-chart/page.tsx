import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildOrgTree } from '@/lib/orgChart';
import { OrgChart } from '@/components/OrgChart';

export default async function OrgChartPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/sign-in');

  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, role: true, managerId: true },
  });

  const tree = buildOrgTree(users);
  const chartRoots = tree.filter((node) => node.children.length > 0);
  const unassigned = tree.filter((node) => node.children.length === 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Org Chart</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Who reports to whom across the organization.
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <OrgChart
          roots={chartRoots}
          unassigned={unassigned}
          isAdmin={session.user.role === 'ADMIN'}
          allPeople={users.map((u) => ({ id: u.id, name: u.name }))}
        />
      </div>
    </div>
  );
}
