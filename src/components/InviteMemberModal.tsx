'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { addMemberToProject, searchAssignableUsers } from '@/lib/actions/projects';

export interface AssignableUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function InviteMemberModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AssignableUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AssignableUser | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions when query changes
  useEffect(() => {
    if (selectedUser) return;

    let active = true;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const results = await searchAssignableUsers(projectId, query);
        if (active) {
          setSuggestions(results);
          setIsSearching(false);
          setHighlightedIndex(-1);
          if (document.activeElement === inputRef.current) {
            setIsOpen(true);
          }
        }
      } catch {
        if (active) setIsSearching(false);
      }
    }, 150);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [projectId, query, selectedUser]);

  function handleSelect(user: AssignableUser) {
    setSelectedUser(user);
    setQuery(user.name);
    setIsOpen(false);
    setError(null);
  }

  function handleClearSelection() {
    setSelectedUser(null);
    setQuery('');
    setSuggestions([]);
    setError(null);
    setSuccess(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const targetUserId = selectedUser?.id;
    const targetEmail = !selectedUser && query.trim() ? query.trim() : undefined;

    if (!targetUserId && !targetEmail) {
      setError('Please select or enter a user to add.');
      return;
    }

    setLoading(true);
    const result = await addMemberToProject(
      projectId,
      targetUserId ? { userId: targetUserId } : { email: targetEmail }
    );
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? 'Something went wrong.');
      return;
    }

    const addedName = result.member?.name ?? selectedUser?.name ?? 'User';
    setSuccess(`${addedName} has been added to the project.`);
    setSelectedUser(null);
    setQuery('');
    setSuggestions([]);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900 dark:shadow-slate-950/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Add a member</h2>
          <button
            onClick={onClose}
            type="button"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Search for a staff member by name or email to add them to this project.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="relative">
            <label htmlFor="user-search-input" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Select user
            </label>
            <div className="relative">
              <input
                id="user-search-input"
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (selectedUser) setSelectedUser(null);
                }}
                onFocus={() => {
                  if (!selectedUser) setIsOpen(true);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type name or email to search…"
                autoComplete="off"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              />
              {isSearching && (
                <div className="absolute right-3 top-2.5">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                </div>
              )}
            </div>

            {/* Suggestions dropdown */}
            {isOpen && !selectedUser && (
              <div
                ref={dropdownRef}
                className="absolute z-40 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
              >
                {suggestions.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">
                    {query.trim() ? 'No matching users found.' : 'No users available to add.'}
                  </p>
                ) : (
                  suggestions.map((user, index) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelect(user)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm transition ${
                        index === highlightedIndex
                          ? 'bg-slate-100 dark:bg-slate-700/60'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-750'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900/60 dark:text-brand-300">
                          {getInitials(user.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800 dark:text-slate-200">{user.name}</p>
                          <p className="truncate text-xs text-slate-400 dark:text-slate-500">{user.email}</p>
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {user.role}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected user preview chip */}
          {selectedUser && (
            <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50/50 p-2.5 dark:border-brand-800/50 dark:bg-brand-950/30">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-medium text-white">
                  {getInitials(selectedUser.name)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{selectedUser.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{selectedUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Change
              </button>
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {success && <p className="text-sm text-green-600 dark:text-green-400">{success}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {success ? 'Done' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={loading || (!selectedUser && !query.trim())}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? 'Adding…' : 'Add member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export const AddMemberModal = InviteMemberModal;
