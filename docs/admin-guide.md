# Admin Guide

This guide covers everything an **Admin** can do in the church task manager that a regular member or manager cannot, plus the org-wide features admins are typically responsible for setting up (users, teams, projects, workflows).

## Roles at a glance

| Role | Summary |
|---|---|
| **Admin** | Full access: every project/task in the org, user management, teams, org chart, all-trash, workflow templates. The first person to ever sign up is automatically made Admin. |
| **Manager** | Everything a member can do, plus a Dashboard scoped to the teams they lead, and team-membership management for those teams. |
| **User** (member) | Access to projects they're a member of, their own tasks, and their own trash. |

Only Admin/Manager see **Dashboard** and **Teams** in the sidebar. Only Admin sees **User Management**, **All Trash**, and **Workflows**.

---

## 1. First-time setup

1. Sign up at `/sign-up`. The very first account created on the org becomes Admin automatically — there is no separate "make me admin" step.
2. Go to **User Management** (`/admin/users`) and create an account for each staff member. You can set their role (Admin / Manager / User) and reset a password here at any time.
3. Go to **Org Chart** (`/org-chart`) and **Teams** (`/teams`) to build out the reporting structure (see §2 below).
4. Create your first project from **All Projects** (`/projects`) and invite members.

---

## 2. User Management, Teams, and Org Chart

### User Management (`/admin/users` — Admin only)
Create, edit, and delete user accounts; change any user's role; reset a password. This is the only place accounts are created — there's no self-serve sign-up link to hand out unless you want more admins bootstrapped the same way.

### Teams (`/teams` — Admin/Manager)
- Admins see every team in the org and can create new ones ("+ New team": name + a manager picked from a dropdown).
- Admins can change a team's manager at any time, delete a team, and add/remove/move members between teams.
- Managers only see teams where they're the assigned manager, and can add/remove/move members within those teams, but can't create/delete teams or reassign the manager.

### Org Chart (`/org-chart` — everyone can view)
Renders a collapsible reporting tree based on each person's manager. Only Admins see the **Change manager** control on each person's card (the dropdown excludes that person's own reports, so you can't accidentally create a management cycle). Anyone without a manager and without reports shows up in a "Not yet placed" section below the chart — check this after adding new users.

---

## 3. Projects

Create a project from **All Projects** (`/projects`). Each project has its own header bar with links to the features below — these live on the project page itself, not in the main sidebar.

### Project members
Admins can invite any existing staff account to a project by email ("Invite a member") and toggle whether a member is a project manager. Guests (people without accounts) are handled differently — see §7.

### Views
Every project has four tabs:
- **List** — the classic task list. This is also the only view that shows Custom Fields as columns.
- **Kanban** — status-column board.
- **Grid** — spreadsheet-style bulk editing (see §4).
- **Dashboard** — project-scoped stats (separate from the org-wide Dashboard in §6).

### Custom Fields
"Manage fields" on the project header. Field types: Text, Number, Date, Dropdown (comma-separated options, extendable later), Checkbox. Deleting a field warns that its values will be lost. Any project member can manage fields — this isn't admin-gated, but as the admin you'll typically be the one setting up a project's field schema before handing it to a team.

### Tags
"Manage tags" on the project header. Create a tag with a name and a color from a fixed palette; rename and recolor inline; deleting a tag removes it from every task that had it. Tags are then assignable from a task's detail panel or from the Grid view's Tags column.

### Automations (`/projects/[id]/automations`)
Per-project "if this, then that" rules, listed as plain-English sentences (e.g. *"When 'Set up chairs' status becomes Done → set status: Ready on 'Clean up'"*). Each rule has an Enabled checkbox, Delete, and an expandable run history.

"+ New rule" lets you configure:
- **When…** — pick a source task, and a trigger: Status changed / Assignee changed / Due date approaching (with a "days before" input).
- **Then…** — pick an action: Set status, Set assignee (a specific person, or "same as source"), Move to section, or Create a new task (with its own title/description/priority/assignee).

Due-date-approaching rules are checked once a day by a background job — expect up to a day of lag, not real-time firing.

### Intake Forms (`/projects/[id]/forms`)
Public, no-login forms that create a task in a fixed project/section when submitted — useful for "request a room setup" or "submit a bulletin item" type requests.

"+ New form": name, URL slug, description, which section new tasks land in, a default assignee, and an Active/Inactive toggle. Each form lets you add fields (label, type — Text/Paragraph/Email/Date/Dropdown — required checkbox, and options for Dropdown fields). "Copy public link" gives you the `/forms/[slug]` URL to share externally. Deleting a form keeps past submissions and the tasks they created.

### Workflow (`/projects/[id]/workflow`)
Lets a project apply one of the org's reusable **Workflow templates** (see §5) — this instantiates the template's stages/tasks into the project's sections in one click. The same page shows a read-only branch map of the project's current section → task → subtask tree with status/priority/assignee badges, and includes an AI-assisted "settings writeup" box that can generate a plain-English description of how the project is set up.

---

## 4. Grid View (bulk editing)

Grid view is a spreadsheet for a project's tasks — Title, Tags, Assignee, Priority, Status, Due Date, and a read-only Recurrence summary column.

- **Select**: click a cell, or drag/Shift-click to select a range.
- **Arrow keys** move focus; **Shift+Arrow** extends the selection; **Tab / Shift+Tab** move across.
- **Enter** edits the focused cell; typing directly over a focused Title cell replaces its text.
- **Copy** (⌘/Ctrl+C) and **Paste** (⌘/Ctrl+V) work like a spreadsheet — paste a block of tab/newline-separated values across the same shape of cells. Pasting past the last row creates new tasks automatically.
- **Fill-down** (⌘/Ctrl+D) copies the top row of your selection down through the rest of it.
- **Undo** (⌘/Ctrl+Z) reverts the last bulk edit.
- The Recurrence column can't be set by paste or fill-down — use a task's own Repeat dropdown (§8) for that.

Any project member can use Grid view, not just admins — but it's the fastest way for an admin to clean up or reassign a large batch of tasks in one pass.

---

## 5. Workflows (`/admin/workflows` — Admin only)

This is different from a project's "Workflow" tab (§3) — this is where you build the **reusable templates** that projects pull from.

"+ New workflow" — start blank, or duplicate an existing workflow as a starting point. Each workflow card shows its team, stage count, and task count; click to expand the builder and add **Stages → Tasks → Subtasks** (title, description, default priority — one level of subtasks only). Flag a workflow `isTemplate` to make it selectable when a project applies a workflow.

Typical use: build a "New Member Onboarding" or "Event Planning" workflow once, then every project of that type applies it instead of re-creating the same task structure by hand.

---

## 6. Dashboard (`/dashboard` — Admin/Manager)

Org-wide (Admin) or team-scoped (Manager) overview. If a Manager doesn't yet manage any team, they see an empty state pointing at Teams.

- **Top stat tiles**: Total Users (Admin) / Team Members (Manager), Open Tasks, Overdue, Due Next 7 Days, Completed (last 14 days).
- **Admin-only extra row**: Teams count, Projects count, Unassigned Tasks count.
- **Charts/tables**: Tasks by Status, Tasks by Priority, a "Workload by Team Member" table (open/overdue/due-soon/completed/completion-rate per person), a Teams table, a Projects table (click through to any project), plus Overdue / Due-in-7-days / Recently-completed lists.

Admins see the entire org here; Managers only see what's under the teams/projects they lead.

---

## 7. Guest Access

There's no email invite for guests — it's a **copy-a-link** flow, scoped to a single task:

1. Open any task's detail panel and click **"🔗 Share with guest"**.
2. Click **"+ New guest link"** to generate a link. Copy it and send it however you like (email, text).
3. The guest opens the link (`/guest/[token]`) with no login and sees the task's title, description, status, priority, due date, and comment thread. If commenting is enabled for that link, they can post a comment (kept separate from staff comments).
4. Revoke a link any time from the same panel, or set an expiration date when creating it. Revoked/expired links stop working immediately.

This is different from **"Invite a member"** on a project, which adds an existing staff account to the project — use guest links for outside parties who shouldn't have an account.

---

## 8. Recurring Tasks

There's no separate recurrence page — open any task's detail panel and check **"This task repeats"** to reveal the Repeat editor:

- **Frequency**: Day / Week / Month / Year, with an interval (e.g. every 2 weeks).
- **Repeat style**:
  - *"Repeat on schedule, whether or not the last one got done"* — good for things like "set up chairs" that happen on a calendar regardless of history.
  - *"Only create the next one after this one is done"* — good for things like "replace HVAC filter," where you don't want the next occurrence to appear until the current one is actually finished.
- **Ends on** (optional): stop generating new occurrences after a date.

Scheduled occurrences appear automatically overnight; "after completion" occurrences appear the moment you mark the current one Done. Grid view shows a read-only summary of a task's recurrence in its Recurrence column.

---

## 9. Trash

- **My Trash** (`/trash`, everyone): tasks you personally deleted. Restore or permanently delete.
- **All Trash** (`/admin/trash`, Admin only): every deleted task from every project and every user. Restoring something someone else deleted asks for an extra confirmation, since it isn't yours.

Deleted tasks are automatically and permanently purged after a fixed retention window — both trash pages show the computed purge date for each item, so if something needs to be recovered, do it before that date. Permanently deleting a task also removes its comments, subtasks, custom field values, and reminders — there's no undo past that point.

---

## 10. Calendar & Integrations

- **Calendar** (`/calendar`, everyone): month/week view of tasks by due date, filterable by status/priority/assignee/team/tag. Admins see tasks across every project; others see only their own projects.
- **Calendar connections** (`/settings/integrations`, per-user): Connect/Disconnect cards for Google Calendar and Outlook. **Note:** connecting only stores the account link today — there is no live sync or import/export yet, and the panel says so explicitly. There's also no ICS export/import anywhere in the app currently.
- **Public API** (`/api/v1/...`): authenticated with a personal API key from `/settings/developer`. An Admin's key can read every task in the org; anyone else's key is limited to their own projects.
- **Webhooks** (`/settings/developer`): register a URL and pick which events to receive (task created/updated/completed/deleted, comment added). Deliveries are signed (`X-Webhook-Signature`) so your endpoint can verify they came from this app.

---

## 11. Search

Press **⌘/Ctrl+K** anywhere in the app to open global search (2+ characters). Results are grouped into Tasks, Projects, Comments, and app Pages — and the Pages results respect your role, so an Admin can search-navigate straight to "User Management," but a regular member won't see admin-only pages in their results.

---

## 12. Settings (per-user, at `/settings`)

There's no separate "org settings" area — each person, including admins, configures their own preferences:

- **Notifications**: per-notification-type email toggles, plus overall digest frequency (Off/Daily/Weekly) and your preferred hour to receive it.
- **Integrations**: the Google/Outlook calendar connect cards described in §10.
- **Developer**: manage your personal API keys (shown once at creation — copy it immediately) and webhooks.
- **Navigation**: drag to reorder, and check/uncheck to show or hide items in your own sidebar. This only changes what's visible to *you* — it doesn't change what any other user, or any role, is allowed to see.

---

## Known limitations (worth knowing before you get asked about them)

- **Digest emails** are driven by unread in-app notifications, not a live scan of what's due/overdue today. A task with no recent notification activity won't show up in someone's digest even if it's due today.
- **Push and SMS reminders** aren't implemented — reminder emails only, by design for now.
- **Calendar sync is inert** — connecting Google/Outlook Calendar stores the connection but doesn't actually import or export events yet.
- **No ICS export/import** exists anywhere in the app today.
- **Automation and recurrence timing has some lag**: due-date-approaching automations and PERIODIC recurrences are evaluated by background jobs on a schedule, not instantly — expect them to appear within a day, not the second a condition is met.
