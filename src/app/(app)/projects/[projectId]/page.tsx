import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ProjectView } from '@/components/ProjectView';

export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/sign-in');

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: {
      members: { include: { user: true } },
      sections: {
        orderBy: { order: 'asc' },
        include: {
          tasks: {
            orderBy: { order: 'asc' },
            include: { assignee: true },
          },
        },
      },
    },
  });

  if (!project) notFound();

  const isMember = project.members.some((m) => m.userId === session.user.id);
  if (!isMember && session.user.role !== 'ADMIN') {
    redirect('/projects');
  }

  return (
    <ProjectView
      projectId={project.id}
      projectName={project.name}
      description={project.description}
      isAdmin={session.user.role === 'ADMIN'}
      members={project.members.map((m) => ({ id: m.user.id, name: m.user.name }))}
      sections={project.sections.map((s) => ({
        id: s.id,
        name: s.name,
        order: s.order,
        tasks: s.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          assigneeName: t.assignee?.name ?? null,
        })),
      }))}
    />
  );
}
