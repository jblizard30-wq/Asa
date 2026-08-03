import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MyTasksList } from '@/components/MyTasksList';

export default async function MyTasksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const tasksRaw = await prisma.task.findMany({
    where: { assigneeId: session.user.id, status: { not: 'DONE' }, deletedAt: null },
    include: { project: true, section: true, tags: { orderBy: { order: 'asc' } } },
  });

  // Sort by due date ascending with nulls last, then by priority.
  const priorityRank: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const tasks = [...tasksRaw].sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return priorityRank[a.priority] - priorityRank[b.priority];
  });

  const doneCount = await prisma.task.count({
    where: { assigneeId: session.user.id, status: 'DONE', deletedAt: null },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">My Tasks</h1>
      <p className="mt-1 text-sm text-slate-500">
        Everything assigned to you, across every project, sorted by due date.
      </p>

      <div className="mt-6">
        <MyTasksList
          tasks={tasks.map((t) => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            status: t.status,
            dueDate: t.dueDate ? t.dueDate.toISOString() : null,
            projectId: t.projectId,
            projectName: t.project.name,
            sectionName: t.section.name,
            tags: t.tags.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })),
          }))}
        />
      </div>

      {doneCount > 0 && (
        <p className="mt-6 text-xs text-slate-400">
          {doneCount} completed {doneCount === 1 ? 'task is' : 'tasks are'} hidden from this view.
        </p>
      )}
    </div>
  );
}
