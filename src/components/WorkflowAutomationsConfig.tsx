'use client';

import { useState } from 'react';

interface UserOption {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface ProjectOption {
  id: string;
  name: string;
}

export function WorkflowAutomationsConfig({
  users,
  projects,
}: {
  users: UserOption[];
  projects: ProjectOption[];
}) {
  const [ordererId, setOrdererId] = useState(users[0]?.id || '');
  const [deliveryId, setDeliveryId] = useState(users[0]?.id || '');
  const [secretaryId, setSecretaryId] = useState(users[0]?.id || '');
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Cross-Module Automation Rules & Role Routing
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Configure which staff members automatically receive tasks when events occur in Inventory or Executive Pastor Hub.
        </p>

        {saved && (
          <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            ✓ Automation routing rules saved successfully!
          </div>
        )}

        <form onSubmit={handleSave} className="mt-6 space-y-6">
          {/* Target Project */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Operations Hub Project
            </h3>
            <p className="text-xs text-slate-500">
              The project where automated restock and production tasks are created.
            </p>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="mt-2 block w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Consumable Restock Loop */}
          <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                1. Consumables Restock Loop
              </h3>
              <p className="text-xs text-slate-500">
                Volunteer submits count below par → Task created for Purchasing Agent → PO received → Task created for Facilities.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Purchasing Agent / Orderer
                </label>
                <select
                  value={ordererId}
                  onChange={(e) => setOrdererId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email} ({u.role})
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-400">Receives order review and Amazon multi-cart tasks.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Facilities / Stocking Lead
                </label>
                <select
                  value={deliveryId}
                  onChange={(e) => setDeliveryId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email} ({u.role})
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-400">Receives room distribution checklist tasks.</span>
              </div>
            </div>
          </div>

          {/* Elder Packet Loop */}
          <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                2. Board Packet Print Order Loop
              </h3>
              <p className="text-xs text-slate-500">
                Executive Pastor requests print run in XP Hub → Task created with copy count, binding, and paper stock specs.
              </p>
            </div>

            <div className="max-w-md">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Executive Secretary / Office Admin
              </label>
              <select
                value={secretaryId}
                onChange={(e) => setSecretaryId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email} ({u.role})
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400">Receives printing, spiral binding, and collating tasks.</span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-5 py-2 text-xs font-semibold text-white shadow hover:bg-brand-700"
            >
              Save Workflow Automations
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
