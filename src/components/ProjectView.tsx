'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { KanbanBoard, type KanbanSection, type CustomFieldDef } from '@/components/KanbanBoard';
import { ListView } from '@/components/ListView';
import { GridView } from '@/components/GridView';
import { InviteMemberModal } from '@/components/InviteMemberModal';
import { setProjectManager } from '@/lib/actions/projects';
import { CustomFieldsManager } from '@/components/CustomFieldsManager';
import { TagsManager } from '@/components/TagsManager';
import { TaskFilterBar } from '@/components/TaskFilterBar';
import { ProjectDashboardView } from '@/components/ProjectDashboardView';
import type { TagInfo } from '@/components/TagPicker';
import { PRIORITY_LABELS, STATUS_LABELS } from '@/lib/format';
import { EMPTY_TASK_FILTERS, UNASSIGNED_ID, countActiveFilters, matchesTaskFilters, type TaskFilters } from '@/lib/taskFilters';

export interface ProjectMemberInfo {
  id: string;
  name: string;
  isManager: boolean;
  role: string;
}

export interface ProjectTeamInfo {
  id: string;
  name: string;
}

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([id, label]) => ({ id, label }));
const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS).map(([id, label]) => ({ id, label }));

export function ProjectView({
  projectId,
  projectName,
  description,
  sections,
  members,
  teams,
  memberTeamIds,
  customFields,
  tags,
  isAdmin,
}: {
  projectId: string;
  projectName: string;
  description: string | null;
  sections: KanbanSection[];
  members: ProjectMemberInfo[];
  teams: ProjectTeamInfo[];
  memberTeamIds: Record<string, string[]>;
  customFields: CustomFieldDef[];
  tags: TagInfo[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<'list' | 'kanban' | 'grid' | 'dashboard'>('kanban');
  const [showInvite, setShowInvite] = useState(false);
  const [showFields, setShowFields] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_TASK_FILTERS);
  const [togglingManagerId, setTogglingManagerId] = useState<string | null>(null);

  async function toggleManager(memberId: string, nextIsManager: boolean) {
    setTogglingManagerId(memberId);
    await setProjectManager(projectId, memberId, nextIsManager);
    setTogglingManagerId(null);
    router.refresh();
  }

  const assigneeOptions = useMemo(
    () => [{ id: UNASSIGNED_ID, label: 'Unassigned' }, ...members.map((m) => ({ id: m.id, label: m.name }))],
    [members],
  );
  const teamOptions = useMemo(() => teams.map((t) => ({ id: t.id, label: t.name })), [teams]);
  const tagOptions = useMemo(() => tags.map((t) => ({ id: t.id, label: t.name })), [tags]);

  const filtersActive = countActiveFilters(filters) > 0;

  const filteredSections = useMemo(() => {
    if (!filtersActive) return sections;
    return sections.map((section) => ({
      ...section,
      tasks: section.tasks.filter((task) => matchesTaskFilters(task, filters, { teamIdsByUserId: memberTeamIds })),
    }));
  }, [sections, filters, filtersActive, memberTeamIds]);

  const totalFilteredTasks = useMemo(
    () => filteredSections.reduce((sum, section) => sum + section.tasks.length, 0),
    [filteredSections],
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{projectName}</h1>
          {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
          {isAdmin ? (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
              <span>Members:</span>
              {members.length === 0 && <span>None yet</span>}
              {members.map((m) =>
                m.role === 'MANAGER' ? (
                  <label key={m.id} className="flex items-center gap-1 whitespace-nowrap" title="Manages this project's exec-summary digest">
                    <span>{m.name}</span>
                    <input
                      type="checkbox"
                      checked={m.isManager}
                      disabled={togglingManagerId === m.id}
                      onChange={(e) => toggleManager(m.id, e.target.checked)}
                      className="h-3 w-3"
                    />
                    <span className="text-[10px] uppercase tracking-wide">Mgr</span>
                  </label>
                ) : (
                  <span key={m.id} className="whitespace-nowrap">
                    {m.name}
                  </span>
                )
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              Members: {members.map((m) => (m.isManager ? `${m.name} (manager)` : m.name)).join(', ') || 'None yet'}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/projects/${projectId}/automations`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Automations
          </Link>
          <Link
            href={`/projects/${projectId}/forms`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Forms
          </Link>
          <Link
            href={`/projects/${projectId}/workflow`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Workflow
          </Link>
          <button
            onClick={() => setShowFields(true)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Manage fields
          </button>
          <button
            onClick={() => setShowTags(true)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Manage tags
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowInvite(true)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              + Invite member
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 inline-flex rounded-md border border-slate-200 bg-white p-1 dark:border-slate-600 dark:bg-slate-800">
        <button
          onClick={() => setView('list')}
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            view === 'list' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          List
        </button>
        <button
          onClick={() => setView('kanban')}
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            view === 'kanban' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          Kanban
        </button>
        <button
          onClick={() => setView('grid')}
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            view === 'grid' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          Grid
        </button>
        <button
          onClick={() => setView('dashboard')}
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            view === 'dashboard' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          Dashboard
        </button>
      </div>

      {view !== 'dashboard' && (
        <div className="mt-4">
          <TaskFilterBar
            filters={filters}
            onChange={setFilters}
            statusOptions={STATUS_OPTIONS}
            priorityOptions={PRIORITY_OPTIONS}
            assigneeOptions={assigneeOptions}
            teamOptions={teamOptions}
            tagOptions={tagOptions}
            searchPlaceholder="Search this project's tasks…"
            scope="project"
            projectId={projectId}
          />
        </div>
      )}

      {view !== 'dashboard' && filtersActive && totalFilteredTasks === 0 && (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          No tasks match your filters.{' '}
          <button onClick={() => setFilters(EMPTY_TASK_FILTERS)} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            Clear filters
          </button>
        </p>
      )}

      <div className="mt-4">
        {view === 'kanban' && (
          <KanbanBoard projectId={projectId} sections={filteredSections} filtersActive={filtersActive} />
        )}
        {view === 'list' && (
          <ListView
            projectId={projectId}
            sections={filteredSections}
            members={members}
            customFields={customFields}
            filtersActive={filtersActive}
          />
        )}
        {view === 'grid' && (
          <GridView
            projectId={projectId}
            sections={filteredSections}
            members={members}
            allTags={tags}
            filtersActive={filtersActive}
          />
        )}
        {view === 'dashboard' && (
          <ProjectDashboardView projectId={projectId} projectName={projectName} sections={sections} />
        )}
      </div>

      {showInvite && <InviteMemberModal projectId={projectId} onClose={() => setShowInvite(false)} />}
      {showFields && (
        <CustomFieldsManager projectId={projectId} fields={customFields} onClose={() => setShowFields(false)} />
      )}
      {showTags && <TagsManager projectId={projectId} tags={tags} onClose={() => setShowTags(false)} />}
    </div>
  );
}
