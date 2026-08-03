'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createFolder, deleteFolder, moveProjectToFolder, renameFolder } from '@/lib/actions/folders';

export interface SidebarProject {
  id: string;
  name: string;
}

export interface SidebarFolder {
  id: string;
  name: string;
  projects: SidebarProject[];
}

interface SidebarProps {
  folders: SidebarFolder[];
  ungroupedProjects: SidebarProject[];
  isAdmin?: boolean;
  canManageTeams?: boolean;
}

const COLLAPSED_KEY = 'sidebar-collapsed-folders';

export function Sidebar({ folders, ungroupedProjects, isAdmin = false, canManageTeams = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [menuProjectId, setMenuProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_KEY);
      if (stored) setCollapsed(new Set(JSON.parse(stored)));
    } catch {
      // ignore malformed storage
    }
  }, []);

  useEffect(() => {
    if (!menuProjectId) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuProjectId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuProjectId]);

  function persistCollapsed(next: Set<string>) {
    setCollapsed(next);
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
  }

  function toggleFolder(id: string) {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    persistCollapsed(next);
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) {
      setAddingFolder(false);
      return;
    }
    setError(null);
    const result = await createFolder(name);
    if (!result.success) {
      setError(result.error ?? 'Could not create folder');
      return;
    }
    setNewFolderName('');
    setAddingFolder(false);
    router.refresh();
  }

  async function handleRenameFolder(folderId: string) {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name) return;
    const result = await renameFolder(folderId, name);
    if (result.success) router.refresh();
  }

  async function handleDeleteFolder(folderId: string) {
    if (!confirm('Delete this folder? Its projects will move back to the ungrouped list.')) return;
    const result = await deleteFolder(folderId);
    if (result.success) router.refresh();
  }

  async function handleMove(projectId: string, folderId: string | null) {
    setMenuProjectId(null);
    const result = await moveProjectToFolder(projectId, folderId);
    if (result.success) router.refresh();
  }

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  function ProjectRow({ project, folderId }: { project: SidebarProject; folderId: string | null }) {
    const active = isActive(`/projects/${project.id}`);
    return (
      <div className="group relative flex items-center">
        <Link
          href={`/projects/${project.id}`}
          className={`flex-1 truncate rounded-md px-2 py-1.5 text-sm ${
            active
              ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          {project.name}
        </Link>
        <button
          onClick={() => setMenuProjectId(menuProjectId === project.id ? null : project.id)}
          className="rounded p-1 text-slate-400 opacity-0 hover:bg-slate-200 focus:opacity-100 group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-slate-700"
          aria-label="Project options"
        >
          &#8942;
        </button>
        {menuProjectId === project.id && (
          <div
            ref={menuRef}
            className="absolute right-0 top-7 z-10 w-48 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            {folders
              .filter((f) => f.id !== folderId)
              .map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleMove(project.id, f.id)}
                  className="block w-full px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Move to {f.name}
                </button>
              ))}
            {folderId && (
              <button
                onClick={() => handleMove(project.id, null)}
                className="block w-full px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Remove from folder
              </button>
            )}
            {folders.length === 0 && !folderId && (
              <p className="px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500">
                Create a folder to organize projects.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white px-3 py-6 print:hidden dark:border-slate-800 dark:bg-slate-900 sm:block">
      <nav className="space-y-1">
        <Link
          href="/my-tasks"
          className={`block rounded-md px-2 py-1.5 text-sm font-medium ${
            isActive('/my-tasks')
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          My Tasks
        </Link>
        <Link
          href="/personal-tasks"
          className={`block rounded-md px-2 py-1.5 text-sm font-medium ${
            isActive('/personal-tasks')
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          Personal Tasks
        </Link>
        <Link
          href="/projects"
          className={`block rounded-md px-2 py-1.5 text-sm font-medium ${
            pathname === '/projects'
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          All Projects
        </Link>
        <Link
          href="/calendar"
          className={`block rounded-md px-2 py-1.5 text-sm font-medium ${
            isActive('/calendar')
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          Calendar
        </Link>
        <Link
          href="/trash"
          className={`block rounded-md px-2 py-1.5 text-sm font-medium ${
            isActive('/trash')
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          Trash
        </Link>
        <Link
          href="/org-chart"
          className={`block rounded-md px-2 py-1.5 text-sm font-medium ${
            isActive('/org-chart')
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          Org Chart
        </Link>
        {canManageTeams && (
          <Link
            href="/teams"
            className={`block rounded-md px-2 py-1.5 text-sm font-medium ${
              isActive('/teams')
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            Teams
          </Link>
        )}
        {isAdmin && (
          <Link
            href="/admin/users"
            className={`block rounded-md px-2 py-1.5 text-sm font-medium ${
              isActive('/admin/users')
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            User Management
          </Link>
        )}
        {isAdmin && (
          <Link
            href="/admin/trash"
            className={`block rounded-md px-2 py-1.5 text-sm font-medium ${
              isActive('/admin/trash')
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            All Trash
          </Link>
        )}
        {isAdmin && (
          <Link
            href="/admin/workflows"
            className={`block rounded-md px-2 py-1.5 text-sm font-medium ${
              isActive('/admin/workflows')
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            Workflows
          </Link>
        )}
      </nav>

      <div className="mt-6">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Projects
          </span>
          <button
            onClick={() => setAddingFolder(true)}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="New folder"
            title="New folder"
          >
            +
          </button>
        </div>

        {addingFolder && (
          <div className="mt-2 px-2">
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') {
                  setAddingFolder(false);
                  setNewFolderName('');
                }
              }}
              onBlur={handleCreateFolder}
              placeholder="Folder name"
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        )}
        {error && <p className="mt-1 px-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-2 space-y-1">
          {folders.map((folder) => {
            const isCollapsed = collapsed.has(folder.id);
            return (
              <div key={folder.id} className="group/folder">
                <div className="flex items-center rounded-md px-1 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <button
                    onClick={() => toggleFolder(folder.id)}
                    className="mr-1 w-3 text-xs text-slate-400 dark:text-slate-500"
                    aria-label={isCollapsed ? 'Expand folder' : 'Collapse folder'}
                  >
                    {isCollapsed ? '▸' : '▾'}
                  </button>
                  {renamingId === folder.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameFolder(folder.id);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      onBlur={() => handleRenameFolder(folder.id)}
                      className="flex-1 rounded border border-brand-300 px-1 py-0.5 text-sm dark:border-brand-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  ) : (
                    <button
                      onClick={() => toggleFolder(folder.id)}
                      className="flex-1 truncate text-left text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      {folder.name}
                    </button>
                  )}
                  <div className="hidden shrink-0 gap-1 group-hover/folder:flex">
                    <button
                      onClick={() => {
                        setRenamingId(folder.id);
                        setRenameValue(folder.name);
                      }}
                      className="rounded p-0.5 text-slate-400 hover:bg-slate-200 dark:text-slate-500 dark:hover:bg-slate-700"
                      title="Rename folder"
                      aria-label="Rename folder"
                    >
                      &#9998;
                    </button>
                    <button
                      onClick={() => handleDeleteFolder(folder.id)}
                      className="rounded p-0.5 text-slate-400 hover:bg-slate-200 dark:text-slate-500 dark:hover:bg-slate-700"
                      title="Delete folder"
                      aria-label="Delete folder"
                    >
                      &#10005;
                    </button>
                  </div>
                </div>
                {!isCollapsed && (
                  <div className="ml-4 space-y-0.5 border-l border-slate-100 pl-2 dark:border-slate-800">
                    {folder.projects.map((project) => (
                      <ProjectRow key={project.id} project={project} folderId={folder.id} />
                    ))}
                    {folder.projects.length === 0 && (
                      <p className="px-2 py-1 text-xs text-slate-400 dark:text-slate-500">Empty folder</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {ungroupedProjects.map((project) => (
            <ProjectRow key={project.id} project={project} folderId={null} />
          ))}

          {folders.length === 0 && ungroupedProjects.length === 0 && (
            <p className="px-2 py-1 text-xs text-slate-400 dark:text-slate-500">No projects yet.</p>
          )}
        </div>
      </div>
    </aside>
  );
}
