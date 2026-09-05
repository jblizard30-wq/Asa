import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isModuleEnabled } from '@/lib/modules';

export default async function XpLayout({ children }: { children: React.ReactNode }) {
  if (!isModuleEnabled('xp')) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/sign-in');
  }

  return <div className="space-y-6">{children}</div>;
}
