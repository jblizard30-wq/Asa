'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';

const addCommentSchema = z.object({
  body: z.string().min(1, 'Comment cannot be empty').max(4000),
});

export async function addComment(taskId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: 'Not authenticated' };

  const parsed = addCommentSchema.safeParse({ body: formData.get('body') });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { success: false, error: 'Task not found' };

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: task.projectId, userId: session.user.id } },
  });
  if (!membership && session.user.role !== 'ADMIN') {
    return { success: false, error: 'You are not a member of this project' };
  }

  const comment = await prisma.comment.create({
    data: { taskId, userId: session.user.id, body: parsed.data.body },
  });

  if (task.assigneeId) {
    await createNotification({
      type: 'COMMENT_ADDED',
      recipientId: task.assigneeId,
      actorId: session.user.id,
      message: `${session.user.name} commented on "${task.title}"`,
      link: `/projects/${task.projectId}?task=${task.id}`,
      emailSubject: `New comment on: ${task.title}`,
    });
  }

  revalidatePath(`/projects/${task.projectId}`);
  return { success: true, commentId: comment.id };
}
