import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllTrash } from '@/lib/actions/trash';
import { TRASH_RETENTION_DAYS } from '@/lib/trash';
import { AdminTrashList } from '@/components/AdminTrashList';

export default async function AdminTrashPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/sign-in');
  if (session.user.role !== 'ADMIN') redirect('/trash');

  const entries = await getAllTrash();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">All Trash</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Deleted tasks from every user, across every project. Restoring a task requires confirming its details first
        since it isn&apos;t yours. Anything here is automatically purged after {TRASH_RETENTION_DAYS} days.
      </p>

      <div className="mt-6">
        <AdminTrashList entries={entries} />
      </div>
    </div>
  );
}
