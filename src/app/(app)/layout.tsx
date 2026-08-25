import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { applyNavPreferences, getVisibleNavDefs } from '@/lib/navItems';
import { ORG_NAME } from '@/lib/site';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/sign-in');

  const isAdmin = session.user.role === 'ADMIN';
  const canManageTeams = isAdmin || session.user.role === 'MANAGER';

  const [notifications, projects, folders, navPreferences] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.project.findMany({
      where: isAdmin
        ? { isPersonal: false }
        : { isPersonal: false, members: { some: { userId: session.user.id } } },
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
    prisma.navPreference.findMany({ where: { userId: session.user.id } }),
  ]);

  const navItems = applyNavPreferences(getVisibleNavDefs({ isAdmin, canManageTeams }), navPreferences).filter(
    (item) => !item.hidden
  );

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
        orgName={ORG_NAME}
      />
      <div className="flex flex-1">
        <Sidebar folders={sidebarFolders} ungroupedProjects={ungroupedProjects} navItems={navItems} />
        <main className="flex min-w-0 w-full flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}
