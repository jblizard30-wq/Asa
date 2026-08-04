'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { saveNavOrder, setNavItemHidden } from '@/lib/actions/navPreferences';

export interface NavSettingsItem {
  key: string;
  label: string;
  href: string;
  hidden: boolean;
}

export function NavSettingsPanel({ initialItems }: { initialItems: NavSettingsItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);

  function handleDragEnd(result: DropResult) {
    const { source, destination } = result;
    if (!destination || source.index === destination.index) return;

    const previous = items;
    const next = [...items];
    const [moved] = next.splice(source.index, 1);
    next.splice(destination.index, 0, moved);
    setItems(next);
    setError(null);

    void saveNavOrder(next.map((item) => item.key)).then((result) => {
      if (!result.success) {
        setItems(previous);
        setError('Could not save the new order.');
      } else {
        router.refresh();
      }
    });
  }

  function handleToggleHidden(key: string) {
    const previous = items;
    const target = items.find((item) => item.key === key);
    if (!target) return;
    const nextHidden = !target.hidden;

    setItems(items.map((item) => (item.key === key ? { ...item, hidden: nextHidden } : item)));
    setError(null);

    void setNavItemHidden(key, nextHidden).then((result) => {
      if (!result.success) {
        setItems(previous);
        setError(result.error ?? 'Could not update visibility.');
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-6">
      <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">
        Drag &#8942;&#8942; to reorder. Toggle an item to hide it from your sidebar.
      </p>
      {error && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="nav-settings">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
              {items.map((item, index) => (
                <Draggable key={item.key} draggableId={item.key} index={index}>
                  {(dragProvided, snapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className={`flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900 ${
                        snapshot.isDragging ? 'shadow-md' : ''
                      } ${item.hidden ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          {...dragProvided.dragHandleProps}
                          className="cursor-grab select-none text-slate-400 dark:text-slate-500"
                          aria-label="Drag to reorder"
                        >
                          &#8942;&#8942;
                        </span>
                        <span className="text-sm text-slate-700 dark:text-slate-200">{item.label}</span>
                      </div>
                      <button
                        onClick={() => handleToggleHidden(item.key)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          item.hidden
                            ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            : 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
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
      </DragDropContext>
    </div>
  );
}
