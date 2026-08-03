'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { createTask, deleteTask, getTaskDetail, moveTask, updateTask } from '@/lib/actions/tasks';
import { setTaskTags } from '@/lib/actions/tags';
import { PRIORITY_LABELS, RECURRENCE_LABELS, STATUS_LABELS } from '@/lib/format';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { TagPicker, type TagInfo } from '@/components/TagPicker';
import type { KanbanSection, KanbanTask } from '@/components/KanbanBoard';

type TaskField = keyof KanbanTask;

export function GridView({
  projectId,
  sections: initialSections,
  members,
  allTags,
}: {
  projectId: string;
  sections: KanbanSection[];
  members: { id: string; name: string }[];
  allTags: TagInfo[];
}) {
  const router = useRouter();
  const [sections, setSections] = useState(initialSections);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [addingToSectionId, setAddingToSectionId] = useState<string | null>(null);

  function patchTask(taskId: string, patch: Partial<KanbanTask>) {
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
      })),
    );
  }

  async function handleFieldChange(taskId: string, field: TaskField, value: string | number | null) {
    patchTask(taskId, { [field]: value } as Partial<KanbanTask>);

    await updateTask(taskId, { [field]: value } as never);

    // Completing a repeating task reschedules it server-side (new due date, status
    // reverts) — re-fetch so the grid reflects the actual next occurrence.
    if (field === 'status') {
      const detail = await getTaskDetail(taskId);
      if (detail) {
        patchTask(taskId, {
          status: detail.status,
          dueDate: detail.dueDate,
          recurrence: detail.recurrence,
          recurrenceInterval: detail.recurrenceInterval,
          recurrenceEndDate: detail.recurrenceEndDate,
        });
      }
    }

    router.refresh();
  }

  async function handleTagsChange(taskId: string, tagIds: string[]) {
    patchTask(taskId, { tags: allTags.filter((t) => tagIds.includes(t.id)) });
    await setTaskTags(taskId, tagIds);
    router.refresh();
  }

  async function handleCreateTask(sectionId: string, title: string) {
    const formData = new FormData();
    formData.set('title', title);
    formData.set('sectionId', sectionId);
    const result = await createTask(projectId, formData);

    if (result.success && result.taskId) {
      const newTask: KanbanTask = {
        id: result.taskId,
        title,
        priority: 'MEDIUM',
        status: 'TODO',
        dueDate: null,
        assigneeId: null,
        assigneeName: null,
        recurrence: 'NONE',
        recurrenceInterval: 1,
        recurrenceEndDate: null,
        locked: false,
        predecessorTitle: null,
        subtasks: [],
        fieldValues: [],
        tags: [],
      };
      setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, tasks: [...s.tasks, newTask] } : s)));
    }

    router.refresh();
  }

  async function handleDelete(taskId: string) {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    setSections((prev) => prev.map((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== taskId) })));
    await deleteTask(taskId);
    router.refresh();
  }

  function handleDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    setSections((prev) => {
      const next = prev.map((s) => ({ ...s, tasks: [...s.tasks] }));
      const sourceSection = next.find((s) => s.id === source.droppableId);
      const destSection = next.find((s) => s.id === destination.droppableId);
      if (!sourceSection || !destSection) return prev;

      const [moved] = sourceSection.tasks.splice(source.index, 1);
      destSection.tasks.splice(destination.index, 0, moved);
      return next;
    });

    void moveTask(draggableId, destination.droppableId, destination.index).then(() => router.refresh());
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              <th className="w-8 px-2 py-2"></th>
              <th className="px-3 py-2">Title</th>
              <th className="w-44 px-3 py-2">Tags</th>
              <th className="w-40 px-3 py-2">Assignee</th>
              <th className="w-32 px-3 py-2">Priority</th>
              <th className="w-36 px-3 py-2">Status</th>
              <th className="w-36 px-3 py-2">Due date</th>
              <th className="w-40 px-3 py-2">Repeat</th>
              <th className="w-10 px-2 py-2"></th>
            </tr>
          </thead>

          {sections.map((section) => (
            <SectionBody
              key={section.id}
              section={section}
              members={members}
              allTags={allTags}
              addingToSectionId={addingToSectionId}
              setAddingToSectionId={setAddingToSectionId}
              onOpenTask={setOpenTaskId}
              onFieldChange={handleFieldChange}
              onTagsChange={handleTagsChange}
              onDelete={handleDelete}
              onCreateTask={handleCreateTask}
            />
          ))}
        </table>
      </div>

      {openTaskId && <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </DragDropContext>
  );
}

function SectionBody({
  section,
  members,
  allTags,
  addingToSectionId,
  setAddingToSectionId,
  onOpenTask,
  onFieldChange,
  onTagsChange,
  onDelete,
  onCreateTask,
}: {
  section: KanbanSection;
  members: { id: string; name: string }[];
  allTags: TagInfo[];
  addingToSectionId: string | null;
  setAddingToSectionId: (id: string | null) => void;
  onOpenTask: (id: string) => void;
  onFieldChange: (taskId: string, field: TaskField, value: string | number | null) => void;
  onTagsChange: (taskId: string, tagIds: string[]) => void;
  onDelete: (taskId: string) => void;
  onCreateTask: (sectionId: string, title: string) => Promise<void>;
}) {
  return (
    <>
      <tbody>
        <tr className="border-b border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/70">
          <td colSpan={9} className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            {section.name} <span className="font-normal text-slate-400 dark:text-slate-500">({section.tasks.length})</span>
          </td>
        </tr>
      </tbody>

      <Droppable droppableId={section.id}>
        {(provided) => (
          <tbody ref={provided.innerRef} {...provided.droppableProps}>
            {section.tasks.map((task, index) => (
              <Draggable key={task.id} draggableId={task.id} index={index}>
                {(dragProvided, snapshot) => (
                  <tr
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    className={`border-b border-slate-100 dark:border-slate-800 ${snapshot.isDragging ? 'bg-brand-50 shadow-md dark:bg-brand-950' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                  >
                    <td className="px-2 py-1.5 text-slate-300 dark:text-slate-600" {...dragProvided.dragHandleProps}>
                      ⠿
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        defaultValue={task.title}
                        onBlur={(e) => e.target.value !== task.title && onFieldChange(task.id, 'title', e.target.value)}
                        onClick={() => onOpenTask(task.id)}
                        className="w-full rounded border-none bg-transparent px-1 py-0.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-400 dark:text-slate-200"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <TagPicker
                        allTags={allTags}
                        selectedIds={task.tags.map((t) => t.id)}
                        onChange={(tagIds) => onTagsChange(task.id, tagIds)}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={task.assigneeId ?? ''}
                        onChange={(e) => onFieldChange(task.id, 'assigneeId', e.target.value || null)}
                        className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-slate-200 focus:border-slate-300 focus:outline-none dark:hover:border-slate-700 dark:focus:border-slate-600"
                      >
                        <option value="">Unassigned</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={task.priority}
                        onChange={(e) => onFieldChange(task.id, 'priority', e.target.value)}
                        className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-slate-200 focus:border-slate-300 focus:outline-none dark:hover:border-slate-700 dark:focus:border-slate-600"
                      >
                        {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={task.status}
                        onChange={(e) => onFieldChange(task.id, 'status', e.target.value)}
                        className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-slate-200 focus:border-slate-300 focus:outline-none dark:hover:border-slate-700 dark:focus:border-slate-600"
                      >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="date"
                        defaultValue={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                        onChange={(e) => onFieldChange(task.id, 'dueDate', e.target.value || null)}
                        className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-slate-200 focus:border-slate-300 focus:outline-none dark:hover:border-slate-700 dark:focus:border-slate-600"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={task.recurrence}
                        onChange={(e) => onFieldChange(task.id, 'recurrence', e.target.value)}
                        className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-slate-200 focus:border-slate-300 focus:outline-none dark:hover:border-slate-700 dark:focus:border-slate-600"
                      >
                        {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        onClick={() => onDelete(task.id)}
                        aria-label="Delete task"
                        className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )}
              </Draggable>
            ))}
            <tr style={{ display: 'none' }}>
              <td colSpan={9}>{provided.placeholder}</td>
            </tr>
          </tbody>
        )}
      </Droppable>

      <tbody>
        <tr className="border-b border-slate-100 dark:border-slate-800">
          <td colSpan={9} className="px-2 py-1">
            <AddRow
              isOpen={addingToSectionId === section.id}
              onOpen={() => setAddingToSectionId(section.id)}
              onClose={() => setAddingToSectionId(null)}
              onSubmitTitle={(title) => onCreateTask(section.id, title)}
            />
          </td>
        </tr>
      </tbody>
    </>
  );
}

function AddRow({
  isOpen,
  onOpen,
  onClose,
  onSubmitTitle,
}: {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSubmitTitle: (title: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = inputRef.current?.value.trim();
    if (!title) return;
    setLoading(true);
    await onSubmitTitle(title);
    setLoading(false);
    if (inputRef.current) inputRef.current.value = '';
    inputRef.current?.focus();
  }

  if (!isOpen) {
    return (
      <button onClick={onOpen} className="w-full rounded px-2 py-1 text-left text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300">
        + Add row
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        ref={inputRef}
        autoFocus
        required
        placeholder="Task title, then press Enter"
        className="w-full rounded border border-slate-200 px-2 py-1 text-sm focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      />
      <button
        type="submit"
        disabled={loading}
        className="shrink-0 rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? 'Adding…' : 'Add'}
      </button>
      <button type="button" onClick={onClose} className="shrink-0 rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
        Cancel
      </button>
    </form>
  );
}
