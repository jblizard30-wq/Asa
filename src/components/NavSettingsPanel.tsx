'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { saveNavOrder, setNavItemHidden, saveNavGroups, resetNavPreferences } from '@/lib/actions/navPreferences';

export interface NavSettingsItem {
  key: string;
  label: string;
  href: string;
  hidden: boolean;
  groupName?: string;
}

export interface NavSettingsGroup {
  name: string;
  order?: number;
  items: NavSettingsItem[];
}

export function NavSettingsPanel({
  initialItems,
  initialGroups,
}: {
  initialItems: NavSettingsItem[];
  initialGroups?: NavSettingsGroup[];
}) {
  const router = useRouter();

  // Initialize groups
  const [groups, setGroups] = useState<NavSettingsGroup[]>(() => {
    if (initialGroups && initialGroups.length > 0) {
      return initialGroups;
    }
    return [
      {
        name: 'General',
        items: initialItems,
      },
    ];
  });

  const [newSectionName, setNewSectionName] = useState('');
  const [addingSection, setAddingSection] = useState(false);
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function persistGroups(updatedGroups: NavSettingsGroup[]) {
    setGroups(updatedGroups);
    setError(null);
    setIsSaving(true);
    try {
      const payload = updatedGroups.map((g) => ({
        name: g.name,
        itemKeys: g.items.map((i) => i.key),
      }));
      const result = await saveNavGroups(payload);
      if (!result.success) {
        setError('Could not save the new navigation structure.');
      } else {
        router.refresh();
      }
    } catch {
      setError('An error occurred while saving navigation groups.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleDragEnd(result: DropResult) {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceGroupIdx = parseInt(source.droppableId.replace('group-', ''), 10);
    const destGroupIdx = parseInt(destination.droppableId.replace('group-', ''), 10);

    if (isNaN(sourceGroupIdx) || isNaN(destGroupIdx)) return;

    const nextGroups = groups.map((g) => ({ ...g, items: [...g.items] }));
    const [movedItem] = nextGroups[sourceGroupIdx].items.splice(source.index, 1);
    movedItem.groupName = nextGroups[destGroupIdx].name;
    nextGroups[destGroupIdx].items.splice(destination.index, 0, movedItem);

    void persistGroups(nextGroups);
  }

  function handleToggleHidden(itemKey: string, currentHidden: boolean) {
    const nextHidden = !currentHidden;
    const nextGroups = groups.map((g) => ({
      ...g,
      items: g.items.map((item) => (item.key === itemKey ? { ...item, hidden: nextHidden } : item)),
    }));
    setGroups(nextGroups);

    void setNavItemHidden(itemKey, nextHidden).then((res) => {
      if (!res.success) {
        setError(res.error ?? 'Could not update visibility.');
      } else {
        router.refresh();
      }
    });
  }

  function handleAddSection() {
    const name = newSectionName.trim();
    if (!name) {
      setAddingSection(false);
      return;
    }
    if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      setError('A section with this name already exists.');
      return;
    }

    const nextGroups = [...groups, { name, items: [] }];
    setNewSectionName('');
    setAddingSection(false);
    void persistGroups(nextGroups);
  }

  function handleRenameSection(index: number) {
    const name = renameValue.trim();
    setRenamingIndex(null);
    if (!name || name === groups[index].name) return;

    const nextGroups = groups.map((g, idx) =>
      idx === index
        ? {
            ...g,
            name,
            items: g.items.map((item) => ({ ...item, groupName: name })),
          }
        : g
    );
    void persistGroups(nextGroups);
  }

  function handleDeleteSection(index: number) {
    if (groups.length <= 1) {
      setError('You must keep at least one navigation section.');
      return;
    }
    const groupToDelete = groups[index];
    const targetIdx = index === 0 ? 1 : 0;

    const nextGroups = groups
      .filter((_, idx) => idx !== index)
      .map((g, idx) => {
        if (idx === (index === 0 ? 0 : targetIdx)) {
          return {
            ...g,
            items: [...g.items, ...groupToDelete.items.map((i) => ({ ...i, groupName: g.name }))],
          };
        }
        return g;
      });

    void persistGroups(nextGroups);
  }

  async function handleResetDefaults() {
    if (!confirm('Reset all navigation items and sections back to system defaults?')) return;
    setIsSaving(true);
    try {
      const res = await resetNavPreferences();
      if (res.success) {
        router.refresh();
      } else {
        setError('Could not reset preferences.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Drag items between sections or reorder them. Items set to hidden will not appear in your left sidebar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAddingSection(true)}
            className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:bg-brand-900/40 dark:text-brand-300 dark:hover:bg-brand-900/60 transition-colors"
          >
            + Add Section
          </button>
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={isSaving}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            Reset Defaults
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      )}

      {addingSection && (
        <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50/50 p-3 dark:border-brand-800/60 dark:bg-brand-950/20">
          <input
            type="text"
            autoFocus
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddSection();
              if (e.key === 'Escape') setAddingSection(false);
            }}
            placeholder="New Section Name (e.g. Ministry Focus, Leadership)..."
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={handleAddSection}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            Save Section
          </button>
          <button
            type="button"
            onClick={() => setAddingSection(false)}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Drag and Drop Container across groups */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="space-y-6">
          {groups.map((group, groupIdx) => (
            <div
              key={group.name}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              {/* Group Header */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {renamingIndex === groupIdx ? (
                    <input
                      type="text"
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSection(groupIdx);
                        if (e.key === 'Escape') setRenamingIndex(null);
                      }}
                      onBlur={() => handleRenameSection(groupIdx)}
                      className="rounded border border-brand-400 px-2 py-0.5 text-xs font-semibold text-slate-800 dark:border-brand-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                  ) : (
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      {group.name}
                    </span>
                  )}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {group.items.length} item{group.items.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingIndex(groupIdx);
                      setRenameValue(group.name);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                    title="Rename section"
                    aria-label="Rename section"
                  >
                    ✎
                  </button>
                  {groups.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteSection(groupIdx)}
                      className="p-1 text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400"
                      title="Delete section and move items"
                      aria-label="Delete section"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Group Droppable area */}
              <Droppable droppableId={`group-${groupIdx}`}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[44px] space-y-2 rounded-lg p-1.5 transition-colors ${
                      snapshot.isDraggingOver
                        ? 'bg-brand-50/50 ring-2 ring-dashed ring-brand-300 dark:bg-brand-950/20 dark:ring-brand-800'
                        : 'bg-slate-50/60 dark:bg-slate-950/40'
                    }`}
                  >
                    {group.items.length === 0 && (
                      <p className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">
                        Drag items here to add to this section
                      </p>
                    )}

                    {group.items.map((item, itemIdx) => (
                      <Draggable key={item.key} draggableId={item.key} index={itemIdx}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className={`flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm transition-all dark:border-slate-700 dark:bg-slate-800 ${
                              dragSnapshot.isDragging ? 'shadow-lg scale-[1.01] ring-2 ring-brand-400' : ''
                            } ${item.hidden ? 'opacity-40' : ''}`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                {...dragProvided.dragHandleProps}
                                className="cursor-grab select-none text-slate-400 hover:text-slate-600 dark:text-slate-500"
                                aria-label="Drag to reorder"
                              >
                                ⋮⋮
                              </span>
                              <span className="font-medium text-slate-800 dark:text-slate-200">{item.label}</span>
                              <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                                {item.href}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleHidden(item.key, item.hidden)}
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                                item.hidden
                                  ? 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400'
                                  : 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-900/40 dark:text-brand-300'
                              }`}
                            >
                              {item.hidden ? 'Hidden' : 'Visible'}
                            </button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
