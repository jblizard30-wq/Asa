'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
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
import { getTasksInRange, type CalendarTask } from '@/lib/actions/calendar';
import { PRIORITY_LABELS, PRIORITY_STYLES, STATUS_LABELS } from '@/lib/format';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { TaskFilterBar } from '@/components/TaskFilterBar';
import { EMPTY_TASK_FILTERS, matchesTaskFilters, type TaskFilters } from '@/lib/taskFilters';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_VISIBLE_PER_DAY = 3;
const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([id, label]) => ({ id, label }));
const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS).map(([id, label]) => ({ id, label }));

export function CalendarView() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [teamIdsByUserId, setTeamIdsByUserId] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_TASK_FILTERS);

  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd]);

  useEffect(() => {
    startTransition(() => {
      getTasksInRange(gridStart.toISOString(), gridEnd.toISOString()).then((result) => {
        setTasks(result.tasks);
        setTeams(result.teams);
        setTeamIdsByUserId(result.teamIdsByUserId);
      });
    });
    // gridStart/gridEnd are derived from `month`, so re-fetching on month change alone is sufficient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const assigneeOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const task of tasks) {
      task.assigneeIds.forEach((id, i) => seen.set(id, task.assigneeNames[i]));
    }
    return [...seen.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [tasks]);

  const projectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const task of tasks) seen.set(task.projectId, task.projectName);
    return [...seen.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [tasks]);

  const tagOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const task of tasks) for (const tag of task.tags) seen.set(tag.id, tag.name);
    return [...seen.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [tasks]);

  const teamOptions = useMemo(() => teams.map((t) => ({ id: t.id, label: t.name })), [teams]);

  const filteredTasks = useMemo(
    () => tasks.filter((task) => matchesTaskFilters(task, filters, { teamIdsByUserId })),
    [tasks, filters, teamIdsByUserId],
  );

  const tasksByDay = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    for (const task of filteredTasks) {
      const key = task.dueDate.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [filteredTasks]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Calendar</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Previous month"
          >
            ‹
          </button>
          <button
            onClick={() => setMonth(startOfMonth(new Date()))}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Today
          </button>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Next month"
          >
            ›
          </button>
          <span className="ml-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            {format(month, 'MMMM yyyy')}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <TaskFilterBar
          filters={filters}
          onChange={setFilters}
          statusOptions={STATUS_OPTIONS}
          priorityOptions={PRIORITY_OPTIONS}
          assigneeOptions={assigneeOptions}
          teamOptions={teamOptions}
          projectOptions={projectOptions}
          tagOptions={tagOptions}
          showDueDate={false}
          searchPlaceholder="Search tasks…"
          scope="calendar"
        />
      </div>

      <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 dark:border-slate-800 dark:bg-slate-800">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="bg-slate-50 px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400"
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
              className={`min-h-[6.5rem] bg-white p-1.5 dark:bg-slate-900 ${
                inMonth ? '' : 'bg-slate-50/60 dark:bg-slate-950/40'
              }`}
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

      {isPending && <p className="mt-2 text-xs text-slate-400">Loading…</p>}

      {openTaskId && <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </div>
  );
}
