'use client';

import { useMemo, useState } from 'react';
import { addDays, differenceInCalendarDays, endOfWeek, format, isSameMonth, isToday, startOfWeek } from 'date-fns';
import type { KanbanSection, KanbanTask } from '@/components/KanbanBoard';
import { STATUS_BAR_COLORS, STATUS_LABELS } from '@/lib/format';
import { TaskDetailModal } from '@/components/TaskDetailModal';

const DAY_WIDTH = 32;
const RANGE_PADDING_DAYS = 3;

interface TimelineRow {
  sectionId: string;
  sectionName: string;
  task: KanbanTask;
  start: Date;
  end: Date;
}

/** Bars need at least one endpoint to place on the axis — start falls back to due, and vice versa. */
function barBounds(task: KanbanTask): { start: Date; end: Date } | null {
  const start = task.startDate ? new Date(task.startDate) : task.dueDate ? new Date(task.dueDate) : null;
  const end = task.dueDate ? new Date(task.dueDate) : task.startDate ? new Date(task.startDate) : null;
  if (!start || !end) return null;
  return start <= end ? { start, end } : { start: end, end: start };
}

export function TimelineView({ sections }: { projectId: string; sections: KanbanSection[]; filtersActive?: boolean }) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const { rows, unscheduledCount, rangeStart, days } = useMemo(() => {
    const rows: TimelineRow[] = [];
    let unscheduledCount = 0;

    for (const section of sections) {
      for (const task of section.tasks) {
        const bounds = barBounds(task);
        if (!bounds) {
          unscheduledCount += 1;
          continue;
        }
        rows.push({ sectionId: section.id, sectionName: section.name, task, ...bounds });
      }
    }

    if (rows.length === 0) {
      return { rows, unscheduledCount, rangeStart: startOfWeek(new Date()), days: [] as Date[] };
    }

    const earliest = rows.reduce((min, r) => (r.start < min ? r.start : min), rows[0].start);
    const latest = rows.reduce((max, r) => (r.end > max ? r.end : max), rows[0].end);
    const rangeStart = startOfWeek(addDays(earliest, -RANGE_PADDING_DAYS));
    const rangeEnd = endOfWeek(addDays(latest, RANGE_PADDING_DAYS));
    const totalDays = differenceInCalendarDays(rangeEnd, rangeStart) + 1;
    const days = Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i));

    return { rows, unscheduledCount, rangeStart, days };
  }, [sections]);

  const sectionOrder = useMemo(() => {
    const seen = new Map<string, string>();
    for (const section of sections) seen.set(section.id, section.name);
    return seen;
  }, [sections]);

  const rowsBySection = useMemo(() => {
    const map = new Map<string, TimelineRow[]>();
    for (const row of rows) {
      const list = map.get(row.sectionId) ?? [];
      list.push(row);
      map.set(row.sectionId, list);
    }
    return map;
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        No tasks with a start or due date yet — set one from a task's detail view to see it on the timeline.
      </div>
    );
  }

  const totalWidth = days.length * DAY_WIDTH;

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <div style={{ minWidth: totalWidth + 200 }}>
          <div className="flex border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
            <div className="w-[200px] shrink-0 border-r border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              Task
            </div>
            <div className="flex">
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  style={{ width: DAY_WIDTH }}
                  className={`shrink-0 border-r border-slate-100 px-0.5 py-2 text-center text-[10px] dark:border-slate-800 ${
                    isToday(day)
                      ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                      : 'text-slate-400 dark:text-slate-500'
                  } ${day.getDate() === 1 || (!isSameMonth(day, addDays(day, -1)) && day.getTime() !== rangeStart.getTime()) ? 'border-l-2 border-l-slate-300 dark:border-l-slate-700' : ''}`}
                  title={format(day, 'EEEE, MMM d')}
                >
                  <div>{format(day, 'd')}</div>
                  {(day.getDate() === 1 || day === days[0]) && (
                    <div className="text-[9px] font-medium text-slate-500 dark:text-slate-400">{format(day, 'MMM')}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {[...sectionOrder.entries()].map(([sectionId, sectionName]) => {
            const sectionRows = rowsBySection.get(sectionId);
            if (!sectionRows || sectionRows.length === 0) return null;
            return (
              <div key={sectionId}>
                <div className="border-b border-slate-200 bg-slate-50/60 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300">
                  {sectionName}
                </div>
                {sectionRows.map((row) => {
                  const left = differenceInCalendarDays(row.start, rangeStart) * DAY_WIDTH;
                  const width = (differenceInCalendarDays(row.end, row.start) + 1) * DAY_WIDTH;
                  return (
                    <div key={row.task.id} className="flex border-b border-slate-100 last:border-b-0 dark:border-slate-800/60">
                      <div className="w-[200px] shrink-0 truncate border-r border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200">
                        <button onClick={() => setOpenTaskId(row.task.id)} className="truncate text-left hover:underline" title={row.task.title}>
                          {row.task.title}
                        </button>
                      </div>
                      <div className="relative py-2" style={{ width: totalWidth, height: 36 }}>
                        <button
                          onClick={() => setOpenTaskId(row.task.id)}
                          style={{ left, width: Math.max(width, DAY_WIDTH * 0.6) }}
                          className={`absolute top-1/2 h-4 -translate-y-1/2 rounded-full ${STATUS_BAR_COLORS[row.task.status] ?? 'bg-slate-400'} opacity-90 hover:opacity-100`}
                          title={`${row.task.title} · ${STATUS_LABELS[row.task.status] ?? row.task.status} · ${format(row.start, 'MMM d')} – ${format(row.end, 'MMM d')}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {unscheduledCount > 0 && (
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          {unscheduledCount} task{unscheduledCount === 1 ? '' : 's'} without a start or due date not shown.
        </p>
      )}

      {openTaskId && <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </div>
  );
}
