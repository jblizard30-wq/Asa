# CPCana Backlog Status (handoff note)

Snapshot date: 2026-08-05. Branch: `wip-automation-builder`. Source doc: `church-tasks-improvements_1.md` (not in repo — pasted by Justin, kept for reference here).

Paste this file's contents back to Claude in a fresh conversation to resume with full context.

---

## Done and verified (tsc clean, 42/42 tests, lint clean)

- **P0.1 — status/column desync.** `updateTask` and `moveTask` in `src/lib/actions/tasks.ts` now share one name-based status↔section mapping (`STATUS_SECTION_NAMES` / `statusFromSectionName`) so editing status off-board moves the card, and drag-drop writes status. Decision made unilaterally (not asked): kept path (A)-adjacent — name-matching against the 3 fixed default sections, no schema change, since no section rename/create UI exists.
- **P0.2 — recurrence duplicate (real race, confirmed).** Three sites (`updateTask`, `moveTask`, `applyAutomationAction`'s `SET_STATUS` in `src/lib/automations.ts`) did stale check-then-act on the DONE transition. Now use an atomic conditional `updateMany` claim (`where: { status: { not: 'DONE' } }`) before materializing the next occurrence, so concurrent completions can't both spawn a successor.
- **P0.3 — personal-task leak (security bug, confirmed).** `src/lib/actions/search.ts`: admin search previously had `isAdmin ? {}` (no project filter at all), leaking other users' Personal Tasks project content into admin search results. Fixed to `{ OR: [{ isPersonal: false }, { isPersonal: true, createdById: session.user.id }] }`.
- **P1.2 — priority default.** Added `priority` column to `TaskRecurrence` (migration `20260805130113_add_task_recurrence_priority`), threaded through `taskRecurrences.ts` and `materializeRecurrence.ts` so recurring occurrences inherit the series' priority instead of reverting to MEDIUM.
- **P1.4 — My Tasks grouping.** `src/app/(app)/my-tasks/page.tsx` was missing `parentTaskId: null` on its two queries, causing assigned/owned subtasks to double-render (nested + duplicate top-level card). Fixed to match convention used everywhere else.

## NOT done — explicitly still open

**P0 loose ends:**
- One-time data migration to reconcile *existing* tasks where column/status already disagree (P0.1's acceptance criteria) — fix only stops new drift, doesn't backfill Sunday Service Planning's current mismatches.
- P0.3's audit criterion — only `search.ts` was fixed. Sidebar, task move/copy, forms builder, workflow builder, and (notably) the **New Automation Rule project picker** — the literal dropdown described in the P0.3 bug report — have not been individually checked for the same missing personal-project scope.

**P1 (2 of 4 remaining):**
- **P1.1** — assignment pressure: inline assignee on quick-add, warning affordance on unassigned cards, "Unassigned (n)" filter chip, weekly digest to project owners, bulk-assign in List view. Nothing started.
- **P1.3** — email notifications: assignment email, deep link, per-user preferences, Thursday digest (America/Chicago). Nothing started. (Push/SMS channels are intentionally deferred per CLAUDE.md "Known gaps" — not part of this item's scope.)

**P2 (nothing started):**
- P2.1 start date + Timeline view
- P2.2 pattern-based automation rules (current rules are hardcoded task-to-task and break on recurrence — architectural rewrite)
- P2.3 multi-homing (task in multiple projects, `TaskProject` join table)
- P2.4 custom fields — not even investigated what "Manage fields" currently supports
- P2.5 task modal gaps: multiple links, rich text description, @mentions, followers/watchers, subtask own assignee/due date
- P2.6 per-project calendar tab, capacity-aware workload, CSV export, public read-only project share

**P3 (nothing started):**
- P3.1 recurring service templates (doc calls this the **highest-value item in the whole document**)
- P3.2 volunteer availability/rotation/fairness
- P3.3 ministry-year seasonality (Advent, Lent, etc. auto-generation)
- P3.4 extend guest links to accept/decline roster confirmation
- P3.5 Planning Center Online (or CCB/Rock RMS) integration — blocked on asking Justin what system the church runs

**Cleanup (untouched):**
- Delete the "123" test project from production
- Triage the Bulletin project's 44 orphaned/unassigned tasks
- Verify responsive/mobile layout (390px, sidebar + 4-col Kanban)
- Verify the notification bell does anything
- Timezone check — confirm due/overdue math uses America/Chicago, not UTC

**Open questions for Justin — none formally answered except by default/inaction:**
1. Sections vs. status: (A) simple vs (B) Asana-style — answered implicitly by choosing (A) for P0.1.
2. Existing Medium-priority tasks: migrate to null, or leave? — **left as-is, not decided by Justin.** Doc recommends migrating.
3. Require an assignee on new tasks, or just nudge? — open.
4. SMS for day-of reminders (Twilio cost/setup)? — open.
5. Public read-only project links (exposes names) — open, needs Justin's sign-off before building.
6. Does Chespres use Planning Center / CCB / Rock RMS? — open, blocks P3.5 scoping.
7. What is the Bulletin project's 44 tasks — import, backlog, or dead weight? — open, blocks cleanup triage.
8. Which Asana tier was the team on (affects whether Timeline/Workload/Portfolios are expected)? — open.

## Suggested next step (per doc's execution order)

Next unstarted items in priority order: **Cleanup** (delete "123", triage Bulletin, timezone check — cheap, unblocks trustworthy dashboard numbers) → **P1.1** (assignment pressure + bulk assign) → **P1.4 empty-state polish already done, P1.3** (email notifications).

## Repo invariants to preserve (from CLAUDE.md — still current)

1. One selection controller for the grid (`GridView.tsx`), not per-cell state.
2. Batch all grid writes into one `$transaction` (`batchUpdateTaskFields`/`batchCreateTasks`), never loop per-row.
3. Store the RRULE (`TaskRecurrence`), not materialized rows.
4. All recurrence date math goes through `rrule`.
5. All scheduled/cron jobs (and check-then-act state transitions generally) must be idempotent — this is the invariant P0.2's fix was built around.

Known intentional gap: Push/SMS reminder channels not implemented (EMAIL-only) — deferred on purpose, not a bug.
