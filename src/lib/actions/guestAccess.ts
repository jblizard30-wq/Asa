'use server';

import crypto from 'crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/permissions';
import { requireProjectMember } from '@/lib/actions/tasks';
import { dispatchWebhooks } from '@/lib/webhooks/dispatch';

async function requireGuestLinkAccess(taskId: string) {
  const session = await requireSession();
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { session, task: null };

  // A guest link exposes the task's title/description/comments to anyone with the URL, so
  // creating/listing/revoking one needs the same project-membership check as touching the task
  // itself — MANAGER doesn't get a blanket org-wide bypass here the way it does for permissions
  // scoped to a resource within a project the actor is already confirmed a member of.
  if (session.user.role !== 'ADMIN') {
    await requireProjectMember(task.projectId);
  }
  return { session, task };
}

export async function createGuestLink(taskId: string, requiresRsvp: boolean = false) {
  const { session, task } = await requireGuestLinkAccess(taskId);
  if (!task) return { success: false as const, error: 'Task not found.' };

  const token = crypto.randomBytes(24).toString('base64url');
  await prisma.taskGuestLink.create({
    data: { taskId, token, requiresRsvp, createdById: session.user.id },
  });

  revalidatePath(`/projects/${task.projectId}`);
  return { success: true as const, path: `/guest/${token}` };
}

export async function listGuestLinks(taskId: string) {
  const { task } = await requireGuestLinkAccess(taskId);
  if (!task) return [];

  const links = await prisma.taskGuestLink.findMany({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
  });

  return links.map((link) => ({
    id: link.id,
    path: `/guest/${link.token}`,
    canComment: link.canComment,
    requiresRsvp: link.requiresRsvp,
    rsvpStatus: link.rsvpStatus,
    rsvpAt: link.rsvpAt?.toISOString() ?? null,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    revokedAt: link.revokedAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
  }));
}

export async function revokeGuestLink(id: string) {
  const session = await requireSession();
  const link = await prisma.taskGuestLink.findUnique({ where: { id }, include: { task: true } });
  if (!link) return { success: false, error: 'Guest link not found.' };

  if (session.user.role !== 'ADMIN') {
    await requireProjectMember(link.task.projectId);
  }

  await prisma.taskGuestLink.update({ where: { id }, data: { revokedAt: new Date() } });
  revalidatePath(`/projects/${link.task.projectId}`);
  return { success: true };
}

export async function respondToGuestRsvp(token: string, rsvpStatus: 'ACCEPTED' | 'DECLINED') {
  const link = await prisma.taskGuestLink.findUnique({
    where: { token },
    include: { task: true },
  });

  if (!link || link.revokedAt || (link.expiresAt && link.expiresAt < new Date())) {
    return { success: false as const, error: 'This link is no longer active.' };
  }

  await prisma.taskGuestLink.update({
    where: { id: link.id },
    data: {
      rsvpStatus,
      rsvpAt: new Date(),
    },
  });

  revalidatePath(`/guest/${token}`);
  revalidatePath(`/projects/${link.task.projectId}`);
  return { success: true as const, rsvpStatus };
}

export async function getTaskForGuest(token: string) {
  const link = await prisma.taskGuestLink.findUnique({
    where: { token },
    include: {
      task: {
        include: {
          comments: { include: { user: true }, orderBy: { createdAt: 'asc' } },
          guestComments: { orderBy: { createdAt: 'asc' } },
        },
      },
    },
  });

  if (!link) return null;
  if (link.revokedAt) return null;
  if (link.expiresAt && link.expiresAt < new Date()) return null;

  return {
    canComment: link.canComment,
    requiresRsvp: link.requiresRsvp,
    rsvpStatus: link.rsvpStatus,
    rsvpAt: link.rsvpAt?.toISOString() ?? null,
    task: {
      id: link.task.id,
      title: link.task.title,
      description: link.task.description,
      status: link.task.status,
      priority: link.task.priority,
      dueDate: link.task.dueDate?.toISOString() ?? null,
    },
    comments: [
      ...link.task.comments.map((c) => ({
        id: c.id,
        author: c.user.name,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
        isGuest: false as const,
      })),
      ...link.task.guestComments.map((c) => ({
        id: c.id,
        author: c.guestName,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
        isGuest: true as const,
      })),
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}


const addGuestCommentSchema = z.object({
  guestName: z.string().min(1, 'Name is required').max(120),
  body: z.string().min(1, 'Comment cannot be empty').max(4000),
});

export async function addGuestComment(token: string, guestName: string, body: string) {
  const parsed = addGuestCommentSchema.safeParse({ guestName, body });
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const link = await prisma.taskGuestLink.findUnique({ where: { token } });
  if (!link || link.revokedAt || (link.expiresAt && link.expiresAt < new Date())) {
    return { success: false as const, error: 'This link is no longer active.' };
  }
  if (!link.canComment) {
    return { success: false as const, error: 'Comments are disabled on this link.' };
  }

  const comment = await prisma.guestComment.create({
    data: {
      guestLinkId: link.id,
      taskId: link.taskId,
      guestName: parsed.data.guestName,
      body: parsed.data.body,
    },
  });

  void dispatchWebhooks('COMMENT_ADDED', {
    taskId: link.taskId,
    guestName: parsed.data.guestName,
    body: parsed.data.body,
  });

  return {
    success: true as const,
    comment: {
      id: comment.id,
      author: comment.guestName,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      isGuest: true as const,
    },
  };
}
