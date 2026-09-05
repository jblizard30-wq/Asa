// src/components/meetups/ShareLinkButton.tsx
'use client';

import React, { useState } from 'react';
import { Share2Icon, CheckIcon } from '@/components/MeetupIcons';
import { generateShareLink } from '@/lib/actions/meetups';

export function ShareLinkButton({ meetupId }: { meetupId: string }) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    setLoading(true);
    const result = await generateShareLink(meetupId);
    setLoading(false);

    if (result.success) {
      const fullUrl = `${window.location.origin}${result.url}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 transition-colors"
    >
      {copied ? (
        <>
          <CheckIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied Guest Link!</span>
        </>
      ) : (
        <>
          <Share2Icon className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
          <span>{loading ? 'Creating Link…' : 'Share with Guests'}</span>
        </>
      )}
    </button>
  );
}

