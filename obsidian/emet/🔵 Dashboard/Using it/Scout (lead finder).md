---
tags: [emet, system]
updated: 2026-10-21
---

# Scout (lead finder)

Status: ✅ Live · part of [[emet HQ (dashboard)]]

Find and judge first clients for a project. Migration 0018 (167 permission tests). Spec: `docs/lead-finder-build-prompt.md`.
- Describe the project → pick country + city + radius
- Sources: **OpenStreetMap + web search + the business's own website** (robots.txt respected) — no Google scraping, €0
- Score /100 from 7 criteria: strong / good / maybe / not worth it, offer, channel, opening lines, who/when, objections
- Never researches the same place twice; **Check a place** from a Maps link, website or Instagram
- Leads get owner, status, next-step date (shows on [[Today]]); **contacted → Customer prospect**; CSV export
- Live 3D globe + plain-language step log
- Runs searches: Customer, Marketing, admins. Outreach avoids cold email (Spanish LSSI)

## v2 (21 Oct 2026)
- Only real places: web finds must appear in real search results; a fast filter drops the wrong kind of place
- Exact Google Maps links; official website / Instagram / phone filled only from real results
- Evidence level per lead (little evidence → at most "Maybe"); unknowns count against a lead
- Save a lead to a project → [[My Projects]] Leads tab
- Shared AI keys + Mistral backup → [[My connections & AI keys]]; the log shows tokens used and why a web search found nothing
- Optional second map source: Open Places API free key (`OPEN_PLACES_API_KEY`)
- **Open to everyone** (27 Oct, migration 0041): anyone creates and runs a Scout project for their own idea with their own Groq key; Customer, Marketing and admins work on all projects and use lent keys
- **27 Oct (0042):** projects private until shared (older ones shared); "Places to judge" 1–60 — the search widens the radius (to 30 km) until that many are judged; select several leads → Add to project
- **Harvey's playbook** (28 Oct, 0046): each lead's ONE reason to contact today (hook) on the card; opener built around it; Scout reads one hiring/news page; "Reasons to contact" editable before a search

Back to [[Systems map]]
