import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MyTasksList } from '@/components/MyTasksList';

export default async function MyTasksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  // Exclude subtasks here — every other top-level task list in this codebase filters
  // parentTaskId: null (see projects/[projectId]/page.tsx, automations.ts, etc.) so that
  // subtasks only surface nested under their parent's `subtasks` include. Without this,
  // a subtask assigned directly to the user would show up twice: once as its own
  // top-level row here, and again nested under its parent (if the parent is also assigned
  // to / owned by the user).
  const tasksRaw = await prisma.task.findMany({
    where: { assignees: { some: { id: session.user.id } }, deletedAt: null, parentTaskId: null },
    include: {
      project: true,
      section: true,
      tags: { orderBy: { order: 'asc' } },
      assignees: { select: { id: true, name: true } },
    },
  });

  // Sort by due date ascending with nulls last, then by priority.
  const priorityRank: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const tasks = [...tasksRaw].sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return priorityRank[a.priority] - priorityRank[b.priority];
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
            description: t.description,
            priority: t.priority,
            status: t.status,
            dueDate: t.dueDate ? t.dueDate.toISOString() : null,
            projectId: t.projectId,
            projectName: t.project.name,
            sectionName: t.section.name,
            assigneeIds: t.assignees.map((a) => a.id),
            assigneeNames: t.assignees.map((a) => a.name),
            tags: t.tags.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })),
          }))}
        />
      </div>
    </div>
  );
}
