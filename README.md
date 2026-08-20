# Asa

A lightweight, Asana-style task manager for church/organization staff — projects, kanban boards, assignments, comments, and notifications. Deployed per-customer: one Vercel project + one Neon database each, running this same codebase, differentiated entirely by environment variables (see below) — no fork per customer.

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
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://postgres:postgres@localhost:5432/asa?schema=public` |
| `NEXTAUTH_SECRET` | Random secret used to sign session tokens. Generate one with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Base URL of the app. Use `http://localhost:3000` locally |
| `ORG_NAME`, `BRAND_COLOR`, `LOGO_URL` | Optional per-deployment branding (see `src/lib/site.ts`). Blank renders a neutral, org-agnostic default — every real deployment sets these explicitly |
| `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Optional — enables outbound email notifications. Leave blank to skip; in-app notifications still work without them |
| `HQ_SUPPORT_SECRET` | Shared secret this deployment and the vendor's HQ app both hold, for HQ's one-click "log in as admin" links. Generate a **unique** value per deployment with `openssl rand -base64 32` |

### New customer checklist

Every new deployment needs its own Neon database + Vercel project, with:
`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ORG_NAME`, `BRAND_COLOR`,
`LOGO_URL` (optional), `EMAIL_FROM`/`SMTP_*`, `CRON_SECRET`,
`BLOB_READ_WRITE_TOKEN`, and a freshly generated `HQ_SUPPORT_SECRET`.

`npm run seed` is safe to run against a new customer's database — it's
generic/demo data. **`npm run seed:bulletin` is Chesterfield Presbyterian
Church's own onboarding script and must never be run against another
customer's database** — see the comment at the top of
`prisma/seed-bulletin.ts`.

If you don't have Postgres running locally, the quickest option is Docker:

```bash
docker run --name asa-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=asa -p 5432:5432 -d postgres:16
```

Then use:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/asa?schema=public"
```

### 3. Run database migrations

```bash
npx prisma migrate dev --name init
```

This creates all tables (`User`, `Project`, `ProjectMember`, `Section`, `Task`, `Comment`, `Notification`) and generates the Prisma client.

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
- **My Tasks** — every task assigned to the logged-in user, across all projects, sorted by due date then priority
- **Project view** — toggle between a **List** view (grouped by section) and a **Kanban** board with drag-and-drop between sections; dropping a card into "In Progress" or "Done" updates its status automatically
- **Task detail panel** — inline-editable title/description, assignee, due date, priority, status, and a comment thread
- **Admin controls** — admins create projects and invite existing users by email; any project member can create and (re)assign tasks within a project they belong to
- **Notifications** — an in-app bell with unread counts fires when a task is assigned to you, someone comments on your task, or you're added to a project. If SMTP is configured, the same events also send an email

## Project structure

```
prisma/
  schema.prisma       Data model
  seed.ts             Sample church data
src/
  app/
    (auth)/           Sign in / sign up pages
    (app)/            Authenticated app shell (Navbar, My Tasks, Projects)
    api/auth/         NextAuth route handler
  components/         Client components (Kanban board, task modal, etc.)
  lib/
    actions/          Server actions (projects, tasks, comments, notifications, auth)
    auth.ts           NextAuth configuration
    prisma.ts         Prisma client singleton
    notifications.ts  In-app + email notification helper
```

## Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run prisma:migrate` | Run/create Prisma migrations |
| `npm run prisma:studio` | Open Prisma Studio to browse the database |
| `npm run seed` | Re-seed sample church data (safe to re-run — upserts users) |

## Deploying to Vercel

1. Push this repo to GitHub and import it into Vercel.
2. Provision a Postgres database (Vercel Postgres, Neon, Supabase, or Railway all work) and copy its connection string into `DATABASE_URL` in your Vercel project's environment variables.
3. Set `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`) and `NEXTAUTH_URL` (your production URL) as environment variables.
4. Add a `postinstall` step is already wired to run `prisma generate`; after the first deploy, run `npx prisma migrate deploy` against the production database (e.g. via `vercel env pull` + local `npx prisma migrate deploy`, or a one-off Vercel deploy hook).
5. Optionally set the SMTP variables to enable email notifications in production.

## Adding Google login later

NextAuth makes this additive: install nothing new, just add a `GoogleProvider` entry to the `providers` array in `src/lib/auth.ts` alongside the existing `CredentialsProvider`, and set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` environment variables. Existing accounts and sessions are unaffected.
