import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/sign-in');

  const isAdmin = session.user.role === 'ADMIN';

  const [notifications, projects, folders] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.project.findMany({
      where: isAdmin ? {} : { members: { some: { userId: session.user.id } } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.projectFolder.findMany({
      where: { userId: session.user.id },
      orderBy: { order: 'asc' },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: { project: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  const accessibleProjectIds = new Set(projects.map((p) => p.id));
  const groupedProjectIds = new Set<string>();

  const sidebarFolders = folders.map((folder) => {
    const folderProjects = folder.items
      .filter((item) => accessibleProjectIds.has(item.projectId))
      .map((item) => {
        groupedProjectIds.add(item.projectId);
        return { id: item.project.id, name: item.project.name };
      });
    return { id: folder.id, name: folder.name, projects: folderProjects };
  });

  const ungroupedProjects = projects.filter((p) => !groupedProjectIds.has(p.id));

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <Navbar
        userName={session.user.name ?? session.user.email ?? 'User'}
        notifications={notifications.map((n) => ({
          id: n.id,
          message: n.message,
          link: n.link,
          read: n.read,
          createdAt: n.createdAt.toISOString(),
        }))}
      />
      <div className="flex flex-1">
        <Sidebar
          folders={sidebarFolders}
          ungroupedProjects={ungroupedProjects}
          isAdmin={isAdmin}
          canManageTeams={isAdmin || session.user.role === 'MANAGER'}
        />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      </div>
    </div>
  );
}
