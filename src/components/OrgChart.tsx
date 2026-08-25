'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { setUserManager } from '@/lib/actions/orgChart';
import { collectDescendantIds, type OrgNode } from '@/lib/orgChart';

export interface OrgChartPerson {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface PersonOption {
  id: string;
  name: string;
}

const ROLE_STYLES: Record<string, string> = {
  ADMIN: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
  MANAGER: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  USER: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

function RolePill({ role }: { role: string }) {
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
        ROLE_STYLES[role] ?? ROLE_STYLES.USER
      }`}
    >
      {role.charAt(0) + role.slice(1).toLowerCase()}
    </span>
  );
}

function PersonCard({
  person,
  isAdmin,
  managerOptions,
  reportCount,
  collapsed,
  onToggleCollapse,
  isHighlighted,
  isDimmed,
}: {
  person: OrgChartPerson;
  isAdmin: boolean;
  managerOptions: PersonOption[];
  reportCount?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isHighlighted?: boolean;
  isDimmed?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(managerId: string) {
    setPending(true);
    setError(null);
    const result = await setUserManager(person.id, managerId || null);
    setPending(false);
    if (!result.success) {
      setError(result.error ?? 'Could not update manager');
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div
      className={`w-52 shrink-0 rounded-xl border bg-white p-3.5 text-left shadow-sm transition-all dark:bg-slate-900 ${
        isHighlighted
          ? 'border-brand-500 ring-2 ring-brand-500/40 shadow-md scale-[1.02] dark:border-brand-400'
          : isDimmed
          ? 'border-slate-200 opacity-40 dark:border-slate-800'
          : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{person.name}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{person.email}</p>
        </div>
        {typeof reportCount === 'number' && reportCount > 0 && (
          <button
            onClick={onToggleCollapse}
            className="shrink-0 rounded p-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            title={collapsed ? 'Expand reports' : 'Collapse reports'}
            aria-label={collapsed ? 'Expand reports' : 'Collapse reports'}
          >
            {collapsed ? '▸' : '▾'}
          </button>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <RolePill role={person.role} />
        {typeof reportCount === 'number' && reportCount > 0 && (
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
            {reportCount} report{reportCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {isAdmin && (
        <div className="mt-2.5 border-t border-slate-100 pt-2 dark:border-slate-800">
          {editing ? (
            <select
              autoFocus
              defaultValue=""
              disabled={pending}
              onChange={(e) => void handleChange(e.target.value)}
              onBlur={() => setEditing(false)}
              className="w-full rounded-md border border-slate-200 px-1.5 py-1 text-xs text-slate-600 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="">No manager</option>
              {managerOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-[11px] font-medium text-slate-400 hover:text-brand-600 dark:text-slate-500 dark:hover:text-brand-400"
            >
              Change manager
            </button>
          )}
          {error && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}

function OrgTreeNode({
  node,
  isAdmin,
  allPeople,
  searchQuery,
  collapsedNodes,
  onToggleNode,
}: {
  node: OrgNode;
  isAdmin: boolean;
  allPeople: PersonOption[];
  searchQuery: string;
  collapsedNodes: Set<string>;
  onToggleNode: (id: string) => void;
}) {
  const excluded = collectDescendantIds(node);
  const managerOptions = allPeople.filter((p) => !excluded.has(p.id));
  const isCollapsed = collapsedNodes.has(node.id);

  const cleanQuery = searchQuery.trim().toLowerCase();
  const isMatch =
    cleanQuery.length > 0 &&
    (node.name.toLowerCase().includes(cleanQuery) ||
      node.email.toLowerCase().includes(cleanQuery) ||
      node.role.toLowerCase().includes(cleanQuery));
  const isDimmed = cleanQuery.length > 0 && !isMatch;

  return (
    <li>
      <PersonCard
        person={node}
        isAdmin={isAdmin}
        managerOptions={managerOptions}
        reportCount={node.children.length}
        collapsed={isCollapsed}
        onToggleCollapse={() => onToggleNode(node.id)}
        isHighlighted={isMatch}
        isDimmed={isDimmed}
      />
      {node.children.length > 0 && !isCollapsed && (
        <ul>
          {node.children.map((child) => (
            <OrgTreeNode
              key={child.id}
              node={child}
              isAdmin={isAdmin}
              allPeople={allPeople}
              searchQuery={searchQuery}
              collapsedNodes={collapsedNodes}
              onToggleNode={onToggleNode}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function getAllCollapsibleNodeIds(nodes: OrgNode[]): string[] {
  const ids: string[] = [];
  function traverse(node: OrgNode) {
    if (node.children.length > 0) {
      ids.push(node.id);
      node.children.forEach(traverse);
    }
  }
  nodes.forEach(traverse);
  return ids;
}

export function OrgChart({
  roots,
  unassigned,
  isAdmin,
  allPeople,
}: {
  roots: OrgNode[];
  unassigned: OrgChartPerson[];
  isAdmin: boolean;
  allPeople: PersonOption[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(100);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showUnassigned, setShowUnassigned] = useState(false);

  const collapsibleIds = useMemo(() => getAllCollapsibleNodeIds(roots), [roots]);
  const allCollapsed = collapsibleIds.length > 0 && collapsibleIds.every((id) => collapsedNodes.has(id));

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  function handleToggleNode(id: string) {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleToggleAll() {
    if (allCollapsed) {
      setCollapsedNodes(new Set());
    } else {
      setCollapsedNodes(new Set(collapsibleIds));
    }
  }

  function toggleFullscreen() {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  const matchCount = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return 0;
    let count = 0;
    function checkNode(node: OrgNode) {
      if (
        node.name.toLowerCase().includes(q) ||
        node.email.toLowerCase().includes(q) ||
        node.role.toLowerCase().includes(q)
      ) {
        count++;
      }
      node.children.forEach(checkNode);
    }
    roots.forEach(checkNode);
    return count;
  }, [roots, searchQuery]);

  return (
    <div
      ref={containerRef}
      className={`flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none p-6' : 'min-h-[calc(100vh-13rem)] w-full'
      }`}
    >
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        {/* Left: Search */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search people..."
              className="w-48 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:bg-slate-900 sm:w-60"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>
          {searchQuery.trim() && (
            <span className="rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
              {matchCount} match{matchCount === 1 ? '' : 'es'}
            </span>
          )}
        </div>

        {/* Right: Controls (Expand/Collapse, Zoom, Fullscreen, Unassigned Toggle) */}
        <div className="flex flex-wrap items-center gap-2">
          {collapsibleIds.length > 0 && (
            <button
              onClick={handleToggleAll}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              {allCollapsed ? 'Expand All' : 'Collapse All'}
            </button>
          )}

          {/* Zoom controls */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
            <button
              onClick={() => setZoom((z) => Math.max(40, z - 10))}
              disabled={zoom <= 40}
              className="rounded px-2 py-1 text-xs font-bold text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-700"
              title="Zoom out"
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="min-w-[3.25rem] text-center text-xs font-medium text-slate-600 dark:text-slate-300">
              {zoom}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(150, z + 10))}
              disabled={zoom >= 150}
              className="rounded px-2 py-1 text-xs font-bold text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-700"
              title="Zoom in"
              aria-label="Zoom in"
            >
              +
            </button>
            {zoom !== 100 && (
              <button
                onClick={() => setZoom(100)}
                className="ml-1 border-l border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                title="Reset zoom to 100%"
              >
                Reset
              </button>
            )}
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title={isFullscreen ? 'Exit full screen' : 'Full screen mode'}
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              {isFullscreen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 9L4 4m0 0l4-4M4 4h5M15 9l5-5m0 0l-4-4m4 4h-5M9 15l-5 5m0 0l4 4m-4-4h5M15 15l5 5m0 0l-4 4m4-4h-5"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              )}
            </svg>
            <span className="hidden sm:inline">{isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</span>
          </button>

          {unassigned.length > 0 && (
            <button
              onClick={() => setShowUnassigned((s) => !s)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                showUnassigned
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-900/40 dark:text-brand-300'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              Unassigned ({unassigned.length})
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div className="org-canvas-dots relative flex flex-1 flex-col overflow-auto bg-slate-50/50 p-6 dark:bg-slate-950/40 sm:p-10">
        {roots.length > 0 ? (
          <div
            className="flex min-w-full flex-1 items-start justify-center"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out',
            }}
          >
            <ul className="org-tree w-max min-w-full pb-12 pt-4">
              {roots.map((root) => (
                <OrgTreeNode
                  key={root.id}
                  node={root}
                  isAdmin={isAdmin}
                  allPeople={allPeople}
                  searchQuery={searchQuery}
                  collapsedNodes={collapsedNodes}
                  onToggleNode={handleToggleNode}
                />
              ))}
            </ul>
          </div>
        ) : (
          <div className="m-auto max-w-md rounded-2xl border border-dashed border-slate-300 bg-white/80 p-8 text-center backdrop-blur shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <p className="text-base font-semibold text-slate-800 dark:text-slate-200">No reporting relationships yet</p>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {isAdmin
                ? 'Assign a manager to someone using the unassigned list below to start building the organization tree.'
                : 'No reporting relationships have been configured yet.'}
            </p>
            {unassigned.length > 0 && !showUnassigned && (
              <button
                onClick={() => setShowUnassigned(true)}
                className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                View {unassigned.length} Unassigned Members
              </button>
            )}
          </div>
        )}
      </div>

      {/* Collapsible Unassigned Section */}
      {unassigned.length > 0 && (
        <div
          className={`border-t border-slate-200 bg-white transition-all dark:border-slate-800 dark:bg-slate-900 ${
            showUnassigned ? 'max-h-[360px] overflow-y-auto p-4' : 'p-3'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowUnassigned((s) => !s)}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
              >
                <span className="text-slate-400 dark:text-slate-500">{showUnassigned ? '▾' : '▸'}</span>
                Not yet placed in chart
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {unassigned.length}
                </span>
              </button>
              <span className="hidden text-xs text-slate-400 dark:text-slate-500 sm:inline">
                {isAdmin
                  ? '— Assign a manager to add them into the tree above.'
                  : '— These people have no manager and no direct reports.'}
              </span>
            </div>
            <button
              onClick={() => setShowUnassigned((s) => !s)}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              {showUnassigned ? 'Hide' : 'Show'}
            </button>
          </div>

          {showUnassigned && (
            <div className="mt-3.5 flex flex-wrap gap-3 pb-1">
              {unassigned.map((person) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  isAdmin={isAdmin}
                  managerOptions={allPeople.filter((p) => p.id !== person.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
