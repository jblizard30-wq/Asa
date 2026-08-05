'use client';

import { useState } from 'react';
import Link from 'next/link';
import { NewProjectModal } from '@/components/NewProjectModal';

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  taskCount: number;
  openTaskCount: number;
}

export function ProjectsListClient({ projects, isAdmin }: { projects: ProjectSummary[]; isAdmin: boolean }) {
  const [showNewProject, setShowNewProject] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Projects</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">All the initiatives your team is working on.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowNewProject(true)}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + New project
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="rounded-lg border border-slate-200 bg-white p-5 hover:border-brand-300 hover:shadow-sm dark:border-slate-600 dark:bg-slate-800"
          >
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">{project.name}</h2>
            {project.description && (
              <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{project.description}</p>
            )}
            <div className="mt-4 flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
              <span>{project.memberCount} members</span>
              <span>{project.openTaskCount} open tasks</span>
            </div>
          </Link>
        ))}

        {projects.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-500 dark:text-slate-500">
            {isAdmin
              ? 'No projects yet. Create your first project to get started.'
              : "You haven't been added to any projects yet. Ask an admin to invite you."}
          </div>
        )}
      </div>

      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}
    </div>
  );
}
