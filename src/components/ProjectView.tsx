'use client';

import { useState } from 'react';
import Link from 'next/link';
import { KanbanBoard, type KanbanSection, type CustomFieldDef } from '@/components/KanbanBoard';
import { ListView } from '@/components/ListView';
import { GridView } from '@/components/GridView';
import { InviteMemberModal } from '@/components/InviteMemberModal';
import { CustomFieldsManager } from '@/components/CustomFieldsManager';
import { TagsManager } from '@/components/TagsManager';
import type { TagInfo } from '@/components/TagPicker';

export interface ProjectMemberInfo {
  id: string;
  name: string;
}

export function ProjectView({
  projectId,
  projectName,
  description,
  sections,
  members,
  customFields,
  tags,
  isAdmin,
}: {
  projectId: string;
  projectName: string;
  description: string | null;
  sections: KanbanSection[];
  members: ProjectMemberInfo[];
  customFields: CustomFieldDef[];
  tags: TagInfo[];
  isAdmin: boolean;
}) {
  const [view, setView] = useState<'list' | 'kanban' | 'grid'>('kanban');
  const [showInvite, setShowInvite] = useState(false);
  const [showFields, setShowFields] = useState(false);
  const [showTags, setShowTags] = useState(false);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{projectName}</h1>
          {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            Members: {members.map((m) => m.name).join(', ') || 'None yet'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/projects/${projectId}/automations`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Automations
          </Link>
          <Link
            href={`/projects/${projectId}/forms`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Forms
          </Link>
          <Link
            href={`/projects/${projectId}/workflow`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Workflow
          </Link>
          <button
            onClick={() => setShowFields(true)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Manage fields
          </button>
          <button
            onClick={() => setShowTags(true)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Manage tags
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowInvite(true)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              + Invite member
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 inline-flex rounded-md border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
        <button
          onClick={() => setView('list')}
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            view === 'list' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          List
        </button>
        <button
          onClick={() => setView('kanban')}
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            view === 'kanban' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          Kanban
        </button>
        <button
          onClick={() => setView('grid')}
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            view === 'grid' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          Grid
        </button>
      </div>

      <div className="mt-4">
        {view === 'kanban' && <KanbanBoard projectId={projectId} sections={sections} />}
        {view === 'list' && (
          <ListView projectId={projectId} sections={sections} members={members} customFields={customFields} />
        )}
        {view === 'grid' && (
          <GridView projectId={projectId} sections={sections} members={members} allTags={tags} />
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
