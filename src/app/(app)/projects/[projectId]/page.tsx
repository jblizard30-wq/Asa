import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ProjectView } from '@/components/ProjectView';

export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/sign-in');

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: {
      members: { include: { user: true } },
      customFields: {
        orderBy: { order: 'asc' },
        include: { options: { orderBy: { order: 'asc' } } },
      },
      tags: { orderBy: { order: 'asc' } },
      sections: {
        orderBy: { order: 'asc' },
        include: {
          tasks: {
            where: { parentTaskId: null, deletedAt: null },
            orderBy: { order: 'asc' },
            include: {
              assignee: true,
              fieldValues: true,
              tags: { orderBy: { order: 'asc' } },
              predecessor: { select: { id: true, title: true, status: true } },
              subtasks: {
                where: { deletedAt: null },
                orderBy: { order: 'asc' },
                include: { assignee: true },
              },
            },
          },
        },
      },
    },
  });

  if (!project) notFound();

  const isMember = project.members.some((m) => m.userId === session.user.id);
  if (!isMember && session.user.role !== 'ADMIN') {
    redirect('/projects');
  }

  return (
    <ProjectView
      projectId={project.id}
      projectName={project.name}
      description={project.description}
      isAdmin={session.user.role === 'ADMIN'}
      members={project.members.map((m) => ({ id: m.user.id, name: m.user.name }))}
      customFields={project.customFields.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        order: f.order,
        options: f.options.map((o) => ({ id: o.id, label: o.label })),
      }))}
      tags={project.tags.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
      sections={project.sections.map((s) => ({
        id: s.id,
        name: s.name,
        order: s.order,
        tasks: s.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          status: t.status,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          assigneeId: t.assigneeId,
          assigneeName: t.assignee?.name ?? null,
          recurrence: t.recurrence,
          recurrenceInterval: t.recurrenceInterval,
          recurrenceEndDate: t.recurrenceEndDate ? t.recurrenceEndDate.toISOString() : null,
          locked: Boolean(t.predecessor && t.predecessor.status !== 'DONE'),
          predecessorTitle: t.predecessor?.title ?? null,
          tags: t.tags.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })),
          fieldValues: t.fieldValues.map((v) => ({
            customFieldId: v.customFieldId,
            textValue: v.textValue,
            numberValue: v.numberValue,
            dateValue: v.dateValue ? v.dateValue.toISOString() : null,
            boolValue: v.boolValue,
            optionId: v.optionId,
          })),
          subtasks: t.subtasks.map((st) => ({
            id: st.id,
            title: st.title,
            status: st.status,
            priority: st.priority,
            dueDate: st.dueDate ? st.dueDate.toISOString() : null,
            assigneeId: st.assigneeId,
            assigneeName: st.assignee?.name ?? null,
          })),
        })),
      }))}
    />
  );
}
