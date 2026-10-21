---
tags: [emet, tech]
updated: 2026-10-21
---

# Tech stack (all €0)

| Piece | Choice |
|---|---|
| App | Next.js (React), Geist font, Magic UI / shadcn components, three.js for 3D |
| Database + login + storage | Supabase free, project `emet`, Frankfurt — Row Level Security, 24 migrations |
| Hosting | Vercel Hobby (server in Frankfurt), daily Cron |
| AI | Each member's own free **Groq** key (Whisper large-v3, gpt-oss with web search) |
| Maps / leads | OpenStreetMap + web search |
| Backups | GitHub Actions → private repo, AES-256 |
| Archive | Google Drive (15 GB free, `drive.file` access) — pending |
| Optional | Trello sync (off) |
| Checks | `npm test`, `npm run check:i18n`, `npm run build`, SQL permission tests |

Back to [[🏔️ emet Dashboard]]
