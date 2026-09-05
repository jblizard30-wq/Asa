import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { applyNavPreferences, buildNavGroups, getVisibleNavDefs } from '@/lib/navItems';
import { NavSettingsPanel } from '@/components/NavSettingsPanel';

export default async function SettingsNavigationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/sign-in');

  const isAdmin = session.user.role === 'ADMIN';
  const canManageTeams = isAdmin || session.user.role === 'MANAGER';

  const navPreferences = await prisma.navPreference.findMany({ where: { userId: session.user.id } });
  const visibleDefs = getVisibleNavDefs({ isAdmin, canManageTeams });
  const items = applyNavPreferences(visibleDefs, navPreferences);
  const groups = buildNavGroups(visibleDefs, navPreferences).map((g) => ({
    name: g.name,
    order: g.order,
    items: g.items.map((i) => ({
      key: i.key,
      label: i.label,
      href: i.href,
      hidden: i.hidden,
      groupName: i.groupName,
    })),
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Navigation</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Customize your left navigation panel &mdash; create custom sections, drag to reorder or re-group items, and toggle visibility.
      </p>

      <div className="mt-6 max-w-2xl">
        <NavSettingsPanel initialItems={items} initialGroups={groups} />
      </div>
    </div>
  );
}
