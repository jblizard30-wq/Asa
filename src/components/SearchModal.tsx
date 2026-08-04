'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { searchAll, type SearchResults } from '@/lib/actions/search';
import { STATUS_LABELS } from '@/lib/format';
import { TaskDetailModal } from '@/components/TaskDetailModal';

const EMPTY: SearchResults = { tasks: [], projects: [], comments: [], pages: [] };

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
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
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
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const hasResults =
    results.tasks.length > 0 || results.projects.length > 0 || results.comments.length > 0 || results.pages.length > 0;

  function openTask(taskId: string) {
    setOpen(false);
    setOpenTaskId(taskId);
  }

  function goToProject(projectId: string) {
    setOpen(false);
    router.push(`/projects/${projectId}`);
  }

  function goToPage(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-400 hover:border-slate-300 hover:text-slate-600 dark:border-slate-700 dark:text-slate-500 dark:hover:border-slate-600 dark:hover:text-slate-300"
        aria-label="Search"
      >
        <SearchIcon />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="hidden rounded border border-slate-200 px-1 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500 sm:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/40 p-4 pt-16 sm:pt-24"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <SearchIcon />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tasks, projects, comments, pages…"
                className="w-full border-none bg-transparent text-sm text-slate-800 focus:outline-none dark:text-slate-100"
              />
              {loading && <span className="text-xs text-slate-400">Searching…</span>}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {query.trim().length >= 2 && !loading && !hasResults && (
                <p className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                  No results for &ldquo;{query}&rdquo;
                </p>
              )}
              {query.trim().length < 2 && (
                <p className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                  Type at least 2 characters to search.
                </p>
              )}

              {results.pages.length > 0 && (
                <div className="py-2">
                  <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Pages
                  </p>
                  {results.pages.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => goToPage(p.href)}
                      className="block w-full truncate px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}

              {results.tasks.length > 0 && (
                <div className="border-t border-slate-100 py-2 dark:border-slate-800">
                  <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Tasks
                  </p>
                  {results.tasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => openTask(t.id)}
                      className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <span className="truncate text-slate-700 dark:text-slate-200">{t.title}</span>
                      <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                        {t.projectName} · {STATUS_LABELS[t.status]}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {results.projects.length > 0 && (
                <div className="border-t border-slate-100 py-2 dark:border-slate-800">
                  <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Projects
                  </p>
                  {results.projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => goToProject(p.id)}
                      className="block w-full truncate px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}

              {results.comments.length > 0 && (
                <div className="border-t border-slate-100 py-2 dark:border-slate-800">
                  <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Comments
                  </p>
                  {results.comments.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => openTask(c.taskId)}
                      className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <p className="truncate text-slate-700 dark:text-slate-200">{c.body}</p>
                      <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                        {c.userName} on &ldquo;{c.taskTitle}&rdquo; · {c.projectName}
                      </p>
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

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}
