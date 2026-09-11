import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isModuleEnabled } from '@/lib/modules';
import { checkChildProtectionAccess } from '@/lib/childProtection';
import { listChildProtectionData } from '@/lib/actions/childProtection';
import { ChildProtectionGridClient } from '@/components/childProtection/ChildProtectionGridClient';

export default async function AdminChildProtectionPage() {
  if (!isModuleEnabled('child_protection')) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/sign-in');
  }

  const { allowed, access } = await checkChildProtectionAccess(session);
  if (!allowed || !access) {
    redirect('/my-tasks');
  }

  const result = await listChildProtectionData();

  if (!result.success || !result.data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
        <h2 className="text-lg font-bold">Unable to load Child Protection data</h2>
        <p className="mt-1 text-sm">{result.error || 'Failed to fetch compliance records.'}</p>
      </div>
    );
  }

  return (
    <ChildProtectionGridClient
      initialRecords={result.data.records}
      initialMetrics={result.data.metrics}
      userAccess={result.data.userAccess}
      availableProjects={result.data.availableProjects}
      assignableUsers={result.data.assignableUsers}
      isAdmin={session.user.role === 'ADMIN'}
    />
  );
}
