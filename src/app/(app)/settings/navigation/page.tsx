import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { applyNavPreferences, getVisibleNavDefs } from '@/lib/navItems';
import { NavSettingsPanel } from '@/components/NavSettingsPanel';

export default async function SettingsNavigationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/sign-in');

  const isAdmin = session.user.role === 'ADMIN';
  const canManageTeams = isAdmin || session.user.role === 'MANAGER';

  const navPreferences = await prisma.navPreference.findMany({ where: { userId: session.user.id } });
  const items = applyNavPreferences(getVisibleNavDefs({ isAdmin, canManageTeams }), navPreferences);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Navigation</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Customize your navigation bar &mdash; drag to reorder items or hide the ones you don&apos;t use.
      </p>

      <div className="mt-6 max-w-xl">
        <NavSettingsPanel initialItems={items} />
      </div>
    </div>
  );
}
