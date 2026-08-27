'use server';

import { revalidatePath } from 'next/cache';
import { put, del } from '@vercel/blob';
import { prisma } from '@/lib/prisma';
import { requireProjectMember } from '@/lib/actions/tasks';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function uploadAttachment(taskId: string, formData: FormData) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { success: false, error: 'Task not found' };
  if (task.deletedAt) return { success: false, error: 'This task is in the trash. Restore it first.' };

  const session = await requireProjectMember(task.projectId);

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: 'Choose a file to upload' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: 'Files must be 10MB or smaller' };
  }

  const pathname = `tasks/${taskId}/${Date.now()}-${file.name}`;
  // addRandomSuffix: the pathname above is built from a non-secret taskId and a millisecond
  // timestamp, so without it the blob's URL is guessable by anyone who can narrow down the
  // upload time. downloadUrl (not the plain inline url) forces Content-Disposition: attachment,
  // so an uploaded .html/.svg can't execute script by being opened directly in a tab.
  const blob = await put(pathname, file, { access: 'public', addRandomSuffix: true });

  const attachment = await prisma.attachment.create({
    data: {
      taskId,
      uploadedById: session.user.id,
      fileName: file.name,
      fileUrl: blob.downloadUrl,
      filePathname: blob.pathname,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
    },
  });

  revalidatePath(`/projects/${task.projectId}`);
  return {
    success: true,
    attachment: {
      id: attachment.id,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      createdAt: attachment.createdAt.toISOString(),
      uploadedByName: session.user.name,
      uploadedById: session.user.id,
    },
  };
}

export async function deleteAttachment(attachmentId: string) {
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId }, include: { task: true } });
  if (!attachment) return { success: false, error: 'Attachment not found' };

  const session = await requireProjectMember(attachment.task.projectId);
  const canDelete =
    session.user.id === attachment.uploadedById || session.user.role === 'ADMIN' || session.user.role === 'MANAGER';
  if (!canDelete) {
    return { success: false, error: 'Only the uploader, a manager, or an admin can remove this file' };
  }

  await del(attachment.filePathname).catch(() => {
    // The blob may already be gone; don't let that block removing the DB record.
  });
  await prisma.attachment.delete({ where: { id: attachmentId } });

  revalidatePath(`/projects/${attachment.task.projectId}`);
  return { success: true };
}
