'use client';

import { useState, useTransition } from 'react';
import { createRaciChart, addRaciStep, addRaciPerson, setRaciCell } from '@/lib/actions/raci';

const LETTERS = [
  { key: 'RESPONSIBLE', letter: 'R', title: 'Responsible' },
  { key: 'ACCOUNTABLE', letter: 'A', title: 'Accountable' },
  { key: 'CONSULTED', letter: 'C', title: 'Consulted' },
  { key: 'INFORMED', letter: 'I', title: 'Informed' },
] as const;

interface Person { id: string; name: string; roleTitle: string }
interface Step { id: string; stepName: string; stepOrder: number; cells: Record<string, string[]> }
interface Chart {
  id: string; processName: string; owner: string; trigger: string;
  ministryArea: string | null; createdAt: string; people: Person[]; steps: Step[];
}

export function RaciClient({ canManage, charts }: { canManage: boolean; charts: Chart[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [processName, setProcessName] = useState('');
  const [owner, setOwner] = useState('');
  const [openId, setOpenId] = useState<string | null>(charts[0]?.id ?? null);
  const [stepName, setStepName] = useState('');
  const [personName, setPersonName] = useState('');
  const [personRole, setPersonRole] = useState('');

  const open = charts.find((c) => c.id === openId) ?? null;

  function run(fn: () => Promise<{ success: boolean; error?: string } | { success: true }>) {
    setError(null);
    start(async () => {
      const res = (await fn()) as { success: boolean; error?: string };
      if (!res.success) setError(res.error ?? 'Something went wrong.');
    });
  }

  function toggle(step: Step, personId: string, role: string) {
    const current = step.cells[personId] ?? [];
    const next = current.includes(role) ? current.filter((r) => r !== role) : [...current, role];
    run(() => setRaciCell({ stepId: step.id, personId, designations: next }));
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">RACI Charts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Who is Responsible, Accountable, Consulted and Informed for each step of a process.
        </p>
      </header>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {canManage && (
        <form
          className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!processName.trim()) return;
            run(async () => {
              const r = await createRaciChart({ processName, owner });
              if (r.success) { setProcessName(''); setOwner(''); }
              return r;
            });
          }}
        >
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium text-slate-700">Process name</span>
            <input
              value={processName}
              onChange={(e) => setProcessName(e.target.value)}
              placeholder="e.g. Sunday Service Setup"
              className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium text-slate-700">Owner</span>
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="e.g. Worship Director"
              className="w-56 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'New chart'}
          </button>
        </form>
      )}

      {charts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No charts yet.{canManage ? ' Create one above to get started.' : ''}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {charts.map((c) => (
            <button
              key={c.id}
              onClick={() => setOpenId(c.id)}
              className={`rounded-full border px-3 py-1 text-sm ${
                c.id === openId
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-700'
              }`}
            >
              {c.processName}
            </button>
          ))}
        </div>
      )}

      {open && (
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{open.processName}</h2>
            {open.owner && <p className="text-sm text-slate-500">Owner: {open.owner}</p>}
          </div>

          {canManage && (
            <div className="flex flex-wrap gap-4">
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!stepName.trim()) return;
                  run(async () => {
                    const r = await addRaciStep({ chartId: open.id, stepName });
                    if (r.success) setStepName('');
                    return r;
                  });
                }}
              >
                <input
                  value={stepName}
                  onChange={(e) => setStepName(e.target.value)}
                  placeholder="Add a step…"
                  className="w-56 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
                <button disabled={pending} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
                  Add step
                </button>
              </form>

              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!personName.trim()) return;
                  run(async () => {
                    const r = await addRaciPerson({ chartId: open.id, name: personName, roleTitle: personRole });
                    if (r.success) { setPersonName(''); setPersonRole(''); }
                    return r;
                  });
                }}
              >
                <input
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="Add a person…"
                  className="w-44 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
                <input
                  value={personRole}
                  onChange={(e) => setPersonRole(e.target.value)}
                  placeholder="Role title"
                  className="w-40 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
                <button disabled={pending} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
                  Add person
                </button>
              </form>
            </div>
          )}

          {open.steps.length === 0 || open.people.length === 0 ? (
            <p className="text-sm text-slate-500">
              Add at least one step and one person to see the matrix.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-700">
                      Step
                    </th>
                    {open.people.map((p) => (
                      <th
                        key={p.id}
                        className="border-b border-slate-200 px-3 py-2 text-left font-medium text-slate-700"
                      >
                        {p.name}
                        {p.roleTitle && (
                          <span className="block text-xs font-normal text-slate-400">{p.roleTitle}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {open.steps.map((s) => (
                    <tr key={s.id}>
                      <td className="border-b border-slate-100 px-3 py-2 text-slate-800">{s.stepName}</td>
                      {open.people.map((p) => {
                        const cell = s.cells[p.id] ?? [];
                        return (
                          <td key={p.id} className="border-b border-slate-100 px-3 py-2">
                            <div className="flex gap-1">
                              {LETTERS.map((l) => {
                                const on = cell.includes(l.key);
                                return (
                                  <button
                                    key={l.key}
                                    title={l.title}
                                    disabled={pending}
                                    onClick={() => toggle(s, p.id, l.key)}
                                    className={`h-7 w-7 rounded border text-xs font-semibold ${
                                      on
                                        ? 'border-slate-900 bg-slate-900 text-white'
                                        : 'border-slate-200 bg-white text-slate-400 hover:border-slate-400'
                                    }`}
                                  >
                                    {l.letter}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
