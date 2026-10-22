---
tags: [emet, system]
updated: 2026-10-22
---

# Notion

Status: ✅ Step 1 built (live once the "emet HQ" Notion app keys are in Vercel) · part of [[emet HQ (dashboard)]]

Each member connects **their own** Notion (uni or personal, several workspaces) in [[My connections & AI keys]], using Notion's own page picker. Private to that person; emet stores no Notion content.

| What | Where |
|---|---|
| Read & search pages, databases as tables | Base camp → **Notion** tab |
| Notion deadlines (purple) | [[Today]] → Your week, [[Base camp]] → My week, My Tasks → "From Notion" |
| Save to Notion | Meeting log, Base camp docs, [[Idea lab]], [[My Projects]] updates |
| Ask emet | Reads your Notion deadlines + matching page excerpts |

- Setup (once): a public Notion integration "emet HQ" → `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` in Vercel; redirect `https://emet-hq.vercel.app/api/notion/callback`; `/privacy` and `/terms` pages.
- Notion API version `2026-03-11` (databases → data sources). Tokens encrypted, renewed automatically; "Reconnect" if Notion refuses.
- Step 2 next: edit pages and databases inside emet, tick Notion tasks done, comments, file uploads.
- Code: `dashboard/src/lib/notion/`, `src/app/api/notion/`, `src/components/notion/`; migration 0033.

Back to [[Systems map]]
