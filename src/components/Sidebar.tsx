'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import {
  createFolder,
  createFolderFromProjects,
  deleteFolder,
  moveProjectToFolder,
  renameFolder,
  reorderFolderItems,
  reorderFolders,
} from '@/lib/actions/folders';
import { SETTINGS_NAV_ITEM } from '@/lib/navItems';

export interface SidebarProject {
  id: string;
  name: string;
}

export interface SidebarFolder {
  id: string;
  name: string;
  projects: SidebarProject[];
}

export interface SidebarNavItem {
  key: string;
  label: string;
  href: string;
}

interface SidebarProps {
  folders: SidebarFolder[];
  ungroupedProjects: SidebarProject[];
  navItems: SidebarNavItem[];
}

const COLLAPSED_KEY = 'sidebar-collapsed-folders';

/** Ungrouped droppable id, and the `folder:<id>` prefix used for each folder's own project-list droppable. */
const UNGROUPED_DROPPABLE_ID = 'ungrouped';
const FOLDER_DROPPABLE_PREFIX = 'folder:';

function folderIdFromDroppableId(droppableId: string): string | null {
  return droppableId === UNGROUPED_DROPPABLE_ID ? null : droppableId.slice(FOLDER_DROPPABLE_PREFIX.length);
}

function reorderArray<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = [...list];
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

export function Sidebar({ folders: foldersProp, ungroupedProjects: ungroupedProjectsProp, navItems }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [folders, setFolders] = useState<SidebarFolder[]>(foldersProp);
  const [ungroupedProjects, setUngroupedProjects] = useState<SidebarProject[]>(ungroupedProjectsProp);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [menuProjectId, setMenuProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFolders(foldersProp);
  }, [foldersProp]);

  useEffect(() => {
    setUngroupedProjects(ungroupedProjectsProp);
  }, [ungroupedProjectsProp]);

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
    if (href === '/projects') return pathname === '/projects';
    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  function findProject(projectId: string): { project: SidebarProject; folderId: string | null } | null {
    const inUngrouped = ungroupedProjects.find((p) => p.id === projectId);
    if (inUngrouped) return { project: inUngrouped, folderId: null };
    for (const folder of folders) {
      const found = folder.projects.find((p) => p.id === projectId);
      if (found) return { project: found, folderId: folder.id };
    }
    return null;
  }

  function handleDragEnd(result: DropResult) {
    const { type, source, destination, combine, draggableId } = result;
    setError(null);

    if (type === 'FOLDER') {
      if (!destination || destination.index === source.index) return;
      const previous = folders;
      const next = reorderArray(folders, source.index, destination.index);
      setFolders(next);
      void reorderFolders(next.map((f) => f.id)).then((res) => {
        if (!res.success) {
          setFolders(previous);
          setError(res.error ?? 'Could not reorder folders');
        } else {
          router.refresh();
        }
      });
      return;
    }

    // type === 'PROJECT'
    if (combine) {
      const dragged = findProject(draggableId)?.project;
      const target = findProject(combine.draggableId)?.project;
      if (!dragged || !target) return;

      const previousUngrouped = ungroupedProjects;
      setUngroupedProjects(ungroupedProjects.filter((p) => p.id !== dragged.id && p.id !== target.id));

      const name = `${target.name} & ${dragged.name}`.slice(0, 60);
      void createFolderFromProjects([target.id, dragged.id], name).then((res) => {
        if (!res.success) {
          setUngroupedProjects(previousUngrouped);
          setError(res.error ?? 'Could not create folder');
          return;
        }
        setRenamingId(res.folderId!);
        setRenameValue(res.folderName ?? name);
        router.refresh();
      });
      return;
    }

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceFolderId = folderIdFromDroppableId(source.droppableId);
    const destFolderId = folderIdFromDroppableId(destination.droppableId);

    if (sourceFolderId === destFolderId) {
      if (sourceFolderId === null) return; // ungrouped list has no persisted order
      const previous = folders;
      const next = folders.map((f) =>
        f.id === sourceFolderId ? { ...f, projects: reorderArray(f.projects, source.index, destination.index) } : f,
      );
      setFolders(next);
      const reorderedFolder = next.find((f) => f.id === sourceFolderId)!;
      void reorderFolderItems(sourceFolderId, reorderedFolder.projects.map((p) => p.id)).then((res) => {
        if (!res.success) {
          setFolders(previous);
          setError(res.error ?? 'Could not reorder projects');
        } else {
          router.refresh();
        }
      });
      return;
    }

    // Cross-list move (folder <-> folder, folder <-> ungrouped)
    const previousFolders = folders;
    const previousUngrouped = ungroupedProjects;

    const moved =
      sourceFolderId === null
        ? ungroupedProjects.find((p) => p.id === draggableId)
        : folders.find((f) => f.id === sourceFolderId)?.projects.find((p) => p.id === draggableId);
    if (!moved) return;

    setUngroupedProjects((prev) => {
      if (sourceFolderId === null) return prev.filter((p) => p.id !== draggableId);
      if (destFolderId === null) return [...prev.slice(0, destination.index), moved, ...prev.slice(destination.index)];
      return prev;
    });
    setFolders((prev) =>
      prev.map((f) => {
        let projects = f.projects;
        if (f.id === sourceFolderId) projects = projects.filter((p) => p.id !== draggableId);
        if (f.id === destFolderId) projects = [...projects.slice(0, destination.index), moved, ...projects.slice(destination.index)];
        return projects === f.projects ? f : { ...f, projects };
      }),
    );

    void moveProjectToFolder(draggableId, destFolderId, destination.index).then((res) => {
      if (!res.success) {
        setFolders(previousFolders);
        setUngroupedProjects(previousUngrouped);
        setError(res.error ?? 'Could not move project');
      } else {
        router.refresh();
      }
    });
  }

  function ProjectRow({
    project,
    folderId,
    isCombineTarget = false,
  }: {
    project: SidebarProject;
    folderId: string | null;
    isCombineTarget?: boolean;
  }) {
    const active = isActive(`/projects/${project.id}`);
    return (
      <div
        className={`group relative flex items-center rounded-md ${
          isCombineTarget ? 'ring-2 ring-brand-400 dark:ring-brand-500' : ''
        }`}
      >
        <Link
          href={`/projects/${project.id}`}
          className={`flex-1 truncate rounded-md px-2 py-1.5 text-sm ${
            active
              ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          {project.name}
        </Link>
        <button
          onClick={() => setMenuProjectId(menuProjectId === project.id ? null : project.id)}
          className="rounded p-1 text-slate-400 opacity-0 hover:bg-slate-200 focus:opacity-100 group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-slate-600"
          aria-label="Project options"
        >
          &#8942;
        </button>
        {menuProjectId === project.id && (
          <div
            ref={menuRef}
            className="absolute right-0 top-7 z-10 w-48 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
          >
            {folders
              .filter((f) => f.id !== folderId)
              .map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleMove(project.id, f.id)}
                  className="block w-full px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Move to {f.name}
                </button>
              ))}
            {folderId && (
              <button
                onClick={() => handleMove(project.id, null)}
                className="block w-full px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
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
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white px-3 py-6 print:hidden dark:border-slate-700 dark:bg-slate-800 sm:block">
      <nav className="space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`block rounded-md px-2 py-1.5 text-sm font-medium ${
              isActive(item.href)
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Projects
          </span>
          <button
            onClick={() => setAddingFolder(true)}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
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
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
        )}
        {error && <p className="mt-1 px-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="mt-2 space-y-1">
            <Droppable droppableId="folder-list" type="FOLDER">
              {(folderListProvided) => (
                <div ref={folderListProvided.innerRef} {...folderListProvided.droppableProps} className="space-y-1">
                  {folders.map((folder, folderIndex) => {
                    const isCollapsed = collapsed.has(folder.id);
                    return (
                      <Draggable
                        key={folder.id}
                        draggableId={folder.id}
                        index={folderIndex}
                        isDragDisabled={renamingId === folder.id}
                      >
                        {(folderDragProvided, folderSnapshot) => (
                          <div
                            ref={folderDragProvided.innerRef}
                            {...folderDragProvided.draggableProps}
                            className={folderSnapshot.isDragging ? 'rounded-md bg-white shadow-md dark:bg-slate-900' : ''}
                          >
                            <div
                              {...folderDragProvided.dragHandleProps}
                              className="group/folder flex items-center rounded-md px-1 py-1 hover:bg-slate-50 dark:hover:bg-slate-700/60"
                            >
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
                                  className="flex-1 rounded border border-brand-300 px-1 py-0.5 text-sm dark:border-brand-700 dark:bg-slate-700 dark:text-slate-100"
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
                                  className="rounded p-0.5 text-slate-400 hover:bg-slate-200 dark:text-slate-500 dark:hover:bg-slate-600"
                                  title="Rename folder"
                                  aria-label="Rename folder"
                                >
                                  &#9998;
                                </button>
                                <button
                                  onClick={() => handleDeleteFolder(folder.id)}
                                  className="rounded p-0.5 text-slate-400 hover:bg-slate-200 dark:text-slate-500 dark:hover:bg-slate-600"
                                  title="Delete folder"
                                  aria-label="Delete folder"
                                >
                                  &#10005;
                                </button>
                              </div>
                            </div>
                            {!isCollapsed && (
                              <Droppable droppableId={`${FOLDER_DROPPABLE_PREFIX}${folder.id}`} type="PROJECT">
                                {(projectListProvided) => (
                                  <div
                                    ref={projectListProvided.innerRef}
                                    {...projectListProvided.droppableProps}
                                    className="ml-4 min-h-[4px] space-y-0.5 border-l border-slate-100 pl-2 dark:border-slate-700"
                                  >
                                    {folder.projects.map((project, projectIndex) => (
                                      <Draggable key={project.id} draggableId={project.id} index={projectIndex}>
                                        {(projectDragProvided) => (
                                          <div
                                            ref={projectDragProvided.innerRef}
                                            {...projectDragProvided.draggableProps}
                                            {...projectDragProvided.dragHandleProps}
                                          >
                                            <ProjectRow project={project} folderId={folder.id} />
                                          </div>
                                        )}
                                      </Draggable>
                                    ))}
                                    {projectListProvided.placeholder}
                                    {folder.projects.length === 0 && (
                                      <p className="px-2 py-1 text-xs text-slate-400 dark:text-slate-500">Empty folder</p>
                                    )}
                                  </div>
                                )}
                              </Droppable>
                            )}
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {folderListProvided.placeholder}
                </div>
              )}
            </Droppable>

            <Droppable droppableId={UNGROUPED_DROPPABLE_ID} type="PROJECT" isCombineEnabled>
              {(ungroupedProvided) => (
                <div ref={ungroupedProvided.innerRef} {...ungroupedProvided.droppableProps} className="min-h-[4px] space-y-0.5">
                  {ungroupedProjects.map((project, index) => (
                    <Draggable key={project.id} draggableId={project.id} index={index}>
                      {(projectDragProvided, projectSnapshot) => (
                        <div
                          ref={projectDragProvided.innerRef}
                          {...projectDragProvided.draggableProps}
                          {...projectDragProvided.dragHandleProps}
                        >
                          <ProjectRow
                            project={project}
                            folderId={null}
                            isCombineTarget={!!projectSnapshot.combineTargetFor}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {ungroupedProvided.placeholder}
                </div>
              )}
            </Droppable>

            {folders.length === 0 && ungroupedProjects.length === 0 && (
              <p className="px-2 py-1 text-xs text-slate-400 dark:text-slate-500">No projects yet.</p>
            )}
          </div>
        </DragDropContext>
      </div>

      <div className="mt-6 border-t border-slate-100 pt-3 dark:border-slate-700">
        <Link
          href={SETTINGS_NAV_ITEM.href}
          className={`block rounded-md px-2 py-1.5 text-sm font-medium ${
            isActive(SETTINGS_NAV_ITEM.href)
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'
          }`}
        >
          {SETTINGS_NAV_ITEM.label}
        </Link>
      </div>
    </aside>
  );
}
