# CLAUDE.md

Next.js 14 + Prisma (Neon serverless Postgres) + NextAuth church task manager.

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm test` — run vitest suite (`vitest run`)
- `npm run prisma:migrate` — create/apply a migration in dev (`prisma migrate dev`)
- `npm run prisma:studio` — Prisma Studio
- `npm run seed` / `npm run seed:bulletin` — seed scripts (`tsx prisma/seed*.ts`)

## Invariants

These hold across the grid view, recurring tasks, and reminders features. Preserve them in any change that touches this code — they were deliberate design decisions, not accidents.

1. **One selection controller for the grid, not per-cell state.** `GridView.tsx` holds a single `{ anchor, focus, editing }` controller; individual `<td>` cells are dumb renderers driven by props. Do not give a cell its own local selection/edit state — that's what breaks shift-select, fill-down, and copy/paste as a set.

2. **Batch all grid writes.** A paste or fill-down across many cells must produce one `$transaction` (see `batchUpdateTaskFields` / `batchCreateTasks` in `src/lib/actions/tasks.ts`), not one request per cell. Never loop `updateTask` per row for a multi-cell operation.

3. **Store the RRULE, not materialized rows.** Recurring tasks are one `TaskRecurrence` row (the recipe) plus a nightly job that creates the next occurrence (the meal). Never pre-generate a batch of future task rows for a recurrence.

4. **All recurrence date math goes through the `rrule` library.** Don't hand-roll interval/weekday/month math for recurrences — `rrule` is already a dependency specifically to avoid that class of bug (DST shifts, month-length edge cases, etc.).

5. **All scheduled/cron jobs must be idempotent.** Vercel Cron can invoke a route more than once for the same trigger. Every cron handler needs a mechanism that makes a duplicate run a no-op — e.g. the `(recurrenceId, occurrenceDate)` unique index for recurrence materialization, or an atomic conditional claim (`updateMany` with `sentAt: null` in the `where`) before delivering a reminder. Never "check then act" without that guard.

## Known gaps (as of 2026-08-11)

- Push/SMS reminder channels aren't implemented (`ReminderChannel` is EMAIL-only) — deferred intentionally, not an oversight.
