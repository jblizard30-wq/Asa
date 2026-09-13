import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/modules';
import { MyTasksList } from '@/components/MyTasksList';

export default async function MyTasksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const onboardingEnabled = isModuleEnabled('onboarding');

  // Exclude subtasks here — every other top-level task list in this codebase filters
  // parentTaskId: null (see projects/[projectId]/page.tsx, automations.ts, etc.) so that
  // subtasks only surface nested under their parent's `subtasks` include. Without this,
  // a subtask assigned directly to the user would show up twice: once as its own
  // top-level row here, and again nested under its parent (if the parent is also assigned
  // to / owned by the user).
  const [tasksRaw, onboardingItemsRaw] = await Promise.all([
    prisma.task.findMany({
      where: { assignees: { some: { id: session.user.id } }, deletedAt: null, parentTaskId: null },
      include: {
        project: true,
        section: true,
        tags: { orderBy: { order: 'asc' } },
        assignees: { select: { id: true, name: true } },
      },
    }),
    onboardingEnabled
      ? prisma.onboardingCaseItem.findMany({
          where: { assignedToUserId: session.user.id },
          include: {
            case: { select: { personName: true } },
            assignedTo: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const mappedTasks = tasksRaw.map((t) => ({
    id: t.id,
    source: 'task' as const,
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
    rawDueDate: t.dueDate,
    rawCreatedAt: t.createdAt,
  }));

  const mappedOnboarding = onboardingItemsRaw.map((item) => ({
    id: item.id,
    source: 'onboarding' as const,
    title: item.title,
    description: item.description ?? null,
    status: item.completedAt !== null ? 'DONE' : 'TODO',
    dueDate: null,
    projectName: `Onboarding: ${item.case.personName}`,
    sectionName: '',
    assigneeIds: item.assignedToUserId ? [item.assignedToUserId] : [],
    assigneeNames: item.assignedTo?.name ? [item.assignedTo.name] : [],
    tags: [],
    rawDueDate: null,
    rawCreatedAt: item.createdAt,
  }));

  // Sort by due date ascending with nulls last, then by createdAt ascending as the tiebreak.
  const allTasks = [...mappedTasks, ...mappedOnboarding].sort((a, b) => {
    if (a.rawDueDate && b.rawDueDate) {
      const diff = a.rawDueDate.getTime() - b.rawDueDate.getTime();
      if (diff !== 0) return diff;
    } else if (a.rawDueDate) {
      return -1;
    } else if (b.rawDueDate) {
      return 1;
    }
    return a.rawCreatedAt.getTime() - b.rawCreatedAt.getTime();
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">My Tasks</h1>
      <p className="mt-1 text-sm text-slate-500">
        Everything assigned to you, across every project, sorted by due date.
      </p>

      <div className="mt-6">
        <MyTasksList
          tasks={allTasks.map(({ rawDueDate, rawCreatedAt, ...task }) => task)}
        />
      </div>
    </div>
  );
}
