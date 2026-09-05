import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { isModuleEnabled } from '@/lib/modules';
import { InventoryNav } from '@/components/InventoryNav';

export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  if (!isModuleEnabled('inventory')) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/sign-in');
  }

  const canManage = session.user.role === 'ADMIN' || session.user.role === 'MANAGER';

  return (
    <div className="space-y-6">
      <InventoryNav canManage={canManage} />
      <div>{children}</div>
    </div>
  );
}
