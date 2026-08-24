'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireProjectMember } from '@/lib/actions/tasks';

export async function addTaskToProject(taskId: string, projectId: string, sectionId?: string) {
  await requireProjectMember(projectId);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true },
  });

  if (!task) {
    return { success: false, error: 'Task not found' };
  }

  // If it's already the task's primary project, nothing to do
  if (task.projectId === projectId) {
    return { success: true };
  }

  // Find a default section in target project if sectionId is not specified
  let targetSectionId = sectionId;
  if (!targetSectionId) {
    const firstSection = await prisma.section.findFirst({
      where: { projectId },
      orderBy: { order: 'asc' },
      select: { id: true },
    });
    targetSectionId = firstSection?.id;
  }

  await prisma.taskProject.upsert({
    where: {
      taskId_projectId: {
        taskId,
        projectId,
      },
    },
    update: {
      sectionId: targetSectionId,
    },
    create: {
      taskId,
      projectId,
      sectionId: targetSectionId,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${task.projectId}`);
  return { success: true };
}

export async function removeTaskFromProject(taskId: string, projectId: string) {
  await requireProjectMember(projectId);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true },
  });

  if (!task) {
    return { success: false, error: 'Task not found' };
  }

  // Cannot remove from the primary project via multi-homing delete
  if (task.projectId === projectId) {
    return { success: false, error: 'Cannot remove a task from its primary project. Change its primary project or delete the task.' };
  }

  await prisma.taskProject.deleteMany({
    where: {
      taskId,
      projectId,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${task.projectId}`);
  return { success: true };
}

export async function getTaskProjectMemberships(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      projectId: true,
      project: { select: { id: true, name: true } },
      extraProjects: {
        select: {
          id: true,
          projectId: true,
          project: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!task) return [];

  return [
    { id: task.project.id, name: task.project.name, isPrimary: true },
    ...task.extraProjects.map((ep) => ({
      id: ep.project.id,
      name: ep.project.name,
      isPrimary: false,
      sectionName: ep.section?.name,
    })),
  ];
}
