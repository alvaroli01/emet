# Scout v2 — Phase 1: accuracy, speed, exact links, save to a project

Date: 2026-10-21 · Owner: Alvaro · Status: approved in chat

## Problems (Alvaro)
Wrong kind of places, misses good places, missing/wrong info, scores that don't make sense, slow, and "Open in Maps"
only searches Google Maps instead of opening the place. Must stay €0, no cards.

## Decisions
- Sources: OpenStreetMap + web search (as now) + **Open Places API** (Overture Maps data, free 10,000 searches/month,
  stops at the cap, never bills) — only when `OPEN_PLACES_API_KEY` is set; Scout works fully without it.
- Phases 2–4 (pipeline board, ready-to-send messages, map + visit route) come after this one, each with its own spec.
- "Save to a project" = our **My Projects**: each lead stays in Scout (the general list) and can also be saved to one project;
  that project gets a **Leads** tab.

## 1. Finding (step `finding`)
- OSM + web search as today, plus Open Places when the key exists: for each plan query (with `{city}` removed),
  `GET https://api.openplacesapi.com/v1/places?q=…&lat=…&lon=…&radius_mi=<km×0.621, ≤50>&limit=20&min_confidence=0.6`,
  `Authorization: Bearer <key>`; map `place_id, name, lat, lon, categories, address.formatted|street+locality, phone,
  website`; skip `operating_status` = closed/permanently_closed. Stored with `source = 'overture'`.
- Merge by fingerprint (as today); when the same place comes from several sources, keep the non-empty fields.
- If fewer than 10 candidates: the log suggests a bigger radius.

## 2. Relevance filter (new step `filtering`, one AI call)
Before any research, one fast call (gpt-oss-20b) gets up to 60 candidates `[n, name, category]` plus the project's niche
and ideal client, and returns which ones are the right *kind* of place (and the reason for each no). Off-target places
are saved as leads with `fit = 'skip'`, `score = 0`, `evidence = 'none'`, `why = "Not a match: …"` so they're never
checked again. Only matches go on to research (best first, `max_places`).

## 3. Research (step `researching`) — faster
- **Two places per step in parallel** (Vercel 60 s): web check on gpt-oss-20b, judging on gpt-oss-120b (separate free quotas).
- Evidence sent to the judge trimmed to 6,000 characters. 30-day research cache kept.
- **Enrichment**: the web check also returns `official_website`, `instagram`, `phone`, `google_maps_url`. A URL is kept
  only if it appears among the URLs the search actually returned; a phone only if it appears in the notes and looks like
  a phone. Kept values fill the place's empty fields (never overwrite).

## 4. Scores that make sense
- A criterion the evidence can't support counts **3** (was 5), and the judge is told to score unknowns 3.
- `evidence` level per lead: `strong` (website read AND ≥3 search sources), `some` (website read OR ≥2 sources),
  `little` (otherwise). With `little`: fit at most `maybe`, `worth_it = false`. Shown on the lead ("Evidence: little").

## 5. Exact links
- `maps_url` on the place (from a pasted Google Maps link or from enrichment) is used as is.
- Otherwise: `https://www.google.com/maps/search/?api=1&query=<name>, <address or city>` **plus** the coordinates
  when known: `https://www.google.com/maps/place/<name>/@<lat>,<lng>,19z` (opens the map on the exact spot, where Google
  shows the business card).

## 6. Save to a project
- `scout_leads.saved_project_id` (→ `projects`, on delete set null). In a lead: "Save to project: — / <project>"
  (projects the person is in; leaders: all).
- Project page → new **Leads** tab: saved leads with name, score, fit, status, evidence, contact buttons and Maps link.

## Data (migration 0031)
`scout_places.maps_url text`, `scout_places.source` allows `'overture'`, `scout_leads.evidence text`,
`scout_leads.saved_project_id uuid`, `scout_searches.status` allows `'filtering'`.

## Testing
`core.test.ts`: evidence level + cap, unknown = 3, mapsLink, relevance-reply parsing, enrichment validation
(URL must be in results, phone pattern), Open Places mapping (closed skipped, address formatting). Browser: one real
search in Bilbao for an existing Scout project, before/after timing and results.
