import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type TaskStatusValue = 'TODO' | 'IN_PROGRESS' | 'DONE';

// Mirrors the STATUS_SECTION_NAMES mapping added by the P0.1 status/column sync fix
// (branch fix/security-race-cherry-pick, PR #1 — not yet merged as of this script). Kept as a
// local, self-contained copy rather than importing from src/lib/actions/tasks.ts because that
// export doesn't exist on this branch yet; once PR #1 merges, this constant should be replaced
// with the shared one to avoid drift.
const STATUS_SECTION_NAMES: Record<TaskStatusValue, string> = {
  TODO: 'to do',
  IN_PROGRESS: 'in progress',
  DONE: 'done',
};

function statusFromSectionName(name: string): TaskStatusValue | null {
  const normalized = name.trim().toLowerCase();
  const entry = (Object.entries(STATUS_SECTION_NAMES) as [TaskStatusValue, string][]).find(
    ([, sectionName]) => sectionName === normalized,
  );
  return entry ? entry[0] : null;
}

async function endOfSectionOrder(sectionId: string): Promise<number> {
  const last = await prisma.task.findFirst({
    where: { sectionId, parentTaskId: null, deletedAt: null },
    orderBy: { order: 'desc' },
  });
  return (last?.order ?? -1) + 1;
}

/**
 * One-time (idempotent) backfill for P0.1: reconciles existing top-level tasks whose `status`
 * and board column (`Section.name`) already disagree.
 *
 * Only the column is corrected, never the status. In this codebase's current action set,
 * moveTask (drag-and-drop) already derives status from the destination column, so a drag can
 * never leave a stale status behind — every existing mismatch was produced by a status change
 * made off the board (task detail panel, grid status cell, subtask checkbox promoting a
 * parent), which updateTask applies to `status` without moving `sectionId`. That makes status
 * the side that already reflects intent; this script brings the column into agreement with it.
 * Subtasks are skipped — they aren't independently positioned on the board.
 *
 * Safe to rerun: a task already sitting in the section matching its status is left untouched.
 */
async function main() {
  console.log('Backfilling status/column mismatches...');

  const tasks = await prisma.task.findMany({
    where: { parentTaskId: null, deletedAt: null },
    include: { section: true },
  });

  let moved = 0;
  let skipped = 0;

  for (const task of tasks) {
    const columnStatus = statusFromSectionName(task.section.name);
    if (columnStatus === null || columnStatus === task.status) {
      skipped += 1;
      continue;
    }

    const targetSectionName = STATUS_SECTION_NAMES[task.status as TaskStatusValue];
    const destinationSection = await prisma.section.findFirst({
      where: { projectId: task.projectId, name: { equals: targetSectionName, mode: 'insensitive' } },
    });

    if (!destinationSection || destinationSection.id === task.sectionId) {
      skipped += 1;
      continue;
    }

    const order = await endOfSectionOrder(destinationSection.id);
    await prisma.task.update({
      where: { id: task.id },
      data: { sectionId: destinationSection.id, order },
    });

    moved += 1;
    console.log(
      `  "${task.title}" (${task.id}) -> moved to "${destinationSection.name}" to match status ${task.status}`,
    );
  }

  console.log(`Done. Moved ${moved} task(s) to match their status, left ${skipped} unchanged.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
