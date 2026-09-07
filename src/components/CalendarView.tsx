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
import {
  getTasksInRange,
  getMeetupsInRange,
  createSermonPrepTask,
  type CalendarTask,
  type CalendarMeetup,
} from '@/lib/actions/calendar';
import { PRIORITY_LABELS, PRIORITY_STYLES, STATUS_LABELS } from '@/lib/format';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { TaskFilterBar } from '@/components/TaskFilterBar';
import { EMPTY_TASK_FILTERS, matchesTaskFilters, type TaskFilters } from '@/lib/taskFilters';
import { deleteMeetup } from '@/lib/actions/meetups';
import { TrashIcon } from '@/components/MeetupIcons';
import { useToast } from '@/components/Toast';
import {
  getLiturgicalSeason,
  LITURGICAL_SEASON_DETAILS,
  getLiturgicalKeyDates,
  getLectionaryReadings,
} from '@/lib/liturgicalCalendar';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_VISIBLE_PER_DAY = 3;
const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([id, label]) => ({ id, label }));
const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS).map(([id, label]) => ({ id, label }));

export function CalendarView() {
  const toast = useToast();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [meetups, setMeetups] = useState<CalendarMeetup[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [teamIdsByUserId, setTeamIdsByUserId] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_TASK_FILTERS);
  const [creatingPrepDate, setCreatingPrepDate] = useState<string | null>(null);

  const currentSeason = useMemo(() => {
    const midMonth = new Date(month.getFullYear(), month.getMonth(), 15);
    const season = getLiturgicalSeason(midMonth);
    return LITURGICAL_SEASON_DETAILS[season];
  }, [month]);

  const yearKeyDates = useMemo(() => {
    return getLiturgicalKeyDates(month.getFullYear());
  }, [month]);

  const holyDaysMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const kd of yearKeyDates) {
      const dayKey = format(kd.date, 'yyyy-MM-dd');
      map.set(dayKey, kd.name);
    }
    return map;
  }, [yearKeyDates]);

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
      getMeetupsInRange(gridStart.toISOString(), gridEnd.toISOString()).then((res) => {
        setMeetups(res);
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

  const filteredMeetups = useMemo(() => {
    return meetups.filter((m) => {
      if (filters.teamIds && filters.teamIds.length > 0) {
        return m.isAllChurch || filters.teamIds.some((id) => m.teamIds.includes(id));
      }
      return true;
    });
  }, [meetups, filters.teamIds]);

  const meetupsByDay = useMemo(() => {
    const map = new Map<string, CalendarMeetup[]>();
    for (const m of filteredMeetups) {
      const key = m.startsAt.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    return map;
  }, [filteredMeetups]);

  async function handleDeleteMeetup(meetupId: string, title: string) {
    if (!confirm(`Delete meetup "${title}"? This cannot be undone.`)) return;
    const res = await deleteMeetup(meetupId);
    if (res.success) {
      setMeetups((prev) => prev.filter((m) => m.id !== meetupId));
      toast.success('Meetup Deleted', `"${title}" has been deleted.`);
    } else {
      toast.error('Deletion Failed', res.error || 'Failed to delete meetup.');
    }
  }

  async function handleCreateSermonPrep(dateString: string) {
    setCreatingPrepDate(dateString);
    try {
      const res = await createSermonPrepTask(dateString);
      if (res.success && res.taskId) {
        toast.success(
          'Sermon Prep Task Created',
          `Created sermon prep task for ${res.readingSet?.sundayName ?? 'Sunday'}.`
        );
        startTransition(() => {
          getTasksInRange(gridStart.toISOString(), gridEnd.toISOString()).then((result) => {
            setTasks(result.tasks);
            setTeams(result.teams);
            setTeamIdsByUserId(result.teamIdsByUserId);
          });
        });
        setOpenTaskId(res.taskId);
      } else {
        toast.error('Error', res.error ?? 'Failed to create sermon prep task.');
      }
    } catch {
      toast.error('Error', 'An unexpected error occurred while creating the task.');
    } finally {
      setCreatingPrepDate(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Calendar</h1>
          {currentSeason && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${currentSeason.badgeClass}`}
            >
              <span>✝</span>
              <span>{currentSeason.name}</span>
              <span className="opacity-75 font-normal">· {currentSeason.colorName}</span>
            </span>
          )}
        </div>
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
          const dayMeetups = meetupsByDay.get(key) ?? [];
          const inMonth = isSameMonth(day, month);
          const isSunday = day.getDay() === 0;
          const sundaySeason = isSunday ? LITURGICAL_SEASON_DETAILS[getLiturgicalSeason(day)] : null;
          const holyDayName = holyDaysMap.get(key);

          return (
            <div
              key={key}
              className={`min-h-[6.5rem] bg-white p-1.5 dark:bg-slate-900 ${
                inMonth ? '' : 'bg-slate-50/60 dark:bg-slate-950/40'
              }`}
            >
              <div className="flex items-center justify-between">
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

                {/* Holy Day or Sunday Liturgical Badge */}
                {holyDayName ? (
                  <span
                    className="truncate max-w-[85px] text-[9px] font-bold px-1 rounded bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300/60"
                    title={holyDayName}
                  >
                    ✦ {holyDayName}
                  </span>
                ) : sundaySeason && inMonth ? (
                  <span
                    className={`truncate max-w-[70px] text-[9px] font-semibold px-1 rounded ${sundaySeason.badgeClass}`}
                    title={`${sundaySeason.name} (${sundaySeason.colorName})`}
                  >
                    {sundaySeason.name}
                  </span>
                ) : null}
              </div>

              {/* Sunday Lectionary Readings Card & 1-Click Sermon Prep Button */}
              {isSunday && inMonth && (() => {
                const readings = getLectionaryReadings(day);
                return (
                  <div className="mt-1 rounded-md border border-indigo-200 bg-indigo-50/75 p-1.5 text-[10px] text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200 shadow-2xs">
                    <div className="flex items-center justify-between font-bold text-[9px] text-indigo-900 dark:text-indigo-200 border-b border-indigo-200/60 dark:border-indigo-900/60 pb-0.5 mb-1">
                      <span className="truncate" title={readings.sundayName}>
                        📖 {readings.sundayName}
                      </span>
                      <span className="rounded bg-indigo-200/70 px-1 py-0.2 text-[8px] font-bold text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300 shrink-0 ml-1">
                        Yr {readings.cycle}
                      </span>
                    </div>
                    <div className="space-y-0.5 text-[9px] text-indigo-900/90 dark:text-indigo-300">
                      <div className="truncate" title={`First Reading: ${readings.firstReading}`}>
                        <span className="font-semibold text-indigo-700 dark:text-indigo-400">1st:</span> {readings.firstReading}
                      </div>
                      <div className="truncate" title={`Psalm: ${readings.psalm}`}>
                        <span className="font-semibold text-indigo-700 dark:text-indigo-400">Ps:</span> {readings.psalm}
                      </div>
                      <div className="truncate" title={`Epistle: ${readings.epistle}`}>
                        <span className="font-semibold text-indigo-700 dark:text-indigo-400">Ep:</span> {readings.epistle}
                      </div>
                      <div className="truncate font-semibold text-indigo-950 dark:text-indigo-100" title={`Gospel: ${readings.gospel}`}>
                        <span className="text-brand-700 dark:text-brand-400">Gosp:</span> {readings.gospel}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateSermonPrep(key);
                      }}
                      disabled={creatingPrepDate === key}
                      className="mt-1.5 flex w-full items-center justify-center gap-1 rounded bg-indigo-600 px-1.5 py-1 text-center text-[9px] font-semibold text-white shadow-2xs hover:bg-indigo-700 disabled:opacity-50 transition-colors leading-tight"
                      title="Create Sermon Prep Task with Lectionary Readings"
                      aria-label="Create Sermon Prep Task with Lectionary Readings"
                    >
                      {creatingPrepDate === key ? (
                        <span>Creating…</span>
                      ) : (
                        <>
                          <span>✍️</span>
                          <span className="truncate">Create Sermon Prep Task with Lectionary Readings</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })()}

              <div className="mt-1 space-y-1">
                {dayMeetups.map((m) => (
                  <div
                    key={m.id}
                    className="group flex items-center justify-between gap-1 w-full rounded px-1.5 py-0.5 text-left text-[11px] font-medium bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:hover:bg-purple-900/60 transition-colors"
                  >
                    <a
                      href={`/meetups/${m.id}`}
                      className="truncate flex-1"
                      title={`Meetup: ${m.title}${m.location ? ` @ ${m.location}` : ''}`}
                    >
                      🗓️ {m.title}
                    </a>
                    {m.canManage && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteMeetup(m.id, m.title);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-purple-600 hover:text-rose-600 dark:text-purple-400 dark:hover:text-rose-400 transition-opacity"
                        title="Delete meetup"
                        aria-label={`Delete meetup ${m.title}`}
                      >
                        <TrashIcon className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
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
