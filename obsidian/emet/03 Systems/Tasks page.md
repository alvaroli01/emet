# Tasks page

Built 2026-11-09 · **local preview only until Alvaro says go** · code `dashboard/src/components/tasks/`, `dashboard/src/lib/tasks.ts`, migration `0052_unified_tasks.sql`

One page (`/tasks`) for every task. It replaces the General board, the team boards' "Task board" tool, the leader's "Assign tasks" tool, a project's Tasks tab and My Tasks (old links redirect).

- **What you see:** only tasks given to you or that you created (leaders too). A goal's progress bar still counts all the project's tasks. Each row has a tick box for your part.
- **Tabs:** All tasks · My Tasks (mine + my private My board + my Notion deadlines) · EMET tasks (general + team boards) · Project tasks (only projects you're in, admins too; pick a project; Goal card on top: goal, target date, progress = done / all tasks, milestones)
- **Filters:** person, project, status, priority, due (overdue / this week / no date)
- **A task:** title, description, due date, assignees, status (To do / In progress / Blocked / Done = its column), priority, per-person completion (Done by itself when everyone ticked), "needs a file", checklist, created by + date, red when late
- **Who can do what:** leaders/admins anywhere; members add to their own projects and EMET and assign only people of that project (EMET: themselves + their group); assignees change status/checklist and tick their part
- **Data:** built on the existing `cards` tables, so home, Today, Overview, Ask emet, search, calendar feed, reminders and the section assistant keep working. The 14 leader tasks (`team_tasks`) were copied into cards with everyone's ticks and files; `team_tasks` itself is untouched.

Related: [[emet Dashboard]]
