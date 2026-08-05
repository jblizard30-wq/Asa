'use client';

import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DraggableProvided,
  type DraggableStateSnapshot,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  batchCreateTasks,
  batchUpdateTaskFields,
  bulkDeleteTasks,
  createTask,
  deleteTask,
  getTaskDetail,
  moveTask,
  updateTask,
  type GridBatchEdit,
} from '@/lib/actions/tasks';
import { setTaskTags } from '@/lib/actions/tags';
import { parseAssignees, parseDueDate, parsePriority, parseStatus, parseTags, parseTitle } from '@/lib/gridCoercion';
import { PRIORITY_LABELS, STATUS_LABELS, formatDueDate } from '@/lib/format';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { TagBadge, TagPicker, type TagInfo } from '@/components/TagPicker';
import { AssigneePicker } from '@/components/AssigneePicker';
import type { KanbanSection, KanbanTask } from '@/components/KanbanBoard';

type TaskField = keyof KanbanTask;

/**
 * One selection controller for the whole grid — cells are dumb renderers, not
 * independent state. `anchor`/`focus` bound the selected rectangle (equal for a
 * single cell); `editing`, when set, is the one cell currently rendering its
 * live control instead of a static display.
 */
type CellPos = { row: number; col: number };
type GridSelectionState = {
  anchor: CellPos | null;
  focus: CellPos | null;
  editing: CellPos | null;
};

/**
 * Excel-style fill handle: dragging the handle at the bottom-right corner of the
 * current selection extends `endRow` downward. `minCol`/`maxCol` and the source row
 * (`startRow`) are pinned from the selection at drag-start and don't change mid-drag —
 * only how far down the drag has reached does. Lives outside `GridSelectionState`
 * since it tracks a separate, transient in-progress gesture, not the committed selection.
 */
type FillDragState = { startRow: number; endRow: number; minCol: number; maxCol: number };

const COL = {
  TITLE: 0,
  TAGS: 1,
  ASSIGNEE: 2,
  PRIORITY: 3,
  STATUS: 4,
  DUE_DATE: 5,
  RECURRENCE: 6,
} as const;
const COLUMN_COUNT = 7;

/** The subset of columns that paste/fill-down/undo can read and write as batched field edits. */
type ColumnEditKey = 'title' | 'tagIds' | 'assigneeIds' | 'priority' | 'status' | 'dueDate';

const COLUMN_EDIT_KEY: Partial<Record<number, ColumnEditKey>> = {
  [COL.TITLE]: 'title',
  [COL.TAGS]: 'tagIds',
  [COL.ASSIGNEE]: 'assigneeIds',
  [COL.PRIORITY]: 'priority',
  [COL.STATUS]: 'status',
  [COL.DUE_DATE]: 'dueDate',
};

type CellError = { raw: string; error: string };
type UndoEntry = { before: GridBatchEdit[]; createdTaskIds: string[] };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function cellErrorKey(row: number, col: number) {
  return `${row}:${col}`;
}

function computeSelectionBounds(selection: GridSelectionState) {
  if (!selection.anchor || !selection.focus) return null;
  return {
    minRow: Math.min(selection.anchor.row, selection.focus.row),
    maxRow: Math.max(selection.anchor.row, selection.focus.row),
    minCol: Math.min(selection.anchor.col, selection.focus.col),
    maxCol: Math.max(selection.anchor.col, selection.focus.col),
  };
}

/** Reads a column's current value off a task, in the shape batched writes/undo expect. */
function readTaskField(task: KanbanTask, key: ColumnEditKey): string | string[] | null {
  switch (key) {
    case 'title':
      return task.title;
    case 'tagIds':
      return task.tags.map((t) => t.id);
    case 'assigneeIds':
      return task.assigneeIds;
    case 'priority':
      return task.priority;
    case 'status':
      return task.status;
    case 'dueDate':
      return task.dueDate;
  }
}

/** Plain-language one-liner for the Repeat column — the grid only ever displays this; editing happens in the full task modal, which has room for the mode picker. */
function summarizeRecurrence(recurrence: KanbanTask['taskRecurrence']): string {
  if (!recurrence) return 'Does not repeat';
  const unit = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' }[recurrence.frequency];
  const every = recurrence.interval === 1 ? `Every ${unit}` : `Every ${recurrence.interval} ${unit}s`;
  return recurrence.mode === 'AFTER_COMPLETION' ? `${every} after done` : every;
}

function serializeCellForCopy(task: KanbanTask, col: number): string {
  switch (col) {
    case COL.TITLE:
      return task.title;
    case COL.TAGS:
      return task.tags.map((t) => t.name).join(', ');
    case COL.ASSIGNEE:
      return task.assigneeNames.join(', ');
    case COL.PRIORITY:
      return PRIORITY_LABELS[task.priority];
    case COL.STATUS:
      return STATUS_LABELS[task.status];
    case COL.DUE_DATE:
      return task.dueDate ? task.dueDate.slice(0, 10) : '';
    case COL.RECURRENCE:
      return summarizeRecurrence(task.taskRecurrence);
    default:
      return '';
  }
}

type ParsedCell = { ok: true; key: ColumnEditKey; value: string | string[] | null } | { ok: false; error: string };

/** The paste-side counterpart of serializeCellForCopy — coerces raw clipboard text per column. */
function parseCellForPaste(
  col: number,
  raw: string,
  context: { members: { id: string; name: string }[]; allTags: TagInfo[] },
): ParsedCell {
  switch (col) {
    case COL.TITLE: {
      const r = parseTitle(raw);
      return r.ok ? { ok: true, key: 'title', value: r.value } : r;
    }
    case COL.TAGS: {
      const r = parseTags(raw, context.allTags);
      return r.ok ? { ok: true, key: 'tagIds', value: r.value } : r;
    }
    case COL.ASSIGNEE: {
      const r = parseAssignees(raw, context.members);
      return r.ok ? { ok: true, key: 'assigneeIds', value: r.value } : r;
    }
    case COL.PRIORITY: {
      const r = parsePriority(raw);
      return r.ok ? { ok: true, key: 'priority', value: r.value } : r;
    }
    case COL.STATUS: {
      const r = parseStatus(raw);
      return r.ok ? { ok: true, key: 'status', value: r.value } : r;
    }
    case COL.DUE_DATE: {
      const r = parseDueDate(raw);
      return r.ok ? { ok: true, key: 'dueDate', value: r.value } : r;
    }
    case COL.RECURRENCE:
      return { ok: false, error: "Repeat can't be set by paste yet — use this cell's dropdown" };
    default:
      return { ok: false, error: 'Unsupported column' };
  }
}

function mergeEdit(map: Map<string, GridBatchEdit>, taskId: string, key: ColumnEditKey, value: unknown) {
  const existing = map.get(taskId) ?? { taskId };
  (existing as Record<string, unknown>)[key] = value;
  map.set(taskId, existing);
}

export function GridView({
  projectId,
  sections: initialSections,
  members = [],
  allTags = [],
  membersByProjectId,
  tagsByProjectId,
  mode = 'project',
  filtersActive = false,
}: {
  projectId?: string;
  sections: KanbanSection[];
  members?: { id: string; name: string }[];
  allTags?: TagInfo[];
  /** Cross-project mode only: each "section" is really one project (id = projectId), so its own members/tags come from these maps instead of the flat `members`/`allTags` lists. */
  membersByProjectId?: Record<string, { id: string; name: string }[]>;
  tagsByProjectId?: Record<string, TagInfo[]>;
  /**
   * 'cross-project' powers the unified My Tasks grid: rows span many projects, so row
   * drag-to-reorder (which reassigns a project-scoped sectionId) and paste-creates-new-rows
   * (which needs a single target sectionId) both have no coherent meaning and are disabled.
   * Everything else — cell selection, keyboard nav, copy, fill-down, paste-to-edit-existing-cells,
   * undo — works unchanged since it already just operates on `sections` generically.
   */
  mode?: 'project' | 'cross-project';
  filtersActive?: boolean;
}) {
  const router = useRouter();
  const [sections, setSections] = useState(initialSections);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [addingToSectionId, setAddingToSectionId] = useState<string | null>(null);

  const [selection, setSelection] = useState<GridSelectionState>({ anchor: null, focus: null, editing: null });
  const [editSeed, setEditSeed] = useState<string | null>(null);
  const [cellErrors, setCellErrors] = useState<Map<string, CellError>>(new Map());
  const [fillDrag, setFillDragState] = useState<FillDragState | null>(null);
  // Mirrors `fillDrag` so the window-level mouseup listener (added once, below) always
  // reads the current drag state without needing to re-subscribe on every update.
  const fillDragRef = useRef<FillDragState | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // Returning focus to the grid container after a commit/cancel fires a synchronous
  // blur on the still-mounted editor — this flag tells that blur handler to no-op
  // instead of re-committing (or, for Escape, wrongly saving the reverted value).
  const programmaticBlurRef = useRef(false);
  // Undo stack for grid mutations (single-cell edits, paste, fill-down) — a plain ref
  // since pushing to it shouldn't itself trigger a render.
  const undoStackRef = useRef<UndoEntry[]>([]);
  // Set by the native 'paste' event handler (the primary paste path) so the Cmd/Ctrl+V
  // keydown fallback below can tell whether that event already fired before it falls
  // back to the permission-gated async Clipboard API.
  const pasteEventFiredRef = useRef(false);

  useEffect(() => {
    setSections(initialSections);
  }, [initialSections]);

  // Row addressing: every task across every section is one continuous row range,
  // in section order, so focus/anchor can be plain (row, col) integers.
  const rowStarts: number[] = [];
  let runningRow = 0;
  for (const section of sections) {
    rowStarts.push(runningRow);
    runningRow += section.tasks.length;
  }
  const totalRows = runningRow;

  // Keep selection valid if the underlying rows shrink (e.g. a selected task is deleted).
  useEffect(() => {
    setSelection((prev) => {
      if (!prev.focus) return prev;
      if (prev.focus.row < totalRows) return prev;
      if (totalRows === 0) return { anchor: null, focus: null, editing: null };
      const clamped = { row: totalRows - 1, col: prev.focus.col };
      return { anchor: clamped, focus: clamped, editing: null };
    });
  }, [totalRows]);

  function taskAt(row: number): { task: KanbanTask; sectionId: string } | null {
    for (let i = 0; i < sections.length; i++) {
      const start = rowStarts[i];
      const section = sections[i];
      if (row < start + section.tasks.length) {
        return { task: section.tasks[row - start], sectionId: section.id };
      }
    }
    return null;
  }

  function findTask(taskId: string): KanbanTask | null {
    for (const s of sections) {
      const t = s.tasks.find((tt) => tt.id === taskId);
      if (t) return t;
    }
    return null;
  }

  function findRowForTask(taskId: string): number | null {
    let idx = 0;
    for (const s of sections) {
      for (const t of s.tasks) {
        if (t.id === taskId) return idx;
        idx++;
      }
    }
    return null;
  }

  function clearCellErrorAt(taskId: string, col: number) {
    const row = findRowForTask(taskId);
    if (row === null) return;
    const key = cellErrorKey(row, col);
    setCellErrors((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }

  function focusGrid() {
    programmaticBlurRef.current = true;
    gridRef.current?.focus();
  }

  function selectCell(row: number, col: number, extend = false) {
    setSelection((prev) => ({
      anchor: extend ? (prev.anchor ?? { row, col }) : { row, col },
      focus: { row, col },
      editing: null,
    }));
    setEditSeed(null);
  }

  function beginEdit(row: number, col: number, seed: string | null = null) {
    setSelection((prev) => ({ ...prev, editing: { row, col } }));
    setEditSeed(seed);
  }

  function endEdit() {
    setSelection((prev) => ({ ...prev, editing: null }));
    setEditSeed(null);
    focusGrid();
  }

  function moveFocus(dRow: number, dCol: number, extend = false) {
    setSelection((prev) => {
      if (!prev.focus || totalRows === 0) return prev;
      const nextFocus = {
        row: clamp(prev.focus.row + dRow, 0, totalRows - 1),
        col: clamp(prev.focus.col + dCol, 0, COLUMN_COUNT - 1),
      };
      return {
        anchor: extend ? (prev.anchor ?? prev.focus) : nextFocus,
        focus: nextFocus,
        editing: null,
      };
    });
    setEditSeed(null);
  }

  function moveFocusTab(direction: 1 | -1) {
    setSelection((prev) => {
      if (!prev.focus || totalRows === 0) return prev;
      let row = prev.focus.row;
      let col = prev.focus.col + direction;
      if (col >= COLUMN_COUNT) {
        col = 0;
        row = clamp(row + 1, 0, totalRows - 1);
      } else if (col < 0) {
        col = COLUMN_COUNT - 1;
        row = clamp(row - 1, 0, totalRows - 1);
      }
      const nextFocus = { row, col };
      return { anchor: nextFocus, focus: nextFocus, editing: null };
    });
    setEditSeed(null);
  }

  function commitAndMoveDown(row: number, col: number) {
    setSelection(() => {
      const nextRow = clamp(row + 1, 0, Math.max(totalRows - 1, 0));
      const nextFocus = { row: nextRow, col };
      return { anchor: nextFocus, focus: nextFocus, editing: null };
    });
    setEditSeed(null);
    focusGrid();
  }

  /**
   * Tab/Shift+Tab counterpart to commitAndMoveDown, shared by every editable column's
   * onKeyDown — advances to the next (direction 1) or previous (direction -1) cell in
   * reading order, wrapping at row boundaries exactly like moveFocusTab does for the
   * non-editing case. Takes the editing cell's own (row, col) rather than reading
   * selection.focus, since a cell opened via double-click may not have moved focus
   * there first (same reason commitAndMoveDown, above, takes explicit row/col).
   */
  function commitAndMoveTab(row: number, col: number, direction: 1 | -1) {
    setSelection(() => {
      let nextRow = row;
      let nextCol = col + direction;
      if (nextCol >= COLUMN_COUNT) {
        nextCol = 0;
        nextRow = clamp(row + 1, 0, Math.max(totalRows - 1, 0));
      } else if (nextCol < 0) {
        nextCol = COLUMN_COUNT - 1;
        nextRow = clamp(row - 1, 0, Math.max(totalRows - 1, 0));
      }
      const nextFocus = { row: nextRow, col: nextCol };
      return { anchor: nextFocus, focus: nextFocus, editing: null };
    });
    setEditSeed(null);
    focusGrid();
  }

  /** Applies batched field edits to local state — shared by optimistic-apply, rollback, and undo. */
  function applyEditsLocally(edits: GridBatchEdit[]) {
    const byId = new Map(edits.map((e) => [e.taskId, e]));
    const allMembers = new Map(members.map((m) => [m.id, m.name]));
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        tasks: s.tasks.map((t) => {
          const edit = byId.get(t.id);
          if (!edit) return t;
          const patch: Partial<KanbanTask> = {};
          if (edit.title !== undefined) patch.title = edit.title;
          if (edit.priority !== undefined) patch.priority = edit.priority;
          if (edit.status !== undefined) patch.status = edit.status;
          if (edit.dueDate !== undefined) patch.dueDate = edit.dueDate;
          if (edit.assigneeIds !== undefined) {
            patch.assigneeIds = edit.assigneeIds;
            patch.assigneeNames = edit.assigneeIds.map((id) => allMembers.get(id) ?? '');
          }
          if (edit.tagIds !== undefined) {
            patch.tags = allTags.filter((tag) => edit.tagIds!.includes(tag.id));
          }
          return { ...t, ...patch };
        }),
      })),
    );
  }

  function pushUndo(entry: UndoEntry) {
    if (entry.before.length === 0 && entry.createdTaskIds.length === 0) return;
    undoStackRef.current.push(entry);
    if (undoStackRef.current.length > 20) undoStackRef.current.shift();
  }

  async function undo() {
    const entry = undoStackRef.current.pop();
    if (!entry) return;

    if (entry.createdTaskIds.length > 0) {
      const created = new Set(entry.createdTaskIds);
      setSections((prev) => prev.map((s) => ({ ...s, tasks: s.tasks.filter((t) => !created.has(t.id)) })));
      await bulkDeleteTasks(entry.createdTaskIds);
    }

    if (entry.before.length > 0) {
      applyEditsLocally(entry.before);
      await batchUpdateTaskFields(entry.before);
    }

    router.refresh();
  }

  async function copySelection() {
    const bounds = computeSelectionBounds(selection);
    if (!bounds) return;

    const lines: string[] = [];
    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      const entry = taskAt(r);
      if (!entry) continue;
      const cols: string[] = [];
      for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
        cols.push(serializeCellForCopy(entry.task, c));
      }
      lines.push(cols.join('\t'));
    }

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
    } catch {
      // Clipboard permission denied — nothing more to do from a keyboard shortcut.
    }
  }

  /**
   * Parses and writes already-obtained paste text at the current focus cell. This is
   * the single implementation shared by the native paste-event handler (handleGridPaste,
   * below — the primary path) and the Cmd/Ctrl+V keydown fallback (pasteAtFocusFallback,
   * further below), which only differ in how they obtain `text`.
   */
  async function applyPastedText(text: string) {
    if (!selection.focus) return;
    if (text === '') return;

    const lines = text.replace(/\r/g, '').split('\n');
    if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
    const pasteRows = lines.map((line) => line.split('\t'));

    const startRow = selection.focus.row;
    const startCol = selection.focus.col;
    const endRowExclusive = startRow + pasteRows.length;

    // Flatten current rows into a plain local array so newly-appended rows can be
    // addressed by index within this same pass, without waiting on a re-render.
    const flatRows: { taskId: string; sectionId: string }[] = [];
    for (const s of sections) {
      for (const t of s.tasks) flatRows.push({ taskId: t.id, sectionId: s.id });
    }

    let newlyCreatedIds: string[] = [];
    const rowsNeeded = endRowExclusive - flatRows.length;
    // Cross-project mode has no single coherent section to create new rows in — a pasted
    // block that overflows past the last row is silently clipped to the rows that already
    // exist (the `if (!row) continue` guard below no-ops any row past `flatRows.length`).
    if (rowsNeeded > 0 && mode !== 'cross-project') {
      // New rows always extend the section containing the grid's current last row —
      // not "the row before wherever this paste happened to start" — regardless of
      // how far into the existing grid the paste's top-left cell was.
      const appendSectionId = flatRows[flatRows.length - 1]?.sectionId ?? sections[sections.length - 1]?.id;
      if (appendSectionId) {
        const titleColOffset = COL.TITLE - startCol;
        const titles: string[] = [];
        for (let i = 0; i < rowsNeeded; i++) {
          const pasteRowIndex = pasteRows.length - rowsNeeded + i;
          const rawCols = pasteRows[pasteRowIndex] ?? [];
          const rawTitle = titleColOffset >= 0 && titleColOffset < rawCols.length ? rawCols[titleColOffset] : '';
          titles.push(rawTitle.trim() || 'Untitled task');
        }
        const createResult = await batchCreateTasks(appendSectionId, titles);
        if (createResult.success && createResult.tasks) {
          newlyCreatedIds = createResult.tasks.map((t) => t.id);
          for (const t of createResult.tasks) flatRows.push({ taskId: t.id, sectionId: appendSectionId });
          setSections((prev) =>
            prev.map((s) =>
              s.id === appendSectionId
                ? {
                    ...s,
                    tasks: [
                      ...s.tasks,
                      ...createResult.tasks!.map(
                        (t): KanbanTask => ({
                          id: t.id,
                          title: t.title,
                          description: null,
                          priority: 'MEDIUM',
                          status: 'TODO',
                          dueDate: null,
                          assigneeIds: [],
                          assigneeNames: [],
                          taskRecurrence: null,
                          locked: false,
                          blockedByTitles: [],
                          subtasks: [],
                          fieldValues: [],
                          tags: [],
                        }),
                      ),
                    ],
                  }
                : s,
            ),
          );
        }
      }
    }

    const newlyCreatedSet = new Set(newlyCreatedIds);
    const editsById = new Map<string, GridBatchEdit>();
    const beforeById = new Map<string, GridBatchEdit>();
    const newErrors = new Map(cellErrors);

    for (let r = 0; r < pasteRows.length; r++) {
      const targetRow = startRow + r;
      const row = flatRows[targetRow];
      if (!row) continue;

      const rawCols = pasteRows[r];
      for (let c = 0; c < rawCols.length; c++) {
        const targetCol = startCol + c;
        if (targetCol >= COLUMN_COUNT) break; // overflow columns are ignored, per spec

        const key = cellErrorKey(targetRow, targetCol);
        const raw = rawCols[c];
        const result = parseCellForPaste(targetCol, raw, { members, allTags });

        if (!result.ok) {
          newErrors.set(key, { raw, error: result.error });
          continue;
        }
        newErrors.delete(key);
        mergeEdit(editsById, row.taskId, result.key, result.value);

        if (!newlyCreatedSet.has(row.taskId)) {
          const current = findTask(row.taskId);
          if (current) mergeEdit(beforeById, row.taskId, result.key, readTaskField(current, result.key));
        }
      }
    }

    setCellErrors(newErrors);

    const edits = Array.from(editsById.values());
    const before = Array.from(beforeById.values());

    if (edits.length > 0) applyEditsLocally(edits);
    pushUndo({ before, createdTaskIds: newlyCreatedIds });

    if (edits.length > 0) {
      const result = await batchUpdateTaskFields(edits);
      if (!result.success && before.length > 0) {
        applyEditsLocally(before); // roll back the optimistic update on failure
      }
    }

    router.refresh();
  }

  /** Native 'paste' event handler on the grid container — the primary paste path. Reads
   * clipboardData directly, which (unlike navigator.clipboard.readText()) needs no async
   * permission grant, so it works in browsers/policies that block programmatic clipboard
   * reads (e.g. Safari, or a restrictive Permissions-Policy). */
  function handleGridPaste(e: ReactClipboardEvent<HTMLDivElement>) {
    // While a cell is editing, its own control (a native input/select, or a picker
    // widget) owns paste just like it owns other keyboard input — let the browser's
    // normal paste-into-the-focused-control behavior run instead of hijacking it for
    // a grid-wide bulk paste. Same guard handleGridKeyDown uses for editing.
    if (selection.editing) return;
    e.preventDefault();
    pasteEventFiredRef.current = true;
    void applyPastedText(e.clipboardData.getData('text/plain'));
  }

  /** Cmd/Ctrl+V keydown fallback. Deliberately does not preventDefault the keydown, so
   * the browser's native paste command still runs and fires the 'paste' event that
   * handleGridPaste (above) handles as the primary path. This only takes over — via the
   * permission-gated async Clipboard API — for the case where a real paste event
   * genuinely didn't fire. */
  async function pasteAtFocusFallback() {
    pasteEventFiredRef.current = false;
    // Yield one tick so the native 'paste' event (if the browser is going to fire one for
    // this keydown) has a chance to run first and flip the flag above.
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (pasteEventFiredRef.current) return;

    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return;
    }
    await applyPastedText(text);
  }

  /**
   * Copies row `minRow`'s value in each fillable column across to rows below it, down
   * through `maxRow`. Shared by the Cmd/Ctrl+D shortcut (fillDown, below, source =
   * current selection) and the mouse fill-handle drag (which extends `maxRow` live as
   * the drag continues) — one batched write path for both.
   */
  async function fillRangeDown(minRow: number, maxRow: number, minCol: number, maxCol: number) {
    if (maxRow <= minRow) return;

    const source = taskAt(minRow);
    if (!source) return;

    const editsById = new Map<string, GridBatchEdit>();
    const beforeById = new Map<string, GridBatchEdit>();

    for (let c = minCol; c <= maxCol; c++) {
      const key = COLUMN_EDIT_KEY[c];
      if (!key) continue; // Repeat isn't fillable yet, same as paste

      const sourceValue = readTaskField(source.task, key);
      for (let r = minRow + 1; r <= maxRow; r++) {
        const entry = taskAt(r);
        if (!entry) continue;
        mergeEdit(editsById, entry.task.id, key, sourceValue);
        mergeEdit(beforeById, entry.task.id, key, readTaskField(entry.task, key));
      }
    }

    const edits = Array.from(editsById.values());
    if (edits.length === 0) return;
    const before = Array.from(beforeById.values());

    applyEditsLocally(edits);
    pushUndo({ before, createdTaskIds: [] });

    const result = await batchUpdateTaskFields(edits);
    if (!result.success) applyEditsLocally(before);
    router.refresh();
  }

  async function fillDown() {
    const bounds = computeSelectionBounds(selection);
    if (!bounds || bounds.minRow === bounds.maxRow) return;
    await fillRangeDown(bounds.minRow, bounds.maxRow, bounds.minCol, bounds.maxCol);
  }

  function setFillDrag(next: FillDragState | null) {
    fillDragRef.current = next;
    setFillDragState(next);
  }

  /** Mousedown on the fill handle — pins the source row and column range for the drag. */
  function startFillDrag() {
    const bounds = computeSelectionBounds(selection);
    if (!bounds) return;
    setFillDrag({ startRow: bounds.minRow, endRow: bounds.maxRow, minCol: bounds.minCol, maxCol: bounds.maxCol });
  }

  /** Mouseenter on a row while a fill drag is active — extends the drag downward only, never above its source row. */
  function fillDragEnterRow(row: number) {
    if (!fillDragRef.current) return;
    setFillDrag({ ...fillDragRef.current, endRow: Math.max(row, fillDragRef.current.startRow) });
  }

  // Window-level (not grid-level) mouseup: the drag should finish wherever the button is
  // released, even if the cursor has left the grid. Added once; reads the live drag state
  // through fillDragRef rather than depending on `fillDrag`, so this effect never re-subscribes.
  useEffect(() => {
    function onWindowMouseUp() {
      const drag = fillDragRef.current;
      if (!drag) return;
      setFillDrag(null);
      void fillRangeDown(drag.startRow, drag.endRow, drag.minCol, drag.maxCol).then(() => {
        setSelection({
          anchor: { row: drag.startRow, col: drag.minCol },
          focus: { row: drag.endRow, col: drag.maxCol },
          editing: null,
        });
      });
    }
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => window.removeEventListener('mouseup', onWindowMouseUp);
    // Intentionally empty: onWindowMouseUp reads fresh state through fillDragRef, so this
    // listener never needs to be torn down and re-added as fillRangeDown's closure changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleGridKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    // While a cell is editing, its own control owns keyboard input — this
    // handler only drives navigation mode.
    if (!selection.focus || selection.editing) return;
    const { row, col } = selection.focus;

    const mod = e.metaKey || e.ctrlKey;
    if (mod) {
      switch (e.key.toLowerCase()) {
        case 'c':
          e.preventDefault();
          void copySelection();
          return;
        case 'v':
          // No preventDefault here: the native 'paste' event (handled by
          // handleGridPaste, the primary path) only fires if the browser's default
          // paste command is allowed to run. This fallback only reads the clipboard
          // itself if that event genuinely didn't fire — see pasteAtFocusFallback.
          void pasteAtFocusFallback();
          return;
        case 'd':
          e.preventDefault();
          void fillDown();
          return;
        case 'z':
          e.preventDefault();
          void undo();
          return;
      }
    }

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        moveFocus(-1, 0, e.shiftKey);
        break;
      case 'ArrowDown':
        e.preventDefault();
        moveFocus(1, 0, e.shiftKey);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        moveFocus(0, -1, e.shiftKey);
        break;
      case 'ArrowRight':
        e.preventDefault();
        moveFocus(0, 1, e.shiftKey);
        break;
      case 'Tab':
        e.preventDefault();
        moveFocusTab(e.shiftKey ? -1 : 1);
        break;
      case 'Enter': {
        e.preventDefault();
        const err = cellErrors.get(cellErrorKey(row, col));
        beginEdit(row, col, err ? err.raw : null);
        break;
      }
      default:
        // Typing directly over a focused cell replaces its contents, like Excel —
        // only meaningful for the free-text title column.
        if (col === COL.TITLE && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          beginEdit(row, col, e.key);
        }
    }
  }

  function patchTask(taskId: string, patch: Partial<KanbanTask>) {
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
      })),
    );
  }

  const FIELD_TO_COL: Partial<Record<TaskField, number>> = {
    title: COL.TITLE,
    priority: COL.PRIORITY,
    status: COL.STATUS,
    dueDate: COL.DUE_DATE,
  };

  async function handleFieldChange(taskId: string, field: TaskField, value: string | number | null) {
    const current = findTask(taskId);
    const col = FIELD_TO_COL[field];
    if (col !== undefined) clearCellErrorAt(taskId, col);
    if (current) {
      pushUndo({ before: [{ taskId, [field]: current[field] } as GridBatchEdit], createdTaskIds: [] });
    }

    patchTask(taskId, { [field]: value } as Partial<KanbanTask>);

    await updateTask(taskId, { [field]: value } as never);

    // Completing a task in an after-completion series spawns the next occurrence as a new
    // row server-side (see materializeAfterCompletion) — router.refresh() below picks that
    // row up; this re-fetch just keeps *this* task's own fields in sync promptly.
    if (field === 'status') {
      const detail = await getTaskDetail(taskId);
      if (detail) {
        patchTask(taskId, {
          status: detail.status,
          dueDate: detail.dueDate,
          taskRecurrence: detail.taskRecurrence,
        });
      }
    }

    router.refresh();
  }

  async function handleAssigneesChange(taskId: string, assigneeIds: string[]) {
    const current = findTask(taskId);
    clearCellErrorAt(taskId, COL.ASSIGNEE);
    if (current) pushUndo({ before: [{ taskId, assigneeIds: current.assigneeIds }], createdTaskIds: [] });

    const allMembers = new Map(members.map((m) => [m.id, m.name]));
    patchTask(taskId, { assigneeIds, assigneeNames: assigneeIds.map((id) => allMembers.get(id) ?? '') });
    await updateTask(taskId, { assigneeIds } as never);
    router.refresh();
  }

  async function handleTagsChange(taskId: string, tagIds: string[]) {
    const current = findTask(taskId);
    clearCellErrorAt(taskId, COL.TAGS);
    if (current) pushUndo({ before: [{ taskId, tagIds: current.tags.map((t) => t.id) }], createdTaskIds: [] });

    patchTask(taskId, { tags: allTags.filter((t) => tagIds.includes(t.id)) });
    await setTaskTags(taskId, tagIds);
    router.refresh();
  }

  async function handleCreateTask(sectionId: string, title: string) {
    if (!projectId) return; // cross-project mode never renders the add-row control that calls this
    const formData = new FormData();
    formData.set('title', title);
    formData.set('sectionId', sectionId);
    const result = await createTask(projectId, formData);

    if (result.success && result.taskId) {
      const newTask: KanbanTask = {
        id: result.taskId,
        title,
        description: null,
        priority: 'MEDIUM',
        status: 'TODO',
        dueDate: null,
        assigneeIds: [],
        assigneeNames: [],
        taskRecurrence: null,
        locked: false,
        blockedByTitles: [],
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
    if (mode === 'cross-project') return; // no Draggables render in this mode
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

  const crossProject = mode === 'cross-project';

  const gridContent = (
    <div
      ref={gridRef}
      tabIndex={-1}
      onKeyDown={handleGridKeyDown}
      onPaste={handleGridPaste}
      className="select-none overflow-x-auto rounded-lg border border-slate-200 bg-white outline-none dark:border-slate-600 dark:bg-slate-800"
    >
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400">
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

        {sections.map((section, sectionIndex) => (
          <SectionBody
            key={section.id}
            section={section}
            rowOffset={rowStarts[sectionIndex]}
            members={crossProject ? (membersByProjectId?.[section.id] ?? []) : members}
            allTags={crossProject ? (tagsByProjectId?.[section.id] ?? []) : allTags}
            draggable={!crossProject}
            addingToSectionId={addingToSectionId}
            setAddingToSectionId={setAddingToSectionId}
            onOpenTask={setOpenTaskId}
            onFieldChange={handleFieldChange}
            onAssigneesChange={handleAssigneesChange}
            onTagsChange={handleTagsChange}
            onDelete={handleDelete}
            onCreateTask={handleCreateTask}
            filtersActive={filtersActive}
            selection={selection}
            editSeed={editSeed}
            cellErrors={cellErrors}
            onSelectCell={selectCell}
            onBeginEdit={beginEdit}
            onEndEdit={endEdit}
            onCommitAndMoveDown={commitAndMoveDown}
            onCommitAndMoveTab={commitAndMoveTab}
            programmaticBlurRef={programmaticBlurRef}
            fillDrag={fillDrag}
            onStartFillDrag={startFillDrag}
            onFillDragEnterRow={fillDragEnterRow}
          />
        ))}
      </table>
    </div>
  );

  return (
    <>
      {crossProject ? gridContent : <DragDropContext onDragEnd={handleDragEnd}>{gridContent}</DragDropContext>}
      {openTaskId && <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </>
  );
}

/** A single `<td>` wired into the shared selection controller — it only ever renders what it's told. */
function GridCell({
  row,
  col,
  isFocused,
  isInRange,
  isFillPreview = false,
  showFillHandle = false,
  onFillHandleMouseDown,
  onSelect,
  onDoubleClick,
  className = '',
  children,
}: {
  row: number;
  col: number;
  isFocused: boolean;
  isInRange: boolean;
  /** True for cells the in-progress fill-handle drag would overwrite if released now. */
  isFillPreview?: boolean;
  /** True only for the bottom-right cell of the current selection — renders the draggable fill handle. */
  showFillHandle?: boolean;
  onFillHandleMouseDown?: () => void;
  onSelect: (row: number, col: number, extend: boolean) => void;
  onDoubleClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <td
      onClick={(e) => onSelect(row, col, e.shiftKey)}
      onDoubleClick={onDoubleClick}
      className={`relative px-3 py-1.5 ${isInRange ? 'bg-brand-50 dark:bg-brand-950/30' : ''} ${isFocused ? 'outline outline-2 -outline-offset-2 outline-brand-500' : ''} ${isFillPreview ? 'outline outline-2 outline-dashed -outline-offset-2 outline-brand-400 bg-brand-50/60 dark:bg-brand-950/20' : ''} ${className}`}
    >
      {children}
      {showFillHandle && (
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFillHandleMouseDown?.();
          }}
          className="absolute -bottom-1 -right-1 h-2.5 w-2.5 cursor-crosshair rounded-sm border border-white bg-brand-500 dark:border-slate-800"
        />
      )}
    </td>
  );
}

/** Shown instead of a cell's normal value when a paste failed to parse it — raw text preserved, never dropped. */
function ErrorCellDisplay({ raw, error }: { raw: string; error: string }) {
  return (
    <div
      title={error}
      className="truncate rounded bg-red-50 px-1 py-0.5 text-sm text-red-700 ring-1 ring-inset ring-red-300 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800"
    >
      {raw.trim() === '' ? <span className="italic text-red-400">(empty)</span> : raw}
    </div>
  );
}

function SectionBody({
  section,
  rowOffset,
  members,
  allTags,
  draggable,
  addingToSectionId,
  setAddingToSectionId,
  onOpenTask,
  onFieldChange,
  onAssigneesChange,
  onTagsChange,
  onDelete,
  onCreateTask,
  filtersActive,
  selection,
  editSeed,
  cellErrors,
  onSelectCell,
  onBeginEdit,
  onEndEdit,
  onCommitAndMoveDown,
  onCommitAndMoveTab,
  programmaticBlurRef,
  fillDrag,
  onStartFillDrag,
  onFillDragEnterRow,
}: {
  section: KanbanSection;
  rowOffset: number;
  members: { id: string; name: string }[];
  allTags: TagInfo[];
  /** false for the cross-project grid's read-only project groupings — no row reordering, no add-row. */
  draggable: boolean;
  addingToSectionId: string | null;
  setAddingToSectionId: (id: string | null) => void;
  onOpenTask: (id: string) => void;
  onFieldChange: (taskId: string, field: TaskField, value: string | number | null) => void;
  onAssigneesChange: (taskId: string, assigneeIds: string[]) => void;
  onTagsChange: (taskId: string, tagIds: string[]) => void;
  onDelete: (taskId: string) => void;
  onCreateTask: (sectionId: string, title: string) => Promise<void>;
  filtersActive: boolean;
  selection: GridSelectionState;
  editSeed: string | null;
  cellErrors: Map<string, CellError>;
  onSelectCell: (row: number, col: number, extend: boolean) => void;
  onBeginEdit: (row: number, col: number, seed?: string | null) => void;
  onEndEdit: () => void;
  onCommitAndMoveDown: (row: number, col: number) => void;
  onCommitAndMoveTab: (row: number, col: number, direction: 1 | -1) => void;
  programmaticBlurRef: MutableRefObject<boolean>;
  fillDrag: FillDragState | null;
  onStartFillDrag: () => void;
  onFillDragEnterRow: (row: number) => void;
}) {
  const bounds = computeSelectionBounds(selection);

  /**
   * One row's cells — identical whether the row lives in a draggable, project-scoped
   * grid (`dragProvided`/`snapshot` set, from inside a `Draggable`) or a read-only,
   * cross-project grouping (`dragProvided`/`snapshot` undefined, rendered directly).
   */
  function renderTaskRow(task: KanbanTask, index: number, dragProvided?: DraggableProvided, snapshot?: DraggableStateSnapshot) {
    const row = rowOffset + index;
    const isFocusedCol = (col: number) => selection.focus?.row === row && selection.focus?.col === col;
    const isInRangeCol = (col: number) =>
      !!bounds && row >= bounds.minRow && row <= bounds.maxRow && col >= bounds.minCol && col <= bounds.maxCol;
    const isEditingCol = (col: number) => selection.editing?.row === row && selection.editing?.col === col;
    // Only the rows a fill-handle drag has reached *beyond* the original selection get the
    // dashed preview — the source rows already show the solid isInRangeCol highlight.
    const isFillPreviewCol = (col: number) =>
      !!fillDrag && !!bounds && row > bounds.maxRow && row <= fillDrag.endRow && col >= fillDrag.minCol && col <= fillDrag.maxCol;
    // The fill handle only ever renders on the bottom-right cell of the selection, and only
    // for columns paste/fill-down already know how to write (Repeat is display-only).
    const isFillHandleCell = (col: number) =>
      !!bounds && row === bounds.maxRow && col === bounds.maxCol && !selection.editing && !!COLUMN_EDIT_KEY[col];
    const errorAt = (col: number) => cellErrors.get(cellErrorKey(row, col));
    const dueInfo = formatDueDate(task.dueDate);

    return (
                    <tr
                      key={task.id}
                      ref={dragProvided?.innerRef}
                      {...(dragProvided?.draggableProps ?? {})}
                      onMouseEnter={() => onFillDragEnterRow(row)}
                      className={`border-b border-slate-100 dark:border-slate-700 ${snapshot?.isDragging ? 'bg-brand-50 shadow-md dark:bg-brand-950' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                    >
                      <td className="px-2 py-1.5 text-slate-300 dark:text-slate-600" {...(dragProvided?.dragHandleProps ?? {})}>
                        {draggable ? '⠿' : ''}
                      </td>

                      <GridCell
                        row={row}
                        col={COL.TITLE}
                        isFocused={isFocusedCol(COL.TITLE)}
                        isInRange={isInRangeCol(COL.TITLE)}
                        isFillPreview={isFillPreviewCol(COL.TITLE)}
                        showFillHandle={isFillHandleCell(COL.TITLE)}
                        onFillHandleMouseDown={onStartFillDrag}
                        onSelect={onSelectCell}
                        onDoubleClick={() => onOpenTask(task.id)}
                      >
                        {isEditingCol(COL.TITLE) ? (
                          <input
                            autoFocus
                            defaultValue={editSeed ?? task.title}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const value = e.currentTarget.value;
                                if (value !== task.title) onFieldChange(task.id, 'title', value);
                                onCommitAndMoveDown(row, COL.TITLE);
                              } else if (e.key === 'Tab') {
                                e.preventDefault();
                                const value = e.currentTarget.value;
                                if (value !== task.title) onFieldChange(task.id, 'title', value);
                                onCommitAndMoveTab(row, COL.TITLE, e.shiftKey ? -1 : 1);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                onEndEdit();
                              }
                            }}
                            onBlur={(e) => {
                              if (programmaticBlurRef.current) {
                                programmaticBlurRef.current = false;
                                return;
                              }
                              const value = e.target.value;
                              if (value !== task.title) onFieldChange(task.id, 'title', value);
                              onEndEdit();
                            }}
                            className="w-full rounded border border-brand-400 bg-white px-1 py-0.5 text-sm text-slate-800 focus:outline-none dark:bg-slate-800 dark:text-slate-200"
                          />
                        ) : errorAt(COL.TITLE) ? (
                          <ErrorCellDisplay raw={errorAt(COL.TITLE)!.raw} error={errorAt(COL.TITLE)!.error} />
                        ) : (
                          <div className="truncate px-1 py-0.5 text-sm text-slate-800 dark:text-slate-200">{task.title}</div>
                        )}
                      </GridCell>

                      <GridCell
                        row={row}
                        col={COL.TAGS}
                        isFocused={isFocusedCol(COL.TAGS)}
                        isInRange={isInRangeCol(COL.TAGS)}
                        isFillPreview={isFillPreviewCol(COL.TAGS)}
                        showFillHandle={isFillHandleCell(COL.TAGS)}
                        onFillHandleMouseDown={onStartFillDrag}
                        onSelect={onSelectCell}
                        onDoubleClick={() => onBeginEdit(row, COL.TAGS)}
                      >
                        {isEditingCol(COL.TAGS) ? (
                          <div
                            onBlur={(e) => {
                              if (!e.currentTarget.contains(e.relatedTarget as Node)) onEndEdit();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                // TagPicker's onChange already commits on every toggle —
                                // nothing more to write, just advance like the other columns.
                                e.preventDefault();
                                onCommitAndMoveDown(row, COL.TAGS);
                              } else if (e.key === 'Tab') {
                                e.preventDefault();
                                onCommitAndMoveTab(row, COL.TAGS, e.shiftKey ? -1 : 1);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                onEndEdit();
                              }
                            }}
                          >
                            <TagPicker
                              allTags={allTags}
                              selectedIds={task.tags.map((t) => t.id)}
                              onChange={(tagIds) => onTagsChange(task.id, tagIds)}
                              autoOpen
                            />
                          </div>
                        ) : errorAt(COL.TAGS) ? (
                          <ErrorCellDisplay raw={errorAt(COL.TAGS)!.raw} error={errorAt(COL.TAGS)!.error} />
                        ) : (
                          <div className="flex flex-wrap items-center gap-1">
                            {task.tags.length === 0 ? (
                              <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                            ) : (
                              task.tags.map((t) => <TagBadge key={t.id} tag={t} />)
                            )}
                          </div>
                        )}
                      </GridCell>

                      <GridCell
                        row={row}
                        col={COL.ASSIGNEE}
                        isFocused={isFocusedCol(COL.ASSIGNEE)}
                        isInRange={isInRangeCol(COL.ASSIGNEE)}
                        isFillPreview={isFillPreviewCol(COL.ASSIGNEE)}
                        showFillHandle={isFillHandleCell(COL.ASSIGNEE)}
                        onFillHandleMouseDown={onStartFillDrag}
                        onSelect={onSelectCell}
                        onDoubleClick={() => onBeginEdit(row, COL.ASSIGNEE)}
                      >
                        {isEditingCol(COL.ASSIGNEE) ? (
                          <div
                            onBlur={(e) => {
                              if (!e.currentTarget.contains(e.relatedTarget as Node)) onEndEdit();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                // AssigneePicker's onChange already commits on every
                                // toggle — nothing more to write, just advance.
                                e.preventDefault();
                                onCommitAndMoveDown(row, COL.ASSIGNEE);
                              } else if (e.key === 'Tab') {
                                e.preventDefault();
                                onCommitAndMoveTab(row, COL.ASSIGNEE, e.shiftKey ? -1 : 1);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                onEndEdit();
                              }
                            }}
                          >
                            <AssigneePicker
                              members={members}
                              selectedIds={task.assigneeIds}
                              onChange={(ids) => onAssigneesChange(task.id, ids)}
                              compact
                              autoOpen
                            />
                          </div>
                        ) : errorAt(COL.ASSIGNEE) ? (
                          <ErrorCellDisplay raw={errorAt(COL.ASSIGNEE)!.raw} error={errorAt(COL.ASSIGNEE)!.error} />
                        ) : (
                          <div className="truncate text-sm text-slate-700 dark:text-slate-200">
                            {task.assigneeNames.length === 0 ? (
                              <span className="text-slate-400 dark:text-slate-500">Unassigned</span>
                            ) : (
                              task.assigneeNames.join(', ')
                            )}
                          </div>
                        )}
                      </GridCell>

                      <GridCell
                        row={row}
                        col={COL.PRIORITY}
                        isFocused={isFocusedCol(COL.PRIORITY)}
                        isInRange={isInRangeCol(COL.PRIORITY)}
                        isFillPreview={isFillPreviewCol(COL.PRIORITY)}
                        showFillHandle={isFillHandleCell(COL.PRIORITY)}
                        onFillHandleMouseDown={onStartFillDrag}
                        onSelect={onSelectCell}
                        onDoubleClick={() => onBeginEdit(row, COL.PRIORITY)}
                      >
                        {isEditingCol(COL.PRIORITY) ? (
                          <select
                            autoFocus
                            value={task.priority}
                            onChange={(e) => {
                              onFieldChange(task.id, 'priority', e.target.value);
                              onEndEdit();
                            }}
                            onBlur={onEndEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const value = e.currentTarget.value;
                                if (value !== task.priority) onFieldChange(task.id, 'priority', value);
                                onCommitAndMoveDown(row, COL.PRIORITY);
                              } else if (e.key === 'Tab') {
                                e.preventDefault();
                                const value = e.currentTarget.value;
                                if (value !== task.priority) onFieldChange(task.id, 'priority', value);
                                onCommitAndMoveTab(row, COL.PRIORITY, e.shiftKey ? -1 : 1);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                onEndEdit();
                              }
                            }}
                            className="w-full rounded border border-brand-400 bg-white px-1 py-0.5 text-sm focus:outline-none dark:bg-slate-800"
                          >
                            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        ) : errorAt(COL.PRIORITY) ? (
                          <ErrorCellDisplay raw={errorAt(COL.PRIORITY)!.raw} error={errorAt(COL.PRIORITY)!.error} />
                        ) : (
                          <div className="truncate px-1 py-0.5 text-sm text-slate-700 dark:text-slate-200">{PRIORITY_LABELS[task.priority]}</div>
                        )}
                      </GridCell>

                      <GridCell
                        row={row}
                        col={COL.STATUS}
                        isFocused={isFocusedCol(COL.STATUS)}
                        isInRange={isInRangeCol(COL.STATUS)}
                        isFillPreview={isFillPreviewCol(COL.STATUS)}
                        showFillHandle={isFillHandleCell(COL.STATUS)}
                        onFillHandleMouseDown={onStartFillDrag}
                        onSelect={onSelectCell}
                        onDoubleClick={() => onBeginEdit(row, COL.STATUS)}
                      >
                        {isEditingCol(COL.STATUS) ? (
                          <select
                            autoFocus
                            value={task.status}
                            onChange={(e) => {
                              onFieldChange(task.id, 'status', e.target.value);
                              onEndEdit();
                            }}
                            onBlur={onEndEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const value = e.currentTarget.value;
                                if (value !== task.status) onFieldChange(task.id, 'status', value);
                                onCommitAndMoveDown(row, COL.STATUS);
                              } else if (e.key === 'Tab') {
                                e.preventDefault();
                                const value = e.currentTarget.value;
                                if (value !== task.status) onFieldChange(task.id, 'status', value);
                                onCommitAndMoveTab(row, COL.STATUS, e.shiftKey ? -1 : 1);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                onEndEdit();
                              }
                            }}
                            className="w-full rounded border border-brand-400 bg-white px-1 py-0.5 text-sm focus:outline-none dark:bg-slate-800"
                          >
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        ) : errorAt(COL.STATUS) ? (
                          <ErrorCellDisplay raw={errorAt(COL.STATUS)!.raw} error={errorAt(COL.STATUS)!.error} />
                        ) : (
                          <div className="truncate px-1 py-0.5 text-sm text-slate-700 dark:text-slate-200">{STATUS_LABELS[task.status]}</div>
                        )}
                      </GridCell>

                      <GridCell
                        row={row}
                        col={COL.DUE_DATE}
                        isFocused={isFocusedCol(COL.DUE_DATE)}
                        isInRange={isInRangeCol(COL.DUE_DATE)}
                        isFillPreview={isFillPreviewCol(COL.DUE_DATE)}
                        showFillHandle={isFillHandleCell(COL.DUE_DATE)}
                        onFillHandleMouseDown={onStartFillDrag}
                        onSelect={onSelectCell}
                        onDoubleClick={() => onBeginEdit(row, COL.DUE_DATE)}
                      >
                        {isEditingCol(COL.DUE_DATE) ? (
                          <input
                            type="date"
                            autoFocus
                            defaultValue={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                            onChange={(e) => onFieldChange(task.id, 'dueDate', e.target.value || null)}
                            onBlur={onEndEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                onCommitAndMoveDown(row, COL.DUE_DATE);
                              } else if (e.key === 'Tab') {
                                e.preventDefault();
                                onCommitAndMoveTab(row, COL.DUE_DATE, e.shiftKey ? -1 : 1);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                onEndEdit();
                              }
                            }}
                            className="w-full rounded border border-brand-400 bg-white px-1 py-0.5 text-sm focus:outline-none dark:bg-slate-800"
                          />
                        ) : errorAt(COL.DUE_DATE) ? (
                          <ErrorCellDisplay raw={errorAt(COL.DUE_DATE)!.raw} error={errorAt(COL.DUE_DATE)!.error} />
                        ) : (
                          <div className={`truncate px-1 py-0.5 text-sm ${dueInfo.overdue ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>
                            {dueInfo.label}
                          </div>
                        )}
                      </GridCell>

                      <GridCell
                        row={row}
                        col={COL.RECURRENCE}
                        isFocused={isFocusedCol(COL.RECURRENCE)}
                        isInRange={isInRangeCol(COL.RECURRENCE)}
                        onSelect={onSelectCell}
                        onDoubleClick={() => onOpenTask(task.id)}
                      >
                        {errorAt(COL.RECURRENCE) ? (
                          <ErrorCellDisplay raw={errorAt(COL.RECURRENCE)!.raw} error={errorAt(COL.RECURRENCE)!.error} />
                        ) : (
                          <div className="truncate px-1 py-0.5 text-sm text-slate-700 dark:text-slate-200">
                            {summarizeRecurrence(task.taskRecurrence)}
                          </div>
                        )}
                      </GridCell>

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
    );
  }

  return (
    <>
      <tbody>
        <tr className="border-b border-slate-100 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-700/70">
          <td colSpan={9} className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            {section.name} <span className="font-normal text-slate-400 dark:text-slate-500">({section.tasks.length})</span>
          </td>
        </tr>
        {filtersActive && section.tasks.length === 0 && (
          <tr className="border-b border-slate-100 dark:border-slate-700">
            <td colSpan={9} className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">
              No tasks match your filters.
            </td>
          </tr>
        )}
      </tbody>

      {draggable ? (
        <Droppable droppableId={section.id}>
          {(provided) => (
            <tbody ref={provided.innerRef} {...provided.droppableProps}>
              {section.tasks.map((task, index) => (
                <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={filtersActive}>
                  {(dragProvided, snapshot) => renderTaskRow(task, index, dragProvided, snapshot)}
                </Draggable>
              ))}
              <tr style={{ display: 'none' }}>
                <td colSpan={9}>{provided.placeholder}</td>
              </tr>
            </tbody>
          )}
        </Droppable>
      ) : (
        <tbody>{section.tasks.map((task, index) => renderTaskRow(task, index))}</tbody>
      )}

      {draggable && (
        <tbody>
          <tr className="border-b border-slate-100 dark:border-slate-700">
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
      )}
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
      <button onClick={onOpen} className="w-full rounded px-2 py-1 text-left text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300">
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
        className="w-full rounded border border-slate-200 px-2 py-1 text-sm focus:border-brand-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
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
      <button type="button" onClick={onClose} className="shrink-0 rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700">
        Cancel
      </button>
    </form>
  );
}
