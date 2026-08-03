import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getIntakeFormsForProject } from '@/lib/actions/intakeForms';
import { IntakeFormsManager } from '@/components/IntakeFormsManager';

export default async function IntakeFormsPage({ params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/sign-in');

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: {
      members: { include: { user: true } },
      sections: { orderBy: { order: 'asc' }, select: { id: true, name: true } },
    },
  });
  if (!project) notFound();

  const isMember = project.members.some((m) => m.userId === session.user.id);
  if (!isMember && session.user.role !== 'ADMIN') {
    redirect('/projects');
  }

  const forms = await getIntakeFormsForProject(project.id);

  return (
    <IntakeFormsManager
      projectId={project.id}
      projectName={project.name}
      sections={project.sections}
      members={project.members.map((m) => ({ id: m.user.id, name: m.user.name }))}
      forms={forms}
    />
  );
}
