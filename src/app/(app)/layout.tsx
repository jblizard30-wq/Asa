import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { applyNavPreferences, buildNavGroups, getVisibleNavDefs } from '@/lib/navItems';
import { isModuleEnabled, type ModuleKey } from '@/lib/modules';
import { ORG_NAME } from '@/lib/site';

import { ToastProvider } from '@/components/Toast';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/sign-in');

  const isAdmin = session.user.role === 'ADMIN';
  const canManageTeams = isAdmin || session.user.role === 'MANAGER';

  const [notifications, projects, folders, navPreferences, childProtectionShare] = await Promise.all([
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
    isAdmin || !isModuleEnabled('child_protection')
      ? Promise.resolve(null)
      : prisma.childProtectionShare.findFirst({
          where: {
            OR: [
              { userId: session.user.id },
              { team: { members: { some: { userId: session.user.id } } } },
            ],
          },
          select: { id: true },
        }),
  ]);

  const sharedModules = new Set<ModuleKey>();
  if (childProtectionShare) {
    sharedModules.add('child_protection');
  }

  const visibleDefs = getVisibleNavDefs({ isAdmin, canManageTeams, sharedModules });
  const navItems = applyNavPreferences(visibleDefs, navPreferences).filter((item) => !item.hidden);
  const navGroups = buildNavGroups(visibleDefs, navPreferences)
    .map((group) => ({
      name: group.name,
      items: group.items.filter((item) => !item.hidden),
    }))
    .filter((group) => group.items.length > 0);

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
    <ToastProvider>
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
          folders={sidebarFolders}
          ungroupedProjects={ungroupedProjects}
          navItems={navItems}
          navGroups={navGroups}
        />
        <div className="flex flex-1">
          <Sidebar folders={sidebarFolders} ungroupedProjects={ungroupedProjects} navItems={navItems} navGroups={navGroups} />
          <main className="flex min-w-0 w-full flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8 print:max-w-none print:p-0">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
