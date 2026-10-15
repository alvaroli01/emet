# Class demo data

Example data used to present the dashboard (added 2026-10-15). Everything is tagged `[DEMO]` (links: slug `demo-*`).

- `1-demo-sales.sql`: about €1,000 of sales over the last 7 days and 2 small expenses. It was run once, plus a second
  batch of similar sales, for €2,014 in total.
- `2-demo-everything-else.sql`: tasks on every team board (assigned only to Alvaro), blockers, decisions, prospects,
  customer problems, stock, posts with metrics, DMs, link clicks and morale check-ins. Notifications are switched
  off while it runs, so nobody is pinged. (The demo team task it creates was deleted afterwards.)
- `remove-all-demo-data.sql`: deletes **all** of it again, including the activity entries it created.

These are **not** migrations. Run them by hand only (`psql "<db url>" -f <file>`), and only on purpose.
