import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/modules';
import { RaciClient } from '@/components/RaciClient';

export default async function RaciPage() {
  if (!isModuleEnabled('raci')) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/sign-in');
  }

  const canManage = session.user.role === 'ADMIN' || session.user.role === 'MANAGER';

  const charts = await prisma.raciChart.findMany({
    where: { archivedAt: null },
    include: {
      steps: { orderBy: { stepOrder: 'asc' }, include: { assignments: true } },
      people: { orderBy: { personOrder: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const shaped = charts.map((c) => ({
    id: c.id,
    processName: c.processName,
    owner: c.owner,
    trigger: c.trigger,
    ministryArea: c.ministryArea,
    createdAt: c.createdAt.toISOString(),
    people: c.people.map((p) => ({ id: p.id, name: p.name, roleTitle: p.roleTitle })),
    steps: c.steps.map((s) => ({
      id: s.id,
      stepName: s.stepName,
      stepOrder: s.stepOrder,
      cells: Object.fromEntries(s.assignments.map((a) => [a.personId, a.designations as string[]])),
    })),
  }));

  return <RaciClient canManage={canManage} charts={shaped} />;
}
