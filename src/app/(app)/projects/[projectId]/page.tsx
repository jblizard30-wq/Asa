import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toTaskRecurrenceInfo } from '@/lib/recurrence';
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
              assignees: { select: { id: true, name: true } },
              taskRecurrence: true,
              fieldValues: true,
              tags: { orderBy: { order: 'asc' } },
              blockedBy: { include: { blocker: { select: { id: true, title: true, status: true } } } },
              subtasks: {
                where: { deletedAt: null },
                orderBy: { order: 'asc' },
                include: { assignees: { select: { id: true, name: true } } },
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

  const memberIds = project.members.map((m) => m.userId);
  const teamMemberships = memberIds.length
    ? await prisma.teamMember.findMany({
        where: { userId: { in: memberIds } },
        include: { team: { select: { id: true, name: true } } },
      })
    : [];

  const teamsById = new Map<string, string>();
  const memberTeamIds: Record<string, string[]> = {};
  for (const membership of teamMemberships) {
    teamsById.set(membership.team.id, membership.team.name);
    (memberTeamIds[membership.userId] ??= []).push(membership.team.id);
  }
  const teams = [...teamsById.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ProjectView
      projectId={project.id}
      projectName={project.name}
      description={project.description}
      isAdmin={session.user.role === 'ADMIN'}
      members={project.members.map((m) => ({ id: m.user.id, name: m.user.name, isManager: m.isManager, role: m.user.role }))}
      teams={teams}
      memberTeamIds={memberTeamIds}
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
          description: t.description,
          priority: t.priority,
          status: t.status,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          assigneeIds: t.assignees.map((a) => a.id),
          assigneeNames: t.assignees.map((a) => a.name),
          taskRecurrence: toTaskRecurrenceInfo(t.taskRecurrence),
          locked: t.blockedBy.some((d) => d.blocker.status !== 'DONE'),
          blockedByTitles: t.blockedBy.filter((d) => d.blocker.status !== 'DONE').map((d) => d.blocker.title),
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
            assigneeIds: st.assignees.map((a) => a.id),
            assigneeNames: st.assignees.map((a) => a.name),
          })),
        })),
      }))}
    />
  );
}
