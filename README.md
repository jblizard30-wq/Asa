# Church Tasks

An Asana-style task manager for church staff — projects, kanban/list/calendar/grid views, recurring tasks, automations, custom fields, intake forms, dashboards, and email digests/reminders.

## Tech stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **PostgreSQL** via **Prisma ORM**
- **NextAuth.js** (email/password credentials to start; add OAuth providers later)
- Drag-and-drop kanban via `@hello-pangea/dnd`
- Deployable to **Vercel** (with any managed Postgres — Vercel Postgres, Supabase, Neon, Railway, etc.)

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in the values:

```bash
cp .env.example .env
```

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://postgres:postgres@localhost:5432/church_tasks?schema=public` |
| `NEXTAUTH_SECRET` | Random secret used to sign session tokens. Generate one with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Base URL of the app. Use `http://localhost:3000` locally |
| `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Optional — enables outbound email notifications. Leave blank to skip; in-app notifications still work without them |
| `CRON_SECRET` | Required for the 5 scheduled jobs under `src/app/api/cron/*` (see `vercel.json`) — Vercel Cron sends it as a bearer token so those routes can tell a scheduled invocation from a public request. Generate with `openssl rand -base64 32` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob store token for task file attachments |
| `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `OUTLOOK_CALENDAR_CLIENT_ID`, `OUTLOOK_CALENDAR_CLIENT_SECRET` | Optional — enables the calendar connect buttons under Settings > Integrations |
| `CALENDAR_TOKEN_ENCRYPTION_KEY` | Required if either calendar integration above is configured — encrypts stored OAuth tokens at rest. Generate with `openssl rand -base64 32` |

If you don't have Postgres running locally, the quickest option is Docker:

```bash
docker run --name church-tasks-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=church_tasks -p 5432:5432 -d postgres:16
```

Then use:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/church_tasks?schema=public"
```

### 3. Run database migrations

```bash
npx prisma migrate dev
```

This applies every migration under `prisma/migrations/` and generates the Prisma client.

### 4. Seed sample data

```bash
npm run seed
```

This creates 5 sample users and 3 projects — **Sunday Service Planning**, **Facilities & Maintenance**, and **Youth Ministry Events** — each with a To Do / In Progress / Done set of sections and a handful of realistic tasks.

All seeded users share the password `password123`. Sign in as the admin to explore project creation and invites:

- **pastor.dan@example.org** (admin)
- **renee.ortiz@example.org** (staff)
- **miguel.alvarez@example.org** (staff)
- **casey.nguyen@example.org** (staff)
- **sarah.kim@example.org** (volunteer)

### 5. Start the dev server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000). You'll be redirected to sign in, or you can create a brand-new account from there (the very first person to sign up on a fresh database becomes an admin automatically).

## Core features

- **Sign up / sign in** with email + password (NextAuth credentials provider, hashed with bcrypt)
- **My Tasks** — everything assigned to you plus your personal tasks, across all projects, in list, kanban, calendar, or grid view
- **Project view** — **List**, **Kanban** (drag-and-drop between sections, with status auto-updating), **Grid** (spreadsheet-style multi-cell paste/fill-down), and per-project **Calendar**
- **Task detail panel** — inline-editable title/description, assignees, due date, priority, status, tags, custom fields, subtasks, dependencies, attachments, and a comment thread
- **Recurring tasks** — an RRULE-based recipe (`TaskRecurrence`) plus a nightly job that materializes the next occurrence; never a pre-generated batch of future rows
- **Automations** — rules that react to a task's status/assignee change or an approaching due date (set status/assignee, move section, create a follow-up task)
- **Custom fields, tags, and saved filters** per project
- **Intake forms** — a public, unauthenticated `/forms/[slug]` page that creates a task from a submission (e.g. a facilities request form)
- **Workflows** — reusable stage/task templates that can be applied to a project
- **Teams and an org chart** — who reports to whom, with team-level and project-level membership
- **Dashboards** — overdue/due-soon rollups; admins see every project, managers see the projects they're flagged as managing
- **Guest access** — a shareable, token-based link that lets someone comment on a single task without an account
- **Trash** — soft-deleted tasks/projects are recoverable until a nightly job purges them past their retention window
- **Digest emails and reminders** — daily/weekly digest of what's due, plus one-off and scheduled reminders
- **Calendar sync, API keys, and webhooks** — Google/Outlook connect buttons under Settings > Integrations, a public `/api/v1/tasks` endpoint, and outbound webhooks (HMAC-signed) for `TASK_*`/`COMMENT_ADDED` events
- **Notifications** — an in-app bell with unread counts, mirrored to email when SMTP is configured
- **Admin controls** — admins manage users/teams and everything above; project members are scoped to their own projects

## Project structure

```
prisma/
  schema.prisma       Data model (~50 models)
  migrations/         Tracked schema history — applied via `prisma migrate deploy` on every build
  seed.ts             Sample church data
  seed-bulletin.ts     Bulletin-focused seed variant
src/
  app/
    (auth)/           Sign in / sign up pages
    (app)/            Authenticated app shell (Navbar, Sidebar, My Tasks, Projects, Settings, Admin)
    api/auth/         NextAuth route handler
    api/cron/         Scheduled jobs (automations, digest, recurrence, reminders, trash purge) — see vercel.json
    api/integrations/ Google/Outlook Calendar OAuth connect + callback routes
    api/v1/           Public API (Bearer API key auth)
    forms/[slug]/      Public intake form pages
    guest/[token]/     Public guest task view/comment pages
  components/         Client components (views, modals, panels)
  lib/
    actions/          Server actions — one file per feature area (tasks, projects, automations, etc.)
    auth.ts           NextAuth configuration
    permissions.ts     Session/role/team-membership guards shared across actions
    prisma.ts         Prisma client singleton (Neon serverless adapter)
    materializeRecurrence.ts, recurrence.ts   RRULE-backed recurring task logic
    notifications.ts, email.ts   In-app + email notification helpers
    webhooks/dispatch.ts   Outbound webhook delivery (HMAC-signed)
```

## Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Applies pending migrations (`prisma migrate deploy`), then a production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm test` | Run the vitest suite |
| `npm run prisma:migrate` | Create and apply a new migration in dev (`prisma migrate dev`) |
| `npm run prisma:studio` | Open Prisma Studio to browse the database |
| `npm run seed` | Re-seed sample church data (safe to re-run — upserts users) |
| `npm run seed:bulletin` | Seed a bulletin-focused sample dataset |
| `npm run backfill:org-chart` | One-off backfill script for org chart manager relationships |

## Deploying to Vercel

1. Push this repo to GitHub and import it into Vercel.
2. Provision a Postgres database (Neon is what this project is built against, via `@prisma/adapter-neon`; Vercel Postgres/Supabase/Railway also work) and copy its connection string into `DATABASE_URL` in your Vercel project's environment variables.
3. Set `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`) and `NEXTAUTH_URL` (your production URL).
4. Set `CRON_SECRET` (generate the same way) and make sure it matches what `vercel.json`'s 5 scheduled jobs send as a bearer token — without it, every `/api/cron/*` route returns 401 and nothing scheduled will run.
5. The build command (`npm run build`) already runs `prisma migrate deploy` before `next build`, so pending migrations apply automatically on every deploy — no manual migration step needed.
6. Optionally set the SMTP variables (email), `BLOB_READ_WRITE_TOKEN` (attachments), and the calendar integration variables (see the environment variable table above) to enable those features in production.

## Adding Google login later

NextAuth makes this additive: install nothing new, just add a `GoogleProvider` entry to the `providers` array in `src/lib/auth.ts` alongside the existing `CredentialsProvider`, and set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` environment variables. Existing accounts and sessions are unaffected.
