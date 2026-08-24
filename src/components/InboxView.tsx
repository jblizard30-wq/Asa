'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  markNotificationRead,
  markAllNotificationsRead,
  toggleNotificationRead,
  deleteNotification,
} from '@/lib/actions/notifications';
import { TaskDetailModal } from '@/components/TaskDetailModal';

export interface InboxNotification {
  id: string;
  type: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
  actor: {
    id: string;
    name: string;
  } | null;
}

export function InboxView({ initialNotifications }: { initialNotifications: InboxNotification[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<'ALL' | 'UNREAD' | 'ASSIGNED' | 'MENTIONS'>('UNREAD');
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const unreadCount = initialNotifications.filter((n) => !n.read).length;

  const filteredNotifications = initialNotifications.filter((n) => {
    if (tab === 'UNREAD') return !n.read;
    if (tab === 'ASSIGNED') return n.type === 'TASK_ASSIGNED';
    if (tab === 'MENTIONS') return n.type === 'MENTIONED' || n.type === 'COMMENT_ADDED';
    return true;
  });

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  function handleToggleRead(id: string, currentRead: boolean) {
    startTransition(async () => {
      await toggleNotificationRead(id, !currentRead);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteNotification(id);
      router.refresh();
    });
  }

  function handleItemClick(notification: InboxNotification) {
    if (!notification.read) {
      void markNotificationRead(notification.id);
    }

    // If link contains taskId, e.g. /projects/proj-123?task=task-456 or #task-456
    if (notification.link) {
      const match = notification.link.match(/task[=/:]([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        setOpenTaskId(match[1]);
        return;
      }
      router.push(notification.link);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Inbox</h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Triage updates, task assignments, and mentions in one unified feed.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={isPending}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {[
          { key: 'UNREAD', label: `Unread (${unreadCount})` },
          { key: 'ALL', label: `All (${initialNotifications.length})` },
          { key: 'ASSIGNED', label: 'Assigned to me' },
          { key: 'MENTIONS', label: 'Mentions & Comments' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key as any)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm dark:divide-slate-800/80 dark:border-slate-800 dark:bg-slate-900">
        {filteredNotifications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-2 text-3xl">✨</div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Zero inbox!</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {tab === 'UNREAD' ? 'You have caught up on all notifications.' : 'No notifications in this category.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleItemClick(notification)}
              className={`group flex cursor-pointer items-start justify-between gap-4 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                !notification.read ? 'bg-brand-50/40 dark:bg-brand-950/20' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Unread indicator */}
                <div className="mt-1.5 flex h-2.5 w-2.5 shrink-0 items-center justify-center">
                  {!notification.read && <div className="h-2 w-2 rounded-full bg-brand-600" />}
                </div>

                {/* Actor Avatar */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  {notification.actor?.name ? notification.actor.name.charAt(0).toUpperCase() : '⚡'}
                </div>

                {/* Message & Meta */}
                <div>
                  <p className="text-sm text-slate-800 dark:text-slate-200">{notification.message}</p>
                  <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  title={notification.read ? 'Mark as unread' : 'Mark as read'}
                  onClick={() => handleToggleRead(notification.id, notification.read)}
                  className="rounded p-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  {notification.read ? 'Mark unread' : '✓ Mark read'}
                </button>
                <button
                  type="button"
                  title="Delete notification"
                  onClick={() => handleDelete(notification.id)}
                  className="rounded p-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {openTaskId && <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </div>
  );
}

