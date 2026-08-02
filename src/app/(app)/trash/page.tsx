import { getMyTrash } from '@/lib/actions/trash';
import { TRASH_RETENTION_DAYS } from '@/lib/trash';
import { TrashList } from '@/components/TrashList';

export default async function TrashPage() {
  const entries = await getMyTrash();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Trash</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Tasks you&apos;ve deleted. Restore them or delete them for good — anything left here is automatically purged
        after {TRASH_RETENTION_DAYS} days.
      </p>

      <div className="mt-6">
        <TrashList entries={entries} />
      </div>
    </div>
  );
}
