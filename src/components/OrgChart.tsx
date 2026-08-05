'use client';

import { useState } from 'react';
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
  MANAGER: 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-200',
  USER: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
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
}: {
  person: OrgChartPerson;
  isAdmin: boolean;
  managerOptions: PersonOption[];
  reportCount?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
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
    <div className="w-52 shrink-0 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm dark:border-slate-600 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{person.name}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{person.email}</p>
        </div>
        {typeof reportCount === 'number' && reportCount > 0 && (
          <button
            onClick={onToggleCollapse}
            className="shrink-0 rounded p-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700"
            title={collapsed ? 'Expand reports' : 'Collapse reports'}
            aria-label={collapsed ? 'Expand reports' : 'Collapse reports'}
          >
            {collapsed ? '▸' : '▾'}
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <RolePill role={person.role} />
        {typeof reportCount === 'number' && reportCount > 0 && (
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {reportCount} report{reportCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {isAdmin && (
        <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-700">
          {editing ? (
            <select
              autoFocus
              defaultValue=""
              disabled={pending}
              onChange={(e) => void handleChange(e.target.value)}
              onBlur={() => setEditing(false)}
              className="w-full rounded-md border border-slate-200 px-1.5 py-1 text-xs text-slate-600 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
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
}: {
  node: OrgNode;
  isAdmin: boolean;
  allPeople: PersonOption[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const excluded = collectDescendantIds(node);
  const managerOptions = allPeople.filter((p) => !excluded.has(p.id));

  return (
    <li>
      <PersonCard
        person={node}
        isAdmin={isAdmin}
        managerOptions={managerOptions}
        reportCount={node.children.length}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />
      {node.children.length > 0 && !collapsed && (
        <ul>
          {node.children.map((child) => (
            <OrgTreeNode key={child.id} node={child} isAdmin={isAdmin} allPeople={allPeople} />
          ))}
        </ul>
      )}
    </li>
  );
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
  return (
    <div>
      {roots.length > 0 ? (
        <div className="overflow-x-auto pb-4">
          <ul className="org-tree">
            {roots.map((root) => (
              <OrgTreeNode key={root.id} node={root} isAdmin={isAdmin} allPeople={allPeople} />
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-600 dark:text-slate-500">
          {isAdmin
            ? 'No reporting relationships yet. Assign a manager to someone below to start building the chart.'
            : "No reporting relationships have been set up yet."}
        </div>
      )}

      {unassigned.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Not yet placed ({unassigned.length})
          </h2>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            These people have no manager and no direct reports.
            {isAdmin && ' Assign a manager to add them to the chart above.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {unassigned.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                isAdmin={isAdmin}
                managerOptions={allPeople.filter((p) => p.id !== person.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
