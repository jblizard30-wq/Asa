// src/components/SearchModal.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { searchAll, type SearchResults } from '@/lib/actions/search';
import { STATUS_LABELS } from '@/lib/format';
import { TaskDetailModal } from '@/components/TaskDetailModal';

const EMPTY: SearchResults = {
  tasks: [],
  projects: [],
  meetups: [],
  inventory: [],
  raci: [],
  tools: [],
  people: [],
  teams: [],
  comments: [],
  pages: [],
};

export function SearchModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleShortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else {
      setQuery('');
      setResults(EMPTY);
    }
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      searchAll(query).then((data) => {
        setResults(data);
        setLoading(false);
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  const hasResults =
    results.tasks.length > 0 ||
    results.projects.length > 0 ||
    results.meetups.length > 0 ||
    results.inventory.length > 0 ||
    results.raci.length > 0 ||
    results.tools.length > 0 ||
    results.people.length > 0 ||
    results.teams.length > 0 ||
    results.comments.length > 0 ||
    results.pages.length > 0;

  function navigateTo(url: string) {
    setOpen(false);
    router.push(url);
  }

  function openTask(taskId: string) {
    setOpen(false);
    setOpenTaskId(taskId);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200 transition-all"
        aria-label="Search"
      >
        <SearchIcon />
        <span className="hidden sm:inline">Search across all modules…</span>
        <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 sm:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 p-4 pt-12 sm:pt-20 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in zoom-in-95 duration-150 flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input Bar */}
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
              <SearchIcon className="h-5 w-5 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tasks, meetups, inventory, RACI, tools, staff…"
                className="w-full border-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              {loading && <span className="text-xs text-slate-400 animate-pulse">Searching…</span>}
              <kbd
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-500 dark:hover:bg-slate-800"
              >
                ESC
              </kbd>
            </div>

            {/* Results Body */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
              {query.trim().length < 2 && (
                <div className="p-4 space-y-4">
                  <div>
                    <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                      Quick Operational Shortcuts
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <button
                        onClick={() => navigateTo('/meetups')}
                        className="flex items-center gap-2 p-2.5 rounded-lg text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/80 border border-slate-100 dark:border-slate-800"
                      >
                        <span>🗓️</span>
                        <span>Meetups & Worship</span>
                      </button>
                      <button
                        onClick={() => navigateTo('/inventory')}
                        className="flex items-center gap-2 p-2.5 rounded-lg text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/80 border border-slate-100 dark:border-slate-800"
                      >
                        <span>📦</span>
                        <span>Inventory Catalog</span>
                      </button>
                      <button
                        onClick={() => navigateTo('/calendar')}
                        className="flex items-center gap-2 p-2.5 rounded-lg text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/80 border border-slate-100 dark:border-slate-800"
                      >
                        <span>📅</span>
                        <span>Liturgical Calendar</span>
                      </button>
                      <button
                        onClick={() => navigateTo('/raci')}
                        className="flex items-center gap-2 p-2.5 rounded-lg text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/80 border border-slate-100 dark:border-slate-800"
                      >
                        <span>👥</span>
                        <span>RACI Processes</span>
                      </button>
                      <button
                        onClick={() => navigateTo('/xp')}
                        className="flex items-center gap-2 p-2.5 rounded-lg text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/80 border border-slate-100 dark:border-slate-800"
                      >
                        <span>📊</span>
                        <span>XP Financial Hub</span>
                      </button>
                      <button
                        onClick={() => navigateTo('/settings/navigation')}
                        className="flex items-center gap-2 p-2.5 rounded-lg text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/80 border border-slate-100 dark:border-slate-800"
                      >
                        <span>⚙️</span>
                        <span>Customize Sidebar</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {query.trim().length >= 2 && !loading && !hasResults && (
                <div className="py-12 text-center">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    No matching results found for &ldquo;{query}&rdquo;
                  </p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Try searching for a task name, church event, room item, process, or staff member.
                  </p>
                </div>
              )}

              {/* Meetups */}
              {results.meetups.length > 0 && (
                <div className="py-2.5">
                  <p className="px-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    🗓️ Meetups & Gatherings
                  </p>
                  {results.meetups.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => navigateTo(`/meetups/${m.id}`)}
                      className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                    >
                      <div className="truncate">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {m.title}
                        </span>
                        {m.location && (
                          <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                            @ {m.location}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                        {m.category}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Inventory */}
              {results.inventory.length > 0 && (
                <div className="py-2.5">
                  <p className="px-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    📦 Inventory & Supplies
                  </p>
                  {results.inventory.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => navigateTo('/inventory')}
                      className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                    >
                      <div className="truncate">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {item.name}
                        </span>
                        <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                          ({item.locationName})
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        {item.onHandQty} {item.unit}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Tasks */}
              {results.tasks.length > 0 && (
                <div className="py-2.5">
                  <p className="px-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    ✅ Tasks
                  </p>
                  {results.tasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => openTask(t.id)}
                      className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                    >
                      <span className="truncate text-slate-800 dark:text-slate-200">{t.title}</span>
                      <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                        {t.projectName} · {STATUS_LABELS[t.status] || t.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Projects */}
              {results.projects.length > 0 && (
                <div className="py-2.5">
                  <p className="px-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    📁 Projects
                  </p>
                  {results.projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => navigateTo(`/projects/${p.id}`)}
                      className="block w-full truncate px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/80 transition-colors"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}

              {/* RACI Charts */}
              {results.raci.length > 0 && (
                <div className="py-2.5">
                  <p className="px-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    👥 RACI Process Charts
                  </p>
                  {results.raci.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => navigateTo('/raci')}
                      className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                    >
                      <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                        {r.processName}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                        {r.ministryArea ? `${r.ministryArea} · ` : ''}Owner: {r.owner || 'Unassigned'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Strategic Discernment Tools */}
              {results.tools.length > 0 && (
                <div className="py-2.5">
                  <p className="px-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    🛠️ Discernment Frameworks
                  </p>
                  {results.tools.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => navigateTo('/xp')}
                      className="block w-full px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                          {t.name}
                        </span>
                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                          {t.primitive}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {t.blurb}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {/* People & Teams */}
              {(results.people.length > 0 || results.teams.length > 0) && (
                <div className="py-2.5">
                  <p className="px-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    👤 People & Ministry Teams
                  </p>
                  {results.people.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => navigateTo('/org-chart')}
                      className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                    >
                      <span className="text-slate-800 dark:text-slate-200">
                        {u.name || u.email}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                        {u.role}
                      </span>
                    </button>
                  ))}
                  {results.teams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => navigateTo('/teams')}
                      className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                    >
                      <span className="text-slate-800 dark:text-slate-200">
                        👥 Team: {team.name}
                      </span>
                      <span className="text-xs text-slate-400">View team</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Pages */}
              {results.pages.length > 0 && (
                <div className="py-2.5">
                  <p className="px-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Navigation Pages
                  </p>
                  {results.pages.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => navigateTo(p.href)}
                      className="block w-full truncate px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/80 transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {openTaskId && <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </>
  );
}

function SearchIcon({ className = 'h-4 w-4 shrink-0' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    </svg>
  );
}
