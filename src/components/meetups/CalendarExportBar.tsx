// src/components/meetups/CalendarExportBar.tsx
'use client';

import React, { useState } from 'react';
import {
  CalendarEventPayload,
  downloadICS,
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
  getOffice365CalendarUrl,
} from '@/lib/meetupCalendarExport';
import { CalendarIcon, DownloadIcon } from '@/components/MeetupIcons';

export function CalendarExportBar({ event }: { event: CalendarEventPayload }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 transition-colors"
      >
        <CalendarIcon className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
        <span>Add to Calendar</span>
        <span className="text-[10px] text-slate-400">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-1 w-52 origin-top-right rounded-xl border border-slate-200 bg-white p-1 shadow-lg ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/60">
            <a
              href={getGoogleCalendarUrl(event)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-100 text-[11px] font-bold text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                G
              </span>
              <span>Google Calendar</span>
            </a>

            <a
              href={getOutlookCalendarUrl(event)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded bg-sky-100 text-[11px] font-bold text-sky-600 dark:bg-sky-900/50 dark:text-sky-400">
                O
              </span>
              <span>Outlook (Live / Hotmail)</span>
            </a>

            <a
              href={getOffice365CalendarUrl(event)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded bg-indigo-100 text-[11px] font-bold text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
                365
              </span>
              <span>Microsoft 365 Work</span>
            </a>

            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

            <button
              type="button"
              onClick={() => {
                downloadICS(event);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <DownloadIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span>Download iCal / .ics file</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

