import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toTaskRecurrenceInfo } from '@/lib/recurrence';
import { MyTasksWorkspace, type MyTask, type TaskSource } from '@/components/MyTasksWorkspace';

const taskInclude = {
  project: true,
  section: true,
  tags: { orderBy: { order: 'asc' as const } },
  assignees: { select: { id: true, name: true } },
  taskRecurrence: true,
  blockedBy: { include: { blocker: { select: { title: true, status: true } } } },
  subtasks: {
    where: { deletedAt: null },
    orderBy: { order: 'asc' as const },
    include: { assignees: { select: { id: true, name: true } } },
  },
};

export default async function MyTasksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const userId = session.user.id;

  const [assignedRaw, personalProject] = await Promise.all([
    prisma.task.findMany({
      // Exclude subtasks here — every other top-level task list in this codebase filters
      // parentTaskId: null (see projects/[projectId]/page.tsx, automations.ts, etc.) so that
      // subtasks only surface nested under their parent's `subtasks` include. Without this,
      // a subtask assigned directly to the user would show up twice: once as its own
      // top-level row here, and again nested under its parent (if the parent is also assigned
      // to / owned by the user).
      where: { assignees: { some: { id: userId } }, deletedAt: null, parentTaskId: null },
      include: taskInclude,
    }),
    prisma.project.findFirst({
      where: { createdById: userId, isPersonal: true },
      select: { id: true },
    }),
  ]);

  const personalRaw = personalProject
    ? await prisma.task.findMany({
        where: { projectId: personalProject.id, deletedAt: null, parentTaskId: null },
        include: taskInclude,
      })
    : [];

  // Merge by task id, tagging which bucket(s) each task came from — a personal task
  // the user also assigned to themself carries both sources, de-duped to one row.
  const bySource = new Map<string, { task: (typeof assignedRaw)[number]; sources: Set<TaskSource> }>();
  for (const t of assignedRaw) bySource.set(t.id, { task: t, sources: new Set<TaskSource>(['assigned']) });
  for (const t of personalRaw) {
    const existing = bySource.get(t.id);
    if (existing) existing.sources.add('personal');
    else bySource.set(t.id, { task: t, sources: new Set<TaskSource>(['personal']) });
  }
  const merged = [...bySource.values()];

  // Sort by due date ascending with nulls last, then by priority.
  const priorityRank: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  merged.sort((a, b) => {
    if (a.task.dueDate && b.task.dueDate) return a.task.dueDate.getTime() - b.task.dueDate.getTime();
    if (a.task.dueDate) return -1;
    if (b.task.dueDate) return 1;
    return priorityRank[a.task.priority] - priorityRank[b.task.priority];
  });

  const tasks: MyTask[] = merged.map(({ task: t, sources }) => ({
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
    sources: [...sources],
    taskRecurrence: toTaskRecurrenceInfo(t.taskRecurrence),
    locked: t.blockedBy.some((d) => d.blocker.status !== 'DONE'),
    blockedByTitles: t.blockedBy.filter((d) => d.blocker.status !== 'DONE').map((d) => d.blocker.title),
    subtasks: t.subtasks.map((st) => ({
      id: st.id,
      title: st.title,
      status: st.status,
      priority: st.priority,
      dueDate: st.dueDate ? st.dueDate.toISOString() : null,
      assigneeIds: st.assignees.map((a) => a.id),
      assigneeNames: st.assignees.map((a) => a.name),
    })),
  }));

  // Grid view needs each touched project's own members/tags — tags in particular are
  // project-scoped vocabulary, so a cross-project grid must not offer Project A's tags
  // when editing a Project B task.
  const projectIds = [...new Set(tasks.map((t) => t.projectId))];
  const projectsMeta = projectIds.length
    ? await prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: {
          id: true,
          members: { include: { user: { select: { id: true, name: true } } } },
          tags: { orderBy: { order: 'asc' } },
        },
      })
    : [];

  const membersByProjectId = Object.fromEntries(
    projectsMeta.map((p) => [p.id, p.members.map((m) => ({ id: m.user.id, name: m.user.name }))]),
  );
  const tagsByProjectId = Object.fromEntries(
    projectsMeta.map((p) => [p.id, p.tags.map((t) => ({ id: t.id, name: t.name, color: t.color }))]),
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">My Tasks</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Everything assigned to you across every project, plus your personal tasks — filter between them or view them together.
      </p>

      <div className="mt-6">
        <MyTasksWorkspace
          tasks={tasks}
          membersByProjectId={membersByProjectId}
          tagsByProjectId={tagsByProjectId}
          hasPersonalProject={!!personalProject}
        />
      </div>
    </div>
  );
}
