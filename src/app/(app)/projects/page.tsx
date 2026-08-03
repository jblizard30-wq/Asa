import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ProjectsListClient } from '@/components/ProjectsListClient';

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const isAdmin = session.user.role === 'ADMIN';

  const projects = await prisma.project.findMany({
    where: isAdmin
      ? { isPersonal: false }
      : { isPersonal: false, members: { some: { userId: session.user.id } } },
    include: {
      _count: { select: { tasks: { where: { deletedAt: null } } } },
      members: true,
      tasks: { where: { status: { not: 'DONE' }, deletedAt: null }, select: { id: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <ProjectsListClient
      isAdmin={isAdmin}
      projects={projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        memberCount: p.members.length,
        taskCount: p._count.tasks,
        openTaskCount: p.tasks.length,
      }))}
    />
  );
}
