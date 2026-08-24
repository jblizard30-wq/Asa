# Asa · Church & Organizational Workflow Engine

A modern, high-performance workflow management platform purpose-built for church and non-profit operations — featuring projects, kanban boards, interactive timeline/Gantt schedules, Asana-style notification triage, liturgical service templates, and volunteer rotation with 1-click tokenized RSVPs.

Deployed per-organization: each deployment connects to one Vercel project and one Neon PostgreSQL database, differentiated entirely by environment variables (see below) — no customer-specific code forks.

---

## ⚡ Tech Stack

- **Framework**: **Next.js 14** (App Router, Server Actions, React Server Components)
- **Language**: **TypeScript** (Strict mode, zero `any`)
- **Styling**: **Tailwind CSS** with dynamic brand scale derivation (`src/lib/site.ts`)
- **Database**: **PostgreSQL** via **Prisma ORM** + Neon serverless adapter
- **Authentication**: **NextAuth.js** (Credentials + stateless HMAC-signed HQ Support Login)
- **Live Sync**: **Server-Sent Events (SSE)** via `/api/sse`
- **Testing**: **Vitest** (88 tests across 14 test suites)

---

## ⛪ Church & Productivity Superpowers

1. **Liturgical Seasonality Engine**: Automated Meeus astronomical Easter calculation and Advent Sunday search classifying liturgical seasons (*Advent*, *Christmas*, *Epiphany*, *Lent*, *Easter*, *Pentecost*, *Ordinary Time*).
2. **Sunday Service Run-Sheet Generator**: 1-click generation of Sunday service sections with dynamic liturgical item filtering and run-sheet idempotency (`src/lib/actions/serviceTemplates.ts`).
3. **Volunteer Fairness Rotation & 1-Click RSVPs**: Least-recently-served rotation ranking respecting weekly schedules and blackout dates (`src/lib/volunteerRotation.ts`), paired with tokenized guest links featuring 1-click **✓ Accept & Confirm** and **Decline** actions.
4. **America/Chicago Timezone Normalization**: Strict calendar-day comparison math (`src/lib/dateUtils.ts`) preventing premature 7:00 PM overdue calculations across dashboards, cards, and crons.
5. **Rich Text / Markdown Descriptions**: Live formatting toolbar for bold, italic, headings, blockquotes, checklists (`- [ ]`), and inline code with write/preview toggle.
6. **Multi-Homing (`TaskProject`)**: Tasks can belong to and be managed across multiple projects simultaneously.
7. **Asana-Style Inbox (`/inbox`)**: Dedicated triage hub with unread filters, mention tracking, and 1-click batch read.
8. **Timeline / Gantt View**: Visual project schedule with task duration bars (`startDate` to `dueDate`) and dependency blockers.
9. **Pattern-Based Automations**: Project-wide condition recipes ("When ANY task is marked Done ➔ move to section X") in `src/lib/automations.ts`.
10. **Real-Time Live Updates**: SSE stream (`/api/sse`) pushing live task moves and comment updates across all open browser tabs.
11. **Admin Onboarding & Reset Tools**: Admin modal to dispatch first-time setup invitation links (`/set-password?token=...`) and manual password resets.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
```

| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string (Neon, Supabase, or local Postgres) |
| `NEXTAUTH_SECRET` | Secret for session tokens (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | App base URL (`http://localhost:3000` locally) |
| `ORG_NAME` | Organization name, e.g. `"Chesterfield Presbyterian Church"` |
| `BRAND_COLOR` | Primary brand hex code, e.g. `"#003366"` (auto-derives 50-950 Tailwind palette) |
| `LOGO_URL` | URL to organization logo |
| `HQ_SUPPORT_SECRET` | Shared secret with `asa-hq` for 1-click admin support logins |
| `CRON_SECRET` | Secret for securing `/api/cron/*` endpoints |
| `SMTP_*` | Optional SMTP configuration for outbound email delivery |

### 3. Run Database Migrations
```bash
npx prisma migrate dev --name init
```

### 4. Run Test Suite
```bash
npm test
```

### 5. Start Development Server
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

---

## 🏛️ Architecture: Asa-HQ vs. Deployments

```
┌─────────────────────────────────────────────────────────────┐
│                       ASA-HQ                                │
│       Central Control Plane & Deployment Registry           │
│   (Manages all church instances, Neon DBs & Support Auth)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                HMAC Support Tokens & Health Probing
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     CPCana (Asa App)                        │
│            Church Workflow & Task Application               │
│   (Tasks, Inbox, Timeline, Liturgy Run-Sheets, RSVPs)      │
│               Deployment #1: Chesterfield                   │
└─────────────────────────────────────────────────────────────┘
```

- **`asa-hq`** is the master control plane managing customer databases, health probing, audit logging, and minting 1-click admin support tokens.
- **`CPCana`** is Deployment #1 of this codebase, branded for Chesterfield Presbyterian Church.
