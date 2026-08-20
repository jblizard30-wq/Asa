# CPCana Backlog Status (handoff note)

Snapshot date: 2026-08-19 (updated from 2026-08-05 original). Branch: `fix/security-race-cherry-pick` (superseded `wip-automation-builder`). Source doc: `church-tasks-improvements_1.md` (not in repo — pasted by Justin, kept for reference here).

Paste this file's contents back to Claude in a fresh conversation to resume with full context.

---

## Step 0 — DONE: PR #1 merged to main (2026-08-20)

**https://github.com/jblizard30-wq/CPCana/pull/1** — 4 commits from `fix/security-race-cherry-pick`, merged into `main` (`992e85e`).

Verified clean: `npm run lint` (no warnings), `npm test` (68/68 across 9 files), `npm run build` (28/28 routes, no errors).

**Environment note (judgment call, documented per instructions):** local verification in the original `~/Documents/GitHub/CPCana` working copy was unreliable for a stretch of this session — `npm run build`, `git status`, and even a `git worktree add` intermittently hung or failed with inconsistent error signatures (`ETIMEDOUT` on a plain `fs.readFileSync`, `mmap failed`, multi-minute `git status` hangs). Root cause: iCloud Drive's "Desktop & Documents" sync is enabled and was evicting `node_modules`/`.git` content to cloud-only placeholder files (confirmed via `brctl status`; disk was also at ~95% capacity, which makes macOS evict more aggressively). Several other concurrent Claude Code sessions on the same machine independently reproduced the same `git status` hang, corroborating this isn't specific to one session or a code defect. Justin confirmed and had already begun moving to a non-iCloud working copy at `~/Developer/CPCana` (fresh `git clone` from origin, not a copy of the flaky tree) — all three checks above were run there, first-hand, not just relayed from another session. The original `~/Documents/GitHub/CPCana` directory has an uncommitted stash another session was migrating over; it hasn't been deleted.

---

## Done and verified (tsc clean, 42/42 tests, lint clean)

- **P0.1 — status/column desync.** `updateTask` and `moveTask` in `src/lib/actions/tasks.ts` now share one name-based status↔section mapping (`STATUS_SECTION_NAMES` / `statusFromSectionName`) so editing status off-board moves the card, and drag-drop writes status. Decision made unilaterally (not asked): kept path (A)-adjacent — name-matching against the 3 fixed default sections, no schema change, since no section rename/create UI exists.
- **P0.2 — recurrence duplicate (real race, confirmed).** Three sites (`updateTask`, `moveTask`, `applyAutomationAction`'s `SET_STATUS` in `src/lib/automations.ts`) did stale check-then-act on the DONE transition. Now use an atomic conditional `updateMany` claim (`where: { status: { not: 'DONE' } }`) before materializing the next occurrence, so concurrent completions can't both spawn a successor.
- **P0.3 — personal-task leak (security bug, confirmed).** `src/lib/actions/search.ts`: admin search previously had `isAdmin ? {}` (no project filter at all), leaking other users' Personal Tasks project content into admin search results. Fixed to `{ OR: [{ isPersonal: false }, { isPersonal: true, createdById: session.user.id }] }`.
- **P1.2 — priority default.** Added `priority` column to `TaskRecurrence` (migration `20260805130113_add_task_recurrence_priority`), threaded through `taskRecurrences.ts` and `materializeRecurrence.ts` so recurring occurrences inherit the series' priority instead of reverting to MEDIUM.
- **P1.4 — My Tasks grouping.** `src/app/(app)/my-tasks/page.tsx` was missing `parentTaskId: null` on its two queries, causing assigned/owned subtasks to double-render (nested + duplicate top-level card). Fixed to match convention used everywhere else.
- **Rebrand to Asa.** Env-driven org branding (name/color/logo) for single-codebase multi-tenant deploys, signed single-use "log in as admin" HQ support token flow, reworked trash list/restore UX (`src/lib/site.ts`, `src/app/support-login/`, `src/lib/supportLogin.ts`).
- **Web manifest icon MIME type.** Now derived from `LOGO_URL`'s actual file extension instead of hardcoded `image/png` — fixes deployments (like this one) using an SVG logo.
- **Bulk actions.** Status/priority/assignee/delete for task lists, restore for trashed tasks, role change/delete for admin users table — one batched action instead of one request per row. **Note for P1.1:** this already covers "bulk-assign in List view" from P1.1's scope below — check `ListView.tsx`/`MyTasksList.tsx` before re-implementing that part of P1.1.
- **P0.3 audit — completed 2026-08-20.** Confirmed the same `role === 'ADMIN' ? {} : {...}` bare-admin-bypass bug (no personal-project exclusion at all) in three more places and fixed all three the same way as `search.ts` (`{ OR: [{ isPersonal: false }, { isPersonal: true, createdById: <id> }] }`): `getAutomationOptions()` in `src/lib/actions/automations.ts` (this **is** the New Automation Rule project picker named in the original bug report — any admin building a rule could see every user's personal project names/sections/task titles), `accessibleProjectIds()` in `src/app/api/v1/tasks/route.ts` (worse than the others — public API-key endpoint, not just a UI leak), and `getTasksInRange()` in `src/lib/actions/calendar.ts` (personal task due dates were appearing on the shared org calendar for admins). Sidebar (`layout.tsx`, `projects/page.tsx`) already filtered correctly. Forms builder and workflow builder (`intakeForms.ts`, `workflows.ts`) only ever query within a single `projectId` the caller already passed `requireProjectMember` for — no cross-project listing, so no leak surface there. No standalone cross-project "move/copy task" picker exists in the codebase (`moveTask` only moves within a project's own sections) — that audit sub-item was based on a feature that doesn't exist. Verified: lint clean, 68/68 tests, build clean (28/28 routes).
- **Notification bell — verified real, not a stub.** `NotificationBell.tsx` renders live unread count, dropdown list, mark-one/mark-all-read wired to real server actions in `src/lib/actions/notifications.ts`. Cleanup item resolved with no code change needed.

## NOT done — explicitly still open

**Newly confirmed bug (from the "timezone check" cleanup item below — this is no longer just a suspicion):**
- **Due/overdue math uses raw UTC instants, not America/Chicago calendar days.** `dueDate` is saved via `new Date(dateOnlyString)` (`src/lib/actions/tasks.ts:152,228,333,750`), which JS parses as midnight UTC. Every overdue computation (`src/lib/actions/dashboard.ts:79` and whatever `computeOverdueTasks`/`computeTopLineStats`/etc. do with that `now`, plus likely the Kanban/List/Grid "overdue" badges and `send-reminders`) compares that instant directly against `new Date()` — an absolute-time compare, not a calendar-day-in-Chicago compare. Concrete effect: a task due "2026-08-20" flips to overdue at 2026-08-20T00:00:00Z, which is **7pm Central on 2026-08-19** (CDT, UTC-5) — a task shows overdue almost a full day before its due date even starts locally, and for the entire day that is actually its due date. `src/app/api/cron/digest/route.ts` and `automations/route.ts` already define `APP_TIMEZONE = 'America/Chicago'` for scheduling, but that constant isn't used for the comparison math itself. **Not fixed yet** — deliberately left for a session with more budget: the correct fix is comparing Chicago calendar-dates (not instants) and needs one shared helper used consistently everywhere "overdue" is computed (mirrors the `STATUS_SECTION_NAMES` single-source-of-truth pattern), plus real verification of DST-boundary days, which wasn't safe to rush at 7% budget remaining.

**P0 loose ends:**
- One-time data migration to reconcile *existing* tasks where column/status already disagree (P0.1's acceptance criteria) — fix only stops new drift, doesn't backfill Sunday Service Planning's current mismatches.

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

**Cleanup:**
- Delete the "123" test project from production — untouched; needs direct prod DB access/confirmation, not something to do unattended.
- Triage the Bulletin project's 44 orphaned/unassigned tasks — untouched; blocked on open question #7 below.
- Verify responsive/mobile layout (390px, sidebar + 4-col Kanban) — untouched.
- ~~Verify the notification bell does anything~~ — done, see above, it's real.
- ~~Timezone check~~ — done, see confirmed bug above (upgraded from "check" to a real, unfixed bug).

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

Next unstarted items in priority order: **fix the confirmed overdue/timezone bug** (now well-scoped above, needs a full budget to fix + verify DST edges properly) → remaining **Cleanup** (delete "123", triage Bulletin, mobile layout) → **P1.1** (assignment pressure + bulk assign) → **P1.3** (email notifications).

## Repo invariants to preserve (from CLAUDE.md — still current)

1. One selection controller for the grid (`GridView.tsx`), not per-cell state.
2. Batch all grid writes into one `$transaction` (`batchUpdateTaskFields`/`batchCreateTasks`), never loop per-row.
3. Store the RRULE (`TaskRecurrence`), not materialized rows.
4. All recurrence date math goes through `rrule`.
5. All scheduled/cron jobs (and check-then-act state transitions generally) must be idempotent — this is the invariant P0.2's fix was built around.

Known intentional gap: Push/SMS reminder channels not implemented (EMAIL-only) — deferred on purpose, not a bug.
