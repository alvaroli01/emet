---
tags: [emet, tech]
updated: 2026-10-21
---

# Repo map — [alvaroli01/emet](https://github.com/alvaroli01/emet)

```
README.md            ← source of truth (goals, team, systems, decisions, open questions)
CLAUDE.md            ← rules for every Claude
CHANGELOG.md         ← newest first, one line per change
skills-lock.json     ← versions of the shared skills
.claude/skills/      ← shared Claude Code skills
docs/
  dashboard-build-prompt.md
  marketing-build-prompt.md
  lead-finder-build-prompt.md
  workspace-roadmap.md
  team-profiles.md   ← preliminary, disputed
  reports/ · research_notes/
dashboard/           ← the Next.js app (emet HQ)
  README.md (setup guide) · PRODUCT.md (design brief)
  FINANCE_SHEET_SETUP.md · TRELLO_SETUP.md
  messages/          ← 7 languages
  src/app/(app)/     ← today, board, my-tasks, camp, g/[slug], lab, scout, meetings, team
  src/app/api/       ← ask, assist, transcribe, scout, lab, books, drive, archive, calendar, health…
  supabase/migrations/ 0001 → 0024
  supabase/demo/     ← [DEMO] scripts + remove-all-demo-data.sql
  supabase/tests/    ← permission tests
```

## Migrations
0001 schema · 0002 security · 0003 activity/realtime · 0004 timestamps · 0005 locale · 0006 trello · 0007 subtasks · 0008 basecamp · 0009 AI keys · 0010 recordings · 0011 audio retention · 0012 meetings · 0013 drive archive · 0014 idea lab · 0015 workspace · 0016 finance · 0017 marketing · 0018 scout · 0019–0021 colours · 0022 reminders · 0023 team activity · 0024 team tasks

Back to [[🏔️ emet Dashboard]]
