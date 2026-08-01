import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Navbar } from '@/components/Navbar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/sign-in');

  const notifications = await prisma.notification.findMany({
    where: { recipientId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return (
    <div className="min-h-screen bg-slate-50">
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
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
