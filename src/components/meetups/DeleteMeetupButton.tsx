// src/components/meetups/DeleteMeetupButton.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrashIcon } from '@/components/MeetupIcons';
import { deleteMeetup } from '@/lib/actions/meetups';

export function DeleteMeetupButton({
  meetupId,
  meetupTitle,
  redirectTo = '/meetups',
  variant = 'button',
  className = '',
  onDeleted,
}: {
  meetupId: string;
  meetupTitle?: string;
  redirectTo?: string | null;
  variant?: 'button' | 'icon';
  className?: string;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const title = meetupTitle ? `"${meetupTitle}"` : 'this meetup';
    if (!window.confirm(`Are you sure you want to delete ${title}? This cannot be undone.`)) {
      return;
    }

    setLoading(true);
    const result = await deleteMeetup(meetupId);
    setLoading(false);

    if (result.success) {
      if (onDeleted) {
        onDeleted();
      }
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    } else {
      alert(result.error || 'Failed to delete meetup.');
    }
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        className={`p-1 text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 transition-colors disabled:opacity-50 ${className}`}
        title="Delete meetup"
        aria-label={`Delete meetup ${meetupTitle || ''}`}
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 shadow-sm hover:bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50 transition-colors disabled:opacity-50 ${className}`}
    >
      <TrashIcon className="h-3.5 w-3.5" />
      <span>{loading ? 'Deleting…' : 'Delete Meetup'}</span>
    </button>
  );
}
