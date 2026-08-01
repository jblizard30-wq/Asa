'use client';

import { useState } from 'react';
import { KanbanBoard, type KanbanSection } from '@/components/KanbanBoard';
import { ListView } from '@/components/ListView';
import { InviteMemberModal } from '@/components/InviteMemberModal';

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
  isAdmin,
}: {
  projectId: string;
  projectName: string;
  description: string | null;
  sections: KanbanSection[];
  members: ProjectMemberInfo[];
  isAdmin: boolean;
}) {
  const [view, setView] = useState<'list' | 'kanban'>('kanban');
  const [showInvite, setShowInvite] = useState(false);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{projectName}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          <p className="mt-2 text-xs text-slate-400">
            Members: {members.map((m) => m.name).join(', ') || 'None yet'}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInvite(true)}
            className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            + Invite member
          </button>
        )}
      </div>

      <div className="mt-6 inline-flex rounded-md border border-slate-200 bg-white p-1">
        <button
          onClick={() => setView('list')}
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            view === 'list' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          List
        </button>
        <button
          onClick={() => setView('kanban')}
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            view === 'kanban' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Kanban
        </button>
      </div>

      <div className="mt-4">
        {view === 'kanban' ? (
          <KanbanBoard projectId={projectId} sections={sections} />
        ) : (
          <ListView projectId={projectId} sections={sections} />
        )}
      </div>

      {showInvite && <InviteMemberModal projectId={projectId} onClose={() => setShowInvite(false)} />}
    </div>
  );
}
