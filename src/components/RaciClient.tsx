'use client';

import React, { useState, useTransition, useMemo, useRef, useEffect } from 'react';
import {
  createRaciChart,
  updateRaciChart,
  archiveRaciChart,
  shareRaciChart,
  removeRaciChartShare,
  addRaciStep,
  bulkAddRaciSteps,
  updateRaciStep,
  deleteRaciStep,
  addRaciPerson,
  updateRaciPerson,
  deleteRaciPerson,
  setRaciCell,
} from '@/lib/actions/raci';

const LETTERS = [
  { key: 'RESPONSIBLE', letter: 'R', title: 'Responsible (does the work)', color: 'bg-blue-600 text-white border-blue-700' },
  { key: 'ACCOUNTABLE', letter: 'A', title: 'Accountable (decision maker / buck stops here)', color: 'bg-amber-500 text-white border-amber-600' },
  { key: 'CONSULTED', letter: 'C', title: 'Consulted (two-way input provided)', color: 'bg-purple-600 text-white border-purple-700' },
  { key: 'INFORMED', letter: 'I', title: 'Informed (kept updated on progress)', color: 'bg-slate-700 text-white border-slate-800' },
] as const;

export interface Person {
  id: string;
  name: string;
  roleTitle: string;
  personOrder: number;
}

export interface Step {
  id: string;
  stepName: string;
  stepOrder: number;
  cells: Record<string, string[]>;
}

export interface ShareItem {
  id: string;
  targetType: 'USER' | 'TEAM';
  targetId: string;
  name: string;
  access: 'VIEW' | 'EDIT';
}

export interface Chart {
  id: string;
  processName: string;
  owner: string;
  trigger: string;
  ministryArea: string | null;
  tags: string[];
  isPublic: boolean;
  createdById: string | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  shares: ShareItem[];
  people: Person[];
  steps: Step[];
}

interface AvailableTeam {
  id: string;
  name: string;
}

interface AvailableUser {
  id: string;
  name: string | null;
  email: string;
}

interface RaciClientProps {
  canCreate: boolean;
  currentUserId: string;
  charts: Chart[];
  availableTeams: AvailableTeam[];
  availableUsers: AvailableUser[];
}

const TEMPLATES = [
  {
    name: 'Blank Grid',
    desc: 'Start with an empty canvas',
    tags: ['Custom'],
    steps: ['Step 1', 'Step 2'],
    people: [{ name: 'Lead', role: 'Owner' }, { name: 'Support', role: 'Member' }],
  },
  {
    name: 'Sunday Service Production',
    desc: 'Audio, tech, sermon, and run-of-service coordination',
    tags: ['Worship', 'Sunday', 'Production'],
    steps: [
      'Sound check & in-ear mix confirmation',
      'Stage lights & visual slide check',
      'Pastor & speaker lapel mic check',
      'Livestream broadcast live check',
      'Sermon recording & post-service tear-down',
    ],
    people: [
      { name: 'Lead Pastor', role: 'Preacher' },
      { name: 'Worship Leader', role: 'Band Director' },
      { name: 'Audio Engineer', role: 'Sound Tech' },
      { name: 'Video Producer', role: 'Livestream Lead' },
    ],
  },
  {
    name: 'Easter / Special Event Operations',
    desc: 'Large multi-department church-wide initiative',
    tags: ['Easter', 'Events', 'Operations'],
    steps: [
      'Event budget & venue layout sign-off',
      'Volunteer call & role assignment',
      'Sanctuary staging & overflow seating setup',
      'Security & parking briefing',
      'Post-event debrief & cleanup',
    ],
    people: [
      { name: 'Executive Pastor', role: 'Project Sponsor' },
      { name: 'Facilities Director', role: 'Building Lead' },
      { name: 'Connections Pastor', role: 'Volunteers' },
      { name: 'Finance Lead', role: 'Budget Oversight' },
    ],
  },
  {
    name: 'Volunteer Onboarding & Clearance',
    desc: 'Background check, orientation, and shadow scheduling',
    tags: ['Volunteers', 'HR', 'Safety'],
    steps: [
      'Application & references review',
      'Criminal background check submission & clearance',
      'Child safety policy orientation',
      'First Sunday team shadow scheduled',
    ],
    people: [
      { name: 'Ministry Director', role: 'Hiring Lead' },
      { name: 'Admin Coordinator', role: 'Compliance' },
      { name: 'Team Mentor', role: 'Trainer' },
    ],
  },
];

export function RaciClient({
  canCreate,
  currentUserId,
  charts: initialCharts,
  availableTeams,
  availableUsers,
}: RaciClientProps) {
  const [charts, setCharts] = useState<Chart[]>(initialCharts);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Keep charts updated if props change
  useEffect(() => {
    setCharts(initialCharts);
  }, [initialCharts]);

  // Active chart
  const [openId, setOpenId] = useState<string | null>(initialCharts[0]?.id ?? null);
  const open = useMemo(() => charts.find((c) => c.id === openId) ?? null, [charts, openId]);

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'steps'>('recent');

  // Modals
  const [showNewModal, setShowNewModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);

  // New Chart Form State
  const [newProcessName, setNewProcessName] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [newTagsInput, setNewTagsInput] = useState('');
  const [newIsPublic, setNewIsPublic] = useState(true);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number>(0);

  // Inline inputs in Grid
  const [newStepInput, setNewStepInput] = useState('');
  const [newPersonNameInput, setNewPersonNameInput] = useState('');
  const [newPersonRoleInput, setNewPersonRoleInput] = useState('');
  const [showAddColumnPopover, setShowAddColumnPopover] = useState(false);

  // Inline editing cell states
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingStepText, setEditingStepText] = useState('');
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editingPersonName, setEditingPersonName] = useState('');
  const [editingPersonRole, setEditingPersonRole] = useState('');

  // Inline Tag addition in header
  const [showAddTagInput, setShowAddTagInput] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  // Paste multiple steps
  const [pasteContent, setPasteContent] = useState('');

  // Keyboard navigation active cell
  const [focusedCell, setFocusedCell] = useState<{ stepIndex: number; personIndex: number } | null>(null);
  const stepInputRef = useRef<HTMLInputElement>(null);
  const columnInputRef = useRef<HTMLInputElement>(null);

  // Unique tags list with counts
  const allTagsWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    charts.forEach((c) => {
      c.tags.forEach((t) => {
        const norm = t.toLowerCase();
        counts[norm] = (counts[norm] || 0) + 1;
      });
    });
    return Object.entries(counts).map(([tag, count]) => ({ tag, count }));
  }, [charts]);

  // Filtered & Sorted charts
  const filteredCharts = useMemo(() => {
    let result = [...charts];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.processName.toLowerCase().includes(q) ||
          c.owner.toLowerCase().includes(q) ||
          c.trigger.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)) ||
          (c.ministryArea && c.ministryArea.toLowerCase().includes(q))
      );
    }

    if (selectedTag) {
      const norm = selectedTag.toLowerCase();
      result = result.filter((c) => c.tags.some((t) => t.toLowerCase() === norm));
    }

    if (sortBy === 'name') {
      result.sort((a, b) => a.processName.localeCompare(b.processName));
    } else if (sortBy === 'steps') {
      result.sort((a, b) => b.steps.length - a.steps.length);
    } else {
      result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    return result;
  }, [charts, searchQuery, selectedTag, sortBy]);

  // Set openId if current open is filtered out or missing
  useEffect(() => {
    if (filteredCharts.length > 0) {
      if (!openId || !filteredCharts.some((c) => c.id === openId)) {
        setOpenId(filteredCharts[0].id);
      }
    }
  }, [filteredCharts, openId]);

  // Transition runner helper
  function runAction<T>(fn: () => Promise<{ success: boolean; error?: string } | { success: true } & T>) {
    setError(null);
    startTransition(async () => {
      const res = (await fn()) as { success: boolean; error?: string };
      if (!res.success) {
        setError(res.error ?? 'Something went wrong.');
      }
    });
  }

  // --- Keyboard Navigation in Grid ---
  const handleGridKeyDown = (e: React.KeyboardEvent, stepIndex: number, personIndex: number) => {
    if (!open) return;
    const maxSteps = open.steps.length;
    const maxPeople = open.people.length;

    // Arrow keys
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedCell({ stepIndex: Math.max(0, stepIndex - 1), personIndex });
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedCell({ stepIndex: Math.min(maxSteps - 1, stepIndex + 1), personIndex });
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setFocusedCell({ stepIndex, personIndex: Math.max(0, personIndex - 1) });
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setFocusedCell({ stepIndex, personIndex: Math.min(maxPeople - 1, personIndex + 1) });
      return;
    }

    // Direct RACI letter keystrokes: R, A, C, I
    const keyUpper = e.key.toUpperCase();
    const targetLetter = LETTERS.find((l) => l.letter === keyUpper);
    const step = open.steps[stepIndex];
    const person = open.people[personIndex];

    if (!open.canEdit || !step || !person) return;

    if (targetLetter) {
      e.preventDefault();
      const current = step.cells[person.id] ?? [];
      const next = current.includes(targetLetter.key)
        ? current.filter((r) => r !== targetLetter.key)
        : [...current, targetLetter.key];

      toggleCell(step, person.id, targetLetter.key);
      return;
    }

    // Backspace or Delete to clear
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      setCellOptimistic(step.id, person.id, []);
      runAction(() => setRaciCell({ stepId: step.id, personId: person.id, designations: [] }));
      return;
    }

    // Space to cycle
    if (e.key === ' ') {
      e.preventDefault();
      const current = step.cells[person.id] ?? [];
      let next: string[] = [];
      if (current.length === 0) next = ['RESPONSIBLE'];
      else if (current.includes('RESPONSIBLE')) next = ['ACCOUNTABLE'];
      else if (current.includes('ACCOUNTABLE')) next = ['CONSULTED'];
      else if (current.includes('CONSULTED')) next = ['INFORMED'];
      else next = [];

      setCellOptimistic(step.id, person.id, next);
      runAction(() => setRaciCell({ stepId: step.id, personId: person.id, designations: next }));
      return;
    }
  };

  // Optimistic cell toggle
  function toggleCell(step: Step, personId: string, role: string) {
    const current = step.cells[personId] ?? [];
    const next = current.includes(role) ? current.filter((r) => r !== role) : [...current, role];
    setCellOptimistic(step.id, personId, next);
    runAction(() => setRaciCell({ stepId: step.id, personId, designations: next }));
  }

  function setCellOptimistic(stepId: string, personId: string, designations: string[]) {
    if (!open) return;
    setCharts((prev) =>
      prev.map((c) => {
        if (c.id !== open.id) return c;
        return {
          ...c,
          steps: c.steps.map((s) => {
            if (s.id !== stepId) return s;
            return {
              ...s,
              cells: {
                ...s.cells,
                [personId]: designations,
              },
            };
          }),
        };
      })
    );
  }

  // --- Fast Inline Step Addition (Enter to add & repeat) ---
  const handleQuickAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!open || !newStepInput.trim()) return;
    const name = newStepInput.trim();
    setNewStepInput('');

    // Optimistic step add
    const tempId = 'temp-' + Date.now();
    const tempStep: Step = {
      id: tempId,
      stepName: name,
      stepOrder: open.steps.length,
      cells: {},
    };

    setCharts((prev) =>
      prev.map((c) => {
        if (c.id !== open.id) return c;
        return { ...c, steps: [...c.steps, tempStep] };
      })
    );

    // Keep focus on input for continuous rapid-fire entry
    stepInputRef.current?.focus();

    const res = await addRaciStep({ chartId: open.id, stepName: name });
    if (!res.success) {
      setError(res.error);
      // rollback
      setCharts((prev) =>
        prev.map((c) => {
          if (c.id !== open.id) return c;
          return { ...c, steps: c.steps.filter((s) => s.id !== tempId) };
        })
      );
    } else if (res.stepId) {
      setCharts((prev) =>
        prev.map((c) => {
          if (c.id !== open.id) return c;
          return {
            ...c,
            steps: c.steps.map((s) => (s.id === tempId ? { ...s, id: res.stepId } : s)),
          };
        })
      );
    }
  };

  // --- Fast Inline Column / Person Addition ---
  const handleQuickAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!open || !newPersonNameInput.trim()) return;
    const name = newPersonNameInput.trim();
    const role = newPersonRoleInput.trim();
    setNewPersonNameInput('');
    setNewPersonRoleInput('');
    setShowAddColumnPopover(false);

    const tempId = 'temp-p-' + Date.now();
    const tempPerson: Person = {
      id: tempId,
      name,
      roleTitle: role,
      personOrder: open.people.length,
    };

    setCharts((prev) =>
      prev.map((c) => {
        if (c.id !== open.id) return c;
        return { ...c, people: [...c.people, tempPerson] };
      })
    );

    const res = await addRaciPerson({ chartId: open.id, name, roleTitle: role });
    if (!res.success) {
      setError(res.error);
      setCharts((prev) =>
        prev.map((c) => {
          if (c.id !== open.id) return c;
          return { ...c, people: c.people.filter((p) => p.id !== tempId) };
        })
      );
    } else if (res.personId) {
      setCharts((prev) =>
        prev.map((c) => {
          if (c.id !== open.id) return c;
          return {
            ...c,
            people: c.people.map((p) => (p.id === tempId ? { ...p, id: res.personId } : p)),
          };
        })
      );
    }
  };

  // --- Bulk Paste Steps ---
  const handleBulkPaste = async () => {
    if (!open || !pasteContent.trim()) return;
    const lines = pasteContent
      .split('\n')
      .map((l) => l.trim().replace(/^[\d\.\-\*\•\)\s]+/, '').trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    setShowPasteModal(false);
    setPasteContent('');

    runAction(async () => {
      const res = await bulkAddRaciSteps({ chartId: open.id, stepNames: lines });
      return res;
    });
  };

  // --- Tag Management on Current Chart ---
  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!open || !newTagInput.trim()) return;
    const clean = newTagInput.trim().replace(/^#+/, '');
    if (open.tags.includes(clean)) {
      setNewTagInput('');
      setShowAddTagInput(false);
      return;
    }

    const updatedTags = [...open.tags, clean];
    setNewTagInput('');
    setShowAddTagInput(false);

    setCharts((prev) =>
      prev.map((c) => (c.id === open.id ? { ...c, tags: updatedTags } : c))
    );

    runAction(() => updateRaciChart({ chartId: open.id, tags: updatedTags }));
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!open) return;
    const updatedTags = open.tags.filter((t) => t !== tagToRemove);
    setCharts((prev) =>
      prev.map((c) => (c.id === open.id ? { ...c, tags: updatedTags } : c))
    );
    runAction(() => updateRaciChart({ chartId: open.id, tags: updatedTags }));
  };

  // --- Toggle Public / Restricted Visibility ---
  const handleTogglePublic = (isPublic: boolean) => {
    if (!open) return;
    setCharts((prev) =>
      prev.map((c) => (c.id === open.id ? { ...c, isPublic } : c))
    );
    runAction(() => updateRaciChart({ chartId: open.id, isPublic }));
  };

  // --- Template Creation Selection ---
  const handleCreateFromTemplate = async () => {
    if (!newProcessName.trim()) return;
    const tpl = TEMPLATES[selectedTemplateIndex];
    const rawTags = newTagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    const combinedTags = Array.from(new Set([...tpl.tags, ...rawTags]));

    setShowNewModal(false);
    const pName = newProcessName.trim();
    const pOwner = newOwner.trim();
    setNewProcessName('');
    setNewOwner('');
    setNewTagsInput('');

    startTransition(async () => {
      const res = await createRaciChart({
        processName: pName,
        owner: pOwner,
        tags: combinedTags,
        isPublic: newIsPublic,
      });

      if (res.success) {
        // If template has steps or people, populate them sequentially
        if (tpl.steps.length > 0) {
          await bulkAddRaciSteps({ chartId: res.chartId, stepNames: tpl.steps });
        }
        for (const p of tpl.people) {
          await addRaciPerson({ chartId: res.chartId, name: p.name, roleTitle: p.role });
        }
        setOpenId(res.chartId);
      } else {
        setError(res.error || 'Could not create chart.');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">RACI Accountability Hub</h1>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              {charts.length} {charts.length === 1 ? 'chart' : 'charts'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Define cross-department and team accountability (Responsible, Accountable, Consulted, Informed) with rapid spreadsheet entry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canCreate && (
            <button
              onClick={() => {
                setNewProcessName('');
                setNewOwner('');
                setNewTagsInput('');
                setShowNewModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white shadow hover:bg-slate-800 transition-colors"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              <span>New Chart</span>
            </button>
          )}
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-800">
            ✕
          </button>
        </div>
      )}

      {/* Search & Tag Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search charts by name, owner, tags, or ministry..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-8 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'recent' | 'name' | 'steps')}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none"
            >
              <option value="recent">Recently Updated</option>
              <option value="name">Alphabetical (A-Z)</option>
              <option value="steps">Most Steps</option>
            </select>
          </div>
        </div>

        {/* Tag pills filter list */}
        {allTagsWithCounts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2 text-xs">
            <span className="text-slate-400 font-medium mr-1">Tags:</span>
            <button
              onClick={() => setSelectedTag(null)}
              className={`rounded-full px-2.5 py-0.5 font-medium transition-colors ${
                selectedTag === null
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({charts.length})
            </button>
            {allTagsWithCounts.map(({ tag, count }) => {
              const active = selectedTag?.toLowerCase() === tag.toLowerCase();
              return (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(active ? null : tag)}
                  className={`rounded-full px-2.5 py-0.5 font-medium transition-colors flex items-center gap-1 ${
                    active
                      ? 'bg-blue-700 text-white'
                      : 'bg-blue-50 text-blue-700 border border-blue-200/60 hover:bg-blue-100'
                  }`}
                >
                  <span>#{tag}</span>
                  <span className="opacity-70 text-[10px]">({count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Chart Selector Pills */}
      {filteredCharts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <p className="text-sm font-medium text-slate-600">No RACI charts found.</p>
          <p className="mt-1 text-xs text-slate-400">
            {searchQuery || selectedTag
              ? 'Try adjusting your search or tag filters.'
              : 'Create your first chart using the button above.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {filteredCharts.map((c) => {
            const isActive = c.id === openId;
            return (
              <button
                key={c.id}
                onClick={() => setOpenId(c.id)}
                className={`group flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-all ${
                  isActive
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>{c.processName}</span>
                {c.tags.length > 0 && (
                  <span
                    className={`rounded px-1.5 py-0.2 text-[10px] ${
                      isActive ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    #{c.tags[0]}
                  </span>
                )}
                {!c.isPublic && (
                  <span title="Restricted / Shared" className={isActive ? 'text-amber-300' : 'text-amber-600'}>
                    🔒
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Grid Workspace */}
      {open && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {/* Chart Sub-Header & Controls */}
          <div className="flex flex-col gap-3 pb-4 border-b border-slate-100 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{open.processName}</h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border ${
                    open.isPublic
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {open.isPublic ? '🌐 Church-wide' : '🔒 Shared / Restricted'}
                </span>
                {open.shares.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                    {open.shares.length} {open.shares.length === 1 ? 'collaborator' : 'collaborators'}
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                {open.owner && <span><strong>Owner:</strong> {open.owner}</span>}
                {open.ministryArea && <span><strong>Ministry:</strong> {open.ministryArea}</span>}
                <span><strong>Updated:</strong> {new Date(open.updatedAt).toLocaleDateString()}</span>
              </div>

              {/* Tags Editor Row */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {open.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700 font-medium"
                  >
                    <span>#{tag}</span>
                    {open.canEdit && (
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="text-slate-400 hover:text-red-600 font-bold ml-0.5"
                        title="Remove tag"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}

                {open.canEdit && (
                  <>
                    {showAddTagInput ? (
                      <form onSubmit={handleAddTag} className="inline-flex items-center gap-1">
                        <input
                          autoFocus
                          type="text"
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          placeholder="Tag name…"
                          className="rounded border border-slate-300 px-2 py-0.5 text-xs w-24 focus:outline-none focus:border-slate-500"
                        />
                        <button
                          type="submit"
                          className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-white"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddTagInput(false)}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <button
                        onClick={() => setShowAddTagInput(true)}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium px-1.5 py-0.5 rounded border border-dashed border-blue-200 hover:border-blue-400"
                      >
                        <span>+ Tag</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Quick Action Toolbar */}
            <div className="flex flex-wrap items-center gap-2 self-start">
              {/* Share Button */}
              <button
                onClick={() => setShowShareModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-slate-500">
                  <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .792l6.733 3.367a2.5 2.5 0 11-.671 1.341l-6.733-3.367a2.5 2.5 0 110-3.474l6.733-3.367A2.52 2.52 0 0113 4.5z" />
                </svg>
                <span>Share</span>
                {open.shares.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-600">
                    {open.shares.length}
                  </span>
                )}
              </button>

              {/* Paste Multiple Steps */}
              {open.canEdit && (
                <button
                  onClick={() => setShowPasteModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
                >
                  <span className="text-amber-500">⚡</span>
                  <span>Paste Steps</span>
                </button>
              )}

              {/* Delete / Archive */}
              {open.canEdit && (
                <button
                  onClick={() => {
                    if (confirm(`Are you sure you want to archive "${open.processName}"?`)) {
                      runAction(() => archiveRaciChart({ chartId: open.id }));
                    }
                  }}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
                  title="Archive chart"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path
                      fillRule="evenodd"
                      d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 001.5.06l.3-7.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Quick Legend & Key Tips */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 px-3.5 py-2 rounded-lg border border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-slate-700">RACI Legend:</span>
              <span className="inline-flex items-center gap-1 text-slate-700">
                <span className="h-4 w-4 rounded text-center text-[10px] font-bold bg-blue-600 text-white">R</span> Responsible
              </span>
              <span className="inline-flex items-center gap-1 text-slate-700">
                <span className="h-4 w-4 rounded text-center text-[10px] font-bold bg-amber-500 text-white">A</span> Accountable
              </span>
              <span className="inline-flex items-center gap-1 text-slate-700">
                <span className="h-4 w-4 rounded text-center text-[10px] font-bold bg-purple-600 text-white">C</span> Consulted
              </span>
              <span className="inline-flex items-center gap-1 text-slate-700">
                <span className="h-4 w-4 rounded text-center text-[10px] font-bold bg-slate-700 text-white">I</span> Informed
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500">
              <span>⌨️ <strong>Speed Keys:</strong> Select cell & press <strong>R</strong>, <strong>A</strong>, <strong>C</strong>, <strong>I</strong>, or <strong>Arrows</strong></span>
            </div>
          </div>

          {/* Grid View */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-inner bg-white">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 divide-x divide-slate-200">
                  {/* Step Index & Name Header */}
                  <th className="w-12 py-2.5 px-3 text-center font-bold text-slate-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="min-w-[280px] py-2.5 px-4 text-left font-semibold uppercase tracking-wider">
                    Step / Process Task
                  </th>

                  {/* Role / Person Columns */}
                  {open.people.map((p, personIndex) => (
                    <th
                      key={p.id}
                      className="min-w-[130px] py-2.5 px-3 text-center font-semibold relative group"
                    >
                      {editingPersonId === p.id ? (
                        <div className="flex flex-col gap-1">
                          <input
                            autoFocus
                            type="text"
                            value={editingPersonName}
                            onChange={(e) => setEditingPersonName(e.target.value)}
                            placeholder="Name / Dept"
                            className="rounded border border-blue-400 px-1.5 py-0.5 text-xs font-semibold focus:outline-none"
                          />
                          <input
                            type="text"
                            value={editingPersonRole}
                            onChange={(e) => setEditingPersonRole(e.target.value)}
                            placeholder="Role Title"
                            className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-600 focus:outline-none"
                          />
                          <div className="flex justify-center gap-1 mt-1">
                            <button
                              onClick={() => {
                                if (editingPersonName.trim()) {
                                  runAction(() =>
                                    updateRaciPerson({
                                      personId: p.id,
                                      name: editingPersonName.trim(),
                                      roleTitle: editingPersonRole.trim(),
                                    })
                                  );
                                  setCharts((prev) =>
                                    prev.map((c) =>
                                      c.id === open.id
                                        ? {
                                            ...c,
                                            people: c.people.map((person) =>
                                              person.id === p.id
                                                ? {
                                                    ...person,
                                                    name: editingPersonName.trim(),
                                                    roleTitle: editingPersonRole.trim(),
                                                  }
                                                : person
                                            ),
                                          }
                                        : c
                                    )
                                  );
                                }
                                setEditingPersonId(null);
                              }}
                              className="bg-slate-900 text-white rounded px-2 py-0.5 text-[10px]"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingPersonId(null)}
                              className="text-slate-500 hover:text-slate-800 text-[10px]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-center gap-1 font-bold text-slate-900">
                            <span>{p.name}</span>
                            {open.canEdit && (
                              <button
                                onClick={() => {
                                  setEditingPersonId(p.id);
                                  setEditingPersonName(p.name);
                                  setEditingPersonRole(p.roleTitle);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 transition-opacity"
                                title="Edit role/person"
                              >
                                ✎
                              </button>
                            )}
                          </div>
                          {p.roleTitle && (
                            <span className="block text-[10px] font-normal text-slate-500">
                              {p.roleTitle}
                            </span>
                          )}
                          {open.canEdit && (
                            <button
                              onClick={() => {
                                if (confirm(`Remove column "${p.name}"?`)) {
                                  runAction(() => deleteRaciPerson({ personId: p.id }));
                                  setCharts((prev) =>
                                    prev.map((c) =>
                                      c.id === open.id
                                        ? {
                                            ...c,
                                            people: c.people.filter((person) => person.id !== p.id),
                                          }
                                        : c
                                    )
                                  );
                                }
                              }}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity"
                              title="Delete column"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      )}
                    </th>
                  ))}

                  {/* Inline Add Column Header */}
                  {open.canEdit && (
                    <th className="w-32 py-2 px-2 text-center bg-slate-50">
                      {showAddColumnPopover ? (
                        <form onSubmit={handleQuickAddPerson} className="flex flex-col gap-1 p-1">
                          <input
                            ref={columnInputRef}
                            autoFocus
                            type="text"
                            value={newPersonNameInput}
                            onChange={(e) => setNewPersonNameInput(e.target.value)}
                            placeholder="Role / Person"
                            className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-xs focus:outline-none"
                          />
                          <input
                            type="text"
                            value={newPersonRoleInput}
                            onChange={(e) => setNewPersonRoleInput(e.target.value)}
                            placeholder="Optional title"
                            className="w-full rounded border border-slate-300 px-1.5 py-0.5 text-[10px] focus:outline-none"
                          />
                          <div className="flex justify-center gap-1 mt-1">
                            <button
                              type="submit"
                              className="bg-blue-600 text-white rounded px-2 py-0.5 text-[10px] font-medium"
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowAddColumnPopover(false)}
                              className="text-slate-400 hover:text-slate-600 text-[10px]"
                            >
                              ✕
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          onClick={() => {
                            setShowAddColumnPopover(true);
                            setTimeout(() => columnInputRef.current?.focus(), 50);
                          }}
                          className="w-full py-1 text-xs text-blue-600 hover:text-blue-800 font-medium hover:bg-blue-50 rounded border border-dashed border-blue-200"
                        >
                          + Add Role
                        </button>
                      )}
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 font-sans">
                {open.steps.map((step, stepIndex) => (
                  <tr
                    key={step.id}
                    className="hover:bg-slate-50/60 divide-x divide-slate-100 transition-colors group"
                  >
                    {/* Index Number */}
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px] select-none bg-slate-50/40">
                      {stepIndex + 1}
                    </td>

                    {/* Step Title (Inline Editable) */}
                    <td className="py-2.5 px-4 font-medium text-slate-800 relative">
                      {editingStepId === step.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            type="text"
                            value={editingStepText}
                            onChange={(e) => setEditingStepText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                if (editingStepText.trim()) {
                                  runAction(() =>
                                    updateRaciStep({
                                      stepId: step.id,
                                      stepName: editingStepText.trim(),
                                    })
                                  );
                                  setCharts((prev) =>
                                    prev.map((c) =>
                                      c.id === open.id
                                        ? {
                                            ...c,
                                            steps: c.steps.map((s) =>
                                              s.id === step.id
                                                ? { ...s, stepName: editingStepText.trim() }
                                                : s
                                            ),
                                          }
                                        : c
                                    )
                                  );
                                }
                                setEditingStepId(null);
                              } else if (e.key === 'Escape') {
                                setEditingStepId(null);
                              }
                            }}
                            className="w-full rounded border border-blue-400 px-2 py-1 text-xs focus:outline-none"
                          />
                          <button
                            onClick={() => {
                              if (editingStepText.trim()) {
                                runAction(() =>
                                  updateRaciStep({
                                    stepId: step.id,
                                    stepName: editingStepText.trim(),
                                  })
                                );
                                setCharts((prev) =>
                                  prev.map((c) =>
                                    c.id === open.id
                                      ? {
                                          ...c,
                                          steps: c.steps.map((s) =>
                                            s.id === step.id
                                              ? { ...s, stepName: editingStepText.trim() }
                                              : s
                                          ),
                                        }
                                      : c
                                  )
                                );
                              }
                              setEditingStepId(null);
                            }}
                            className="text-xs text-blue-600 font-bold"
                          >
                            ✓
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span
                            onDoubleClick={() => {
                              if (open.canEdit) {
                                setEditingStepId(step.id);
                                setEditingStepText(step.stepName);
                              }
                            }}
                            className="cursor-pointer hover:text-blue-700"
                            title={open.canEdit ? 'Double-click to edit step' : undefined}
                          >
                            {step.stepName}
                          </span>
                          {open.canEdit && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setEditingStepId(step.id);
                                  setEditingStepText(step.stepName);
                                }}
                                className="text-slate-400 hover:text-blue-600 px-1"
                                title="Edit step name"
                              >
                                ✎
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Delete step "${step.stepName}"?`)) {
                                    runAction(() => deleteRaciStep({ stepId: step.id }));
                                    setCharts((prev) =>
                                      prev.map((c) =>
                                        c.id === open.id
                                          ? {
                                              ...c,
                                              steps: c.steps.filter((s) => s.id !== step.id),
                                            }
                                          : c
                                      )
                                    );
                                  }
                                }}
                                className="text-slate-300 hover:text-red-500 px-1"
                                title="Delete step"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Matrix Cells */}
                    {open.people.map((person, personIndex) => {
                      const designations = step.cells[person.id] ?? [];
                      const isFocused =
                        focusedCell?.stepIndex === stepIndex &&
                        focusedCell?.personIndex === personIndex;

                      return (
                        <td
                          key={person.id}
                          tabIndex={open.canEdit ? 0 : undefined}
                          onFocus={() => setFocusedCell({ stepIndex, personIndex })}
                          onKeyDown={(e) => handleGridKeyDown(e, stepIndex, personIndex)}
                          className={`py-2 px-2 text-center transition-colors outline-none ${
                            isFocused
                              ? 'bg-blue-50/80 ring-2 ring-blue-500 ring-inset'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1">
                            {LETTERS.map((l) => {
                              const active = designations.includes(l.key);
                              return (
                                <button
                                  key={l.key}
                                  title={`${l.title} (Click or press ${l.letter})`}
                                  disabled={!open.canEdit || pending}
                                  onClick={() => toggleCell(step, person.id, l.key)}
                                  className={`h-6 w-6 rounded text-[11px] font-bold border transition-all ${
                                    active
                                      ? `${l.color} shadow-xs scale-105`
                                      : 'border-slate-200 bg-white text-slate-300 hover:border-slate-400 hover:text-slate-600'
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

                    {/* Trailing spacer for Add Column */}
                    {open.canEdit && <td className="bg-slate-50/40" />}
                  </tr>
                ))}

                {/* Permanent Bottom Row: Quick Add Step Input */}
                {open.canEdit && (
                  <tr className="bg-blue-50/30 border-t-2 border-slate-200">
                    <td className="py-2 px-3 text-center text-blue-500 font-bold text-xs select-none">
                      +
                    </td>
                    <td colSpan={open.people.length + 2} className="py-2 px-4">
                      <form onSubmit={handleQuickAddStep} className="flex items-center gap-2">
                        <input
                          ref={stepInputRef}
                          type="text"
                          value={newStepInput}
                          onChange={(e) => setNewStepInput(e.target.value)}
                          placeholder="Type step name and press Enter to rapidly add row... (Google Sheets style)"
                          className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none py-1 font-medium"
                        />
                        <button
                          type="submit"
                          disabled={!newStepInput.trim() || pending}
                          className="shrink-0 rounded bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-40 hover:bg-slate-800"
                        >
                          + Add Step (Enter)
                        </button>
                      </form>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {open.steps.length === 0 && (
            <p className="text-center py-6 text-xs text-slate-500">
              No steps added yet. Type in the box at the bottom of the grid or click <strong>⚡ Paste Steps</strong> to batch import.
            </p>
          )}
        </section>
      )}

      {/* --- MODAL 1: Create New Chart with Templates --- */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-5 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create RACI Chart</h3>
                <p className="text-xs text-slate-500">Choose a starter template or start from scratch.</p>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Template Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Choose Starter Template</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TEMPLATES.map((tpl, i) => (
                  <div
                    key={tpl.name}
                    onClick={() => {
                      setSelectedTemplateIndex(i);
                      if (!newProcessName) setNewProcessName(tpl.name === 'Blank Grid' ? '' : tpl.name);
                    }}
                    className={`cursor-pointer rounded-xl border p-3 text-left transition-all ${
                      selectedTemplateIndex === i
                        ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-500'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-xs text-slate-900">{tpl.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{tpl.desc}</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tpl.tags.map((t) => (
                        <span key={t} className="bg-slate-100 text-slate-600 rounded px-1.5 py-0.2 text-[10px]">
                          #{t}
                        </span>
                      ))}
                      <span className="text-[10px] text-slate-400 ml-auto">
                        {tpl.steps.length} steps • {tpl.people.length} roles
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart Details Form */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Process Name *
                </label>
                <input
                  autoFocus
                  type="text"
                  value={newProcessName}
                  onChange={(e) => setNewProcessName(e.target.value)}
                  placeholder="e.g. Sunday Service Setup, Easter Production"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Owner / Lead</label>
                  <input
                    type="text"
                    value={newOwner}
                    onChange={(e) => setNewOwner(e.target.value)}
                    placeholder="e.g. Worship Director"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newTagsInput}
                    onChange={(e) => setNewTagsInput(e.target.value)}
                    placeholder="e.g. Worship, Easter, Facilities"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Default Visibility */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">Church-Wide Visibility</span>
                  <input
                    type="checkbox"
                    checked={newIsPublic}
                    onChange={(e) => setNewIsPublic(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  When checked, anyone with RACI module permissions can view this chart. Uncheck to restrict access to specific teams or individual profiles.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newProcessName.trim() || pending}
                onClick={handleCreateFromTemplate}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {pending ? 'Creating…' : 'Create & Open Grid'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Share with Profiles & Teams --- */}
      {showShareModal && open && (
        <ShareDialog
          open={open}
          availableTeams={availableTeams}
          availableUsers={availableUsers}
          currentUserId={currentUserId}
          onClose={() => setShowShareModal(false)}
          onTogglePublic={handleTogglePublic}
          onShare={async (targetType, targetId, access) => {
            const res = await shareRaciChart({
              chartId: open.id,
              targetType,
              targetId,
              access,
            });
            if (res.success && res.shareId) {
              const targetName =
                targetType === 'USER'
                  ? availableUsers.find((u) => u.id === targetId)?.name ||
                    availableUsers.find((u) => u.id === targetId)?.email ||
                    'Unknown'
                  : availableTeams.find((t) => t.id === targetId)?.name || 'Unknown';

              const newShare: ShareItem = {
                id: res.shareId,
                targetType,
                targetId,
                name: targetName,
                access,
              };

              setCharts((prev) =>
                prev.map((c) =>
                  c.id === open.id
                    ? {
                        ...c,
                        shares: [...c.shares.filter((s) => s.targetId !== targetId), newShare],
                      }
                    : c
                )
              );
            }
            return res;
          }}
          onRemoveShare={async (shareId) => {
            const res = await removeRaciChartShare({ shareId });
            if (res.success) {
              setCharts((prev) =>
                prev.map((c) =>
                  c.id === open.id
                    ? { ...c, shares: c.shares.filter((s) => s.id !== shareId) }
                    : c
                )
              );
            }
            return res;
          }}
        />
      )}

      {/* --- MODAL 3: Paste Multiple Steps --- */}
      {showPasteModal && open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Paste Multiple Steps</h3>
                <p className="text-xs text-slate-500">
                  Paste rows directly from Excel, Word, or bullet points (one step per line).
                </p>
              </div>
              <button
                onClick={() => setShowPasteModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <textarea
              autoFocus
              rows={8}
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder="1. Sound check\n2. Stage lighting setup\n3. Pre-service prayer\n4. Sermon slides cue check"
              className="w-full rounded-xl border border-slate-300 p-3 text-xs font-mono focus:border-slate-900 focus:outline-none"
            />

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                {pasteContent.split('\n').filter((l) => l.trim()).length} steps detected
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasteModal(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!pasteContent.trim() || pending}
                  onClick={handleBulkPaste}
                  className="rounded-lg bg-slate-900 px-4 py-1.5 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {pending ? 'Importing…' : 'Import Steps'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Share Dialog Component ---
function ShareDialog({
  open,
  availableTeams,
  availableUsers,
  currentUserId,
  onClose,
  onTogglePublic,
  onShare,
  onRemoveShare,
}: {
  open: Chart;
  availableTeams: AvailableTeam[];
  availableUsers: AvailableUser[];
  currentUserId: string;
  onClose: () => void;
  onTogglePublic: (isPublic: boolean) => void;
  onShare: (
    targetType: 'USER' | 'TEAM',
    targetId: string,
    access: 'VIEW' | 'EDIT'
  ) => Promise<{ success: boolean; error?: string }>;
  onRemoveShare: (shareId: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const [selectedType, setSelectedType] = useState<'TEAM' | 'USER'>('TEAM');
  const [selectedId, setSelectedId] = useState('');
  const [selectedAccess, setSelectedAccess] = useState<'VIEW' | 'EDIT'>('EDIT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const handleAddShare = async () => {
    if (!selectedId) return;
    setIsSubmitting(true);
    setShareError(null);
    const res = await onShare(selectedType, selectedId, selectedAccess);
    setIsSubmitting(false);
    if (!res.success) {
      setShareError(res.error || 'Failed to share');
    } else {
      setSelectedId('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-5 border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Share &ldquo;{open.processName}&rdquo;</h3>
            <p className="text-xs text-slate-500">Manage permissions across teams and staff profiles.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-sm">
            ✕
          </button>
        </div>

        {shareError && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700">
            {shareError}
          </div>
        )}

        {/* Visibility Setting */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-slate-900">Church-Wide Access</h4>
              <p className="text-[11px] text-slate-500">
                {open.isPublic
                  ? 'Anyone with RACI access in the church can view this chart.'
                  : 'Restricted: Only invited profiles and teams below have access.'}
              </p>
            </div>
            {open.canEdit && (
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={open.isPublic}
                  onChange={(e) => onTogglePublic(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            )}
          </div>
        </div>

        {/* Add Share Form */}
        {open.canEdit && (
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <h4 className="text-xs font-semibold text-slate-800">Add Team or Profile</h4>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value as 'TEAM' | 'USER');
                  setSelectedId('');
                }}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:outline-none"
              >
                <option value="TEAM">Team</option>
                <option value="USER">Profile / User</option>
              </select>

              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:outline-none"
              >
                <option value="">
                  Select {selectedType === 'TEAM' ? 'a team…' : 'a person…'}
                </option>
                {selectedType === 'TEAM'
                  ? availableTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))
                  : availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name ? `${u.name} (${u.email})` : u.email}
                      </option>
                    ))}
              </select>

              <select
                value={selectedAccess}
                onChange={(e) => setSelectedAccess(e.target.value as 'VIEW' | 'EDIT')}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:outline-none"
              >
                <option value="EDIT">Can Edit</option>
                <option value="VIEW">Can View</option>
              </select>

              <button
                type="button"
                disabled={!selectedId || isSubmitting}
                onClick={handleAddShare}
                className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Share
              </button>
            </div>
          </div>
        )}

        {/* Existing Shares List */}
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <h4 className="text-xs font-semibold text-slate-800">Current Collaborators</h4>
          {open.shares.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No specific teams or users added yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {open.shares.map((share) => (
                <div key={share.id} className="flex items-center justify-between py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 uppercase">
                      {share.targetType}
                    </span>
                    <span className="font-medium text-slate-800">{share.name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                        share.access === 'EDIT'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {share.access === 'EDIT' ? 'Can edit' : 'Can view'}
                    </span>
                    {open.canEdit && (
                      <button
                        onClick={() => onRemoveShare(share.id)}
                        className="text-slate-400 hover:text-red-600 font-bold"
                        title="Remove share"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
