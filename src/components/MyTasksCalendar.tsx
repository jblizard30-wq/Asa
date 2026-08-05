'use client';

import { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { PRIORITY_STYLES } from '@/lib/format';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import type { MyTask } from '@/components/MyTasksWorkspace';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_VISIBLE_PER_DAY = 3;

/**
 * Unlike the standalone CalendarView (which re-fetches tasks per month via a server action),
 * this operates entirely on the already-fetched `tasks` prop — no server round trip needed.
 */
export function MyTasksCalendar({ tasks }: { tasks: MyTask[] }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, MyTask[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const key = task.dueDate.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-700"
            aria-label="Previous month"
          >
            ‹
          </button>
          <button
            onClick={() => setMonth(startOfMonth(new Date()))}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Today
          </button>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-700"
            aria-label="Next month"
          >
            ›
          </button>
          <span className="ml-2 text-sm font-medium text-slate-700 dark:text-slate-300">{format(month, 'MMMM yyyy')}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-700">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="bg-slate-50 px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          >
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDay.get(key) ?? [];
          const inMonth = isSameMonth(day, month);
          return (
            <div
              key={key}
              className={`min-h-[6.5rem] bg-white p-1.5 dark:bg-slate-800 ${inMonth ? '' : 'bg-slate-50/60 dark:bg-slate-900/40'}`}
            >
              <p
                className={`text-xs font-medium ${
                  isToday(day)
                    ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white'
                    : inMonth
                      ? 'text-slate-600 dark:text-slate-300'
                      : 'text-slate-300 dark:text-slate-600'
                }`}
              >
                {format(day, 'd')}
              </p>
              <div className="mt-1 space-y-1">
                {dayTasks.slice(0, MAX_VISIBLE_PER_DAY).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setOpenTaskId(t.id)}
                    className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium ${PRIORITY_STYLES[t.priority]}`}
                    title={`${t.title} · ${t.projectName}${t.assigneeNames.length > 0 ? ` · ${t.assigneeNames.join(', ')}` : ''}`}
                  >
                    {t.title}
                  </button>
                ))}
                {dayTasks.length > MAX_VISIBLE_PER_DAY && (
                  <p className="px-1.5 text-[11px] text-slate-400">+{dayTasks.length - MAX_VISIBLE_PER_DAY} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {openTaskId && <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </div>
  );
}
