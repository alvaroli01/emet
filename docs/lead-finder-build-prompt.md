# Build prompt: Lead finder ("Scout") + Idea lab council

> Written 2026-10-14 for Claude Code to build inside emet HQ (`dashboard/`). Read the repo `CLAUDE.md` and `README.md` first, and follow every rule there (git pull first, €0 budget, README + CHANGELOG on every change, 7 languages, phone-first, the database decides permissions).
> **North star:** the team works inside the dashboard every day, so every feature has to save time. It should look professional, not "vibe coded".

---

## 0. Why we need it

Once the team picks a business idea in the Idea lab, the next question is **who do we sell to first?** Scout answers that. You describe the project, the niche and the kind of client, and choose a city and country. Scout then:

1. finds matching places on the map and on the web,
2. researches each one,
3. scores how good a client it is **for this specific project**, and
4. says what to offer them, how to approach them, and whether they're worth the time.

It remembers every place it has already looked at, so it never shows or researches the same place twice. Anyone can also paste a Google Maps link or a website they found themselves and get the same verdict.

Scout must work for **any business type**: B2B services, physical products sold to shops, events, cafés, gyms, schools, clinics, landlords, and so on. The niche and the client description come from the user each time. Nothing is hard-coded to one industry.

---

## 1. Hard constraints (read before designing)

- **€0.** No paid scraping APIs (SerpAPI, Apify, Outscraper, PhantomBuster and the like), no paid proxies, no paid LLMs.
- **Google Maps data, the legal way.** Scraping Google Maps or Google Search HTML breaks Google's Terms, gets blocked quickly from Vercel IPs and breaks without warning. Don't do it. Use these instead, in this order:
  1. **OpenStreetMap**: Nominatim geocodes the city and gets its bounding box; the **Overpass API** returns businesses by tag (`shop=*`, `amenity=*`, `craft=*`, `office=*`, `leisure=*`, `tourism=*`) with name, address, website, phone, opening hours and coordinates. Free, legal, needs no key. Respect the usage policies: one request at a time, a clear User-Agent (`emet-hq/1.0 (contact email)`), and cached results.
  2. **Web search**: Groq `openai/gpt-oss-120b` with the `browser_search` tool, using the member's own encrypted Groq key (the same pattern as Idea lab, `src/lib/lab/ai.ts`). It finds businesses that OSM is missing (search "<niche> in <city>") and their websites and Instagram profiles.
  3. **Google Places API (New)**: **optional, off by default.** It has free monthly usage caps, but it needs a Google Cloud billing account with a card. **Stop and ask Alvaro before enabling it** (rule 6). If it's ever turned on, use field masks for Essentials-tier fields only and keep a hard monthly call counter that refuses to go past the free cap.
  4. **Pasted Google Maps links** are allowed (§5). Resolve the link to a name and coordinates by following the redirect and parsing `@lat,lng` and the place name from the URL, then look the place up in OSM and on the web. Don't fetch the Google Maps page itself.
- **Fetching websites:** only the business's own public site, using server-side `fetch` with a timeout of about 8 s and a 500 KB limit. Respect `robots.txt`. Read at most 3 pages per site (home, about/services, contact). Strip the HTML to text before passing it to the AI. Never log in anywhere and never get around a CAPTCHA.
- **GDPR / Spanish LSSI.** Store only **business** data: business name, public business email or phone, website, address. Don't store data about private individuals. Keep the source URL and the date for every fact. Add a "Forget this place" action that deletes the data but keeps a hash so the place is never collected again. Outreach advice has to respect the law: in Spain, unsolicited commercial email needs prior consent, **even to companies** (LSSI art. 21). So by default Scout suggests in-person visits, phone calls, Instagram DMs or a contact form, and it adds a warning whenever it suggests a cold email.
- **Groq free-tier limits:** treat 429/413 responses as "wait" (existing `groq.ts` handling), run the research jobs one after another, and save after every place so a job can resume.
- **Vercel Hobby:** functions have a short time limit, so a search runs as a **job**. One request does one step and saves its progress, and the client polls or listens on Realtime and calls the next step. The tab can close, and the job continues when someone reopens it. The 03:00 cron can finish jobs left half-done.

---

## 2. Data model (migration `0018_scout.sql`)

| Table | Purpose | Key columns |
|---|---|---|
| `scout_projects` | What we're selling and who to | `id, title, idea_id → lab idea (nullable), offer (what we sell), niche, ideal_client (free text), must_have text[], deal_breakers text[], avg_deal_value numeric, created_by, created_at` |
| `scout_searches` | One search = project + place | `id, project_id, country_code, city, bbox, radius_km, osm_tags text[] (AI-proposed, user-editable), web_queries text[], status (queued/finding/researching/done/failed), found, researched, limit (default 25), created_by, created_at` |
| `scout_places` | Each business **once, globally** | `id, fingerprint unique (normalized name + rounded lat/lng, or domain), name, category, address, city, country_code, lat, lng, website, phone, instagram, email_public, opening_hours, osm_id, source (osm/web/manual/google), first_seen_at, forgotten boolean` |
| `scout_leads` | A place judged for one project | `id, project_id, place_id, search_id, score 0–100, fit (strong/good/maybe/skip), worth_it boolean, why text, attack_with text (what to offer), approach jsonb ({channel, opener, best_time, who_to_ask_for, objections[]}), signals jsonb (evidence with source URLs), status (new/contacted/meeting/won/lost/ignored), owner_id, next_step_at, created_at` — unique `(project_id, place_id)` |
| `scout_research` | Raw evidence, so nothing is fetched twice | `place_id, url, fetched_at, text_excerpt (≤ 4 KB), robots_ok` — reused for 30 days |

- **No repeats:** before researching, look up `fingerprint`. If the place already has a lead for this project, skip it. If the place exists but has no lead for this project yet, reuse the stored research and only run the scoring. The UI shows "x new, y already known".
- **RLS:** every member can read. Writing is open to the groups that sell (Customer, Marketing) and to admins (`is_member()` for reading, a new `can_scout()` for writing). Members can change only the status and owner of leads assigned to them. Add permission tests in `supabase/tests/permissions_test.sql`.
- When a lead is moved to "contacted", optionally create a **prospect** in the existing Customer pipeline (`prospects`), so sales work stays in one place.

---

## 3. The scoring brain (`src/lib/scout/`)

Keep it pure and unit-tested, like `src/lib/lab/score.ts`. The AI fills in the evidence and the sub-scores; **the app does the maths**.

- **Step A, understand the project (one AI call per project, cached):** turn `offer + niche + ideal_client` into
  - OSM tags to search,
  - web search queries in the local language of the country,
  - the signals that make a business a good fit for this project (e.g. "has no online booking", "posts on Instagram less than once a month", "new opening", "sells products similar to ours", "has 4+ staff"),
  - deal-breakers.
  This step is what makes Scout work for any business type.
- **Step B, research one place:** gather OSM tags, the website text (≤ 3 pages), and a web search for "<name> <city>" (reviews, Instagram, news). Save it all to `scout_research` with the URLs.
- **Step C, judge:** the AI returns JSON (validated with a `normalize()` like the one in Idea lab) with these criteria, each scored 0–10 with a one-line reason and a source:
  1. **Need**: do they visibly have the problem we solve?
  2. **Fit**: do they match the ideal client and avoid the deal-breakers?
  3. **Ability to pay**: size, prices, location, staff.
  4. **Reachability**: can we reach a decision-maker? Do they have a phone, an Instagram, a walk-in shop?
  5. **Timing**: new opening, season, recent change, bad reviews about the thing we fix.
  6. **Deal value vs effort** for a 15-person student team.
  7. **Risk**: chain or franchise (decisions made at HQ), closed, hostile reviews.

  The weights live in code (`WEIGHTS`). `scoreOf()` → 0–100. `fitOf()` → strong ≥ 75, good ≥ 60, maybe ≥ 45, otherwise skip. `worth_it = score ≥ 60 && no deal-breaker`.
- **Step D, plan the attack (only for strong/good fits):**
  - what to offer first (the smallest paid or free step that proves value),
  - the channel,
  - a 2–3 sentence opener in the business's language, specific to them,
  - who to ask for,
  - the best time to visit or call (from opening hours),
  - 2 likely objections, each with an answer.
- Every claim has to cite evidence the app actually collected. If something is unknown, the AI says it's unknown. The prompt forbids invented facts, the same as Idea lab.
- **Knowledge for any business:** keep a compact `src/lib/scout/playbooks.ts` with sales patterns for each kind of business: B2B service, wholesale to retail shops, consignment, events/partnerships, local services, hospitality, education, health/beauty, real estate. Step A picks the closest playbook and adapts it. Don't duplicate long texts. Write short rules that a 20B model can follow.

---

## 4. Screens (new menu item **Scout**, `src/app/(app)/scout`)

1. **Projects**: list of projects, plus "New project". The form has offer, niche, ideal client, must-haves, deal-breakers and average deal value. A "From Idea lab" button pre-fills it from a chosen idea.
2. **Search**: a country picker (ISO list, localized names), a city field with autocomplete (Nominatim, debounced, cached) and a radius. Show the AI-proposed tags and queries as chips the user can edit before running. Then "Find clients".
3. **Results**: ranked lead cards.
   - Each card shows the score dial, the fit badge, a "worth it / skip" verdict, the 3 strongest reasons, what to attack with, and the channel.
   - Opening a card shows the full evidence with source links, the approach, the objections, and buttons: "Copy opener", "Open in Maps" (a plain `https://www.google.com/maps/search/?api=1&query=` link is fine), "Assign", "Mark contacted → create prospect", and "Forget".
   - Filters: fit, status, owner. There's a map view (OSM tiles via Leaflet, free) and a list view. Export to CSV.
4. **Check a place**: paste a Google Maps link, a website, or an Instagram URL, then pick the project. Scout gives the same verdict for one place and remembers it, so it won't come up again in searches.
5. **Pipeline**: all leads by status across projects, with "next step" dates. Leads due today show up on **Today** and in notifications (reuse the existing systems).

### The globe (for teammates who don't know how it works)

- A three.js globe drawn in the Summit style: topographic line-art Earth, project colour tokens, light and dark themes. Lazy-load it the way `mountain-lazy.tsx` does, and use a static fallback for `prefers-reduced-motion` and on low-power phones.
- When idle, it rotates slowly with soft pins in a few random cities ("Bilbao · cafés", "Helsinki · gyms", …) to show what Scout can do.
- When a search starts, the globe **flies to the chosen city** (an eased camera move), drops a pin, and pins pop in as places are found. Strong fits are drawn bigger and in the "climbed" colour.
- Next to the globe, a **live step log** explains in plain language what Scout is doing. These are status lines written by the app at each job step, **not** model chain-of-thought:
  - "Understanding your project → looking for: hair salons without online booking"
  - "Searching OpenStreetMap around Bilbao (5 km) → 63 places"
  - "Skipping 12 we already know"
  - "Reading peluqueriaxyz.es (3 pages)"
  - "Scoring: strong fit (82) — no booking, 4.6★, opened 2025"
  - "Done: 9 strong, 7 good, 21 skip"

  Each line links to the evidence behind it.
- On phones, the globe becomes a short header strip and the step log a collapsible card. No sideways scroll.

---

## 5. Idea lab upgrade: council + business skills

The Idea lab currently does research → one analysis → app-computed score (`src/lib/lab/ai.ts`, `score.ts`). Add:

1. **LLM Council** (from Alvaro's skill `~/Downloads/SKILL.md`; copy the method into `src/lib/lab/council.ts` in our own words, keeping it short). After the research, 5 advisors each judge the idea independently:
   - Contrarian
   - First-principles thinker
   - Expansionist
   - Outsider
   - Executor

   Then there's an **anonymous peer review**: each advisor sees the others' answers labelled A–E and says which is strongest, which is weakest, and what everyone missed. Finally a **chairman** writes the verdict: where they agree, where they clash, blind spots, and the one thing to do first.

   On Groq's free tier, run the 5 advisors on `gpt-oss-20b` with short outputs, the reviews in a single call, and the chairman on `gpt-oss-120b`. Run the calls one after another with the existing 429 handling, and save after each step so the run can resume.

   The **app score stays the official number**. The council is shown next to it as "What the council says", with each advisor collapsible. Store it in a new `lab_councils` table (idea_id, advisors jsonb, reviews jsonb, chairman jsonb, created_at). Anyone can "Run the council again" after the idea changes.
2. **Business checks taken from Alvaro's synced skills**, made general (they were written for his personal Spain store, so don't copy store-specific rules):
   - From **ecom-profit-check**: for any idea that sells a product, compute break-even ROAS = price ÷ (price − unit cost − fees), break-even CPA = price − unit cost − fees, and the margin in € and %. Flag it if the margin is below emet's 50% target or below a €-per-unit floor that admins can set. Show the maths, not just the verdict.
   - From **winning-product-research**: the "is it already working somewhere?" check. Look for proof of demand abroad (live ads in the Meta Ad Library, competitor stores, reviews) and record it as evidence with links. The Meta Ad Library is public, so link to it rather than scraping it.
   - Feed both into the existing criteria ("≥ 50% margin", "Demand") as evidence. Don't add new criteria, so old scores stay comparable.
3. When an idea gets a **strong** verdict, show a button: **"Find first clients with Scout"**. It creates a Scout project pre-filled from the idea.

---

## 6. Build order and checks

1. Migration + RLS + permission tests (apply locally first, then live through the Management API as before).
2. `src/lib/scout` pure functions (fingerprint, scoring, fit, OSM query builder, Maps-link parser) + unit tests.
3. API routes: `/api/scout/plan`, `/api/scout/step`, `/api/scout/check`. Each step stays under ~8 s. Rate limit to one running job per member.
4. Screens + globe + step log, built with the `frontend-design` / `impeccable` skills and checked at 375 px.
5. Idea lab council + business checks + the "Find first clients" button.
6. English strings, then the 6 translations (the sonnet subagent pattern), then `npm run check:i18n`.
7. Browser test with the local stack. For example: project "Instagram content for local cafés", Bilbao, 3 km. Check that no place repeats on a second run, and that pasting a Maps link works.
8. README (systems, decisions, open questions: Google Places on/off, who can scout), CHANGELOG, then commit, push, deploy (rsync method).

## 7. Open questions to ask the team (don't block the build on them)

- Who may run searches: everyone, or only Customer + Marketing?
- Daily search limit per member (each search uses that member's own Groq quota).
- Do we ever enable Google Places (needs a billing card, stays within the free cap)?
